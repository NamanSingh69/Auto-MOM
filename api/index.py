import os
import json
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from pydantic import BaseModel
from typing import List
import requests as http_requests
from gemini_model_resolver import generate_with_fallback, get_dynamic_cascade

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Pydantic schema for structured Gemini output
class MeetingMinutes(BaseModel):
    title: str
    date: str
    summary: str
    actionItems: List[str]
    decisions: List[str]


def _resolve_api_key():
    """Resolve Gemini API key from header or environment."""
    api_key = request.headers.get("X-Gemini-Key")
    if not api_key or not api_key.strip() or api_key == "null":
        api_key = os.environ.get("GEMINI_API_KEY")
    return api_key


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "AutoMOM-API"})


@app.route('/api/models', methods=['GET'])
def get_models():
    api_key = _resolve_api_key()
    if not api_key:
        return jsonify({"error": "Gemini API key missing"}), 401

    try:
        cascade = get_dynamic_cascade(api_key)
        return jsonify({
            "models": [{"name": f"models/{m}"} for m in cascade]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/get-upload-url', methods=['POST'])
def get_upload_url():
    """
    Generates a Google Resumable Upload URL that the frontend can use
    to upload large files directly to Gemini, bypassing the Vercel 4.5MB limit.
    """
    api_key = _resolve_api_key()
    if not api_key:
        return jsonify({"error": "Gemini API key missing"}), 401

    data = request.get_json(silent=True) or {}
    mime_type = data.get("mime_type", "audio/webm")
    content_length = data.get("content_length", 0)
    display_name = data.get("display_name", "meeting-media")

    try:
        url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable&key={api_key}"
        headers = {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": str(content_length),
            "X-Goog-Upload-Header-Content-Type": mime_type,
            "Content-Type": "application/json",
        }
        body = json.dumps({"file": {"display_name": display_name}})

        resp = http_requests.post(url, headers=headers, data=body, timeout=15)

        if resp.status_code != 200:
            return jsonify({"error": f"Google API returned {resp.status_code}: {resp.text}"}), resp.status_code

        upload_url = resp.headers.get("X-Goog-Upload-URL")
        if not upload_url:
            return jsonify({"error": "No upload URL returned from Google"}), 502

        return jsonify({"upload_url": upload_url}), 200

    except Exception as e:
        print(f"Error getting upload URL: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/synthesize', methods=['POST'])
def synthesize_minutes():
    """
    Accepts either:
    1. JSON body with { file_uri, file_name, model } — for direct-uploaded files
    2. multipart/form-data with 'media' or 'audio' field — legacy fallback for small files
    """
    api_key = _resolve_api_key()
    if not api_key:
        return jsonify({"error": "Gemini API key missing in headers or environment"}), 401

    genai.configure(api_key=api_key)

    content_type = request.content_type or ""

    # --- Path 1: JSON body (direct upload) ---
    if "application/json" in content_type:
        data = request.get_json(silent=True) or {}
        file_uri = data.get("file_uri")
        file_name = data.get("file_name")
        requested_model = data.get("model", "gemini-3.1-pro")

        if not file_uri and not file_name:
            return jsonify({"error": "Missing file_uri or file_name in JSON body"}), 400

        try:
            # Retrieve the file reference from Gemini using the file name
            gemini_file = genai.get_file(file_name)

            response, model_used = generate_with_fallback(
                api_key=api_key,
                initial_model=requested_model,
                contents=[gemini_file, "Synthesize meeting minutes from this media into the required JSON schema."],
                system_instruction="You are a professional Executive Assistant synthesizing meeting minutes from the provided audio/video. Identify action items and key decisions. Output strictly in the requested JSON format.",
                response_schema=MeetingMinutes,
                response_mime_type="application/json"
            )

            try:
                payload = json.loads(response.text)
                payload["_model_used"] = model_used
            except Exception:
                payload = {"error": "Failed to parse API output"}

            # Cleanup remote file
            try:
                genai.delete_file(gemini_file.name)
            except:
                pass

            return jsonify(payload), 200

        except Exception as e:
            print(f"Error synthesizing (JSON path): {str(e)}")
            return jsonify({"error": str(e)}), 500

    # --- Path 2: multipart/form-data (legacy/small files) ---
    media_file = request.files.get('media') or request.files.get('audio')
    if not media_file:
        return jsonify({"error": "No media file uploaded"}), 400

    if media_file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    try:
        from werkzeug.utils import secure_filename

        mime_type = media_file.mimetype if media_file.mimetype else "audio/webm"
        filename = secure_filename(media_file.filename) if media_file.filename else "meeting.webm"
        ext = os.path.splitext(filename)[1] or ".webm"

        _, temp_path = tempfile.mkstemp(suffix=ext)
        media_file.save(temp_path)

        requested_model = request.form.get("model", "gemini-3.1-pro")

        print(f"Uploading to Gemini File API... ({ext}, {mime_type})")
        gemini_file = genai.upload_file(temp_path, mime_type=mime_type)

        response, model_used = generate_with_fallback(
            api_key=api_key,
            initial_model=requested_model,
            contents=[gemini_file, "Synthesize meeting minutes from this media into the required JSON schema."],
            system_instruction="You are a professional Executive Assistant synthesizing meeting minutes from the provided audio/video. Identify action items and key decisions. Output strictly in the requested JSON format.",
            response_schema=MeetingMinutes,
            response_mime_type="application/json"
        )

        try:
            payload = json.loads(response.text)
            payload["_model_used"] = model_used
        except Exception:
            payload = {"error": "Failed to parse API output"}

        try:
            genai.delete_file(gemini_file.name)
            os.remove(temp_path)
        except:
            pass

        return jsonify(payload), 200

    except Exception as e:
        print(f"Error synthesizing media: {str(e)}")
        return jsonify({"error": str(e)}), 500


# Serverless entrypoint for Vercel
if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))

import sys
import os
# Ensure this file's directory (api/) is on the path so local modules
# like gemini_model_resolver are importable when Vercel CWD is /var/task
sys.path.insert(0, os.path.dirname(__file__))

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
            # File should already be ACTIVE (frontend polls before calling this)
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

import os
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from pydantic import BaseModel
from typing import List
import requests
from gemini_model_resolver import generate_with_fallback, get_dynamic_cascade

app = Flask(__name__)
# Enable CORS for local testing, assuming frontend is on port 5173
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Pydantic schema for structured Gemini output
class MeetingMinutes(BaseModel):
    title: str
    date: str
    summary: str
    actionItems: List[str]
    decisions: List[str]

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "AutoMOM-API"})

@app.route('/api/models', methods=['GET'])
def get_models():
    api_key = request.headers.get("X-Gemini-Key")
    if not api_key or not api_key.strip() or api_key == "null":
        api_key = os.environ.get("GEMINI_API_KEY")
        
    if not api_key:
        return jsonify({"error": "Gemini API key missing"}), 401

    try:
        cascade = get_dynamic_cascade(api_key)
        # Emulate the Google API format so the frontend dropdown works out-of-the-box
        return jsonify({
            "models": [{"name": f"models/{m}"} for m in cascade]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/synthesize', methods=['POST'])
def synthesize_minutes():
    api_key = request.headers.get("X-Gemini-Key")
    if not api_key or not api_key.strip() or api_key == "null":
        api_key = os.environ.get("GEMINI_API_KEY")
        
    if not api_key:
        return jsonify({"error": "Gemini API key missing in headers or environment"}), 401

    if 'audio' not in request.files:
        return jsonify({"error": "No audio file uploaded"}), 400

    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    try:
        # Save audio to a temporary file for Gemini SDK
        _, temp_path = tempfile.mkstemp(suffix=".webm")
        audio_file.save(temp_path)

        requested_model = request.form.get("model", "gemini-3.1-pro")
        
        # Configure Gemini
        genai.configure(api_key=api_key)

        # Upload the audio file to Google's File API for multimodal processing
        print("Uploading to Gemini File API...")
        gemini_file = genai.upload_file(temp_path, mime_type="audio/webm")

        response, model_used = generate_with_fallback(
            api_key=api_key,
            initial_model=requested_model,
            contents=[gemini_file, "Summarize this meeting audio into the required JSON schema."],
            system_instruction="You are a professional Executive Assistant synthesizing meeting minutes from the provided audio. Identify action items and key decisions. Output strictly in the requested JSON format.",
            response_schema=MeetingMinutes,
            response_mime_type="application/json"
        )

        import json
        try:
            payload = json.loads(response.text)
            payload["_model_used"] = model_used
        except Exception:
            payload = {"error": "Failed to parse API output"}

        # Cleanup the file from Gemini and Local
        try:
            genai.delete_file(gemini_file.name)
            os.remove(temp_path)
        except:
            pass

        return jsonify(payload), 200

    except Exception as e:
        print(f"Error synthesizing audio: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Serverless entrypoint for Vercel
if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))

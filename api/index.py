import os
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from pydantic import BaseModel
from typing import List
import requests

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
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY") or "REDACTED_API_KEY"
        
    if not api_key:
        return jsonify({"error": "Gemini API key missing"}), 401

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        response = requests.get(url)
        if response.status_code != 200:
            return jsonify(response.json()), response.status_code
        return jsonify(response.json()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/synthesize', methods=['POST'])
def synthesize_minutes():
    api_key = request.headers.get("X-Gemini-Key")
    if not api_key or not api_key.strip() or api_key == "null":
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY") or "REDACTED_API_KEY"
        
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

        requested_model = request.form.get("model", "gemini-1.5-flash")
        
        # Configure Gemini
        genai.configure(api_key=api_key)

        # Upload the audio file to Google's File API for multimodal processing
        print("Uploading to Gemini File API...")
        gemini_file = genai.upload_file(temp_path, mime_type="audio/webm")

        # Define the model and instruction
        model = genai.GenerativeModel(
            model_name=requested_model, 
            system_instruction="You are a professional Executive Assistant synthesizing meeting minutes from the provided audio. Identify action items and key decisions. Output strictly in the requested JSON format."
        )

        response = model.generate_content(
            [gemini_file, "Summarize this meeting audio into the required JSON schema."],
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=MeetingMinutes
            )
        )

        # Cleanup the file from Gemini and Local
        try:
            genai.delete_file(gemini_file.name)
            os.remove(temp_path)
        except:
            pass

        return response.text, 200, {'Content-Type': 'application/json'}

    except Exception as e:
        print(f"Error synthesizing audio: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Serverless entrypoint for Vercel
if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('PORT', 5000)))

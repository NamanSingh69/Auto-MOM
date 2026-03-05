# Google Meet Audio Recorder Bot

A Python automation script that launches a browser, joins a Google Meet session, and records the meeting audio (system output) to a WAV file. It utilizes **Playwright** for browser automation and **Soundcard** for audio loopback recording.

## 🚀 Features

- **Automated Joining:** Navigates to the URL, disables Mic/Cam, and clicks "Join".
- **Audio Recording:** Captures system audio (what you hear) directly to a `.wav` file.
- **Login Persistence:** Saves browser cookies locally so you don't have to log in every time.
- **Auto-Exit:** Detects when the meeting is over (e.g., "You're the only one here") and closes automatically.
- **Protocol Fix:** Automatically handles URLs whether you type `meet.google.com/...` or `https://...`.

## 📋 Prerequisites

*   **OS:** Windows is recommended (specifically for WASAPI Loopback audio recording). Mac/Linux requires specific PulseAudio/BlackHole configurations for `soundcard`.
*   **Python:** Version 3.8 or higher.
*   **Google Chrome:** The script uses the installed Chrome channel by default.

## 🛠️ Installation

1.  **Clone or Download this repository.**

2.  **Install Python Dependencies:**
    ```bash
    pip install playwright soundcard soundfile numpy
    ```

3.  **Install Playwright Browsers:**
    ```bash
    playwright install chromium
    ```

## 🏃 Usage

1.  Run the script:
    ```bash
    python bot_engine.py
    ```

2.  **Paste the Google Meet URL** when prompted. 
    *   *Example:* `meet.google.com/abc-defg-hij`

3.  **First Run (Login):**
    *   Since this is a new browser instance, you will likely see a "Sign In" button.
    *   **Action:** Manually log in to your Google Account in the opened browser window.
    *   Once logged in, press `ENTER` in the terminal to continue.
    *   *Note:* Your session is saved in the `./bot_profile` folder, so you shouldn't need to log in again next time.

4.  **During the Meeting:**
    *   The bot will sit in the call.
    *   **Do not play other audio** (YouTube, Spotify) on your computer, as this script records *System Loopback* (everything playing out of your speakers).

5.  **Stopping:**
    *   The bot attempts to auto-close when the meeting ends.
    *   To stop manually, press `Ctrl+C` in the terminal or close the browser window.

## 📂 Configuration

You can modify the top section of `bot_engine.py` to change settings:

```python
OUTPUT_FILENAME = "meeting_recording.wav"  # Output file name
SAMPLE_RATE = 44100                        # Audio quality
BOT_PROFILE_DIR = "./bot_profile"          # Where login cookies are stored
```

## ⚠️ Known Issues & Troubleshooting

### 1. Audio Recording Error (Loopback)
If you see an error regarding `include_loopback=True`, it means your OS or Audio Driver does not support WASAPI loopback easily.
*   **Fix:** Ensure you are on Windows. If on Mac/Linux, you may need to install `pyaudio` or configure a virtual audio cable.

### 2. Google Login Blocking
Google sometimes blocks automation browsers ("This browser or app may not be secure").
*   **Fix:** The script uses `launch_persistent_context` to mimic a real user profile. If blocked, try logging in manually once, or use a specific user agent in the Playwright launch arguments.

### 3. Join Button Not Found
Google changes their UI frequently. If the bot hangs at the "Ready to join?" screen:
*   You can manually click "Join" or "Ask to Join" in the browser window. The recording will start once the bot detects the "Leave call" button is visible.

## ⚖️ Legal Disclaimer

**Please respect privacy laws.** Recording conversations without the consent of all parties is illegal in many jurisdictions. Always ask for permission before recording a meeting. This tool is for educational purposes only.
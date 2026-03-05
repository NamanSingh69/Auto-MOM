# Auto MOM (Minutes of Meeting Bot) — Technical Report

## Architecture Overview

| Component | Technology |
|-----------|-----------|
| Language | Python 3.x |
| Browser Automation | Playwright |
| Audio Capture | Soundcard, SoundFile |
| Platform | Desktop only (requires audio hardware) |

### Pipeline
```
[Meeting URL] → [Playwright Browser] → [Join Meeting Automatically]
                                             ↓
                              [Soundcard Audio Capture (Loopback)]
                                             ↓
                              [WAV Recording] → [Audio File Output]
```

## Study Findings

- **Purpose**: Automated meeting attendance and audio recording bot
- **Browser Control**: Playwright launches Chromium, navigates to meeting URL, handles join flow
- **Audio**: Captures system audio via Soundcard's loopback recording (records what speakers output)
- **Requirements**: Physical/virtual audio device, desktop OS with audio loopback support
- **Deployment Verdict**: ❌ **Not deployable on free tier** — Requires desktop environment with audio hardware, browser rendering, and GUI. Not suitable for headless server deployment.

## Local Setup Guide

```bash
# 1. Navigate to project
cd "Auto MOM"

# 2. Setup Python environment
python -m venv venv
venv\Scripts\activate

# 3. Install dependencies
pip install playwright soundcard soundfile

# 4. Install Playwright browsers
playwright install chromium

# 5. Run the bot
python bot_engine.py
# Note: Requires an active audio output device for loopback recording
```

## 🔑 API Keys
No API keys required — operates locally with browser automation.

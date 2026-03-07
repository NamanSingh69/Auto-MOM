import time
import threading
import warnings
import soundcard as sc
import soundfile as sf
from playwright.sync_api import sync_playwright

# --- CONFIGURATION ---
OUTPUT_FILENAME = "meeting_recording.wav"
SAMPLE_RATE = 44100
BOT_PROFILE_DIR = "./bot_profile"

# Suppress warnings
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", module="soundcard")

class AudioRecorder:
    def __init__(self, filename):
        self.filename = filename
        self.recording = False
        self.thread = None

    def start(self):
        self.recording = True
        self.thread = threading.Thread(target=self._record_loop)
        self.thread.start()
        print(f"[Audio] Recording started... saving to {self.filename}")

    def stop(self):
        print("[Audio] Stopping recording...")
        self.recording = False
        if self.thread:
            self.thread.join()
        print("[Audio] File saved.")

    def _record_loop(self):
        try:
            # Note: loopback=True usually requires Windows (WASAPI)
            mic = sc.get_microphone(id=str(sc.default_speaker().name), include_loopback=True)
            with sf.SoundFile(self.filename, mode='w', samplerate=SAMPLE_RATE, channels=2) as file:
                with mic.recorder(samplerate=SAMPLE_RATE) as recorder:
                    while self.recording:
                        data = recorder.record(numframes=int(SAMPLE_RATE * 0.5))
                        file.write(data)
        except Exception as e:
            print(f"[Error] Audio recording failed: {e}")

def run_bot():
    meet_url = input("Enter Google Meet URL: ").strip()
    
    # --- AUTO-FIX URL ---
    if not meet_url.startswith("http"):
        meet_url = "https://" + meet_url

    recorder = AudioRecorder(OUTPUT_FILENAME)

    with sync_playwright() as p:
        print("[System] Launching browser...")
        try:
            browser = p.chromium.launch_persistent_context(
                user_data_dir=BOT_PROFILE_DIR,
                channel="chrome",
                headless=False,
                args=["--use-fake-ui-for-media-stream", "--disable-blink-features=AutomationControlled"]
            )
            page = browser.pages[0]
        except Exception as e:
            print(f"[Error] Browser launch failed: {e}")
            return

        try:
            print(f"[Bot] Navigating to {meet_url}...")
            page.goto(meet_url)

            # --- LOGIN CHECK ---
            if page.get_by_text("Sign in").is_visible() or "ServiceLogin" in page.url:
                print("\n!!! ACTION REQUIRED: Log in manually, then press ENTER here !!!")
                input()

            # --- TURN OFF MIC & CAM ---
            print("[Bot] Disabling Mic and Camera...")
            try:
                page.keyboard.press("Control+d")
                time.sleep(0.5)
                page.keyboard.press("Control+e")
                time.sleep(0.5)
                print("[Bot] Mic/Cam disabled via shortcuts.")
            except:
                print("[Warning] Could not disable Mic/Cam automatically.")

            # --- JOINING ---
            print("[Bot] Attempting to join...")
            try:
                # Look for Join button (selectors may vary)
                btn = page.locator("button").filter(has_text="Join").first
                if not btn.is_visible():
                    btn = page.locator("button").filter(has_text="Ask to join").first
                
                if btn.is_visible():
                    btn.click()
                else:
                    print("[Bot] Join button not found. Please click manually.")
            except:
                pass

            print("[Bot] Waiting for meeting to start (Detecting 'Leave call' button)...")
            try:
                page.wait_for_selector("button[aria-label='Leave call']", timeout=60000)
                print("[Bot] Successfully joined! Recording active.")
            except:
                print("[Bot] Timed out waiting to join. Check if you are stuck in the lobby.")

            # --- RECORDING LOOP ---
            recorder.start()

            while True:
                if page.is_closed():
                    print("[Bot] Browser closed by user.")
                    break
                
                # --- AUTO-LEAVE CHECKS ---
                if page.get_by_text("You're the only one here").is_visible():
                    print("[Bot] Meeting ended (Only one left).")
                    break
                
                if page.get_by_text("No one else is here").is_visible():
                    print("[Bot] Meeting ended (No one else here).")
                    break

                if "meet.google.com/landing" in page.url:
                    print("[Bot] Returned to home screen.")
                    break
                
                time.sleep(1)

        except KeyboardInterrupt:
            print("\n[Bot] Manual Stop.")
        except Exception as e:
            print(f"[Error] {e}")
        finally:
            recorder.stop()
            try: browser.close()
            except: pass
            print(f"[System] DONE. Audio file: {OUTPUT_FILENAME}")

if __name__ == "__main__":
    run_bot()
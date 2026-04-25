from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import json
import os
import sys
import uuid
from datetime import datetime, time
import threading
import signal
import webbrowser


def _bundle_dir() -> str:
    """PyInstaller onefile extract, or repo folder (where `app.py` / `build/` live)."""
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def _writable_dir() -> str:
    """User data next to the .exe when frozen; same as bundle dir when running from source."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


_BUNDLE = _bundle_dir()
_WRITABLE = _writable_dir()

app = Flask(__name__, static_folder=os.path.join(_BUNDLE, "build"), static_url_path="/")
CORS(app)

DATA_FILE = os.path.join(_WRITABLE, "data.json")
UPLOAD_FOLDER = os.path.join(_WRITABLE, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

scheduler = BackgroundScheduler()
scheduler.start()

# Serialize play_state updates + /api/status so only one client reads play_trigger per fire.
play_state_lock = threading.RLock()

play_state = {
    "current_playing": None,
    "play_trigger": None,
    "current_audio_path": None,
    "current_label": None,
    "current_event_at": None,
    "last_trigger": None,
    "play_start_time": None
}

# ---------------- FRONTEND (INDEX.HTML / REACT BUILD) ----------------

@app.route('/')
def serve_root():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def serve_any(path):
    # If file exists in build folder -> serve it
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)

    # Otherwise return React index.html (important for routing)
    return app.send_static_file('index.html')

# ---------------- SCHEDULE LOGIC ----------------

def load_schedules():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"schedules": []}

def save_schedules(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def normalize_event_at_hhmm(event_at):
    """
    Compare schedules using clock HH:MM only so '08:30' and '08:30:00' both match strftime('%H:%M').
    Returns None if the value cannot be parsed.
    """
    if event_at is None:
        return None
    s = str(event_at).strip()
    if not s:
        return None
    try:
        t = time.fromisoformat(s)
        return f"{t.hour:02d}:{t.minute:02d}"
    except ValueError:
        return None


def start_play(schedule_id, audio_path, label, event_at):
    with play_state_lock:
        play_state["current_playing"] = schedule_id
        play_state["current_audio_path"] = audio_path
        play_state["current_label"] = label
        play_state["current_event_at"] = event_at


def trigger_auto_play(schedule_id, audio_path, label, event_at):
    with play_state_lock:
        play_state["current_playing"] = schedule_id
        play_state["current_audio_path"] = audio_path
        play_state["current_label"] = label
        play_state["current_event_at"] = event_at
        # Unique each fire so the frontend does not ignore repeats (same id next day / same minute retry).
        play_state["play_trigger"] = f"{schedule_id}:{int(datetime.now().timestamp() * 1000)}"
        play_state["play_start_time"] = datetime.now()

def open_browser(url):
    """Open the default web browser."""
    webbrowser.open(url)

def clear_play():
    with play_state_lock:
        play_state["current_playing"] = None
        play_state["play_trigger"] = None
        play_state["current_audio_path"] = None
        play_state["current_label"] = None
        play_state["current_event_at"] = None
        play_state["play_start_time"] = None


def check_schedules():
    now = datetime.now()
    current_time = now.strftime("%H:%M")
    data = load_schedules()
    with play_state_lock:
        # Auto-clear current_playing if we've moved past that minute
        if play_state["current_playing"] is not None:
            ev_norm = normalize_event_at_hhmm(play_state["current_event_at"])
            if ev_norm and ev_norm != current_time:
                clear_play()
            # Safety: clear if it's been playing for more than 2 minutes (frontend might have crashed)
            elif play_state["play_start_time"]:
                elapsed = (now - play_state["play_start_time"]).total_seconds()
                if elapsed > 120:
                    clear_play()

        # Don't check for new schedules while something is playing
        if play_state["current_playing"] is not None:
            return

        # Stable order when two slots share the same HH:MM (id tie-breaks).
        schedules_sorted = sorted(
            data["schedules"],
            key=lambda s: (
                normalize_event_at_hhmm(s.get("event_at")) or "99:99",
                str(s.get("id", "")),
            ),
        )
        for schedule in schedules_sorted:
            event_at = schedule.get("event_at", "")
            enabled = schedule.get("enabled", False)
            sched_hhmm = normalize_event_at_hhmm(event_at)
            if not enabled or not sched_hhmm or sched_hhmm != current_time:
                continue
            # Include calendar date so the same clock time fires again on a new day while the server runs.
            trigger_key = f"{schedule['id']}_{now.strftime('%Y-%m-%d')}_{current_time}"
            if trigger_key != play_state["last_trigger"]:
                play_state["last_trigger"] = trigger_key
                trigger_auto_play(
                    schedule["id"],
                    schedule["audio_path"],
                    schedule["label"],
                    schedule["event_at"],
                )
                break


scheduler.add_job(
    check_schedules,
    "interval",
    seconds=1,
    max_instances=1,
    coalesce=True,
    id="check_schedules",
    replace_existing=True,
)

_SI_WEEKDAY_EN_TO_SI = {
    "Monday": "සඳුදා",
    "Tuesday": "අඟහරුවාදා",
    "Wednesday": "බදාදා",
    "Thursday": "බ්‍රහස්පතින්දා",
    "Friday": "සිකුරාදා",
    "Saturday": "සෙනසුරාදා",
    "Sunday": "ඉරිදා",
}


def _format_datetime_sinhala(now: datetime) -> str:
    s = now.strftime("%A %Y-%m-%d %I:%M:%S %p")
    for en, si in _SI_WEEKDAY_EN_TO_SI.items():
        s = s.replace(en, si)
    return s.replace(" AM", " පෙ.ව.").replace(" PM", " ප.ව.")


# ---------------- API ROUTES ----------------

@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    data = load_schedules()
    # Sort schedules by event_at in ascending order
    data["schedules"].sort(key=lambda s: s.get("event_at", ""))
    return jsonify(data["schedules"])

@app.route('/api/schedules', methods=['POST'])
def create_schedule():
    data = request.json
    if not data.get("event_at"):
        return jsonify({"error": "event_at අවශ්‍යයි"}), 400
    try:
        time.fromisoformat(data["event_at"])
    except ValueError:
        return jsonify({"error": "event_at ආකෘතිය වලංගු නොවේ"}), 400
    schedules_data = load_schedules()
    schedule_id = str(uuid.uuid4())
    schedule = {
        "id": schedule_id,
        "event_at": data["event_at"],
        "label": data["label"],
        "enabled": data.get("enabled", True),
        "audio_name": data["audio_name"],
        "audio_path": data["audio_path"]
    }
    schedules_data["schedules"].append(schedule)
    save_schedules(schedules_data)
    return jsonify(schedule), 201

@app.route('/api/schedules/<schedule_id>', methods=['PUT'])
def update_schedule(schedule_id):
    data = request.json
    if "event_at" in data and not data["event_at"]:
        return jsonify({"error": "event_at හිස් විය නොහැක"}), 400
    if "event_at" in data:
        try:
            time.fromisoformat(data["event_at"])
        except ValueError:
            return jsonify({"error": "event_at ආකෘතිය වලංගු නොවේ"}), 400
    schedules_data = load_schedules()
    for schedule in schedules_data["schedules"]:
        if schedule["id"] == schedule_id:
            schedule.update(data)
            save_schedules(schedules_data)
            return jsonify(schedule)
    return jsonify({"error": "කාලසටහන හමු නොවීය"}), 404

@app.route('/api/schedules/<schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    schedules_data = load_schedules()
    schedules_data["schedules"] = [s for s in schedules_data["schedules"] if s["id"] != schedule_id]
    save_schedules(schedules_data)
    return jsonify({"message": "මකන ලදී"})

@app.route('/api/upload-audio', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return jsonify({"error": "ගොනුවක් නැත"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "ගොනුවක් තෝරා නැත"}), 400
    ext = os.path.splitext(file.filename)[1]
    filename = str(uuid.uuid4()) + ext
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    return jsonify({
        "audio_name": file.filename,
        "audio_path": f"/api/uploads/{filename}"
    })

@app.route('/api/uploads/<filename>')
def get_upload(filename):
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(filepath):
        return send_from_directory(UPLOAD_FOLDER, filename)
    else:
        return "ගොනුව හමු නොවීය", 404

@app.route('/api/ping')
def ping():
    return jsonify({"status": "ok"})

@app.route('/api/play/<schedule_id>', methods=['POST'])
def play_schedule(schedule_id):
    schedules_data = load_schedules()
    for schedule in schedules_data["schedules"]:
        if schedule["id"] == schedule_id:
            start_play(schedule_id, schedule["audio_path"], schedule["label"], schedule["event_at"])
            return jsonify(schedule)
    return jsonify({"error": "කාලසටහන හමු නොවීය"}), 404

@app.route('/api/test-play', methods=['POST'])
def test_play():
    data = request.json
    audio_path = data.get("audio_path")
    label = data.get("label", "Test Audio")
    event_at = data.get("event_at", "")
    if not audio_path:
        return jsonify({"error": "ශ්‍රව්‍ය මාර්ගය ලබා දී නැත"}), 400
    test_id = f"test_{uuid.uuid4()}"
    start_play(test_id, audio_path, label, event_at)
    return jsonify({
        "id": test_id,
        "audio_path": audio_path,
        "label": label,
        "event_at": event_at
    })

@app.route('/api/stop', methods=['POST'])
def stop_audio():
    clear_play()
    return jsonify({"status": "stopped"})

@app.route("/api/status")
def get_status():
    now = datetime.now()
    data = load_schedules()
    enabled_schedules = [s for s in data["schedules"] if s["enabled"]]
    next_event = None
    next_event_at = None
    time_remaining = None

    if enabled_schedules:
        # Match the React overlay: "next" is the first enabled slot strictly after the
        # current clock minute (HH:MM), not after now.time() with seconds — that could
        # disagree with the UI and hide time_remaining after one item finishes.
        current_hhmm = now.strftime("%H:%M")
        future_schedules = []
        for s in enabled_schedules:
            ev_norm = normalize_event_at_hhmm(s.get("event_at"))
            if ev_norm and ev_norm > current_hhmm:
                future_schedules.append(s)

        if future_schedules:
            next_schedule = min(
                future_schedules,
                key=lambda sch: normalize_event_at_hhmm(sch.get("event_at")) or "99:99",
            )
            try:
                next_time = time.fromisoformat(str(next_schedule["event_at"]).strip())
            except ValueError:
                next_time = None
            if next_time is not None:
                next_dt = datetime.combine(now.date(), next_time)
                total_sec = int((next_dt - now).total_seconds())
                if total_sec > 0:
                    hours, remainder = divmod(total_sec, 3600)
                    minutes, seconds = divmod(remainder, 60)
                    time_remaining = f"පැය {hours} මිනිත්තු {minutes} තත්පර {seconds}"
                    next_event = next_schedule["label"]
                    next_event_at = normalize_event_at_hhmm(next_schedule.get("event_at"))

    with play_state_lock:
        trigger_for_client = play_state["play_trigger"]
        play_state["play_trigger"] = None
        response = {
            "current_time": _format_datetime_sinhala(now),
            "next_event": next_event,
            "next_event_at": next_event_at,
            "time_remaining": time_remaining,
            "playing": play_state["current_playing"] is not None,
            "current_playing": play_state["current_playing"],
            "play_trigger": trigger_for_client,
            "audio_path": play_state["current_audio_path"],
            "label": play_state["current_label"],
            "event_at": play_state["current_event_at"],
        }

    return jsonify(response)


def _shutdown_server():
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    try:
        os.kill(os.getpid(), signal.SIGINT)
    except Exception:
        pass


@app.route('/exit', methods=['GET'])
def exit_app():
    threading.Thread(target=_shutdown_server, daemon=True).start()
    return jsonify({"message": "සේවාදායකය නිවා දමමින්..."})


if __name__ == "__main__":
    # Avoid a second browser window if you already use the desktop shell (set SKIP_OPEN_BROWSER=1).
    # if os.environ.get("SKIP_OPEN_BROWSER", "").strip().lower() not in ("1", "true", "yes"):
    #     open_browser("http://localhost:5000/")
    app.run(debug=False, use_reloader=False, use_debugger=False, port=5000)
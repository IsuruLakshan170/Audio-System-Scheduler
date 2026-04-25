"""
Native desktop shell for the same React UI.

Default: Flask serves the `build/` bundle on 127.0.0.1:5000; pywebview shows it.
With --dev: pywebview loads the CRA dev server on port 3000 (run `npm start` first);
Flask still runs on 5000 for the API.

Prerequisites (default mode):
  1) npm run build   (so build/index.html exists)
  2) py -3 -m pip install -r requirements.txt

Prerequisites (--dev):
  1) npm start       (CRA on http://127.0.0.1:3000)
  2) py -3 -m pip install -r requirements.txt

Run: py -3 desktop_shell.py
Dev: py -3 desktop_shell.py --dev
"""
from __future__ import annotations

import argparse
import os
import sys
import threading
import time
import urllib.error
import urllib.request

def _root_dir() -> str:
    """Project root in source; PyInstaller extract when frozen (same as bundled `build/`)."""
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


ROOT = _root_dir()
BUILD_INDEX = os.path.join(ROOT, "build", "index.html")
FLASK_ORIGIN = "http://127.0.0.1:5000"
PING_URL = f"{FLASK_ORIGIN}/api/ping"
DEV_UI_ORIGIN = "http://127.0.0.1:3000"


def _wait_for_flask(timeout_sec: float = 45.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            urllib.request.urlopen(PING_URL, timeout=2)
            return True
        except (urllib.error.URLError, OSError):
            time.sleep(0.15)
    return False


def _wait_for_cra_dev_server(timeout_sec: float = 120.0) -> bool:
    """Poll CRA default dev server until it responds."""
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            urllib.request.urlopen(DEV_UI_ORIGIN + "/", timeout=2)
            return True
        except (urllib.error.URLError, OSError):
            time.sleep(0.25)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Audio scheduler desktop window (Flask + pywebview).")
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Load UI from CRA dev server (port 3000). Start `npm start` first. Flask still serves API on 5000.",
    )
    args = parser.parse_args()

    if not args.dev:
        if not os.path.isfile(BUILD_INDEX):
            print("Run `npm run build` first so the `build/` folder exists.", file=sys.stderr)
            print("Or use --dev with `npm start` for live development UI.", file=sys.stderr)
            sys.exit(1)

    import app as flask_module

    def run_flask() -> None:
        flask_module.app.run(
            host="127.0.0.1",
            port=5000,
            debug=False,
            use_reloader=False,
            use_debugger=False,
            threaded=True,
        )

    threading.Thread(target=run_flask, daemon=True).start()

    if not _wait_for_flask():
        print("Backend did not become ready in time.", file=sys.stderr)
        sys.exit(1)

    if args.dev:
        if not _wait_for_cra_dev_server():
            print(
                "React dev server did not respond at "
                f"{DEV_UI_ORIGIN}. Start it from the project root: npm start",
                file=sys.stderr,
            )
            sys.exit(1)
        start_url = DEV_UI_ORIGIN + "/"
    else:
        start_url = FLASK_ORIGIN + "/"

    import webview

    title = "දහම් පාසල් ශ්‍රව්‍ය කළමනාකරණ පද්ධතිය"
    # maximized = fill screen with normal title bar (minimize / maximize / close).
    # Do not use fullscreen=True here — that hides the window chrome.
    webview.create_window(
        title,
        start_url,
        width=1280,
        height=800,
        min_size=(960, 600),
        maximized=True,
        resizable=True,
    )
    webview.start(debug=False)


if __name__ == "__main__":
    main()

"""
Build a single-file Windows .exe for the native desktop app (desktop_shell + Flask + webview).

Same idea as dep.py: run the React production build, then PyInstaller.

Prerequisites:
  pip install pyinstaller
  npm install

Output:
  dist/AudioScheduler.exe

Run from project root:
  py -3 dep_desktop.py
"""
from __future__ import annotations

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

# Step 1: production React bundle (Flask serves build/)
print("Step 1: npm run build")
if subprocess.call("npm run build", shell=True) != 0:
    print("npm run build failed.", file=sys.stderr)
    sys.exit(1)

# Step 2: PyInstaller — mirror dep.py; optional myicon.ico if present
icon = os.path.join(ROOT, "myicon.ico")
icon_arg = f'--icon=myicon.ico ' if os.path.isfile(icon) else ""

# --noconsole: no black console behind the GUI
# --add-data: bundle build/ for Flask static files (Windows: source;dest)
# Use `python -m PyInstaller` so the CLI works when `pyinstaller` is not on PATH.
py = sys.executable
cmd = (
    f'"{py}" -m PyInstaller --onefile --noconsole --name AudioScheduler '
    f'{icon_arg}'
    f'--add-data "build;build" '
    f'--hidden-import=webview '
    f'desktop_shell.py'
)

print("Step 2:", cmd)
if subprocess.call(cmd, shell=True) != 0:
    print("PyInstaller failed.", file=sys.stderr)
    sys.exit(1)

print("Done: dist/AudioScheduler.exe")
print("Place data.json beside the exe on first run if migrating; uploads/ is created automatically.")

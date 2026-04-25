@echo off

REM Build dist\AudioScheduler.exe (npm run build + PyInstaller). Requires: pip install -r requirements-build.txt



cd /d "%~dp0"

py -3 dep_desktop.py

if errorlevel 1 pause



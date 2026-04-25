@echo off
title Stop Audio Scheduler
echo Stopping servers on ports 5000 and 3000...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-all.ps1"
echo.
pause

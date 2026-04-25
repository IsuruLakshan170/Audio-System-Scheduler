@echo off
echo Starting Audio Scheduler Web App...

echo Starting backend server...
start cmd /k "cd backend && python app.py"

timeout /t 5 /nobreak > nul

echo Starting frontend server...
start cmd /k "cd frontend && npm start"

echo Both servers are starting. Backend at http://localhost:5000, Frontend at http://localhost:3000
pause
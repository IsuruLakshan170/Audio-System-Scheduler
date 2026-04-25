Write-Host "Starting Audio Scheduler Web App..." -ForegroundColor Green

Write-Host "Starting backend server..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k cd backend && python app.py"

Start-Sleep -Seconds 5

Write-Host "Starting frontend server..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k cd frontend && npm start"

Write-Host "Both servers are starting. Backend at http://localhost:5000, Frontend at http://localhost:3000" -ForegroundColor Green
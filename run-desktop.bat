@echo off



REM Rebuilds the React bundle, then opens the native window (Flask + pywebview).

REM For live dev UI without rebuilding, use: npm start  then  py -3 desktop_shell.py --dev



cd /d "%~dp0"



call npm run build

if errorlevel 1 (

  echo npm run build failed.

  pause

  exit /b 1

)



py -3 desktop_shell.py



if errorlevel 1 pause





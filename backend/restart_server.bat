@echo off
echo Stopping any existing backend server...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" 2>nul
timeout /t 2 /nobreak >nul
echo Starting backend server...
cd /d %~dp0
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause


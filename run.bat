@echo off
title ClipForge AI Launcher
echo ===================================================
echo             ClipForge AI Launcher
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking environment...
if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment 'venv' not found in this folder.
    pause
    exit /b 1
)

echo [2/3] Launching FastAPI Backend (http://127.0.0.1:8000)...
start "ClipForge AI - Backend" cmd /k "cd /d ""%~dp0"" && .\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Launching Frontend Development Server (http://127.0.0.1:5173)...
start "ClipForge AI - Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo ===================================================
echo  ClipForge AI is starting!
echo  - Frontend Web App: http://localhost:5173
echo  - Backend API:      http://localhost:8000
echo  - API Docs:         http://localhost:8000/docs
echo ===================================================
echo.
timeout /t 3 /nobreak >nul
start http://localhost:5173


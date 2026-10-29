# ClipForge AI 🎬⚡
> Automated AI Video Clipper for YouTube Shorts, Instagram Reels, and TikTok.

ClipForge AI automatically analyzes long-form videos (podcasts, gameplay, interviews, lectures) and turns them into 9:16 vertical social shorts using FFmpeg, PySceneDetect, and speech/audio intelligence.

---

## 🚀 How to Run the App

### Option 1: One-Click Quick Start (Windows)
Double-click the **`run.bat`** file in this folder, or run:
```bat
.\run.bat
```
This opens the backend (port 8000), frontend (port 5173), and automatically launches your browser.

---

### Option 2: Run via Terminal (PowerShell / Command Prompt)

Open two terminal windows in the project directory `c:\Users\prasa\OneDrive\Desktop\ClipForge AI`:

#### Terminal 1: Backend Server (FastAPI)
```powershell
.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend runs on `http://127.0.0.1:8000` (API documentation at `/docs`).*

#### Terminal 2: Frontend Server (Vite React)
```powershell
cd frontend
npm run dev
```
*Frontend runs on `http://127.0.0.1:5173`.*

---

### Option 3: Single-Server Production Mode
Because the frontend is pre-built into `frontend/dist`, you can also run the entire website using only the FastAPI backend:
```powershell
.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 🛠️ Features
- **Local File Upload & Link Import**: Drag-and-drop local video files or paste links from YouTube, Shorts, Vimeo, or direct MP4 URLs.
- **Smart Slicing Strategies**:
  - **Scene Cut Detection**: Powered by PySceneDetect.
  - **Silence Removal**: Detects speech pauses with FFmpeg silencedetect.
  - **Duration Chunks**: Uniform social-optimized intervals.
  - **Speech-Aware Cuts**: Sentence-level alignment with faster-whisper.
- **Aspect Ratio Re-Framing**: 9:16 (Vertical Shorts/Reels/TikTok), 1:1 (Square), 16:9 (Landscape) with smart blurred padding.
- **In-Browser Video Streaming**: HTTP 206 partial content streaming player.
- **Batch Export**: Instant individual MP4 downloads or full ZIP package bundle.


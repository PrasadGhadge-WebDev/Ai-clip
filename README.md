# ClipForge AI 🎬⚡
> Automated AI Video Clipper for YouTube Shorts, Instagram Reels, and TikTok.

ClipForge AI automatically analyzes long-form videos (podcasts, gameplay, interviews, lectures) and turns them into 9:16 vertical social shorts using FFmpeg, PySceneDetect, and speech/audio intelligence.

---

## 🏗️ Architecture & Frameworks

- **Backend**: Python 3.11+ / FastAPI / Uvicorn / PySceneDetect / FFmpeg / yt-dlp / httpx
- **Frontend**: React 19 / TypeScript / Vite / Tailwind CSS / Lucide React
- **Video Pipeline**: FFmpeg custom filter-chain (blurred bokeh background padding, dynamic scale & crop, AAC audio normalization, +faststart MP4 streaming)
- **Deployment**: Dockerized backend on Render + Static Single Page Application (SPA) on Vercel or Render Static Site

---

## 🚀 Local Development

### Option 1: One-Click Quick Start (Windows)
Double-click **`run.bat`** or run:
```bat
.\run.bat
```

### Option 2: Run via Terminal
1. **Backend** (from project root):
   ```powershell
   .\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
2. **Frontend** (in separate terminal):
   ```powershell
   cd frontend
   npm run dev
   ```

---

## 🌐 Production Internet Deployment Guide

Recommended Cloud Architecture:
- **Backend**: [Render Web Service](https://render.com) (Docker Runtime)
- **Frontend**: [Vercel](https://vercel.com) (Vite React SPA)

---

### Step 1: Deploy Backend on Render (Web Service)

1. Sign up/Log in at [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** &rarr; **Web Service**.
3. Connect your GitHub repository: `PrasadGhadge-WebDev/Ai-clip`.
4. Configure the settings:
   - **Name**: `clipforge-backend`
   - **Region**: Nearest to your users (e.g., `Oregon (US West)` or `Frankfurt (EU)`)
   - **Branch**: `main`
   - **Runtime**: **`Docker`** *(Uses the included `Dockerfile` with native FFmpeg & OpenCV pre-installed)*
   - **Instance Type**: **Free**
5. Under **Environment Variables**, add:
   - `PORT`: `8000`
   - `CORS_ORIGINS`: `*` *(or your Vercel URL once deployed)*
   - `MAX_UPLOAD_SIZE_MB`: `500`
   - `RETENTION_HOURS`: `24`
6. Click **Create Web Service**.
7. Once deployed, copy your backend URL (e.g. `https://clipforge-backend.onrender.com`).

---

### Step 2: Deploy Frontend on Vercel

1. Log in at [vercel.com](https://vercel.com).
2. Click **Add New...** &rarr; **Project**.
3. Import your repository: `PrasadGhadge-WebDev/Ai-clip`.
4. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`frontend`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://clipforge-backend.onrender.com` *(your Render backend URL from Step 1)*
6. Click **Deploy**.
7. Your frontend will be live on `https://your-project.vercel.app`!

> ⚠️ **CRITICAL NOTE ON VIDEO UPLOAD BUFFERING**:
> If you deploy on Vercel without setting `VITE_API_BASE_URL`, the frontend defaults to relative `/api`. Because Vercel has a strict 4.5MB Serverless function payload limit and does not run Python, uploads will hang/buffer infinitely or return HTML errors. Setting `VITE_API_BASE_URL` routes uploads directly to your Render backend or S3 bucket, completely bypassing the Vercel 4.5MB bottleneck.

*(Optional: Go back to Render Dashboard &rarr; Environment &rarr; set `CORS_ORIGINS=*` or `https://your-project.vercel.app` for strict security).*

---

## ⚠️ Cloud & Free-Tier Operational Considerations

1. **Free Tier Inactivity Sleep (Render)**:
   - On Render Free Tier, the backend spins down after 15 minutes of inactivity.
   - The first request after sleep may take ~30–50 seconds to wake up.
   - *Tip*: Free cron services like UptimeRobot or Cron-Job.org can ping `/api/health` every 14 minutes to keep it active.
2. **Ephemeral Disk vs Persistent Storage**:
   - Render Free Tier has an ephemeral file system. Uploaded videos and rendered clips remain accessible during the user session, but are wiped when the container sleeps or redeploys.
   - For long-term permanent storage, mount a **Render Persistent Disk** at `/var/data` and set `DATA_DIR=/var/data` in environment variables.
3. **Long Video Processing & Timeout Protection**:
   - ClipForge AI creates jobs asynchronously and returns `job_id` within 20 milliseconds.
   - The frontend polls `/api/jobs/{id}` every 1.5s, preventing the cloud proxy 100-second request timeout.
   - For heavy 1+ hour videos on CPU instances, configure `max_clips` or 720p for faster turnaround.

---

## ✅ Post-Deployment Verification Checklist

- [ ] Visit `https://<your-backend>.onrender.com/api/health` &rarr; returns `status: "healthy"` and `ffmpeg.installed: true`.
- [ ] Visit `https://<your-frontend>.vercel.app` &rarr; header shows `Engine Active` with green status dot.
- [ ] Click **"Generate Demo Video"** &rarr; 15-second sample generates in seconds.
- [ ] Click **"Paste Video Link"** &rarr; paste YouTube URL (`https://www.youtube.com/watch?v=...`) &rarr; metadata loads.
- [ ] Click **"Forge Social Clips Now"** &rarr; live progress bar tracks rendering stages.
- [ ] Review clips in gallery &rarr; test in-browser video streaming modal.
- [ ] Click **"Download All (ZIP)"** &rarr; ZIP package downloads successfully.

import os
import time
import shutil
import logging
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Query,
    Header,
    Request,
    status,
    WebSocket,
    WebSocketDisconnect
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

from .config import settings, UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR, BASE_DIR
from .ffmpeg_utils import get_ffmpeg_path, get_video_metadata, generate_sample_video
from .transcriber import is_whisper_available, WHISPER_LIMITATIONS_DISCLOSURE
from .silence_detector import SILENCE_REMOVAL_EXPLANATION
from .job_manager import job_manager
from .url_downloader import download_video_from_url
from .s3_storage import s3_storage
from fastapi.staticfiles import StaticFiles

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("clipforge.api")

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Automated AI-powered video cutter for Instagram Reels, YouTube Shorts, and TikTok"
)

# Real-time WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = []
        self.active_connections[job_id].append(websocket)

    def disconnect(self, job_id: str, websocket: WebSocket):
        if job_id in self.active_connections:
            if websocket in self.active_connections[job_id]:
                self.active_connections[job_id].remove(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

    async def broadcast_job(self, job_id: str, data: dict):
        if job_id in self.active_connections:
            dead = []
            for ws in self.active_connections[job_id]:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.append(ws)
            for d in dead:
                self.disconnect(job_id, d)

ws_manager = ConnectionManager()

def on_job_state_changed(job_id: str, job_dict: dict):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(ws_manager.broadcast_job(job_id, job_dict))
    except RuntimeError:
        pass

job_manager.register_listener(on_job_state_changed)

# CORS Middleware
cors_origins = settings.cors_origins
if "*" in cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


class JobCreateRequest(BaseModel):
    file_id: Optional[str] = None
    video_url: Optional[str] = None
    s3_key: Optional[str] = None
    cut_method: str = Field(default="scene", description="'scene' | 'silence' | 'duration' | 'speech'")
    aspect_ratio: str = Field(default="9:16", description="'9:16' | '16:9' | '1:1'")
    crop_mode: str = Field(default="blur_padding", description="'blur_padding' | 'center_crop' | 'fit_pad'")
    resolution: str = Field(default="1080p", description="'1080p' | '720p'")
    target_duration: float = Field(default=30.0, ge=3.0, le=300.0)
    min_duration: float = Field(default=5.0, ge=2.0, le=60.0)
    max_duration: float = Field(default=60.0, ge=5.0, le=300.0)
    scene_threshold: float = Field(default=27.0, ge=5.0, le=100.0)
    silence_noise_db: float = Field(default=-30.0, ge=-80.0, le=-10.0)
    silence_duration: float = Field(default=0.5, ge=0.1, le=5.0)
    enable_subtitles: bool = Field(default=False)
    whisper_model: str = Field(default="tiny")
    max_clips: int = Field(default=6)


@app.get("/api/health")
async def get_system_health():
    """Returns system status, FFmpeg path, Whisper availability, and disk usage."""
    ffmpeg_path = get_ffmpeg_path()
    whisper_ok = is_whisper_available()
    
    total_b, used_b, free_b = shutil.disk_usage(str(UPLOAD_DIR))

    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.version,
        "ffmpeg": {
            "path": ffmpeg_path,
            "installed": bool(ffmpeg_path and Path(ffmpeg_path).exists())
        },
        "whisper": {
            "available": whisper_ok,
            "default_model": settings.default_whisper_model,
            "disclosure": WHISPER_LIMITATIONS_DISCLOSURE
        },
        "silence_removal_info": SILENCE_REMOVAL_EXPLANATION,
        "storage": {
            "max_upload_size_mb": settings.max_upload_size_mb,
            "free_space_gb": round(free_b / (1024 ** 3), 2),
            "allowed_extensions": settings.allowed_extensions
        }
    }


@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    Validates and stores uploaded video file securely.
    Returns file identifier and video metadata.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(settings.allowed_extensions)}"
        )

    # Sanitize and assign unique file name
    safe_stem = "".join(c for c in Path(file.filename or "video").stem if c.isalnum() or c in ("-", "_"))[:40]
    file_id = f"{int(time.time())}_{safe_stem}{ext}"
    target_path = UPLOAD_DIR / file_id

    # Stream write with size limit validation
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    total_written = 0

    try:
        with open(target_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_written += len(chunk)
                if total_written > max_bytes:
                    f.close()
                    target_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum upload size limit of {settings.max_upload_size_mb}MB"
                    )
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        target_path.unlink(missing_ok=True)
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"File upload error: {str(e)}")

    # Extract metadata using FFmpeg
    try:
        metadata = get_video_metadata(target_path)
    except Exception as e:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid or corrupted video file: {str(e)}")

    return {
        "file_id": file_id,
        "filename": file.filename,
        "file_size": total_written,
        "metadata": metadata
    }


class LinkImportRequest(BaseModel):
    url: str = Field(..., description="Public video URL (YouTube, Vimeo, direct MP4, etc.)")


@app.post("/api/upload-url")
async def import_video_from_url(req: LinkImportRequest):
    """
    Downloads and prepares video from a public video link or streaming platform.
    Returns standard file identifier and video metadata.
    """
    try:
        data = download_video_from_url(
            url=req.url,
            upload_dir=UPLOAD_DIR,
            max_size_mb=settings.max_upload_size_mb
        )
        return data
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Link import failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process video link: {str(e)}"
        )



@app.post("/api/system/generate-sample")
async def create_synthetic_sample():
    """
    Generates a 15-second synthetic demo video locally using FFmpeg.
    Allows instant zero-download testing for the user!
    """
    file_id = f"demo_sample_{int(time.time())}.mp4"
    sample_path = UPLOAD_DIR / file_id
    try:
        generate_sample_video(sample_path, duration_secs=15)
        metadata = get_video_metadata(sample_path)
        return {
            "file_id": file_id,
            "filename": "ClipForge_Demo_15s.mp4",
            "file_size": sample_path.stat().st_size,
            "metadata": metadata
        }
    except Exception as e:
        logger.error(f"Sample generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate synthetic sample: {str(e)}")


class PresignedUrlRequest(BaseModel):
    filename: str
    content_type: str = "video/mp4"
    file_size: Optional[int] = None


@app.post("/api/storage/presigned-url")
async def get_presigned_url(req: PresignedUrlRequest):
    """Generates S3 Pre-signed URL for direct browser-to-bucket upload."""
    if not s3_storage.enabled:
        return {
            "supported": False,
            "message": "AWS S3 credentials not configured in backend environment. Direct backend streaming will be used."
        }

    if req.file_size and req.file_size > (settings.max_upload_size_mb * 1024 * 1024):
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum upload size limit of {settings.max_upload_size_mb}MB"
        )

    try:
        data = s3_storage.generate_presigned_upload_url(
            filename=req.filename,
            content_type=req.content_type
        )
        return {"supported": True, **data}
    except Exception as e:
        logger.error(f"Failed generating pre-signed URL: {e}")
        raise HTTPException(status_code=500, detail=f"Pre-signed URL generation failed: {str(e)}")


@app.websocket("/api/ws/jobs/{job_id}")
async def job_progress_websocket(websocket: WebSocket, job_id: str):
    """Real-time bidirectional WebSocket connection for live job state & logs streaming."""
    await ws_manager.connect(job_id, websocket)
    current = job_manager.get_job(job_id)
    if current:
        await websocket.send_json(current)
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        ws_manager.disconnect(job_id, websocket)


@app.post("/api/jobs")
async def create_processing_job(req: JobCreateRequest):
    """Creates and starts an asynchronous video clipping job from uploaded file, S3 key, or URL."""
    if not req.file_id and not req.video_url and not req.s3_key:
        raise HTTPException(
            status_code=400,
            detail="One of 'file_id', 'video_url', or 's3_key' must be provided."
        )

    input_path = None
    original_filename = "video.mp4"

    if req.file_id:
        input_path = UPLOAD_DIR / req.file_id
        if not input_path.exists():
            raise HTTPException(status_code=404, detail=f"Uploaded file '{req.file_id}' not found.")
        original_filename = req.file_id
    elif req.video_url:
        original_filename = "online_video.mp4"
    elif req.s3_key:
        original_filename = Path(req.s3_key).name

    options = req.model_dump()
    job = job_manager.create_job(
        input_file_path=input_path,
        original_filename=original_filename,
        options=options,
        video_url=req.video_url,
        s3_key=req.s3_key
    )
    return job


@app.get("/api/jobs")
async def list_jobs():
    """Lists all video processing jobs."""
    return job_manager.list_jobs()


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    """Retrieves full status and clips for a specific job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancels a running job."""
    success = job_manager.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot cancel job (job may not exist or already finished).")
    return {"message": "Job cancellation requested"}


@app.post("/api/jobs/{job_id}/retry")
async def retry_job(job_id: str):
    """Retries a failed job with the same parameters."""
    job = job_manager.retry_job(job_id)
    if not job:
        raise HTTPException(status_code=400, detail="Cannot retry job. Source file may have been deleted.")
    return job


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Deletes job record and purges all uploaded/generated video files."""
    success = job_manager.delete_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job and associated files successfully deleted."}


@app.get("/api/jobs/{job_id}/clips/{clip_id}/stream")
async def stream_clip(job_id: str, clip_id: str, request: Request):
    """
    Streams a clip MP4 with HTTP 206 Partial Content Range support
    for responsive in-browser seeking.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    clip = next((c for c in job.get("clips", []) if c["id"] == clip_id), None)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    file_path = Path(clip["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Clip video file not found on disk")

    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        # Range: bytes=start-end
        bytes_str = range_header.replace("bytes=", "")
        parts = bytes_str.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        length = end - start + 1

        def iterfile():
            with open(file_path, "rb") as f:
                f.seek(start)
                bytes_left = length
                chunk_sz = 64 * 1024
                while bytes_left > 0:
                    read_len = min(chunk_sz, bytes_left)
                    data = f.read(read_len)
                    if not data:
                        break
                    bytes_left -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": "video/mp4",
        }
        return StreamingResponse(iterfile(), status_code=206, headers=headers)

    return FileResponse(file_path, media_type="video/mp4")


@app.get("/api/jobs/{job_id}/clips/{clip_id}/download")
async def download_clip(job_id: str, clip_id: str):
    """Downloads an individual rendered short clip."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    clip = next((c for c in job.get("clips", []) if c["id"] == clip_id), None)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    file_path = Path(clip["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Clip file missing")

    return FileResponse(
        file_path,
        media_type="video/mp4",
        filename=clip["file_name"]
    )


@app.get("/api/jobs/{job_id}/clips/{clip_id}/thumbnail")
async def get_clip_thumbnail(job_id: str, clip_id: str):
    """Returns the preview thumbnail image for a clip."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    clip = next((c for c in job.get("clips", []) if c["id"] == clip_id), None)
    if not clip or not clip.get("thumbnail_path"):
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    thumb_path = Path(clip["thumbnail_path"])
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file missing")

    return FileResponse(thumb_path, media_type="image/jpeg")


@app.get("/api/jobs/{job_id}/clips/{clip_id}/srt")
async def download_clip_srt(job_id: str, clip_id: str):
    """Downloads the SRT subtitle file for a clip."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    clip = next((c for c in job.get("clips", []) if c["id"] == clip_id), None)
    if not clip or not clip.get("srt_path"):
        raise HTTPException(status_code=404, detail="SRT subtitle file not found")

    srt_path = Path(clip["srt_path"])
    if not srt_path.exists():
        raise HTTPException(status_code=404, detail="SRT file missing")

    return FileResponse(
        srt_path,
        media_type="text/plain",
        filename=f"{clip_id}_subtitles.srt"
    )


@app.get("/api/jobs/{job_id}/download-all")
async def download_all_clips_zip(job_id: str):
    """Downloads all generated clips, SRTs, and metadata as a single ZIP archive."""
    zip_path = job_manager.create_zip_archive(job_id)
    if not zip_path or not zip_path.exists():
        raise HTTPException(status_code=404, detail="Failed to build ZIP archive or no clips available")

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=zip_path.name
    )


@app.post("/api/system/cleanup")
async def cleanup_system_files(hours: int = Query(default=24, ge=1)):
    """Manually purges temporary files and jobs older than retention hours."""
    now = time.time()
    cutoff = now - (hours * 3600)
    purged = 0

    # Clean old uploads
    for item in UPLOAD_DIR.iterdir():
        if item.is_file() and item.stat().st_mtime < cutoff:
            try:
                item.unlink(missing_ok=True)
                purged += 1
            except Exception as e:
                logger.warning(f"Could not purge {item}: {e}")

    # Clean old jobs
    for job in job_manager.list_jobs():
        if job.get("created_at", 0) < cutoff:
            job_manager.delete_job(job["id"])
            purged += 1

    return {"message": f"Cleanup complete. Purged {purged} old files/records older than {hours} hours."}


# Mount built frontend dist if available (for production / single-server serving)
frontend_dist = BASE_DIR / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


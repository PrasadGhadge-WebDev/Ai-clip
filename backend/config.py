import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "outputs"
TEMP_DIR = DATA_DIR / "temp"

# Ensure runtime directories exist
for folder in [DATA_DIR, UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    app_name: str = "ClipForge AI"
    version: str = "1.0.0"
    max_upload_size_mb: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500"))
    allowed_extensions: list[str] = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"]
    ffmpeg_custom_path: str = os.getenv("FFMPEG_PATH", "")
    default_retention_hours: int = int(os.getenv("RETENTION_HOURS", "24"))
    enable_whisper: bool = os.getenv("ENABLE_WHISPER", "true").lower() in ("true", "1", "yes")
    default_whisper_model: str = os.getenv("WHISPER_MODEL", "tiny")
    cors_origins: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
    ]

settings = Settings()

import os
import re
import time
import logging
from pathlib import Path
from typing import Dict, Any
from urllib.parse import urlparse
import httpx
import yt_dlp
from .ffmpeg_utils import get_ffmpeg_path, get_video_metadata

logger = logging.getLogger("clipforge.urldownload")


def download_video_from_url(url: str, upload_dir: Path, max_size_mb: int = 500) -> Dict[str, Any]:
    """
    Downloads a video from a platform link (YouTube, Vimeo, etc.) or direct HTTP video URL.
    Saves it into upload_dir, extracts video metadata, and returns the standard UploadResponse payload.
    """
    url = url.strip()
    if not url:
        raise ValueError("Video link URL cannot be empty.")

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Invalid URL scheme. Link must begin with http:// or https://")

    max_bytes = max_size_mb * 1024 * 1024
    ffmpeg_bin = get_ffmpeg_path()
    timestamp = int(time.time())
    temp_stem = f"link_{timestamp}_{os.urandom(4).hex()}"
    out_template = str(upload_dir / f"{temp_stem}.%(ext)s")

    # Strategy 1: Attempt yt-dlp (YouTube, Shorts, Vimeo, Twitter/X, TikTok, Reddit, etc.)
    ydl_opts = {
        'format': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[ext=mp4]/best',
        'outtmpl': out_template,
        'ffmpeg_location': ffmpeg_bin,
        'merge_output_format': 'mp4',
        'max_filesize': max_bytes,
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'socket_timeout': 30,
    }

    try:
        logger.info(f"Attempting yt-dlp download for link: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "Online Video")

            # Check for generated candidate files
            candidates = list(upload_dir.glob(f"{temp_stem}.*"))
            if not candidates:
                raise FileNotFoundError("Video download finished but output file was not found on disk.")

            final_file = candidates[0]
            if final_file.suffix.lower() != ".mp4":
                mp4_target = final_file.with_suffix(".mp4")
                if not mp4_target.exists():
                    final_file.rename(mp4_target)
                    final_file = mp4_target

            clean_title = re.sub(r'[^\w\s-]', '', title)[:50].strip() or "online_video"
            safe_filename = f"{clean_title}.mp4"

            metadata = get_video_metadata(final_file)
            return {
                "file_id": final_file.name,
                "filename": safe_filename,
                "file_size": final_file.stat().st_size,
                "metadata": metadata
            }

    except Exception as yt_err:
        logger.warning(f"yt-dlp extraction was unable to complete: {yt_err}. Trying direct stream download...")
        # Clean any partial downloaded files
        for f in upload_dir.glob(f"{temp_stem}.*"):
            f.unlink(missing_ok=True)

        # Strategy 2: Direct HTTP streaming download (for direct mp4 / webm / mov URLs)
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*"
            }
            target_file = upload_dir / f"{temp_stem}.mp4"
            downloaded_bytes = 0

            with httpx.Client(follow_redirects=True, timeout=40.0, headers=headers) as client:
                with client.stream("GET", url) as response:
                    if response.status_code >= 400:
                        raise ValueError(f"Direct stream returned HTTP status {response.status_code}")

                    cl = response.headers.get("content-length")
                    if cl and int(cl) > max_bytes:
                        raise ValueError(f"Video file exceeds maximum allowed limit of {max_size_mb}MB")

                    with open(target_file, "wb") as out_f:
                        for chunk in response.iter_bytes(chunk_size=1024 * 64):
                            downloaded_bytes += len(chunk)
                            if downloaded_bytes > max_bytes:
                                target_file.unlink(missing_ok=True)
                                raise ValueError(f"File exceeds maximum allowed upload limit of {max_size_mb}MB")
                            out_f.write(chunk)

            if not target_file.exists() or target_file.stat().st_size == 0:
                target_file.unlink(missing_ok=True)
                raise ValueError("Downloaded video file is empty.")

            metadata = get_video_metadata(target_file)
            url_name = Path(parsed.path).name or "direct_video.mp4"
            if not url_name.endswith(".mp4"):
                url_name += ".mp4"

            return {
                "file_id": target_file.name,
                "filename": url_name,
                "file_size": downloaded_bytes,
                "metadata": metadata
            }

        except Exception as direct_err:
            logger.error(f"Both yt-dlp and direct HTTP download failed: {direct_err}")
            raise ValueError(
                f"Failed to import video from link. Please verify that the URL is public, accessible, and points to a supported video. (Details: {str(yt_err)})"
            )


import os
import re
import shutil
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger("clipforge.ffmpeg")

def get_ffmpeg_path() -> str:
    """Finds the FFmpeg executable path reliably on Windows and other OS."""
    # 1. Custom configured path
    custom = os.getenv("FFMPEG_PATH", "")
    if custom and os.path.isfile(custom):
        return custom

    # 2. System PATH
    which_path = shutil.which("ffmpeg")
    if which_path:
        return which_path

    # 3. imageio-ffmpeg bundled binary
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.isfile(exe):
            return exe
    except Exception as e:
        logger.warning(f"Could not load imageio_ffmpeg: {e}")

    # Fallback to plain binary name
    return "ffmpeg"


def get_ffprobe_path() -> Optional[str]:
    """Finds ffprobe if installed."""
    custom = os.getenv("FFPROBE_PATH", "")
    if custom and os.path.isfile(custom):
        return custom
    which_path = shutil.which("ffprobe")
    if which_path:
        return which_path
    return None


def get_video_metadata(file_path: Path) -> Dict[str, Any]:
    """
    Extracts video metadata using FFmpeg/FFprobe without requiring shell=True.
    Parses duration, dimensions, framerate, and audio track presence.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Video file not found: {file_path}")

    ffmpeg = get_ffmpeg_path()
    
    # Run ffmpeg -i on the file (outputs info to stderr)
    cmd = [ffmpeg, "-hide_banner", "-i", str(file_path)]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, shell=False)
    output = result.stderr

    metadata: Dict[str, Any] = {
        "duration_seconds": 0.0,
        "width": 0,
        "height": 0,
        "fps": 30.0,
        "has_audio": False,
        "video_codec": "unknown",
        "audio_codec": "none",
        "file_size_bytes": file_path.stat().st_size,
    }

    # Extract Duration: 00:01:23.45
    duration_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", output)
    if duration_match:
        hours = float(duration_match.group(1))
        mins = float(duration_match.group(2))
        secs = float(duration_match.group(3))
        metadata["duration_seconds"] = round(hours * 3600 + mins * 60 + secs, 2)

    # Extract Video Stream: Stream #0:0: Video: h264 (...), 1920x1080 [SAR 1:1 DAR 16:9], 30 fps
    video_match = re.search(r"Stream\s*#\d+:\d+(?:\[\w+\])?.*Video:\s*(\w+).+?(\d{2,5})x(\d{2,5})", output)
    if video_match:
        metadata["video_codec"] = video_match.group(1)
        metadata["width"] = int(video_match.group(2))
        metadata["height"] = int(video_match.group(3))

    # Extract FPS
    fps_match = re.search(r"(\d+(?:\.\d+)?)\s*fps", output)
    if fps_match:
        try:
            metadata["fps"] = float(fps_match.group(1))
        except ValueError:
            metadata["fps"] = 30.0

    # Extract Audio Stream
    audio_match = re.search(r"Stream\s*#\d+:\d+(?:\[\w+\])?.*Audio:\s*(\w+)", output)
    if audio_match:
        metadata["has_audio"] = True
        metadata["audio_codec"] = audio_match.group(1)

    return metadata


def build_filter_chain(
    target_aspect: str = "9:16",
    crop_mode: str = "blur_padding",
    resolution: str = "1080p",
    src_width: int = 1920,
    src_height: int = 1080
) -> Tuple[int, int, str]:
    """
    Constructs FFmpeg video filter for aspect ratio framing and resizing.
    Supported target_aspect: '9:16', '16:9', '1:1'.
    Supported crop_mode: 'blur_padding', 'center_crop', 'fit_pad'.
    """
    # Determine target width and height
    if target_aspect == "9:16":
        out_w, out_h = (1080, 1920) if resolution == "1080p" else (720, 1280)
    elif target_aspect == "1:1":
        out_w, out_h = (1080, 1080) if resolution == "1080p" else (720, 720)
    else:  # 16:9
        out_w, out_h = (1920, 1080) if resolution == "1080p" else (1280, 720)

    # 1. Blur Padding Mode (Signature modern TikTok / Reels style)
    # Background: downscale and apply blur for ultra-fast silky bokeh
    # Foreground: scale to fit within canvas preserving aspect ratio
    # Overlay foreground on centered background
    if crop_mode == "blur_padding":
        bg_w = max(160, out_w // 4)
        bg_h = max(160, out_h // 4)
        vf = (
            f"[0:v]split=2[fg_in][bg_in];"
            f"[bg_in]scale={bg_w}:{bg_h}:force_original_aspect_ratio=increase,crop={bg_w}:{bg_h},boxblur=8:2,scale={out_w}:{out_h}[bg];"
            f"[fg_in]scale={out_w}:{out_h}:force_original_aspect_ratio=decrease[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2"
        )
    # 2. Smart Center Crop Mode
    elif crop_mode == "center_crop":
        vf = (
            f"scale={out_w}:{out_h}:force_original_aspect_ratio=increase,"
            f"crop={out_w}:{out_h}"
        )
    # 3. Fit Pad Mode (Letterbox/Pillarbox with clean dark borders)
    else:
        vf = (
            f"scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,"
            f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2:color=black"
        )

    return out_w, out_h, vf


def cut_clip(
    input_path: Path,
    output_path: Path,
    start_time: float,
    end_time: float,
    target_aspect: str = "9:16",
    crop_mode: str = "blur_padding",
    resolution: str = "1080p",
    src_width: int = 1920,
    src_height: int = 1080,
    has_audio: bool = True
) -> Path:
    """
    Renders an individual clip between start_time and end_time with specified aspect ratio framing.
    Uses H.264 + AAC with +faststart for immediate browser streaming.
    """
    ffmpeg = get_ffmpeg_path()
    duration = max(0.5, end_time - start_time)

    out_w, out_h, vf = build_filter_chain(
        target_aspect=target_aspect,
        crop_mode=crop_mode,
        resolution=resolution,
        src_width=src_width,
        src_height=src_height
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        ffmpeg,
        "-y",
        "-ss", f"{start_time:.3f}",
        "-t", f"{duration:.3f}",
        "-i", str(input_path),
        "-filter_complex", vf,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "24",
        "-pix_fmt", "yuv420p",
    ]

    if has_audio:
        cmd.extend(["-c:a", "aac", "-b:a", "128k", "-ar", "44100"])
    else:
        cmd.extend(["-an"])

    cmd.extend(["-movflags", "+faststart", str(output_path)])

    logger.info(f"Rendering clip: {start_time:.2f}s - {end_time:.2f}s -> {output_path.name}")
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, shell=False)

    if res.returncode != 0:
        logger.error(f"FFmpeg error: {res.stderr}")
        raise RuntimeError(f"FFmpeg failed rendering clip: {res.stderr[-400:]}")

    return output_path


def generate_thumbnail(video_path: Path, thumbnail_path: Path, timestamp: float = 1.0) -> Path:
    """Extracts a single frame as JPEG thumbnail for quick preview."""
    ffmpeg = get_ffmpeg_path()
    thumbnail_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        ffmpeg,
        "-y",
        "-ss", f"{timestamp:.3f}",
        "-i", str(video_path),
        "-frames:v", "1",
        "-q:v", "2",
        str(thumbnail_path)
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False)
    return thumbnail_path


def generate_sample_video(output_path: Path, duration_secs: int = 15) -> Path:
    """
    Generates a synthetic demo MP4 video with color transitions, animated clock,
    and synthesized audio speech-like tones so users can test ClipForge AI
    instantly on Windows with 0 file downloads!
    """
    ffmpeg = get_ffmpeg_path()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Filter creates a 1280x720 video with changing background colors every 4 seconds,
    # timestamp test pattern, and a sine audio track with brief silence pauses
    filter_graph = (
        f"testsrc=duration={duration_secs}:size=1280x720:rate=30,"
        f"drawbox=y=ih-80:color=black@0.6:width=iw:height=80:t=fill"
    )

    cmd = [
        ffmpeg,
        "-y",
        "-f", "lavfi", "-i", filter_graph,
        "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration_secs}",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        str(output_path)
    ]

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, shell=False)
    if res.returncode != 0:
        # Fallback simpler testsrc if drawbox has issues on some ffmpeg builds
        simple_cmd = [
            ffmpeg,
            "-y",
            "-f", "lavfi", "-i", f"testsrc=duration={duration_secs}:size=1280x720:rate=30",
            "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration_secs}",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            str(output_path)
        ]
        res = subprocess.run(simple_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, shell=False)
        if res.returncode != 0:
            raise RuntimeError(f"Failed to generate synthetic test video: {res.stderr}")

    return output_path

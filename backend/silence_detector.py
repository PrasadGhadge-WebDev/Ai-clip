import re
import subprocess
import logging
from pathlib import Path
from typing import List, Tuple, Dict, Any
from .ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger("clipforge.silence")

# Clear explanation of silence removal trade-offs
SILENCE_REMOVAL_EXPLANATION = (
    "Silence removal uses FFmpeg's 'silencedetect' filter on the audio track. "
    "Noise threshold (e.g., -30dB) sets the volume level considered dead silence. "
    "Duration threshold (e.g., 0.5s) sets the minimum silent pause duration before a cut. "
    "CRITICAL NOTE: Setting noise threshold too high (e.g., -20dB) or duration too short (e.g., 0.2s) "
    "may aggressively cut natural speech pauses, whispers, soft consonants, or trailing words. "
    "Recommended default: -30dB with 0.5s duration."
)

def detect_silence_intervals(
    video_path: Path,
    noise_db: float = -30.0,
    min_silence_duration: float = 0.5
) -> List[Tuple[float, float]]:
    """
    Executes FFmpeg silencedetect filter and parses silent start and end timestamps.
    Returns list of (silence_start, silence_end).
    """
    ffmpeg = get_ffmpeg_path()
    cmd = [
        ffmpeg,
        "-hide_banner",
        "-vn",
        "-i", str(video_path),
        "-af", f"silencedetect=noise={noise_db}dB:d={min_silence_duration}",
        "-f", "null",
        "-"
    ]

    logger.info(f"Detecting silence with noise={noise_db}dB, duration={min_silence_duration}s on {video_path.name}")
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, shell=False)
    output = res.stderr

    silence_intervals: List[Tuple[float, float]] = []
    
    current_start: float | None = None
    for line in output.splitlines():
        start_match = re.search(r"silence_start:\s*([0-9.]+)", line)
        if start_match:
            current_start = float(start_match.group(1))

        end_match = re.search(r"silence_end:\s*([0-9.]+)", line)
        if end_match and current_start is not None:
            silence_end = float(end_match.group(1))
            if silence_end > current_start:
                silence_intervals.append((current_start, silence_end))
            current_start = None

    return silence_intervals


def extract_active_speech_segments(
    video_path: Path,
    video_duration: float,
    noise_db: float = -30.0,
    min_silence_duration: float = 0.5,
    min_clip_len: float = 5.0,
    max_clip_len: float = 60.0,
    target_duration: float = 30.0
) -> Dict[str, Any]:
    """
    Finds non-silent (active speech) segments by inverting silent intervals.
    Groups segments into natural short-form clips.
    """
    silences = detect_silence_intervals(video_path, noise_db, min_silence_duration)
    
    # Invert silence to find speech segments
    speech_segments: List[Tuple[float, float]] = []
    current_time = 0.0

    for s_start, s_end in silences:
        if s_start > current_time:
            # Active segment before silence
            speech_segments.append((round(current_time, 2), round(s_start, 2)))
        current_time = max(current_time, s_end)

    if current_time < video_duration:
        speech_segments.append((round(current_time, 2), round(video_duration, 2)))

    # If no silence was detected (e.g. constant background music/noise), fall back to target slicing
    if not speech_segments or (len(speech_segments) == 1 and speech_segments[0][1] - speech_segments[0][0] >= video_duration * 0.95):
        logger.info("Continuous sound detected with minimal silence; slicing by target duration.")
        clips: List[Tuple[float, float]] = []
        pos = 0.0
        while pos < video_duration:
            c_end = min(pos + target_duration, video_duration)
            if c_end - pos >= min_clip_len:
                clips.append((round(pos, 2), round(c_end, 2)))
            pos += target_duration
        return {
            "clips": clips,
            "silence_count": len(silences),
            "explanation": SILENCE_REMOVAL_EXPLANATION,
            "warning": "Audio had very little silence under threshold; sliced into standard chunks."
        }

    # Group adjacent speech segments into clips within [min_clip_len, max_clip_len]
    clips: List[Tuple[float, float]] = []
    accum_start, accum_end = speech_segments[0]

    for seg_start, seg_end in speech_segments[1:]:
        curr_len = accum_end - accum_start
        added_len = seg_end - seg_start

        if curr_len + added_len <= max_clip_len:
            accum_end = seg_end
        else:
            if curr_len >= min_clip_len:
                clips.append((accum_start, accum_end))
            accum_start = seg_start
            accum_end = seg_end

    if accum_end - accum_start >= min_clip_len:
        clips.append((accum_start, accum_end))
    elif clips:
        # Merge into last clip if it doesn't exceed max length
        last_s, last_e = clips.pop()
        if accum_end - last_s <= max_clip_len:
            clips.append((last_s, accum_end))
        else:
            clips.append((last_s, last_e))

    return {
        "clips": clips,
        "silence_count": len(silences),
        "explanation": SILENCE_REMOVAL_EXPLANATION,
        "warning": None if silences else "No silence detected at this sensitivity level."
    }

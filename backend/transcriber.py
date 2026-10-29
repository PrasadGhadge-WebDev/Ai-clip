import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger("clipforge.transcribe")

WHISPER_LIMITATIONS_DISCLOSURE = (
    "Speech-Aware cuts & subtitles use local open-source Whisper (faster-whisper). "
    "Limitations: 1) Tiny/Base models run fast on standard CPUs but may mishear strong regional accents or technical jargon. "
    "2) Heavy background music or loud reverberation can distort word timestamp precision. "
    "3) Speech-aware cutting selects high-information sentence clusters, which might split a continuous thought if pauses occur."
)

_model_cache: Dict[str, Any] = {}

def is_whisper_available() -> bool:
    """Checks if faster-whisper or openai-whisper is importable."""
    try:
        import faster_whisper
        return True
    except ImportError:
        try:
            import whisper
            return True
        except ImportError:
            return False


def get_whisper_model(model_name: str = "tiny"):
    """Loads and caches local faster-whisper model on CPU with int8 quantization."""
    global _model_cache
    if model_name in _model_cache:
        return _model_cache[model_name]

    try:
        from faster_whisper import WhisperModel
        logger.info(f"Loading faster-whisper model '{model_name}' on CPU...")
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        _model_cache[model_name] = model
        return model
    except Exception as e:
        logger.warning(f"Could not load faster-whisper: {e}")
        return None


def format_timestamp_srt(seconds: float) -> str:
    """Converts seconds into SRT timestamp format: HH:MM:SS,mmm"""
    total_ms = int(round(seconds * 1000))
    hours = total_ms // 3600000
    minutes = (total_ms % 3600000) // 60000
    secs = (total_ms % 60000) // 1000
    millis = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def transcribe_video(
    video_path: Path,
    model_name: str = "tiny"
) -> Dict[str, Any]:
    """
    Transcribes video audio using faster-whisper if available.
    Returns segments list with start, end, text, and overall transcript.
    """
    if not is_whisper_available():
        return {
            "available": False,
            "segments": [],
            "full_text": "",
            "error": "Whisper library not installed. Install faster-whisper to enable speech-aware cutting.",
            "disclosure": WHISPER_LIMITATIONS_DISCLOSURE
        }

    try:
        model = get_whisper_model(model_name)
        if not model:
            return {
                "available": False,
                "segments": [],
                "full_text": "",
                "error": "Failed to initialize Whisper model.",
                "disclosure": WHISPER_LIMITATIONS_DISCLOSURE
            }

        logger.info(f"Transcribing {video_path.name} with model {model_name}...")
        segments_gen, info = model.transcribe(
            str(video_path),
            beam_size=2,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        segments = []
        full_text_list = []
        for seg in segments_gen:
            text = seg.text.strip()
            if text:
                segments.append({
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": text,
                })
                full_text_list.append(text)

        return {
            "available": True,
            "language": getattr(info, "language", "en"),
            "segments": segments,
            "full_text": " ".join(full_text_list),
            "disclosure": WHISPER_LIMITATIONS_DISCLOSURE,
            "error": None
        }

    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        return {
            "available": False,
            "segments": [],
            "full_text": "",
            "error": str(e),
            "disclosure": WHISPER_LIMITATIONS_DISCLOSURE
        }


def generate_srt_content(segments: List[Dict[str, Any]], offset_start: float = 0.0) -> str:
    """
    Builds standard SRT content from segments.
    Applies offset_start if generating subtitles for an individual cut clip.
    """
    lines = []
    idx = 1
    for seg in segments:
        s = max(0.0, seg["start"] - offset_start)
        e = max(0.0, seg["end"] - offset_start)
        if e > s:
            lines.append(str(idx))
            lines.append(f"{format_timestamp_srt(s)} --> {format_timestamp_srt(e)}")
            lines.append(seg["text"])
            lines.append("")
            idx += 1
    return "\n".join(lines)


def get_speech_aware_cuts(
    segments: List[Dict[str, Any]],
    video_duration: float,
    min_duration: float = 10.0,
    max_duration: float = 60.0,
    target_duration: float = 30.0
) -> List[Tuple[float, float]]:
    """
    Computes natural speech-aware clip cuts based on sentence boundaries.
    Avoids cutting in the middle of a spoken sentence.
    """
    if not segments:
        # Fall back to target duration chunking if no speech detected
        cuts = []
        curr = 0.0
        while curr < video_duration:
            nxt = min(curr + target_duration, video_duration)
            if nxt - curr >= min_duration:
                cuts.append((round(curr, 2), round(nxt, 2)))
            curr = nxt
        return cuts

    clips: List[Tuple[float, float]] = []
    current_start = segments[0]["start"]
    current_end = segments[0]["end"]

    for seg in segments[1:]:
        seg_s = seg["start"]
        seg_e = seg["end"]
        potential_len = seg_e - current_start

        if potential_len <= max_duration:
            current_end = seg_e
        else:
            if current_end - current_start >= min_duration:
                clips.append((round(current_start, 2), round(current_end, 2)))
            current_start = seg_s
            current_end = seg_e

    if current_end - current_start >= min_duration:
        clips.append((round(current_start, 2), round(current_end, 2)))
    elif clips:
        # Merge trailing fragment with previous clip if fits
        prev_s, prev_e = clips.pop()
        if current_end - prev_s <= max_duration:
            clips.append((prev_s, round(current_end, 2)))
        else:
            clips.append((prev_s, prev_e))

    return clips

import pytest
from pathlib import Path
from backend.ffmpeg_utils import get_ffmpeg_path, build_filter_chain, generate_sample_video, get_video_metadata
from backend.config import TEMP_DIR

def test_ffmpeg_path_exists():
    path = get_ffmpeg_path()
    assert path is not None
    assert Path(path).exists() or path == "ffmpeg"

def test_build_filter_chain_9_16_blur():
    w, h, vf = build_filter_chain("9:16", "blur_padding", "1080p")
    assert w == 1080
    assert h == 1920
    assert "split=2" in vf
    assert "boxblur" in vf
    assert "overlay" in vf

def test_build_filter_chain_1_1_crop():
    w, h, vf = build_filter_chain("1:1", "center_crop", "720p")
    assert w == 720
    assert h == 720
    assert "crop=720:720" in vf

def test_build_filter_chain_16_9_pad():
    w, h, vf = build_filter_chain("16:9", "fit_pad", "1080p")
    assert w == 1920
    assert h == 1080
    assert "pad=1920:1080" in vf

def test_synthetic_video_generation_and_metadata():
    test_video = TEMP_DIR / "unit_test_synthetic.mp4"
    try:
        generate_sample_video(test_video, duration_secs=3)
        assert test_video.exists()
        assert test_video.stat().st_size > 0

        meta = get_video_metadata(test_video)
        assert meta["duration_seconds"] >= 2.5
        assert meta["width"] == 1280
        assert meta["height"] == 720
        assert meta["has_audio"] is True
    finally:
        test_video.unlink(missing_ok=True)

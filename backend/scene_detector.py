import logging
from pathlib import Path
from typing import List, Tuple
from scenedetect import open_video, SceneManager, ContentDetector, AdaptiveDetector

logger = logging.getLogger("clipforge.scenedetect")

def detect_scenes(
    video_path: Path,
    detector_type: str = "content",
    threshold: float = 27.0,
    min_scene_len_sec: float = 3.0,
    max_scene_len_sec: float = 60.0,
    target_duration: float = 30.0,
    video_duration: float = 0.0
) -> List[Tuple[float, float]]:
    """
    Detects scene transitions in a video file using PySceneDetect.
    Processes the raw scenes into social media short-form clips:
    - Merges fragments shorter than min_scene_len_sec
    - Subdivides scenes longer than max_scene_len_sec
    - Falls back to target_duration segmentation if video has few visual transitions.
    """
    logger.info(f"Running PySceneDetect on {video_path.name} (type={detector_type}, threshold={threshold})")
    
    raw_scenes: List[Tuple[float, float]] = []

    try:
        video = open_video(str(video_path))
        scene_manager = SceneManager()

        if detector_type == "adaptive":
            scene_manager.add_detector(AdaptiveDetector(adaptive_threshold=threshold))
        else:
            scene_manager.add_detector(ContentDetector(threshold=threshold))

        scene_manager.detect_scenes(video=video, show_progress=False)
        scene_list = scene_manager.get_scene_list()

        for start_tc, end_tc in scene_list:
            start_s = round(start_tc.get_seconds(), 2)
            end_s = round(end_tc.get_seconds(), 2)
            if end_s > start_s:
                raw_scenes.append((start_s, end_s))

    except Exception as e:
        logger.warning(f"PySceneDetect encountered error: {e}. Falling back to duration slicing.")

    # Fallback if no scenes detected or video is shorter than threshold
    if not raw_scenes:
        if video_duration <= 0:
            video_duration = 30.0
        logger.info(f"No scene cuts detected by detector. Dividing {video_duration}s by target duration {target_duration}s")
        current = 0.0
        while current < video_duration:
            clip_end = min(current + target_duration, video_duration)
            if clip_end - current >= min_scene_len_sec:
                raw_scenes.append((round(current, 2), round(clip_end, 2)))
            current += target_duration
        return raw_scenes

    # Post-process: merge tiny scenes and split excessively long scenes
    processed_clips: List[Tuple[float, float]] = []
    accum_start = raw_scenes[0][0]
    accum_end = raw_scenes[0][1]

    for i in range(1, len(raw_scenes)):
        s_start, s_end = raw_scenes[i]
        curr_len = accum_end - accum_start

        # If current accumulated duration is too small, merge with next
        if curr_len < min_scene_len_sec:
            accum_end = s_end
        else:
            # If current accumulated duration exceeds max, subdivide it
            if curr_len > max_scene_len_sec:
                seg_start = accum_start
                while seg_start < accum_end:
                    seg_end = min(seg_start + target_duration, accum_end)
                    if seg_end - seg_start >= min_scene_len_sec:
                        processed_clips.append((round(seg_start, 2), round(seg_end, 2)))
                    seg_start = seg_end
            else:
                processed_clips.append((round(accum_start, 2), round(accum_end, 2)))
            
            accum_start = s_start
            accum_end = s_end

    # Handle final segment
    final_len = accum_end - accum_start
    if final_len > max_scene_len_sec:
        seg_start = accum_start
        while seg_start < accum_end:
            seg_end = min(seg_start + target_duration, accum_end)
            if seg_end - seg_start >= min_scene_len_sec:
                processed_clips.append((round(seg_start, 2), round(seg_end, 2)))
            seg_start = seg_end
    elif final_len >= min_scene_len_sec:
        processed_clips.append((round(accum_start, 2), round(accum_end, 2)))
    elif processed_clips:
        # Merge tiny trailing fragment into previous clip
        prev_start, _ = processed_clips.pop()
        processed_clips.append((prev_start, round(accum_end, 2)))
    else:
        processed_clips.append((round(accum_start, 2), round(accum_end, 2)))

    return processed_clips

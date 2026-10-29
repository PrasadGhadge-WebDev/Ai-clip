import json
import uuid
import time
import shutil
import zipfile
import logging
import threading
from pathlib import Path
from typing import Dict, List, Optional, Any
from concurrent.futures import ThreadPoolExecutor

from .config import DATA_DIR, OUTPUT_DIR, TEMP_DIR
from .ffmpeg_utils import get_video_metadata, cut_clip, generate_thumbnail
from .scene_detector import detect_scenes
from .silence_detector import extract_active_speech_segments, SILENCE_REMOVAL_EXPLANATION
from .transcriber import transcribe_video, get_speech_aware_cuts, generate_srt_content, WHISPER_LIMITATIONS_DISCLOSURE

logger = logging.getLogger("clipforge.jobmanager")

STATE_FILE = DATA_DIR / "jobs_state.json"

class JobManager:
    def __init__(self, max_workers: int = 2):
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()
        self._load_state()

    def _save_state(self):
        """Serializes non-sensitive job states to JSON."""
        try:
            with self.lock:
                serializable = {}
                for jid, job in self.jobs.items():
                    data = dict(job)
                    # Convert Paths to strings
                    if "input_path" in data and isinstance(data["input_path"], Path):
                        data["input_path"] = str(data["input_path"])
                    if "zip_path" in data and isinstance(data["zip_path"], Path):
                        data["zip_path"] = str(data["zip_path"])
                    serializable[jid] = data
                with open(STATE_FILE, "w", encoding="utf-8") as f:
                    json.dump(serializable, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to persist state: {e}")

    def _load_state(self):
        """Loads existing jobs from state file if present."""
        if STATE_FILE.exists():
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    for jid, data in loaded.items():
                        # Mark interrupted jobs as failed on reboot
                        if data.get("status") in ("queued", "analyzing", "cutting"):
                            data["status"] = "failed"
                            data["error"] = "Job interrupted by server restart. You may click Retry."
                        self.jobs[jid] = data
            except Exception as e:
                logger.warning(f"Could not load previous job state: {e}")

    def add_log(self, job_id: str, message: str):
        with self.lock:
            if job_id in self.jobs:
                entry = f"[{time.strftime('%H:%M:%S')}] {message}"
                self.jobs[job_id]["logs"].append(entry)
                logger.info(f"[{job_id[:8]}] {message}")

    def update_job(self, job_id: str, **kwargs):
        with self.lock:
            if job_id in self.jobs:
                self.jobs[job_id].update(kwargs)
                self.jobs[job_id]["updated_at"] = time.time()
        self._save_state()

    def create_job(
        self,
        input_file_path: Path,
        original_filename: str,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        job_id = str(uuid.uuid4())
        job_dir = OUTPUT_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        job_data: Dict[str, Any] = {
            "id": job_id,
            "original_filename": original_filename,
            "input_path": str(input_file_path),
            "output_dir": str(job_dir),
            "status": "queued",
            "progress": 0,
            "stage": "Job queued for processing",
            "created_at": time.time(),
            "updated_at": time.time(),
            "options": {
                "cut_method": options.get("cut_method", "scene"),
                "aspect_ratio": options.get("aspect_ratio", "9:16"),
                "crop_mode": options.get("crop_mode", "blur_padding"),
                "resolution": options.get("resolution", "1080p"),
                "target_duration": float(options.get("target_duration", 30.0)),
                "min_duration": float(options.get("min_duration", 5.0)),
                "max_duration": float(options.get("max_duration", 60.0)),
                "scene_threshold": float(options.get("scene_threshold", 27.0)),
                "silence_noise_db": float(options.get("silence_noise_db", -30.0)),
                "silence_duration": float(options.get("silence_duration", 0.5)),
                "enable_subtitles": bool(options.get("enable_subtitles", False)),
                "whisper_model": options.get("whisper_model", "tiny"),
            },
            "clips": [],
            "logs": [],
            "error": None,
            "disclosure": None,
            "zip_path": None
        }

        with self.lock:
            self.jobs[job_id] = job_data
        self._save_state()

        # Submit to executor
        self.executor.submit(self._process_job, job_id)
        return job_data

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self.jobs.get(job_id)

    def list_jobs(self) -> List[Dict[str, Any]]:
        with self.lock:
            # Return list sorted by creation time descending
            return sorted(
                list(self.jobs.values()),
                key=lambda j: j.get("created_at", 0),
                reverse=True
            )

    def cancel_job(self, job_id: str) -> bool:
        job = self.get_job(job_id)
        if not job:
            return False
        if job["status"] in ("completed", "failed", "cancelled"):
            return False
        self.update_job(job_id, status="cancelled", stage="Job cancelled by user", progress=0)
        self.add_log(job_id, "Job was cancelled by user.")
        return True

    def retry_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        job = self.get_job(job_id)
        if not job:
            return None
        input_path = Path(job["input_path"])
        if not input_path.exists():
            return None

        # Reset job state
        self.update_job(
            job_id,
            status="queued",
            progress=0,
            stage="Retrying job...",
            error=None,
            clips=[],
            zip_path=None
        )
        self.add_log(job_id, "Job retry initiated.")
        self.executor.submit(self._process_job, job_id)
        return self.get_job(job_id)

    def delete_job(self, job_id: str) -> bool:
        job = self.get_job(job_id)
        if not job:
            return False

        # Cleanup input and output folders
        try:
            inp = Path(job["input_path"])
            if inp.exists():
                inp.unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"Error removing input file for job {job_id}: {e}")

        try:
            out_dir = Path(job["output_dir"])
            if out_dir.exists():
                shutil.rmtree(out_dir, ignore_errors=True)
        except Exception as e:
            logger.warning(f"Error removing output dir for job {job_id}: {e}")

        with self.lock:
            self.jobs.pop(job_id, None)
        self._save_state()
        return True

    def create_zip_archive(self, job_id: str) -> Optional[Path]:
        """Creates a zip archive containing all generated clips, SRTs, and a summary."""
        job = self.get_job(job_id)
        if not job or not job.get("clips"):
            return None

        job_dir = Path(job["output_dir"])
        zip_path = job_dir / f"clipforge_clips_{job_id[:8]}.zip"

        if zip_path.exists():
            return zip_path

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for clip in job["clips"]:
                c_path = Path(clip["file_path"])
                if c_path.exists():
                    zipf.write(c_path, arcname=c_path.name)
                if clip.get("srt_path"):
                    s_path = Path(clip["srt_path"])
                    if s_path.exists():
                        zipf.write(s_path, arcname=s_path.name)

            # Write metadata manifest
            manifest = {
                "job_id": job_id,
                "original_video": job["original_filename"],
                "total_clips": len(job["clips"]),
                "options": job["options"],
                "clips": job["clips"]
            }
            zipf.writestr("clips_manifest.json", json.dumps(manifest, indent=2))

        self.update_job(job_id, zip_path=str(zip_path))
        return zip_path

    def _process_job(self, job_id: str):
        """Main asynchronous processing workflow."""
        job = self.get_job(job_id)
        if not job:
            return

        input_path = Path(job["input_path"])
        job_dir = Path(job["output_dir"])
        opts = job["options"]

        try:
            self.update_job(job_id, status="analyzing", progress=5, stage="Probing video stream & metadata")
            self.add_log(job_id, f"Analyzing video: {input_path.name}")

            meta = get_video_metadata(input_path)
            duration = meta["duration_seconds"]
            src_w = meta["width"] or 1920
            src_h = meta["height"] or 1080
            has_audio = meta["has_audio"]

            self.add_log(job_id, f"Metadata: duration={duration}s, res={src_w}x{src_h}, fps={meta['fps']}, audio={has_audio}")

            if duration <= 0:
                raise ValueError("Could not determine video duration. The file may be corrupt or unreadable.")

            cut_method = opts["cut_method"]
            raw_intervals = []
            transcription_result = None

            # ----------------------------------------------------
            # 1. SEGMENTATION STRATEGY
            # ----------------------------------------------------
            if cut_method == "scene":
                self.update_job(job_id, progress=15, stage="Detecting visual scene transitions with PySceneDetect")
                self.add_log(job_id, f"Running PySceneDetect (threshold={opts['scene_threshold']})...")
                raw_intervals = detect_scenes(
                    input_path,
                    threshold=opts["scene_threshold"],
                    min_scene_len_sec=opts["min_duration"],
                    max_scene_len_sec=opts["max_duration"],
                    target_duration=opts["target_duration"],
                    video_duration=duration
                )

            elif cut_method == "silence":
                self.update_job(job_id, progress=15, stage="Detecting audio silence with FFmpeg silencedetect")
                self.add_log(job_id, f"Detecting silence: noise={opts['silence_noise_db']}dB, min_pause={opts['silence_duration']}s")
                silence_res = extract_active_speech_segments(
                    input_path,
                    video_duration=duration,
                    noise_db=opts["silence_noise_db"],
                    min_silence_duration=opts["silence_duration"],
                    min_clip_len=opts["min_duration"],
                    max_clip_len=opts["max_duration"],
                    target_duration=opts["target_duration"]
                )
                raw_intervals = silence_res["clips"]
                self.update_job(job_id, disclosure=silence_res["explanation"])
                if silence_res.get("warning"):
                    self.add_log(job_id, f"Notice: {silence_res['warning']}")

            elif cut_method == "speech":
                self.update_job(job_id, progress=15, stage="Running Whisper transcription for speech-aware cuts")
                self.add_log(job_id, f"Transcribing audio with Whisper '{opts['whisper_model']}' model...")
                transcription_result = transcribe_video(input_path, model_name=opts["whisper_model"])
                self.update_job(job_id, disclosure=transcription_result.get("disclosure", WHISPER_LIMITATIONS_DISCLOSURE))
                
                if transcription_result["available"] and transcription_result["segments"]:
                    self.add_log(job_id, f"Detected {len(transcription_result['segments'])} speech segments. Aligning cuts to sentence boundaries.")
                    raw_intervals = get_speech_aware_cuts(
                        transcription_result["segments"],
                        video_duration=duration,
                        min_duration=opts["min_duration"],
                        max_duration=opts["max_duration"],
                        target_duration=opts["target_duration"]
                    )
                else:
                    self.add_log(job_id, f"Whisper speech notice: {transcription_result.get('error') or 'No clear speech found.'}. Falling back to duration slicing.")
                    curr = 0.0
                    while curr < duration:
                        nxt = min(curr + opts["target_duration"], duration)
                        if nxt - curr >= opts["min_duration"]:
                            raw_intervals.append((round(curr, 2), round(nxt, 2)))
                        curr = nxt

            else:  # duration
                self.update_job(job_id, progress=15, stage="Slicing video by fixed clip duration")
                self.add_log(job_id, f"Cutting into uniform {opts['target_duration']}s clips...")
                curr = 0.0
                while curr < duration:
                    nxt = min(curr + opts["target_duration"], duration)
                    if nxt - curr >= opts["min_duration"]:
                        raw_intervals.append((round(curr, 2), round(nxt, 2)))
                    curr = nxt

            # Ensure we have at least one valid clip interval
            if not raw_intervals:
                raw_intervals = [(0.0, min(duration, opts["target_duration"]))]

            # Cap maximum clips per job for optimal processing time on long videos
            max_clips_limit = int(opts.get("max_clips", 6))
            if len(raw_intervals) > max_clips_limit:
                self.add_log(job_id, f"Long video ({int(duration)}s) detected: Curating {max_clips_limit} high-impact short clips.")
                raw_intervals = raw_intervals[:max_clips_limit]

            self.add_log(job_id, f"Identified {len(raw_intervals)} target clips to render.")
            self.update_job(job_id, progress=30, stage=f"Rendering {len(raw_intervals)} social clips with {opts['aspect_ratio']} reframing")

            # Check if job was cancelled
            if self.get_job(job_id)["status"] == "cancelled":
                return

            # Optional transcription for subtitles if enabled and not already transcribed
            if opts["enable_subtitles"] and transcription_result is None:
                self.add_log(job_id, "Transcribing video for subtitle generator...")
                transcription_result = transcribe_video(input_path, model_name=opts["whisper_model"])

            # ----------------------------------------------------
            # 2. RENDERING INDIVIDUAL CLIPS
            # ----------------------------------------------------
            rendered_clips = []
            total_clips = len(raw_intervals)

            for idx, (start_s, end_s) in enumerate(raw_intervals, start=1):
                # Check cancellation
                if self.get_job(job_id)["status"] == "cancelled":
                    self.add_log(job_id, "Job cancelled during rendering.")
                    return

                clip_id = f"clip_{idx:02d}"
                clip_filename = f"{clip_id}_{opts['aspect_ratio'].replace(':', 'x')}.mp4"
                clip_path = job_dir / clip_filename
                thumb_filename = f"{clip_id}_thumb.jpg"
                thumb_path = job_dir / thumb_filename

                self.add_log(job_id, f"Processing clip {idx}/{total_clips}: [{start_s:.1f}s - {end_s:.1f}s]")

                # Render video with FFmpeg
                cut_clip(
                    input_path=input_path,
                    output_path=clip_path,
                    start_time=start_s,
                    end_time=end_s,
                    target_aspect=opts["aspect_ratio"],
                    crop_mode=opts["crop_mode"],
                    resolution=opts["resolution"],
                    src_width=src_w,
                    src_height=src_h,
                    has_audio=has_audio
                )

                # Generate thumbnail
                clip_duration = end_s - start_s
                thumb_time = min(1.0, clip_duration / 2)
                generate_thumbnail(clip_path, thumb_path, timestamp=thumb_time)

                # Generate SRT subtitles for clip if transcription available
                srt_path_str = None
                clip_transcript = None
                if transcription_result and transcription_result.get("segments"):
                    # Find segments falling within [start_s, end_s]
                    sub_segs = [
                        s for s in transcription_result["segments"]
                        if s["end"] >= start_s and s["start"] <= end_s
                    ]
                    if sub_segs:
                        srt_content = generate_srt_content(sub_segs, offset_start=start_s)
                        srt_file = job_dir / f"{clip_id}.srt"
                        with open(srt_file, "w", encoding="utf-8") as sf:
                            sf.write(srt_content)
                        srt_path_str = str(srt_file)
                        clip_transcript = " ".join([s["text"] for s in sub_segs])

                clip_meta = {
                    "id": clip_id,
                    "index": idx,
                    "start_time": start_s,
                    "end_time": end_s,
                    "duration": round(clip_duration, 2),
                    "file_name": clip_filename,
                    "file_path": str(clip_path),
                    "thumbnail_name": thumb_filename,
                    "thumbnail_path": str(thumb_path),
                    "srt_path": srt_path_str,
                    "transcript_text": clip_transcript,
                    "aspect_ratio": opts["aspect_ratio"],
                    "resolution": opts["resolution"],
                    "file_size_bytes": clip_path.stat().st_size if clip_path.exists() else 0
                }
                rendered_clips.append(clip_meta)

                # Update progress
                current_pct = int(30 + (idx / total_clips) * 60)
                self.update_job(
                    job_id,
                    progress=current_pct,
                    stage=f"Rendered clip {idx}/{total_clips}",
                    clips=rendered_clips
                )

            # ----------------------------------------------------
            # 3. FINALIZING & BUNDLING
            # ----------------------------------------------------
            self.update_job(job_id, progress=95, stage="Bundling package & generating ZIP archive")
            self.create_zip_archive(job_id)

            self.update_job(
                job_id,
                status="completed",
                progress=100,
                stage="Completed successfully! Clips ready for download.",
                clips=rendered_clips
            )
            self.add_log(job_id, f"Successfully created {len(rendered_clips)} clips!")

        except Exception as e:
            logger.exception(f"Job {job_id} encountered failure: {e}")
            self.update_job(
                job_id,
                status="failed",
                stage="Processing failed",
                error=str(e)
            )
            self.add_log(job_id, f"Error: {e}")

# Global JobManager instance
job_manager = JobManager()

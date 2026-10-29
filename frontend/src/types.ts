export interface VideoMetadata {
  duration_seconds: number;
  width: number;
  height: number;
  fps: number;
  has_audio: boolean;
  video_codec: string;
  audio_codec: string;
  file_size_bytes: number;
}

export interface UploadResponse {
  file_id: string;
  filename: string;
  file_size: number;
  metadata: VideoMetadata;
}

export interface JobOptions {
  cut_method: 'scene' | 'silence' | 'duration' | 'speech';
  aspect_ratio: '9:16' | '16:9' | '1:1';
  crop_mode: 'blur_padding' | 'center_crop' | 'fit_pad';
  resolution: '1080p' | '720p';
  target_duration: number;
  min_duration: number;
  max_duration: number;
  scene_threshold: number;
  silence_noise_db: number;
  silence_duration: number;
  enable_subtitles: boolean;
  whisper_model: string;
}

export interface Clip {
  id: string;
  index: number;
  start_time: number;
  end_time: number;
  duration: number;
  file_name: string;
  file_path: string;
  thumbnail_name: string;
  thumbnail_path: string;
  srt_path?: string | null;
  transcript_text?: string | null;
  aspect_ratio: string;
  resolution: string;
  file_size_bytes: number;
}

export interface Job {
  id: string;
  original_filename: string;
  input_path: string;
  output_dir: string;
  status: 'queued' | 'analyzing' | 'cutting' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  created_at: number;
  updated_at: number;
  options: JobOptions;
  clips: Clip[];
  logs: string[];
  error?: string | null;
  disclosure?: string | null;
  zip_path?: string | null;
}

export interface SystemHealth {
  status: string;
  app_name: string;
  version: string;
  ffmpeg: {
    path: string;
    installed: boolean;
  };
  whisper: {
    available: boolean;
    default_model: string;
    disclosure: string;
  };
  silence_removal_info: string;
  storage: {
    max_upload_size_mb: number;
    free_space_gb: number;
    allowed_extensions: string[];
  };
}

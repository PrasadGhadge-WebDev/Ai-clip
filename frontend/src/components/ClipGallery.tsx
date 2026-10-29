import type { FC } from 'react';
import {
  Download,
  Play,
  FileText,
  Archive,
  Trash2,
  Clock,
  Film,
} from 'lucide-react';
import type { Clip, Job } from '../types';
import {
  getClipDownloadUrl,
  getClipThumbnailUrl,
  getClipSrtUrl,
  getJobZipDownloadUrl,
} from '../api';

interface ClipGalleryProps {
  job: Job;
  onPlayClip: (clip: Clip) => void;
  onDeleteJob: (jobId: string) => void;
}

export const ClipGallery: FC<ClipGalleryProps> = ({ job, onPlayClip, onDeleteJob }) => {
  const clips = job.clips || [];

  const totalDuration = clips.reduce((acc, c) => acc + c.duration, 0);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (clips.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-2xl border border-[#272b38] text-center space-y-3">
        <Film className="w-12 h-12 mx-auto text-zinc-600" />
        <h4 className="text-base font-bold text-white">No clips generated yet</h4>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Start a processing job from the configuration panel to slice this video into social media shorts!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Gallery Header Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-[#272b38] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">Generated Short Clips</h3>
            <span className="text-xs font-mono font-bold bg-indigo-500/15 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              {clips.length} clips ({formatSeconds(totalDuration)} total)
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Optimized for {job.options.aspect_ratio} • {job.options.resolution} • {job.options.crop_mode.replace('_', ' ')}
          </p>
        </div>

        {/* Global Download & Cleanup Actions */}
        <div className="flex items-center gap-2.5">
          <a
            href={getJobZipDownloadUrl(job.id)}
            download
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
          >
            <Archive className="w-4 h-4" />
            <span>Download All (ZIP)</span>
          </a>

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this job and all its video files?')) {
                onDeleteJob(job.id);
              }
            }}
            className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/30 border border-[#272b38] hover:border-red-800 transition-colors"
            title="Delete this job and remove all stored files from server"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Clips Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {clips.map((clip) => (
          <div
            key={clip.id}
            className="glass-card rounded-2xl border border-[#272b38] overflow-hidden flex flex-col group"
          >
            {/* Card Thumbnail / Preview Trigger */}
            <div
              onClick={() => onPlayClip(clip)}
              className="relative aspect-[9/16] bg-black cursor-pointer overflow-hidden flex items-center justify-center"
            >
              <img
                src={getClipThumbnailUrl(job.id, clip.id)}
                alt={`Clip ${clip.index}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  // Fallback if thumbnail hasn't loaded yet
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />

              {/* Play Overlay Button */}
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shadow-xl group-hover:scale-110 group-hover:bg-indigo-600 transition-all">
                  <Play className="w-5 h-5 ml-0.5 fill-white" />
                </div>
              </div>

              {/* Badges on Thumbnail */}
              <div className="absolute top-2.5 left-2.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white border border-white/20">
                  Clip #{clip.index}
                </span>
              </div>

              <div className="absolute top-2.5 right-2.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-900/80 backdrop-blur-md text-indigo-200 border border-indigo-500/40">
                  {clip.aspect_ratio}
                </span>
              </div>

              <div className="absolute bottom-2.5 right-2.5">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-white flex items-center gap-1 border border-white/10">
                  <Clock className="w-3 h-3 text-indigo-400" />
                  {clip.duration}s
                </span>
              </div>

              <div className="absolute bottom-2.5 left-2.5">
                <span className="text-[10px] font-mono text-zinc-300 bg-black/60 px-1.5 py-0.5 rounded">
                  {formatSeconds(clip.start_time)} - {formatSeconds(clip.end_time)}
                </span>
              </div>
            </div>

            {/* Card Content & Meta */}
            <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white truncate">{clip.file_name}</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {formatBytes(clip.file_size_bytes)}
                  </span>
                </div>

                {/* Subtitle / Transcript Snippet */}
                {clip.transcript_text && (
                  <p className="text-[11px] text-zinc-300 italic line-clamp-2 mt-1 bg-[#141622] p-1.5 rounded border border-[#272b38]">
                    "{clip.transcript_text}"
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-[#232736]">
                <a
                  href={getClipDownloadUrl(job.id, clip.id)}
                  download
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 text-center flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>

                {clip.srt_path && (
                  <a
                    href={getClipSrtUrl(job.id, clip.id)}
                    download
                    title="Download Subtitles (.SRT)"
                    className="p-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-800/60 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

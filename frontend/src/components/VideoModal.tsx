import { useState, useEffect, useRef, type FC } from 'react';
import { X, Download, RotateCcw, FileText } from 'lucide-react';
import type { Clip } from '../types';
import { getClipStreamUrl, getClipDownloadUrl, getClipSrtUrl } from '../api';

interface VideoModalProps {
  clip: Clip | null;
  jobId: string;
  onClose: () => void;
}

export const VideoModal: FC<VideoModalProps> = ({ clip, jobId, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!clip) return null;

  const streamUrl = getClipStreamUrl(jobId, clip.id);
  const downloadUrl = getClipDownloadUrl(jobId, clip.id);

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const isVertical = clip.aspect_ratio === '9:16';
  const isSquare = clip.aspect_ratio === '1:1';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`glass-panel rounded-2xl border border-[#272b38] overflow-hidden flex flex-col max-h-[92vh] ${
          isVertical ? 'w-full max-w-sm' : isSquare ? 'w-full max-w-lg' : 'w-full max-w-3xl'
        }`}
      >
        {/* Header */}
        <div className="p-3.5 border-b border-[#272b38] flex items-center justify-between bg-[#12141c]">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Clip #{clip.index}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                {clip.aspect_ratio} • {clip.duration}s
              </span>
            </h4>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative bg-black flex items-center justify-center flex-1 overflow-hidden min-h-[300px]">
          <video
            ref={videoRef}
            src={streamUrl}
            controls
            autoPlay
            loop={isLooping}
            playsInline
            className="max-h-[65vh] w-auto mx-auto object-contain"
          />
        </div>

        {/* Transcript Excerpt if available */}
        {clip.transcript_text && (
          <div className="px-4 py-2 bg-[#0e1017] border-t border-[#232736] text-[11px] text-zinc-300">
            <span className="font-semibold text-indigo-400">Transcript: </span>
            <span>"{clip.transcript_text}"</span>
          </div>
        )}

        {/* Controls & Download Footer */}
        <div className="p-3.5 border-t border-[#272b38] bg-[#12141c] flex flex-wrap items-center justify-between gap-3">
          {/* Speed & Loop */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400 text-[11px]">Speed:</span>
            {[1, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => handleRateChange(rate)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  playbackRate === rate
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`ml-2 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                isLooping ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-500'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Loop</span>
            </button>
          </div>

          {/* Download Buttons */}
          <div className="flex items-center gap-2">
            {clip.srt_path && (
              <a
                href={getClipSrtUrl(jobId, clip.id)}
                download
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-800 transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>SRT</span>
              </a>
            )}

            <a
              href={downloadUrl}
              download
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download MP4</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

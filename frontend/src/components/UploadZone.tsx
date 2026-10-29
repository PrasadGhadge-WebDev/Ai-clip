import { useState, useRef, type FC, type DragEvent, type ChangeEvent, type FormEvent } from 'react';
import {
  UploadCloud,
  Film,
  CheckCircle,
  AlertCircle,
  X,
  Sparkles,
  RefreshCw,
  Volume2,
  VolumeX,
  Link2,
  Globe,
  ArrowRight,
  FileVideo,
} from 'lucide-react';
import type { UploadResponse } from '../types';
import { uploadVideo, generateSyntheticSample, fetchVideoFromUrl } from '../api';

interface UploadZoneProps {
  currentUpload: UploadResponse | null;
  onUploadSuccess: (data: UploadResponse) => void;
  onClearUpload: () => void;
  maxSizeMb?: number;
}

export const UploadZone: FC<UploadZoneProps> = ({
  currentUpload,
  onUploadSuccess,
  onClearUpload,
  maxSizeMb = 500,
}) => {
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [videoUrl, setVideoUrl] = useState('');
  const [fetchingLink, setFetchingLink] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatingSample, setGeneratingSample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensions = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'];

  const validateAndUpload = async (file: File) => {
    setErrorMessage(null);

    // Validate extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setErrorMessage(`Invalid video format. Supported: ${allowedExtensions.join(', ')}`);
      return;
    }

    // Validate size
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > maxSizeMb) {
      setErrorMessage(`File is too large (${sizeMb.toFixed(1)}MB). Maximum allowed is ${maxSizeMb}MB.`);
      return;
    }

    try {
      setUploading(true);
      setUploadPercent(0);
      const res = await uploadVideo(file, (pct) => setUploadPercent(pct));
      onUploadSuccess(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const handleImportLink = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = videoUrl.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a valid video link.');
      return;
    }

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setErrorMessage('URL must start with http:// or https://');
      return;
    }

    setErrorMessage(null);
    setFetchingLink(true);
    try {
      const res = await fetchVideoFromUrl(trimmed);
      onUploadSuccess(res);
      setVideoUrl('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to download video from the provided link.');
    } finally {
      setFetchingLink(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const handleGenerateSample = async () => {
    setErrorMessage(null);
    try {
      setGeneratingSample(true);
      const res = await generateSyntheticSample();
      onUploadSuccess(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate demo sample');
    } finally {
      setGeneratingSample(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full space-y-3">
      {/* Uploaded Video State */}
      {currentUpload ? (
        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-[#121420] to-[#151928] shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Film className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md">
                    {currentUpload.filename}
                  </h3>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle className="w-3 h-3" /> Ready
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1.5">
                  <span className="bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300 font-mono">
                    {formatSeconds(currentUpload.metadata.duration_seconds)} ({currentUpload.metadata.duration_seconds}s)
                  </span>
                  <span className="bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300 font-mono">
                    {currentUpload.metadata.width} × {currentUpload.metadata.height}
                  </span>
                  <span className="bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300 font-mono">
                    {formatBytes(currentUpload.file_size)}
                  </span>
                  <span className="flex items-center gap-1 text-zinc-300">
                    {currentUpload.metadata.has_audio ? (
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                    )}
                    {currentUpload.metadata.has_audio ? 'Audio detected' : 'No audio'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClearUpload}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Remove and choose different video"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Option Selector: File vs Link */}
          <div className="flex items-center p-1 bg-[#12141e] border border-[#232736] rounded-xl w-full">
            <button
              type="button"
              onClick={() => {
                setUploadMode('file');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                uploadMode === 'file'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileVideo className="w-3.5 h-3.5" />
              <span>Upload Video File</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUploadMode('link');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                uploadMode === 'link'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Paste Video Link (YouTube/URL)</span>
            </button>
          </div>

          {/* Mode 1: File Dropzone */}
          {uploadMode === 'file' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-500/10 shadow-2xl shadow-indigo-500/20 scale-[1.01]'
                  : 'border-[#2c3244] hover:border-indigo-500/50 bg-[#10121a]/70 hover:bg-[#131622]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={allowedExtensions.join(',')}
                onChange={handleFileChange}
                className="hidden"
              />

              {uploading ? (
                <div className="py-4 max-w-sm mx-auto">
                  <RefreshCw className="w-8 h-8 mx-auto text-indigo-400 animate-spin mb-3" />
                  <p className="text-sm font-semibold text-white mb-2">
                    Uploading video... {uploadPercent}%
                  </p>
                  <div className="w-full bg-[#1e2230] rounded-full h-2 overflow-hidden border border-[#2c3244]">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-200"
                      style={{ width: `${uploadPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">
                    Extracting video stream headers & audio tracks...
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">
                      Drop your long video here, or <span className="text-indigo-400 underline underline-offset-2">browse</span>
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Supports MP4, MOV, MKV, WebM, AVI (up to {maxSizeMb}MB)
                    </p>
                  </div>

                  {/* Instant Test Sample Action */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateSample();
                      }}
                      disabled={generatingSample}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-purple-300 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/60 transition-all hover:scale-105"
                    >
                      {generatingSample ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      )}
                      <span>No video handy? Generate an instant 15s test sample</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: Link Input */
            <div className="glass-panel p-6 rounded-2xl border border-[#272b38] bg-[#10121a]/90 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Import from Video URL</h3>
                  <p className="text-xs text-zinc-400">
                    Paste any public link from YouTube, Vimeo, TikTok, or direct video URL (.mp4).
                  </p>
                </div>
              </div>

              <form onSubmit={handleImportLink} className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or direct MP4 link"
                    disabled={fetchingLink}
                    className="w-full pl-10 pr-4 py-3 bg-[#151724] border border-[#2a2f42] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Supported:</span>
                    <span className="text-[10px] bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">YouTube</span>
                    <span className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded-full font-medium">Vimeo</span>
                    <span className="text-[10px] bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded-full font-medium">TikTok</span>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">Direct MP4</span>
                  </div>

                  <button
                    type="submit"
                    disabled={fetchingLink || !videoUrl.trim()}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-md shadow-indigo-600/30 transition-all"
                  >
                    {fetchingLink ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Downloading Link...</span>
                      </>
                    ) : (
                      <>
                        <span>Fetch Video</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {fetchingLink && (
                <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-indigo-200 text-xs flex items-center gap-2.5 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                  <span>Connecting to source, extracting video stream & analyzing audio tracks with FFmpeg...</span>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


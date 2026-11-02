import { useState, type FC } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Terminal,
  RefreshCw,
  Ban,
  Sparkles,
} from 'lucide-react';
import type { Job } from '../types';

interface JobProgressProps {
  job: Job;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
}

export const JobProgress: FC<JobProgressProps> = ({ job, onCancel, onRetry }) => {
  const [showLogs, setShowLogs] = useState(false);

  const isRunning = ['queued', 'downloading', 'analyzing', 'cutting'].includes(job.status);
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';

  return (
    <div className="glass-panel p-6 rounded-2xl border border-[#272b38] space-y-5">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isRunning && (
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
          )}
          {isCompleted && (
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          )}
          {isFailed && (
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
          )}
          {isCancelled && (
            <div className="w-10 h-10 rounded-xl bg-zinc-500/15 border border-zinc-500/30 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-zinc-400" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white truncate max-w-xs sm:max-w-md">
                {job.original_filename}
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isRunning
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : isCompleted
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : isFailed
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-zinc-700/50 text-zinc-400'
                }`}
              >
                {job.status}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
              <span>{job.stage}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={() => onCancel(job.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 transition-colors"
            >
              <Ban className="w-3.5 h-3.5 text-zinc-400" />
              <span>Cancel Job</span>
            </button>
          )}

          {isFailed && (
            <button
              onClick={() => onRetry(job.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900 border border-indigo-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Job</span>
            </button>
          )}

          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              showLogs
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'bg-[#151722] text-zinc-400 border-[#272b38] hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Logs ({job.logs.length})</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-zinc-400 font-medium">Processing Progress</span>
          <span className="font-mono font-bold text-white">{job.progress}%</span>
        </div>
        <div className="w-full bg-[#1b1e2a] rounded-full h-2.5 overflow-hidden border border-[#272b38]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : isFailed
                ? 'bg-red-500'
                : isCancelled
                ? 'bg-zinc-600'
                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 animate-pulse'
            }`}
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>

      {/* Error Banner */}
      {job.error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Error Processing Video:</p>
            <p className="text-red-300 font-mono text-[11px] break-all">{job.error}</p>
          </div>
        </div>
      )}

      {/* Disclosure banner if silence / speech method was selected */}
      {job.disclosure && (
        <div className="p-3 rounded-xl bg-[#141724] border border-[#262c3e] text-zinc-300 text-xs flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-zinc-300">{job.disclosure}</p>
        </div>
      )}

      {/* Terminal Logs Viewer */}
      {showLogs && (
        <div className="rounded-xl bg-[#0b0c10] border border-[#202433] p-3 text-[11px] font-mono max-h-52 overflow-y-auto space-y-1 text-zinc-300">
          {job.logs.length === 0 ? (
            <p className="text-zinc-500 italic">No log entries yet.</p>
          ) : (
            job.logs.map((log, i) => (
              <div key={i} className="leading-relaxed hover:bg-zinc-900/50 px-1 rounded">
                {log}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

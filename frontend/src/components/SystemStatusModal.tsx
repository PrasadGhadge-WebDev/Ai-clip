import { useState, type FC } from 'react';
import {
  X,
  Activity,
  HardDrive,
  Cpu,
  Trash2,
  CheckCircle,
  Info,
  RefreshCw,
} from 'lucide-react';
import type { SystemHealth } from '../types';
import { triggerCleanup } from '../api';

interface SystemStatusModalProps {
  health: SystemHealth | null;
  onClose: () => void;
  onRefreshHealth: () => void;
}

export const SystemStatusModal: FC<SystemStatusModalProps> = ({
  health,
  onClose,
  onRefreshHealth,
}) => {
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  if (!health) return null;

  const handleCleanup = async () => {
    try {
      setCleaning(true);
      setCleanupMessage(null);
      const res = await triggerCleanup(24);
      setCleanupMessage(res.message);
      onRefreshHealth();
    } catch (err: any) {
      setCleanupMessage(err.message || 'Cleanup failed');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-2xl rounded-2xl border border-[#272b38] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#272b38] flex items-center justify-between bg-[#12141c]">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">System Status & Processing Architecture</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* FFmpeg Status */}
          <div className="p-4 rounded-xl bg-[#141620] border border-[#272b38] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  FFmpeg Core Engine
                </span>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle className="w-3 h-3" /> Operational
              </span>
            </div>
            <p className="text-xs text-zinc-300">
              Binary Path: <code className="text-indigo-300 text-[11px] font-mono break-all">{health.ffmpeg.path}</code>
            </p>
            <p className="text-[11px] text-zinc-400">
              FFmpeg handles video decoding, aspect ratio filters (split, boxblur, crop, pad), audio normalization, and faststart MP4 rendering.
            </p>
          </div>

          {/* Whisper AI Status */}
          <div className="p-4 rounded-xl bg-[#141620] border border-[#272b38] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Local Speech AI (faster-whisper)
                </span>
              </div>
              <span
                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  health.whisper.available
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }`}
              >
                {health.whisper.available ? 'Ready (Local CPU/GPU)' : 'Optional'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              {health.whisper.disclosure}
            </p>
          </div>

          {/* Silence Removal Details */}
          <div className="p-4 rounded-xl bg-[#141620] border border-[#272b38] space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Silence Removal Science & Thresholds
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              {health.silence_removal_info}
            </p>
          </div>

          {/* Storage & Retention */}
          <div className="p-4 rounded-xl bg-[#141620] border border-[#272b38] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Disk Storage & Security
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-purple-300">
                {health.storage.free_space_gb} GB Free
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 pt-1">
              <div>
                <span className="text-zinc-500">Max Upload Limit:</span>{' '}
                <span className="text-zinc-200 font-bold">{health.storage.max_upload_size_mb} MB</span>
              </div>
              <div>
                <span className="text-zinc-500">Allowed Formats:</span>{' '}
                <span className="text-zinc-200 font-bold">{health.storage.allowed_extensions.join(', ')}</span>
              </div>
            </div>
          </div>

          {/* Manual Cleanup Action */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-semibold text-white">Temporary Files Maintenance</p>
              <p className="text-[11px] text-zinc-400">Purge files and jobs older than 24 hours.</p>
            </div>
            <button
              onClick={handleCleanup}
              disabled={cleaning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900 border border-red-800 transition-colors disabled:opacity-50"
            >
              {cleaning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Purge Temporary Files</span>
            </button>
          </div>

          {cleanupMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs">
              {cleanupMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import type { FC } from 'react';
import { Scissors, Sparkles, Activity, RefreshCw } from 'lucide-react';
import type { SystemHealth } from '../types';

interface HeaderProps {
  health: SystemHealth | null;
  onOpenSystemModal: () => void;
  onQuickSample: () => void;
  sampleLoading: boolean;
  activeTab: 'studio' | 'jobs';
  setActiveTab: (tab: 'studio' | 'jobs') => void;
  jobsCount: number;
}

export const Header: FC<HeaderProps> = ({
  health,
  onOpenSystemModal,
  onQuickSample,
  sampleLoading,
  activeTab,
  setActiveTab,
  jobsCount,
}) => {
  const isHealthy = health?.ffmpeg.installed ?? true;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#272b38] bg-[#0d0e14]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <Scissors className="w-5 h-5 text-white transform -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white">ClipForge</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                AI
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 tracking-wide hidden sm:block">
              Shorts • Reels • TikTok Automated AI Video Clipper
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-[#151720] p-1 rounded-xl border border-[#272b38]">
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'studio'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Create Clips
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'jobs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Jobs & History</span>
            {jobsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/60 text-indigo-300 border border-indigo-500/40">
                {jobsCount}
              </span>
            )}
          </button>
        </nav>

        {/* Actions & Status */}
        <div className="flex items-center gap-2.5">
          {/* Quick Demo Sample Generator Button */}
          <button
            onClick={onQuickSample}
            disabled={sampleLoading}
            title="Generate a 15-second synthetic test video using FFmpeg instantly without downloading any file!"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-300 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/50 hover:border-purple-600 transition-all disabled:opacity-50"
          >
            {sampleLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>Generate Demo Video</span>
          </button>

          {/* System Status Pill */}
          <button
            onClick={onOpenSystemModal}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#161822] hover:bg-[#1e2230] border border-[#2c3244] text-xs transition-colors"
            title="Click to view FFmpeg and system details"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-zinc-300 font-medium hidden sm:inline">
              {isHealthy ? 'Engine Active' : 'Setup Needed'}
            </span>
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      </div>
    </header>
  );
};

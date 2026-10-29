import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { ConfigPanel } from './components/ConfigPanel';
import { JobProgress } from './components/JobProgress';
import { ClipGallery } from './components/ClipGallery';
import { VideoModal } from './components/VideoModal';
import { SystemStatusModal } from './components/SystemStatusModal';
import type {
  UploadResponse,
  Job,
  JobOptions,
  SystemHealth,
  Clip,
} from './types';
import {
  fetchHealth,
  createJob,
  fetchJobs,
  fetchJob,
  cancelJob,
  retryJob,
  deleteJob,
  generateSyntheticSample,
} from './api';
import {
  Trash2,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

export function App() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [activeTab, setActiveTab] = useState<'studio' | 'jobs'>('studio');
  const [currentUpload, setCurrentUpload] = useState<UploadResponse | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [activeModalClip, setActiveModalClip] = useState<Clip | null>(null);
  const [showSystemModal, setShowSystemModal] = useState<boolean>(false);
  const [sampleLoading, setSampleLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [options, setOptions] = useState<JobOptions>({
    cut_method: 'scene',
    aspect_ratio: '9:16',
    crop_mode: 'blur_padding',
    resolution: '1080p',
    target_duration: 30,
    min_duration: 5,
    max_duration: 60,
    scene_threshold: 27.0,
    silence_noise_db: -30.0,
    silence_duration: 0.5,
    enable_subtitles: false,
    whisper_model: 'tiny',
  });

  // Load system health & initial jobs
  const loadInitialData = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
      const jobs = await fetchJobs();
      setJobsList(jobs);
      // If there's an ongoing or latest job, pick it
      if (jobs.length > 0) {
        setCurrentJob((prev) => prev || jobs[0]);
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Poll current job if running
  useEffect(() => {
    if (!currentJob) return;
    const isRunning = ['queued', 'analyzing', 'cutting'].includes(currentJob.status);
    if (!isRunning) return;

    const jobId = currentJob.id;
    const interval = setInterval(async () => {
      try {
        const updated = await fetchJob(jobId);
        setCurrentJob(updated);
        // Refresh jobs list
        const jobs = await fetchJobs();
        setJobsList(jobs);
      } catch (err) {
        console.error('Error polling job:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentJob?.id, currentJob?.status]);

  // Handle Quick Demo generation from header
  const handleQuickDemo = async () => {
    try {
      setSampleLoading(true);
      setGlobalError(null);
      const res = await generateSyntheticSample();
      setCurrentUpload(res);
      setActiveTab('studio');
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to generate demo sample');
    } finally {
      setSampleLoading(false);
    }
  };

  // Submit new clipping job
  const handleSubmitJob = async () => {
    if (!currentUpload) return;
    try {
      setIsSubmitting(true);
      setGlobalError(null);
      const newJob = await createJob(currentUpload.file_id, options);
      setCurrentJob(newJob);
      const jobs = await fetchJobs();
      setJobsList(jobs);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to start clipping job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      const updated = await fetchJob(jobId);
      setCurrentJob(updated);
      const jobs = await fetchJobs();
      setJobsList(jobs);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to cancel job');
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const retried = await retryJob(jobId);
      setCurrentJob(retried);
      const jobs = await fetchJobs();
      setJobsList(jobs);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to retry job');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      if (currentJob?.id === jobId) {
        setCurrentJob(null);
      }
      const jobs = await fetchJobs();
      setJobsList(jobs);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to delete job');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Top Navigation */}
      <Header
        health={health}
        onOpenSystemModal={() => setShowSystemModal(true)}
        onQuickSample={handleQuickDemo}
        sampleLoading={sampleLoading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        jobsCount={jobsList.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Global Error Banner */}
        {globalError && (
          <div className="p-4 rounded-2xl bg-red-950/50 border border-red-800 text-red-200 text-xs flex items-center justify-between shadow-xl">
            <span>{globalError}</span>
            <button
              onClick={() => setGlobalError(null)}
              className="text-red-300 hover:text-white font-bold ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 1: Studio / Creator Mode */}
        {activeTab === 'studio' && (
          <div className="space-y-8">
            {/* Step 1 & 2 Grid: Upload & Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Upload Zone (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <h2 className="text-base font-bold text-white">Source Video File</h2>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 ml-8">
                    Select a podcast, gameplay clip, webinar, or long video to repurpose.
                  </p>
                </div>

                <UploadZone
                  currentUpload={currentUpload}
                  onUploadSuccess={(res) => setCurrentUpload(res)}
                  onClearUpload={() => setCurrentUpload(null)}
                  maxSizeMb={health?.storage.max_upload_size_mb || 500}
                />
              </div>

              {/* Right Column: AI Cutting Settings (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h2 className="text-base font-bold text-white">Reframing & Segmentation Rules</h2>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 ml-8">
                    Choose visual scene detection, silence detection, or speech-aware highlights.
                  </p>
                </div>

                <ConfigPanel
                  options={options}
                  onChange={setOptions}
                  onSubmit={handleSubmitJob}
                  disabled={!currentUpload || isSubmitting}
                  whisperAvailable={health?.whisper.available ?? true}
                />
              </div>
            </div>

            {/* Active Job Progress Section */}
            {currentJob && (
              <div className="space-y-4 pt-4 border-t border-[#232736]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <h2 className="text-base font-bold text-white">Processing Engine Status</h2>
                  </div>
                </div>

                <JobProgress
                  job={currentJob}
                  onCancel={handleCancelJob}
                  onRetry={handleRetryJob}
                />

                {/* Rendered Clips Gallery for Current Job */}
                {currentJob.status === 'completed' && (
                  <div className="pt-4">
                    <ClipGallery
                      job={currentJob}
                      onPlayClip={(clip) => setActiveModalClip(clip)}
                      onDeleteJob={handleDeleteJob}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Jobs & History */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Jobs & Processed Clips History</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  View past render runs, review generated social clips, or download archive packages.
                </p>
              </div>
              <button
                onClick={loadInitialData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#151722] hover:bg-[#1d2030] border border-[#272b38] text-zinc-300 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {jobsList.length === 0 ? (
              <div className="glass-panel p-16 rounded-2xl border border-[#272b38] text-center space-y-3">
                <FolderOpen className="w-12 h-12 mx-auto text-zinc-600" />
                <h4 className="text-base font-bold text-white">No jobs recorded yet</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Switch to the Studio tab to upload a video or click 'Generate Demo Video' to see ClipForge AI in action!
                </p>
                <button
                  onClick={() => setActiveTab('studio')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                  Go to Studio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {jobsList.map((j) => (
                  <div
                    key={j.id}
                    className={`glass-panel p-5 rounded-2xl border transition-all ${
                      currentJob?.id === j.id
                        ? 'border-indigo-500/50 ring-1 ring-indigo-500/30'
                        : 'border-[#272b38] hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#232736]">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{j.original_filename}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              j.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : j.status === 'failed'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-indigo-500/20 text-indigo-300'
                            }`}
                          >
                            {j.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1">
                          <span>Method: <strong className="text-zinc-200">{j.options.cut_method}</strong></span>
                          <span>Format: <strong className="text-zinc-200">{j.options.aspect_ratio} ({j.options.crop_mode.replace('_', ' ')})</strong></span>
                          <span>Duration: <strong className="text-zinc-200">{j.options.target_duration}s</strong></span>
                          <span>Clips: <strong className="text-zinc-200">{j.clips?.length || 0}</strong></span>
                          <span className="text-zinc-500">
                            {new Date(j.created_at * 1000).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCurrentJob(j);
                            setActiveTab('studio');
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                        >
                          View in Studio
                        </button>
                        <button
                          onClick={() => handleDeleteJob(j.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/30 border border-[#272b38] transition-colors"
                          title="Delete this job and remove files"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Clips Thumbnail Strip */}
                    {j.clips && j.clips.length > 0 && (
                      <div className="pt-4">
                        <ClipGallery
                          job={j}
                          onPlayClip={(clip) => setActiveModalClip(clip)}
                          onDeleteJob={handleDeleteJob}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Video Streaming Player Modal */}
      {activeModalClip && currentJob && (
        <VideoModal
          clip={activeModalClip}
          jobId={currentJob.id}
          onClose={() => setActiveModalClip(null)}
        />
      )}

      {/* System Status & Architecture Modal */}
      {showSystemModal && (
        <SystemStatusModal
          health={health}
          onClose={() => setShowSystemModal(false)}
          onRefreshHealth={loadInitialData}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-[#1d202c] py-6 text-center text-xs text-zinc-500 bg-[#08090d]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            <strong className="text-zinc-400">ClipForge AI</strong> — Production-grade video cutter for Reels, Shorts, and TikTok.
          </p>
          <div className="flex items-center gap-4 text-zinc-500">
            <span>FFmpeg & PySceneDetect Powered</span>
            <span>•</span>
            <span>Local Processing (No paid APIs required)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

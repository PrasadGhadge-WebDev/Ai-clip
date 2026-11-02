import { useState, type FC } from 'react';
import {
  Sliders,
  Scissors,
  VolumeX,
  Clock,
  Mic,
  Tv,
  Smartphone,
  Square,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { JobOptions } from '../types';

interface ConfigPanelProps {
  options: JobOptions;
  onChange: (options: JobOptions) => void;
  onSubmit: () => void;
  disabled: boolean;
  whisperAvailable: boolean;
}

export const ConfigPanel: FC<ConfigPanelProps> = ({
  options,
  onChange,
  onSubmit,
  disabled,
  whisperAvailable,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const applyPreset = (preset: 'reels' | 'shorts' | 'tiktok' | 'square' | 'landscape') => {
    switch (preset) {
      case 'reels':
        onChange({
          ...options,
          aspect_ratio: '9:16',
          crop_mode: 'blur_padding',
          target_duration: 30,
          resolution: '1080p',
          cut_method: 'scene',
        });
        break;
      case 'shorts':
        onChange({
          ...options,
          aspect_ratio: '9:16',
          crop_mode: 'blur_padding',
          target_duration: 60,
          resolution: '1080p',
          cut_method: 'scene',
        });
        break;
      case 'tiktok':
        onChange({
          ...options,
          aspect_ratio: '9:16',
          crop_mode: 'center_crop',
          target_duration: 15,
          resolution: '1080p',
          cut_method: 'silence',
        });
        break;
      case 'square':
        onChange({
          ...options,
          aspect_ratio: '1:1',
          crop_mode: 'blur_padding',
          target_duration: 30,
          resolution: '1080p',
        });
        break;
      case 'landscape':
        onChange({
          ...options,
          aspect_ratio: '16:9',
          crop_mode: 'fit_pad',
          target_duration: 45,
          resolution: '1080p',
        });
        break;
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-[#272b38] space-y-6">
      {/* Platform Presets Bar */}
      <div>
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2.5">
          Quick Platform Presets
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => applyPreset('reels')}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              options.aspect_ratio === '9:16' && options.target_duration === 30
                ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-md shadow-indigo-500/20'
                : 'border-[#272b38] bg-[#141620] text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Smartphone className="w-3.5 h-3.5 text-pink-400" />
              <span>IG Reels</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">9:16 • 30s Blur</p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('shorts')}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              options.aspect_ratio === '9:16' && options.target_duration === 60
                ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-md shadow-indigo-500/20'
                : 'border-[#272b38] bg-[#141620] text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Smartphone className="w-3.5 h-3.5 text-red-400" />
              <span>YT Shorts</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">9:16 • 60s Blur</p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('tiktok')}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              options.aspect_ratio === '9:16' && options.target_duration === 15 && options.crop_mode === 'center_crop'
                ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-md shadow-indigo-500/20'
                : 'border-[#272b38] bg-[#141620] text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>TikTok</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">9:16 • 15s Fast</p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('square')}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              options.aspect_ratio === '1:1'
                ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-md shadow-indigo-500/20'
                : 'border-[#272b38] bg-[#141620] text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Square className="w-3.5 h-3.5 text-amber-400" />
              <span>Feed 1:1</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">Square Post</p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('landscape')}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              options.aspect_ratio === '16:9'
                ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-md shadow-indigo-500/20'
                : 'border-[#272b38] bg-[#141620] text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Tv className="w-3.5 h-3.5 text-emerald-400" />
              <span>16:9 Wide</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">Horizontal HD</p>
          </button>
        </div>
      </div>

      {/* Primary Cutting Method */}
      <div>
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2.5">
          Detection & Cutting Engine
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* 1. PySceneDetect */}
          <button
            type="button"
            onClick={() => onChange({ ...options, cut_method: 'scene' })}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              options.cut_method === 'scene'
                ? 'border-indigo-500 bg-indigo-500/10 text-white ring-1 ring-indigo-500/40'
                : 'border-[#272b38] bg-[#141620] text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-white">
              <Scissors className="w-4 h-4 text-indigo-400" />
              <span>Scene Cuts</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
              PySceneDetect camera switch & transition detection
            </p>
          </button>

          {/* 2. FFmpeg Silence Detection */}
          <button
            type="button"
            onClick={() => onChange({ ...options, cut_method: 'silence' })}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              options.cut_method === 'silence'
                ? 'border-indigo-500 bg-indigo-500/10 text-white ring-1 ring-indigo-500/40'
                : 'border-[#272b38] bg-[#141620] text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-white">
              <VolumeX className="w-4 h-4 text-purple-400" />
              <span>Silence Removal</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
              FFmpeg silencedetect removes dead air & pauses
            </p>
          </button>

          {/* 3. Whisper Speech-Aware */}
          <button
            type="button"
            onClick={() => onChange({ ...options, cut_method: 'speech', enable_subtitles: true })}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              options.cut_method === 'speech'
                ? 'border-indigo-500 bg-indigo-500/10 text-white ring-1 ring-indigo-500/40'
                : 'border-[#272b38] bg-[#141620] text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs text-white">
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Speech-Aware</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                AI Whisper
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
              Aligns cuts around full sentences & speaker intervals
            </p>
          </button>

          {/* 4. Fixed Duration */}
          <button
            type="button"
            onClick={() => onChange({ ...options, cut_method: 'duration' })}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              options.cut_method === 'duration'
                ? 'border-indigo-500 bg-indigo-500/10 text-white ring-1 ring-indigo-500/40'
                : 'border-[#272b38] bg-[#141620] text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-white">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Uniform Slices</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
              Precise uniform intervals (e.g. exactly 30s or 60s)
            </p>
          </button>
        </div>

        {/* Silence Notice Alert */}
        {options.cut_method === 'silence' && (
          <div className="mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">FFmpeg Audio Silence Detection Notice:</p>
              <p className="text-zinc-300 mt-0.5">
                Silencedetect strips dead silence between speech. If volume threshold is too aggressive
                (-20dB vs -30dB), trailing whispers or quiet consonants might be clipped.
              </p>
            </div>
          </div>
        )}

        {/* Speech Aware Limitation Alert */}
        {options.cut_method === 'speech' && (
          <div className="mt-3 p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-indigo-300 text-xs flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Speech-Aware Highlight Selection Disclosure:</p>
              <p className="text-zinc-300 mt-0.5">
                Uses local open-source Whisper. Cuts are snapped to sentence boundaries. Heavy background music
                or strong accents may influence word timestamp precision.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Aspect Ratio & Crop / Framing Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Aspect Ratio */}
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2.5">
            Output Aspect Ratio
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: '9:16', label: '9:16 Vertical', desc: 'Reels / Shorts / TikTok' },
              { id: '1:1', label: '1:1 Square', desc: 'Instagram Grid' },
              { id: '16:9', label: '16:9 Wide', desc: 'YouTube Standard' },
            ].map((ar) => (
              <button
                key={ar.id}
                type="button"
                onClick={() => onChange({ ...options, aspect_ratio: ar.id as any })}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  options.aspect_ratio === ar.id
                    ? 'border-indigo-500 bg-indigo-500/15 text-white font-bold'
                    : 'border-[#272b38] bg-[#141620] text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <div className="text-xs">{ar.label}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{ar.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Framing / Crop Style */}
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2.5">
            Framing Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'blur_padding', label: 'Blurred BG', desc: 'Aesthetic padding' },
              { id: 'center_crop', label: 'Center Crop', desc: 'Fill entire frame' },
              { id: 'fit_pad', label: 'Letterbox', desc: 'Fit with borders' },
            ].map((cm) => (
              <button
                key={cm.id}
                type="button"
                onClick={() => onChange({ ...options, crop_mode: cm.id as any })}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  options.crop_mode === cm.id
                    ? 'border-indigo-500 bg-indigo-500/15 text-white font-bold'
                    : 'border-[#272b38] bg-[#141620] text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <div className="text-xs">{cm.label}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{cm.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Target Duration & Resolution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
        {/* Target Clip Duration Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Target Clip Duration
            </label>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
              {options.target_duration}s
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="120"
            step="5"
            value={options.target_duration}
            onChange={(e) => onChange({ ...options, target_duration: Number(e.target.value) })}
            className="w-full h-2 bg-[#1b1e2b] rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
            <span>10s (Fast hook)</span>
            <span>30s (Reels standard)</span>
            <span>60s (Shorts max)</span>
            <span>120s</span>
          </div>
        </div>

        {/* Resolution & Subtitles */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
              Resolution
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['1080p', '720p'].map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => onChange({ ...options, resolution: res as any })}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                    options.resolution === res
                      ? 'border-indigo-500 bg-indigo-500/15 text-white'
                      : 'border-[#272b38] bg-[#141620] text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {res} Full HD
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
              Subtitles (.SRT)
            </label>
            <button
              type="button"
              disabled={!whisperAvailable}
              onClick={() => onChange({ ...options, enable_subtitles: !options.enable_subtitles })}
              className={`w-full py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                !whisperAvailable
                  ? 'border-[#272b38] bg-[#141620] text-zinc-500 cursor-not-allowed'
                  : options.enable_subtitles
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                  : 'border-[#272b38] bg-[#141620] text-zinc-400 hover:border-zinc-600'
              }`}
              title={whisperAvailable ? 'Toggle Subtitles generation' : 'faster-whisper is not installed on this system'}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>
                {!whisperAvailable
                  ? 'Subtitles (Whisper N/A)'
                  : options.enable_subtitles
                  ? 'Subtitles ON'
                  : 'Subtitles OFF'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Settings Accordion */}
      <div className="border-t border-[#272b38] pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Advanced Tuning Parameters (Silence dB, Min/Max Limits, Whisper model)</span>
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 p-4 rounded-xl bg-[#12141d] border border-[#232736]">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Silence Noise Threshold (dB)
              </label>
              <input
                type="number"
                min="-60"
                max="-10"
                step="5"
                value={options.silence_noise_db}
                onChange={(e) => onChange({ ...options, silence_noise_db: Number(e.target.value) })}
                className="w-full bg-[#181a26] border border-[#2e3346] rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">Default: -30dB</span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Min Silence Pause (seconds)
              </label>
              <input
                type="number"
                min="0.2"
                max="2.0"
                step="0.1"
                value={options.silence_duration}
                onChange={(e) => onChange({ ...options, silence_duration: Number(e.target.value) })}
                className="w-full bg-[#181a26] border border-[#2e3346] rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">Default: 0.5s pause</span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Scene Sensitivity Threshold
              </label>
              <input
                type="number"
                min="10"
                max="60"
                step="2"
                value={options.scene_threshold}
                onChange={(e) => onChange({ ...options, scene_threshold: Number(e.target.value) })}
                className="w-full bg-[#181a26] border border-[#2e3346] rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">PySceneDetect (Default: 27.0)</span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                FFmpeg Encoding Preset
              </label>
              <select
                value={options.encoding_preset || 'veryfast'}
                onChange={(e) => onChange({ ...options, encoding_preset: e.target.value as any })}
                className="w-full bg-[#181a26] border border-[#2e3346] rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="ultrafast">⚡ Ultrafast (Maximum Speed)</option>
                <option value="superfast">🚀 Superfast</option>
                <option value="veryfast">⚖️ Veryfast (Balanced Default)</option>
                <option value="faster">🎯 Faster</option>
                <option value="medium">💎 Medium (Studio Quality)</option>
              </select>
              <span className="text-[10px] text-zinc-400 mt-1 block">H.264 Encoder Speed</span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Quality Factor (CRF: 18-30)
              </label>
              <input
                type="number"
                min="18"
                max="32"
                step="1"
                value={options.crf ?? 24}
                onChange={(e) => onChange({ ...options, crf: Number(e.target.value) })}
                className="w-full bg-[#181a26] border border-[#2e3346] rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">Lower = higher quality (24 is optimal)</span>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="allow_stream_copy"
                checked={options.allow_stream_copy ?? true}
                onChange={(e) => onChange({ ...options, allow_stream_copy: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 bg-[#181a26] border-[#2e3346]"
              />
              <label htmlFor="allow_stream_copy" className="text-[11px] font-medium text-zinc-300 cursor-pointer">
                Allow Stream Copy (-c copy) when format matches
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Main Submit Button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm tracking-wide shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
      >
        <Scissors className="w-4 h-4 transform -rotate-45" />
        <span>Forge Social Clips Now</span>
      </button>
    </div>
  );
};

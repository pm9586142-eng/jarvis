import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Disc3,
  Download,
  Gamepad2,
  Loader2,
  Music2,
  Pause,
  Play,
  Repeat,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { generateLyriaMusic } from '../services/api';
import { base64ToAudioBlobUrl } from '../services/gameAudio';
import { ConnectionState, GeneratedMusicTrack, LyriaModelMode } from '../types/jarvis';

interface MusicStudioViewProps {
  connectionState: ConnectionState;
  tracks: GeneratedMusicTrack[];
  activeGameTrackId: string | null;
  onTrackGenerated: (track: GeneratedMusicTrack, setAsSoundtrack?: boolean) => void;
  onSelectGameTrack: (trackId: string | null) => void;
  onDeleteTrack: (trackId: string) => void;
  onLaunchGame: () => void;
}

const MUSIC_PRESETS: Array<{ label: string; prompt: string; mode: LyriaModelMode }> = [
  {
    label: 'Orbital Combat Synthwave',
    prompt: 'Driving cosmic synthwave space battle theme, 132 BPM, crisp analog arpeggios, punchy sidechained kick, heroic brass leads',
    mode: 'clip',
  },
  {
    label: 'J.A.R.V.I.S. Ambient Lab',
    prompt: 'Futuristic clean-tech laboratory ambient electronic underscore, warm sub-bass, shimmering glass bells, calm precision pulse',
    mode: 'clip',
  },
  {
    label: 'Dreadnought Boss Symphony',
    prompt: 'Epic sci-fi orchestral hybrid full track with choir, heavy brass hits, aggressive electronic percussion, rising tension',
    mode: 'pro',
  },
  {
    label: 'Deep Space Lo-Fi',
    prompt: 'Chill cosmic lo-fi chillhop beat, mellow Rhodes chords, subtle tape vinyl warmth, floating stereo pads',
    mode: 'clip',
  },
];

export const MusicStudioView: React.FC<MusicStudioViewProps> = ({
  connectionState,
  tracks,
  activeGameTrackId,
  onTrackGenerated,
  onSelectGameTrack,
  onDeleteTrack,
  onLaunchGame,
}) => {
  const [mode, setMode] = useState<LyriaModelMode>('clip');
  const [prompt, setPrompt] = useState(MUSIC_PRESETS[0].prompt);
  const [lyrics, setLyrics] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Build stable Blob URLs for tracks in memory and revoke cleanly on unmount/change
  const trackUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tracks) {
      map.set(t.id, base64ToAudioBlobUrl(t.audioBase64, t.mimeType));
    }
    return map;
  }, [tracks]);

  useEffect(() => {
    return () => {
      trackUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [trackUrls]);

  const activeTrack = tracks.find((t) => t.id === playingTrackId) || tracks[0] || null;
  const activeUrl = activeTrack ? trackUrls.get(activeTrack.id) || '' : '';

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = loopEnabled;
    }
  }, [loopEnabled]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    setError(null);
    setIsGenerating(true);
    try {
      const res = await generateLyriaMusic({
        prompt: prompt.trim(),
        mode,
        lyrics: lyrics.trim(),
      });
      const newTrack: GeneratedMusicTrack = {
        id: `lyria_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: prompt.trim().slice(0, 44) + (prompt.trim().length > 44 ? '...' : ''),
        prompt: res.prompt,
        model: res.model,
        mode: res.mode,
        mimeType: res.mimeType,
        audioBase64: res.audioBase64,
        lyrics: res.lyrics || undefined,
        durationLabel: res.durationLabel,
        createdAt: Date.now(),
      };
      onTrackGenerated(newTrack, activeGameTrackId === null);
      setPlayingTrackId(newTrack.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Music generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadTrack = (track: GeneratedMusicTrack) => {
    const url = trackUrls.get(track.id);
    if (!url) return;
    const ext = track.mimeType.includes('wav') ? 'wav' : 'mp3';
    const link = document.createElement('a');
    link.href = url;
    link.download = `jarvis-lyria-${track.mode}-${track.id}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {connectionState !== 'online' && (
        <div className="glass-panel rounded-xl p-4 border border-amber-500/40 bg-amber-500/10 flex items-center gap-3 text-xs font-mono-hud text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            {connectionState === 'key_missing'
              ? 'Server is running, but GEMINI_API_KEY is not configured. Add GEMINI_API_KEY to compose music with Lyria 3.'
              : 'Backend server is unreachable. Start the Express server to generate Lyria 3 audio.'}
          </span>
        </div>
      )}

      {/* Composer Card */}
      <div className="glass-panel-glow rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-400/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-100">
                LYRIA 3 SONIC COMPOSER
              </h2>
              <p className="font-mono-hud text-xs text-cyan-300">
                Compose 30s Loops (lyria-3-clip-preview) or Full Tracks (lyria-3-pro-preview)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLaunchGame}
            className="px-4 py-2 rounded-xl bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 font-display text-xs font-semibold text-cyan-200 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Gamepad2 className="w-4 h-4 text-cyan-400" />
            <span>PLAY IN 3D GAME</span>
          </button>
        </div>

        {/* Model Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('clip')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              mode === 'clip'
                ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_18px_rgba(34,211,238,0.16)]'
                : 'bg-[#0D1527]/80 border-slate-800 text-slate-300 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-cyan-300">
                lyria-3-clip-preview
              </span>
              <span className="font-mono-hud text-[10px] px-2 py-0.5 rounded bg-cyan-400/15 border border-cyan-400/40 text-cyan-200">
                UP TO 30s
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Rapid high-fidelity 30s loops, game themes, and quick musical motifs.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('pro')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              mode === 'pro'
                ? 'bg-violet-500/15 border-violet-400 text-white shadow-[0_0_18px_rgba(167,139,250,0.18)]'
                : 'bg-[#0D1527]/80 border-slate-800 text-slate-300 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-violet-300">
                lyria-3-pro-preview
              </span>
              <span className="font-mono-hud text-[10px] px-2 py-0.5 rounded bg-violet-400/15 border border-violet-400/40 text-violet-200">
                FULL TRACK
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Full-length structured compositions with intros, verses, choruses, and custom lyrics.
            </p>
          </button>
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <p className="font-mono-hud text-[11px] text-slate-400 uppercase tracking-wider">
            Quick Soundscapes:
          </p>
          <div className="flex flex-wrap gap-2">
            {MUSIC_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setPrompt(preset.prompt);
                  setMode(preset.mode);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 font-mono-hud text-[11px] text-slate-200 cursor-pointer transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-3">
          <div>
            <label className="block font-mono-hud text-[11px] text-cyan-300 uppercase mb-1.5">
              Musical Prompt (Genre, BPM, Instrumentation, Mood)
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe instruments, tempo, vibe, and structure..."
              className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono-hud text-[11px] text-slate-400 uppercase mb-1.5">
              Optional Lyrics / Arrangement Cues
            </label>
            <textarea
              rows={2}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Optional: [Intro] Atmospheric synth swell... [Chorus] ..."
              className="w-full bg-[#040812] border border-slate-800 focus:border-cyan-400 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="font-mono-hud text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating || connectionState !== 'online'}
              className="px-5 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>COMPOSING WITH {mode === 'pro' ? 'LYRIA PRO' : 'LYRIA CLIP'}...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>GENERATE {mode === 'pro' ? 'FULL TRACK' : '30s CLIP'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Active Track Player */}
      {activeTrack && activeUrl && (
        <div className="glass-panel rounded-2xl p-5 space-y-4 border border-cyan-500/35">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Disc3 className="w-6 h-6 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-slate-100 truncate">
                  {activeTrack.title}
                </p>
                <p className="font-mono-hud text-[11px] text-cyan-300">
                  {activeTrack.model} • {activeTrack.durationLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLoopEnabled((v) => !v)}
                className={`px-3 py-1.5 rounded-lg border font-mono-hud text-[11px] flex items-center gap-1.5 cursor-pointer ${
                  loopEnabled
                    ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                    : 'bg-[#0D1527] border-slate-700 text-slate-400'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>LOOP {loopEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectGameTrack(activeTrack.id)}
                className={`px-3 py-1.5 rounded-lg border font-mono-hud text-[11px] cursor-pointer ${
                  activeGameTrackId === activeTrack.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-[#0D1527] border-slate-700 text-slate-200 hover:border-cyan-400'
                }`}
              >
                {activeGameTrackId === activeTrack.id ? 'ACTIVE 3D BGM' : 'SET AS 3D BGM'}
              </button>

              <button
                type="button"
                onClick={() => handleDownloadTrack(activeTrack)}
                aria-label="Download generated music file"
                className="p-2 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-cyan-300 cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <audio
            ref={audioRef}
            key={activeTrack.id}
            src={activeUrl}
            controls
            autoPlay
            loop={loopEnabled}
            className="w-full"
          />

          {activeTrack.lyrics && (
            <div className="rounded-xl bg-[#040812] border border-slate-800 p-3.5 space-y-1">
              <p className="font-mono-hud text-[10px] text-cyan-300 uppercase">
                Generated Lyrics & Structure
              </p>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                {activeTrack.lyrics}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Generated Track Library */}
      {tracks.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="font-mono-hud text-xs font-semibold text-slate-400 tracking-widest">
            SESSION COMPOSITIONS ({tracks.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tracks.map((track) => {
              const isCurrent = activeTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`glass-panel rounded-xl p-4 flex items-center justify-between gap-3 border ${
                    isCurrent ? 'border-cyan-400/60' : 'border-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{track.title}</p>
                    <p className="font-mono-hud text-[10px] text-slate-400 mt-0.5">
                      {track.model} • {new Date(track.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPlayingTrackId(isCurrent ? null : track.id)}
                      aria-label={isCurrent ? 'Pause track' : 'Play track'}
                      className="p-2 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-cyan-300 cursor-pointer"
                    >
                      {isCurrent ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadTrack(track)}
                      aria-label="Download track"
                      className="p-2 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-slate-300 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTrack(track.id)}
                      aria-label="Remove track"
                      className="p-2 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-rose-400 text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

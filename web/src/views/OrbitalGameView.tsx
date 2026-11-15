import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Crosshair,
  Disc3,
  Gamepad2,
  Loader2,
  Music2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  DifficultyMode,
  GameHudSnapshot,
  OrbitalAegisEngine,
  SceneAtmosphere,
} from '../game/OrbitalAegisEngine';
import { generateLyriaMusic } from '../services/api';
import { base64ToAudioBlobUrl, GameAudioSynth } from '../services/gameAudio';
import { ConnectionState, GeneratedMusicTrack, LyriaModelMode } from '../types/jarvis';

interface OrbitalGameViewProps {
  connectionState: ConnectionState;
  tracks: GeneratedMusicTrack[];
  activeTrackId: string | null;
  onTrackGenerated: (track: GeneratedMusicTrack, setAsSoundtrack?: boolean) => void;
  onSelectTrack: (trackId: string | null) => void;
  onExitGame: () => void;
}

const INITIAL_HUD: GameHudSnapshot = {
  phase: 'title',
  score: 0,
  combo: 1,
  wave: 1,
  maxWaves: 3,
  endlessMode: false,
  shield: 100,
  maxShield: 100,
  beaconIntegrity: 100,
  dashReadyRatio: 1,
  enemiesRemaining: 0,
  kills: 0,
  inspectCamera: false,
  atmosphere: 'cosmic',
  asteroidDensity: 1,
  difficulty: 'vanguard',
  bossHpRatio: null,
  bossName: null,
};

const QUICK_GAME_PROMPTS = [
  'High-energy cosmic synthwave space combat loop, 132 BPM, analog arpeggios and punchy drums',
  'Dark orbital sci-fi boss battle soundtrack with orchestral brass and pulsing bass',
  'Atmospheric deep space ambient electronic pulse with crystalline pads',
];

export const OrbitalGameView: React.FC<OrbitalGameViewProps> = ({
  connectionState,
  tracks,
  activeTrackId,
  onTrackGenerated,
  onSelectTrack,
  onExitGame,
}) => {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OrbitalAegisEngine | null>(null);
  const synthRef = useRef<GameAudioSynth | null>(null);
  const soundtrackAudioRef = useRef<HTMLAudioElement | null>(null);
  const soundtrackBlobUrlRef = useRef<string | null>(null);

  const [hud, setHud] = useState<GameHudSnapshot>(INITIAL_HUD);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyMode>('vanguard');
  const [muted, setMuted] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [showTouchPad, setShowTouchPad] = useState(
    () => typeof window !== 'undefined' && (window.innerWidth < 900 || navigator.maxTouchPoints > 0)
  );

  // Lyria quick soundtrack composer inside collapsible 3D dock
  const [lyriaPrompt, setLyriaPrompt] = useState(QUICK_GAME_PROMPTS[0]);
  const [lyriaMode, setLyriaMode] = useState<LyriaModelMode>('clip');
  const [isGeneratingTrack, setIsGeneratingTrack] = useState(false);
  const [lyriaError, setLyriaError] = useState<string | null>(null);
  const [soundtrackPlaying, setSoundtrackPlaying] = useState(false);

  // Mount isolated Three.js canvas + 60fps loop once
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const synth = new GameAudioSynth();
    synthRef.current = synth;

    const engine = new OrbitalAegisEngine(host, synth, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      synth.dispose();
      engineRef.current = null;
      synthRef.current = null;
    };
  }, []);

  // Sync mute state to both procedural SFX and Lyria soundtrack audio
  useEffect(() => {
    synthRef.current?.setMuted(muted);
    if (soundtrackAudioRef.current) {
      soundtrackAudioRef.current.muted = muted;
    }
  }, [muted]);

  // Manage active Lyria soundtrack Audio playback cleanly
  const activeTrack = tracks.find((t) => t.id === activeTrackId) || null;

  useEffect(() => {
    if (soundtrackBlobUrlRef.current) {
      URL.revokeObjectURL(soundtrackBlobUrlRef.current);
      soundtrackBlobUrlRef.current = null;
    }
    if (soundtrackAudioRef.current) {
      soundtrackAudioRef.current.pause();
      soundtrackAudioRef.current = null;
      setSoundtrackPlaying(false);
    }

    if (!activeTrack) return;

    const blobUrl = base64ToAudioBlobUrl(activeTrack.audioBase64, activeTrack.mimeType);
    soundtrackBlobUrlRef.current = blobUrl;

    const audio = new Audio(blobUrl);
    audio.loop = true;
    audio.volume = 0.52;
    audio.muted = muted;
    soundtrackAudioRef.current = audio;

    audio
      .play()
      .then(() => setSoundtrackPlaying(true))
      .catch(() => setSoundtrackPlaying(false));

    return () => {
      audio.pause();
      URL.revokeObjectURL(blobUrl);
      if (soundtrackBlobUrlRef.current === blobUrl) {
        soundtrackBlobUrlRef.current = null;
      }
    };
  }, [activeTrack?.id]);

  const toggleSoundtrackPlay = () => {
    const audio = soundtrackAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setSoundtrackPlaying(true))
        .catch(() => setSoundtrackPlaying(false));
    } else {
      audio.pause();
      setSoundtrackPlaying(false);
    }
  };

  const handleGenerateSoundtrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lyriaPrompt.trim() || isGeneratingTrack) return;
    setLyriaError(null);
    setIsGeneratingTrack(true);
    try {
      const res = await generateLyriaMusic({
        prompt: lyriaPrompt.trim(),
        mode: lyriaMode,
      });
      const newTrack: GeneratedMusicTrack = {
        id: `lyria_${Date.now()}`,
        title:
          lyriaPrompt.trim().slice(0, 38) + (lyriaPrompt.trim().length > 38 ? '...' : ''),
        prompt: res.prompt,
        model: res.model,
        mode: res.mode,
        mimeType: res.mimeType,
        audioBase64: res.audioBase64,
        lyrics: res.lyrics || undefined,
        durationLabel: res.durationLabel,
        createdAt: Date.now(),
      };
      onTrackGenerated(newTrack, true);
    } catch (err) {
      setLyriaError(err instanceof Error ? err.message : 'Unable to generate soundtrack.');
    } finally {
      setIsGeneratingTrack(false);
    }
  };

  const shieldPct = Math.max(0, Math.min(100, Math.round((hud.shield / hud.maxShield) * 100)));

  return (
    <div className="fixed inset-0 z-40 w-screen h-screen bg-[#030712] text-slate-100 overflow-hidden select-none">
      {/* Isolated Full-Bleed Three.js Viewport (100vw x 100vh) */}
      <div
        ref={canvasHostRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Orbital Aegis 3D Game Viewport"
      />

      {/* ==================== TITLE SCREEN OVERLAY ==================== */}
      {hud.phase === 'title' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5 sm:p-8">
          {/* Top bar: Exit & Mute */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onExitGame}
              className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#070D18]/90 border border-slate-700/90 hover:border-cyan-400 font-mono-hud text-xs text-slate-200 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>EXIT TO JARVIS HUD</span>
            </button>

            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDockOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#070D18]/90 border border-slate-700/90 hover:border-cyan-400 font-mono-hud text-xs text-cyan-300 cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>3D SCENE & LYRIA</span>
              </button>

              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="p-2 rounded-xl bg-[#070D18]/90 border border-slate-700/90 hover:border-cyan-400 text-cyan-300 cursor-pointer transition-colors"
              >
                {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Left-aligned Title Lockup over calm negative space (leaves central 3D orbital core clear) */}
          <div className="max-w-md space-y-5 my-auto">
            {/* Bespoke Inline SVG Title Lockup */}
            <div className="space-y-2">
              <svg
                viewBox="0 0 420 105"
                className="w-full max-w-[380px] h-auto drop-shadow-[0_4px_18px_rgba(34,211,238,0.28)]"
                role="img"
                aria-label="Orbital Aegis Mark VII"
              >
                <defs>
                  <linearGradient id="aegisTitleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#67E8F9" />
                    <stop offset="55%" stopColor="#F8FAFC" />
                    <stop offset="100%" stopColor="#38BDF8" />
                  </linearGradient>
                </defs>
                {/* Winged Emblem */}
                <polygon
                  points="10,48 34,22 52,22 36,48 52,74 34,74"
                  fill="#22D3EE"
                  opacity="0.9"
                />
                <polygon points="44,48 64,30 82,48 64,66" fill="#0EA5E9" opacity="0.85" />
                <circle cx="64" cy="48" r="7" fill="#E0F2FE" />
                <text
                  x="98"
                  y="49"
                  fill="url(#aegisTitleGrad)"
                  fontFamily="Orbitron, sans-serif"
                  fontSize="31"
                  fontWeight="700"
                  letterSpacing="4"
                >
                  ORBITAL
                </text>
                <text
                  x="98"
                  y="81"
                  fill="#38BDF8"
                  fontFamily="Orbitron, sans-serif"
                  fontSize="24"
                  fontWeight="600"
                  letterSpacing="7"
                >
                  AEGIS VII
                </text>
                <line x1="98" y1="92" x2="404" y2="92" stroke="#22D3EE" strokeOpacity="0.45" strokeWidth="1.5" />
              </svg>
              <p className="font-mono-hud text-xs text-slate-300 max-w-sm leading-relaxed">
                Defend the Orbital Beacon across 3 escalating sectors against scout interceptors, heavy artillery cruisers, and the Kronos-X Dreadnought.
              </p>
            </div>

            {/* Difficulty Selection */}
            <div className="pointer-events-auto flex items-center gap-2">
              {(['recruit', 'vanguard', 'ace'] as DifficultyMode[]).map((mode) => {
                const active = selectedDifficulty === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedDifficulty(mode)}
                    className={`px-3 py-1.5 rounded-lg border font-mono-hud text-[11px] uppercase tracking-wider cursor-pointer transition-colors ${
                      active
                        ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                        : 'bg-[#070D18]/88 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>

            {/* Primary Start CTA */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => engineRef.current?.startGame(selectedDifficulty)}
                className="px-6 py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-sm font-bold tracking-widest flex items-center gap-2.5 cursor-pointer transition-colors shadow-[0_0_24px_rgba(34,211,238,0.35)]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>LAUNCH SORTIE</span>
              </button>
            </div>
          </div>

          {/* Single Flat Control-Hint Line */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono-hud text-[11px] sm:text-xs text-cyan-200/90 tracking-wider bg-[#070D18]/85 border border-slate-800 px-3.5 py-1.5 rounded-lg">
              WASD Move · Space / Click Fire · Shift Dash · Esc Pause
            </p>
            {activeTrack && (
              <span className="font-mono-hud text-[11px] text-emerald-300 bg-[#070D18]/85 border border-emerald-500/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5" />
                <span>LYRIA TRACK READY: {activeTrack.title}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ==================== PLAYING PERIMETER HUD (>=85% Unobstructed) ==================== */}
      {hud.phase === 'playing' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
          {/* Top Perimeter Row */}
          <div className="flex items-start justify-between gap-3">
            {/* Top-Left: Shield, Beacon, Dash & Wave */}
            <div className="bg-[#070D18]/88 border border-cyan-500/35 rounded-xl px-3.5 py-2.5 space-y-2 min-w-[200px] sm:min-w-[235px]">
              <div className="flex items-center justify-between gap-3 font-mono-hud text-[11px]">
                <span className="text-cyan-300 flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-cyan-400" aria-hidden="true">
                    <path d="M8 1L2 3.5V7.8C2 11.4 4.5 14.4 8 15.5C11.5 14.4 14 11.4 14 7.8V3.5L8 1Z" />
                  </svg>
                  SHIELD
                </span>
                <span className="tabular-nums text-slate-100 font-semibold">
                  {hud.shield}/{hud.maxShield}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    shieldPct > 45 ? 'bg-cyan-400' : shieldPct > 22 ? 'bg-amber-400' : 'bg-rose-500'
                  }`}
                  style={{ width: `${shieldPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-3 font-mono-hud text-[10px] text-slate-300 pt-0.5">
                <span className="tabular-nums">BEACON: {hud.beaconIntegrity}%</span>
                <span className="tabular-nums text-sky-300">
                  DASH: {hud.dashReadyRatio >= 0.99 ? 'READY' : `${Math.round(hud.dashReadyRatio * 100)}%`}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono-hud text-[10px] text-amber-300 border-t border-slate-800/90 pt-1">
                <span className="tabular-nums">
                  {hud.endlessMode ? `OVERDRIVE W${hud.wave}` : `SECTOR ${hud.wave}/${hud.maxWaves}`}
                </span>
                <span className="tabular-nums">HOSTILES: {hud.enemiesRemaining}</span>
              </div>
            </div>

            {/* Top-Center Boss Health Bar (only during Dreadnought fight) */}
            {hud.bossHpRatio !== null && hud.bossName && (
              <div className="hidden sm:block bg-[#070D18]/90 border border-rose-500/50 rounded-xl px-4 py-2 min-w-[260px]">
                <div className="flex items-center justify-between font-mono-hud text-[10px] text-rose-300 mb-1">
                  <span>{hud.bossName}</span>
                  <span className="tabular-nums">{Math.round(hud.bossHpRatio * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all duration-100"
                    style={{ width: `${Math.round(hud.bossHpRatio * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Top-Right: Score, Combo, Controls */}
            <div className="pointer-events-auto flex items-start gap-2">
              <div className="bg-[#070D18]/88 border border-cyan-500/35 rounded-xl px-3.5 py-2 text-right">
                <p className="font-mono-hud text-[10px] text-slate-400">SCORE</p>
                <p className="font-display text-lg font-bold tabular-nums text-cyan-300 leading-tight">
                  {hud.score.toLocaleString()}
                </p>
                <p className="font-mono-hud text-[10px] tabular-nums text-amber-300">
                  COMBO ×{hud.combo}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                    className="p-2.5 rounded-xl bg-[#070D18]/90 border border-slate-700 hover:border-cyan-400 text-cyan-300 cursor-pointer"
                  >
                    {muted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDockOpen((v) => !v)}
                    aria-label="Toggle 3D & Lyria Dock"
                    className={`p-2.5 rounded-xl border cursor-pointer ${
                      dockOpen
                        ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                        : 'bg-[#070D18]/90 border-slate-700 hover:border-cyan-400 text-cyan-300'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => engineRef.current?.togglePause()}
                    aria-label="Pause game"
                    className="p-2.5 rounded-xl bg-[#070D18]/90 border border-slate-700 hover:border-cyan-400 text-slate-100 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTouchPad((v) => !v)}
                  className="px-2.5 py-1 rounded-lg bg-[#070D18]/88 border border-slate-800 font-mono-hud text-[10px] text-slate-400 hover:text-cyan-300 cursor-pointer"
                >
                  {showTouchPad ? 'HIDE TOUCH PAD' : 'TOUCH PAD'}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Touch Controls (compact corners, never blocks center arena) */}
          {showTouchPad && (
            <div className="flex items-end justify-between pb-2">
              {/* Compact Directional Cluster */}
              <div className="pointer-events-auto grid grid-cols-3 gap-1.5 bg-[#070D18]/80 p-2 rounded-2xl border border-slate-800">
                <div />
                <button
                  type="button"
                  aria-label="Thrust Up"
                  onPointerDown={() => engineRef.current?.setTouchMove(0, -1)}
                  onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
                  onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
                  className="w-11 h-11 rounded-lg bg-[#0D1527] active:bg-cyan-400/30 border border-slate-700 font-mono-hud text-xs text-cyan-300"
                >
                  ▲
                </button>
                <div />
                <button
                  type="button"
                  aria-label="Strafe Left"
                  onPointerDown={() => engineRef.current?.setTouchMove(-1, 0)}
                  onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
                  onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
                  className="w-11 h-11 rounded-lg bg-[#0D1527] active:bg-cyan-400/30 border border-slate-700 font-mono-hud text-xs text-cyan-300"
                >
                  ◀
                </button>
                <button
                  type="button"
                  aria-label="Thrust Down"
                  onPointerDown={() => engineRef.current?.setTouchMove(0, 1)}
                  onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
                  onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
                  className="w-11 h-11 rounded-lg bg-[#0D1527] active:bg-cyan-400/30 border border-slate-700 font-mono-hud text-xs text-cyan-300"
                >
                  ▼
                </button>
                <button
                  type="button"
                  aria-label="Strafe Right"
                  onPointerDown={() => engineRef.current?.setTouchMove(1, 0)}
                  onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
                  onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
                  className="w-11 h-11 rounded-lg bg-[#0D1527] active:bg-cyan-400/30 border border-slate-700 font-mono-hud text-xs text-cyan-300"
                >
                  ▶
                </button>
              </div>

              {/* Fire & Dash Action Buttons */}
              <div className="pointer-events-auto flex items-center gap-2.5">
                <button
                  type="button"
                  onPointerDown={() => engineRef.current?.triggerTouchDash()}
                  className="w-14 h-14 rounded-full bg-[#070D18]/90 border border-sky-400/60 active:bg-sky-400/30 flex flex-col items-center justify-center text-sky-300 font-mono-hud text-[10px]"
                >
                  <Zap className="w-4 h-4 mb-0.5" />
                  DASH
                </button>
                <button
                  type="button"
                  onPointerDown={() => engineRef.current?.triggerTouchFire()}
                  className="w-16 h-16 rounded-full bg-cyan-400/20 border-2 border-cyan-400 active:bg-cyan-400/50 flex flex-col items-center justify-center text-cyan-200 font-mono-hud text-[10px] font-bold"
                >
                  <Crosshair className="w-5 h-5 mb-0.5" />
                  FIRE
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== COLLAPSIBLE 3D & LYRIA CONTROL DOCK (<=15% footprint, solid rgba, NO backdrop-filter) ==================== */}
      {dockOpen && (
        <aside className="fixed right-3 top-20 z-50 w-72 max-w-[88vw] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl bg-[#070D18]/94 border border-cyan-500/40 p-4 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-display text-xs font-bold tracking-wider text-cyan-300 flex items-center gap-1.5">
              <Orbit className="w-4 h-4" />
              3D SCENE & LYRIA DOCK
            </span>
            <button
              type="button"
              onClick={() => setDockOpen(false)}
              aria-label="Collapse control dock"
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 3D Camera Mode */}
          <div className="space-y-1.5">
            <p className="font-mono-hud text-[10px] text-slate-400 uppercase">Camera Control</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => engineRef.current?.setInspectCamera(false)}
                className={`py-1.5 px-2 rounded-lg border font-mono-hud text-[11px] cursor-pointer ${
                  !hud.inspectCamera
                    ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                    : 'bg-[#0D1527] border-slate-800 text-slate-400'
                }`}
              >
                CHASE CAM
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.setInspectCamera(true)}
                className={`py-1.5 px-2 rounded-lg border font-mono-hud text-[11px] cursor-pointer ${
                  hud.inspectCamera
                    ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                    : 'bg-[#0D1527] border-slate-800 text-slate-400'
                }`}
              >
                ORBIT INSPECT
              </button>
            </div>
          </div>

          {/* Atmosphere & Lighting Mood */}
          <div className="space-y-1.5">
            <p className="font-mono-hud text-[10px] text-slate-400 uppercase">PBR Lighting & Fog</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['cosmic', 'solar', 'nebula'] as SceneAtmosphere[]).map((atmo) => (
                <button
                  key={atmo}
                  type="button"
                  onClick={() => engineRef.current?.setAtmosphere(atmo)}
                  className={`py-1.5 rounded-lg border font-mono-hud text-[10px] uppercase cursor-pointer ${
                    hud.atmosphere === atmo
                      ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                      : 'bg-[#0D1527] border-slate-800 text-slate-400'
                  }`}
                >
                  {atmo}
                </button>
              ))}
            </div>
          </div>

          {/* Asteroid Belt Density */}
          <div className="space-y-1">
            <div className="flex items-center justify-between font-mono-hud text-[10px] text-slate-400">
              <span>ASTEROID BELT</span>
              <span className="tabular-nums text-cyan-300">
                {Math.round(hud.asteroidDensity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.15}
              max={1}
              step={0.05}
              value={hud.asteroidDensity}
              onChange={(e) => engineRef.current?.setAsteroidDensity(parseFloat(e.target.value))}
              aria-label="Asteroid belt density"
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Lyria 3 AI Soundtrack Generator */}
          <div className="border-t border-slate-800 pt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono-hud text-[10px] text-cyan-300 uppercase flex items-center gap-1">
                <Disc3 className="w-3.5 h-3.5" />
                LYRIA 3 SOUNDTRACK
              </span>
              {activeTrack && (
                <button
                  type="button"
                  onClick={toggleSoundtrackPlay}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 font-mono-hud text-[10px] text-emerald-300 cursor-pointer"
                >
                  {soundtrackPlaying ? 'PAUSE BGM' : 'PLAY BGM'}
                </button>
              )}
            </div>

            {tracks.length > 0 && (
              <select
                aria-label="Select generated soundtrack"
                value={activeTrackId || ''}
                onChange={(e) => onSelectTrack(e.target.value || null)}
                className="w-full bg-[#0D1527] border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-hud text-[11px] text-slate-100"
              >
                <option value="">No Soundtrack Selected</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.mode === 'pro' ? 'PRO' : '30s'}] {t.title}
                  </option>
                ))}
              </select>
            )}

            <form onSubmit={handleGenerateSoundtrack} className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setLyriaMode('clip')}
                  className={`py-1 px-2 rounded-lg border font-mono-hud text-[10px] cursor-pointer ${
                    lyriaMode === 'clip'
                      ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                      : 'bg-[#0D1527] border-slate-800 text-slate-400'
                  }`}
                >
                  CLIP 30s
                </button>
                <button
                  type="button"
                  onClick={() => setLyriaMode('pro')}
                  className={`py-1 px-2 rounded-lg border font-mono-hud text-[10px] cursor-pointer ${
                    lyriaMode === 'pro'
                      ? 'bg-violet-400/20 border-violet-400 text-violet-200'
                      : 'bg-[#0D1527] border-slate-800 text-slate-400'
                  }`}
                >
                  PRO FULL
                </button>
              </div>

              <textarea
                rows={2}
                value={lyriaPrompt}
                onChange={(e) => setLyriaPrompt(e.target.value)}
                placeholder="Describe combat soundtrack..."
                className="w-full bg-[#0D1527] border border-slate-700 focus:border-cyan-400 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={isGeneratingTrack || connectionState !== 'online'}
                className="w-full py-2 px-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#02040A] font-mono-hud text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isGeneratingTrack ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>GENERATING LYRIA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>COMPOSE SOUNDTRACK</span>
                  </>
                )}
              </button>

              {connectionState !== 'online' && (
                <p className="font-mono-hud text-[10px] text-amber-300">
                  Set GEMINI_API_KEY on server to compose live Lyria 3 music.
                </p>
              )}
              {lyriaError && <p className="font-mono-hud text-[10px] text-rose-400">{lyriaError}</p>}
            </form>
          </div>
        </aside>
      )}

      {/* ==================== PAUSE / VICTORY / GAME OVER MODALS (solid rgba, NO backdrop-filter) ==================== */}
      {(hud.phase === 'paused' || hud.phase === 'victory' || hud.phase === 'gameover') && (
        <div className="absolute inset-0 z-50 bg-[#02040A]/78 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#070D18]/96 border border-cyan-500/45 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Gamepad2
                  className={`w-6 h-6 ${
                    hud.phase === 'victory'
                      ? 'text-emerald-400'
                      : hud.phase === 'gameover'
                        ? 'text-rose-400'
                        : 'text-cyan-400'
                  }`}
                />
                <h2 className="font-display text-xl font-bold tracking-wider text-slate-100">
                  {hud.phase === 'paused'
                    ? 'SORTIE PAUSED'
                    : hud.phase === 'victory'
                      ? 'SECTOR SECURED'
                      : 'AEGIS DOWN'}
                </h2>
              </div>
              <span className="font-mono-hud text-xs text-cyan-300 tabular-nums">
                WAVE {hud.wave}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl bg-[#0D1527] border border-slate-800 p-3">
                <p className="font-mono-hud text-[10px] text-slate-400">SCORE</p>
                <p className="font-display text-base font-bold tabular-nums text-cyan-300 mt-1">
                  {hud.score.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-[#0D1527] border border-slate-800 p-3">
                <p className="font-mono-hud text-[10px] text-slate-400">KILLS</p>
                <p className="font-display text-base font-bold tabular-nums text-amber-300 mt-1">
                  {hud.kills}
                </p>
              </div>
              <div className="rounded-xl bg-[#0D1527] border border-slate-800 p-3">
                <p className="font-mono-hud text-[10px] text-slate-400">BEACON</p>
                <p className="font-display text-base font-bold tabular-nums text-emerald-300 mt-1">
                  {hud.beaconIntegrity}%
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {hud.phase === 'paused' && (
                <button
                  type="button"
                  onClick={() => engineRef.current?.togglePause()}
                  className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>RESUME COMBAT (ESC)</span>
                </button>
              )}

              {hud.phase === 'victory' && (
                <button
                  type="button"
                  onClick={() => engineRef.current?.continueEndless()}
                  className="w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>CONTINUE ENDLESS OVERDRIVE</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => engineRef.current?.startGame(selectedDifficulty)}
                className="w-full py-3 rounded-xl bg-[#0D1527] hover:border-cyan-400 border border-cyan-500/40 text-cyan-200 font-display text-xs font-semibold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESTART SORTIE</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => engineRef.current?.returnToTitle()}
                  className="py-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-slate-500 font-mono-hud text-xs text-slate-300 cursor-pointer"
                >
                  TITLE SCREEN
                </button>
                <button
                  type="button"
                  onClick={onExitGame}
                  className="py-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-rose-400/60 font-mono-hud text-xs text-slate-300 hover:text-rose-200 cursor-pointer"
                >
                  EXIT TO HUD
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

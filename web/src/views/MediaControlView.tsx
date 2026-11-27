import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Film,
  Globe,
  GraduationCap,
  Headphones,
  ListMusic,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Music,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  SkipBack,
  SkipForward,
  Square,
  ThumbsUp,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
  X,
  Youtube,
} from 'lucide-react';
import {
  MediaStageRect,
  YouTubePlayerStage,
} from '../components/YouTubePlayerStage';
import { BUILTIN_WEBSITE_DIRECTORY } from '../services/media/websiteResolver.js';
import { formatCompactNumber, parseYouTubeUrlInput } from '../services/media/youtubeMediaServices';
import {
  CommandActivityLogEntry,
  MediaPlayerState,
  ReactorHudState,
  SmartMediaMemory,
  YouTubeMediaItem,
  YouTubeSearchMode,
  YouTubeSearchResponse,
} from '../types/media';

export type { MediaStageRect };

interface MediaControlViewProps {
  mediaState: MediaPlayerState;
  mediaMemory: SmartMediaMemory;
  activityLog: CommandActivityLogEntry[];
  reactorState: ReactorHudState;
  youtubeConfigured?: boolean;
  ytSearchResults: YouTubeSearchResponse | null;
  isSearchingYouTube: boolean;
  isListening: boolean;
  isExecutingCommand: boolean;
  isWakeWordActive: boolean;
  audioDuckingEnabled: boolean;
  reducedMotion: boolean;
  initialSection?: 'youtube' | 'browser';
  isOnline?: boolean;
  onExecuteCommand: (rawText: string) => void;
  onSearchYouTube: (query: string, mode: YouTubeSearchMode, pageToken?: string) => void;
  onPlaySearchResult: (items: YouTubeMediaItem[], index: number, fallbackUrl?: string) => void;
  onClearSearchHistory: () => void;
  onStartVoiceCapture: () => void;
  onStopVoiceCapture: () => void;
  onToggleWakeWord: () => void;
  onToggleAudioDucking: () => void;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStop: () => void;
  onClosePlayer: () => void;
  onSeekTo: (seconds: number) => void;
  onSeekBy: (deltaSeconds: number) => void;
  onSetVolume: (level: number) => void;
  onAdjustVolume: (delta: number) => void;
  onToggleMute: () => void;
  onCycleRepeat: () => void;
  onToggleFullscreen: () => void;
  onSelectQueueIndex: (index: number) => void;
  onClearActivityLog: () => void;
  onStageRectChange: (rect: MediaStageRect | null) => void;
}

const QUICK_COMMANDS: Array<{ label: string; command: string; tag: string }> = [
  { label: 'Search Arijit Singh', command: 'Search Arijit Singh songs', tag: 'SEARCH' },
  { label: 'पहला वीडियो चलाओ', command: 'पहला वीडियो चलाओ', tag: 'HINDI' },
  { label: 'Play Kesariya', command: 'Play Kesariya', tag: 'MUSIC' },
  { label: 'Iron Man Trailer', command: 'Play Iron Man trailer', tag: 'VIDEO' },
  { label: 'वीडियो रोक दो', command: 'वीडियो रोक दो', tag: 'PAUSE' },
  { label: 'Flipkart खोलो', command: 'Flipkart kholo', tag: 'WEB' },
  { label: 'Volume 50', command: 'Volume 50', tag: 'CTRL' },
  { label: 'Fullscreen', command: 'Turn on fullscreen', tag: 'VIEW' },
];

const REACTOR_STATES: ReactorHudState[] = [
  'SPEAKING',
  'LISTENING',
  'PROCESSING',
  'EXECUTING',
  'PLAYING',
  'PAUSED',
];

const SEARCH_MODES: Array<{ id: YouTubeSearchMode; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'video', label: 'All Videos', icon: Film },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'education', label: 'Education', icon: GraduationCap },
];

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const rem = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export const MediaControlView: React.FC<MediaControlViewProps> = ({
  mediaState,
  mediaMemory,
  activityLog,
  reactorState,
  youtubeConfigured,
  ytSearchResults,
  isSearchingYouTube,
  isListening,
  isExecutingCommand,
  isWakeWordActive,
  audioDuckingEnabled,
  reducedMotion,
  initialSection = 'youtube',
  isOnline = true,
  onExecuteCommand,
  onSearchYouTube,
  onPlaySearchResult,
  onClearSearchHistory,
  onStartVoiceCapture,
  onStopVoiceCapture,
  onToggleWakeWord,
  onToggleAudioDucking,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onStop,
  onClosePlayer,
  onSeekTo,
  onSeekBy,
  onSetVolume,
  onAdjustVolume,
  onToggleMute,
  onCycleRepeat,
  onToggleFullscreen,
  onSelectQueueIndex,
  onClearActivityLog,
  onStageRectChange,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [ytQuery, setYtQuery] = useState('');
  const [ytMode, setYtMode] = useState<YouTubeSearchMode>('video');
  const [siteFilter, setSiteFilter] = useState('');
  const [rightTab, setRightTab] = useState<'results' | 'queue' | 'websites' | 'log'>(
    initialSection === 'browser'
      ? 'websites'
      : ytSearchResults && ytSearchResults.items.length > 0
        ? 'results'
        : 'queue'
  );

  useEffect(() => {
    if (initialSection === 'browser') {
      setRightTab('websites');
    } else if (initialSection === 'youtube' && rightTab === 'websites') {
      setRightTab(ytSearchResults && ytSearchResults.items.length > 0 ? 'results' : 'queue');
    }
  }, [initialSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch cleanly to Results tab whenever a fresh YouTube search arrives (never lock ytMode to music)
  useEffect(() => {
    if (ytSearchResults && (ytSearchResults.items.length > 0 || !ytSearchResults.ok)) {
      setRightTab('results');
      if (ytSearchResults.query) {
        setYtQuery(ytSearchResults.query);
      }
    }
  }, [ytSearchResults]);

  const filteredWebsites = useMemo(() => {
    const q = siteFilter.trim().toLowerCase();
    if (!q) return BUILTIN_WEBSITE_DIRECTORY;
    return BUILTIN_WEBSITE_DIRECTORY.filter(
      (site) =>
        site.name.toLowerCase().includes(q) ||
        site.category.toLowerCase().includes(q) ||
        site.aliases.some((alias) => alias.toLowerCase().includes(q))
    );
  }, [siteFilter]);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commandInput.trim();
    if (!trimmed) return;
    onExecuteCommand(trimmed);
    setCommandInput('');
  };

  const handleYouTubeSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = ytQuery.trim();
    if (!trimmed) return;
    const parsedUrl = parseYouTubeUrlInput(trimmed);
    if (parsedUrl?.kind === 'video' && parsedUrl.videoId) {
      const directItem: YouTubeMediaItem = {
        videoId: parsedUrl.videoId,
        title: `YouTube Video (${parsedUrl.videoId})`,
        channelTitle: 'Direct Link',
        description: '',
        thumbnailUrl: `https://i.ytimg.com/vi/${parsedUrl.videoId}/hqdefault.jpg`,
        watchUrl: `https://www.youtube.com/watch?v=${parsedUrl.videoId}`,
        embeddable: true,
        mediaType: 'video',
      };
      setRightTab('queue');
      onPlaySearchResult([directItem], 0, directItem.watchUrl);
      return;
    }
    if (parsedUrl?.kind === 'playlist' && parsedUrl.playlistId) {
      setRightTab('queue');
      onExecuteCommand(`play youtube playlist ${parsedUrl.playlistId}`);
      return;
    }
    setRightTab('results');
    onSearchYouTube(trimmed, ytMode);
  };

  const track = mediaState.currentTrack;
  const isPlaying = mediaState.status === 'playing';
  const searchHistory = mediaMemory.searchHistory || [];

  return (
    <div className="space-y-4 pb-6" data-testid="media-control-view">
      {!isOnline && (
        <div
          data-testid="media-offline-banner"
          className="rounded-xl border border-amber-400/50 bg-amber-500/12 px-4 py-2.5 flex items-center gap-2.5 font-mono-hud text-xs text-amber-200"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
          <span>
            Offline mode active: YouTube streaming &amp; live web browsing require an internet connection. Local tasks, notes, memory, and local AI commands remain available.
          </span>
        </div>
      )}
      {/* Top HUD Command & Reactor Strip */}
      <div className="glass-panel-glow rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-base sm:text-lg tracking-[0.18em] text-slate-100">
                YOUTUBE &amp; UNIVERSAL MEDIA CONTROL
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/45 font-mono-hud text-[10px] font-bold text-cyan-200">
                {reactorState}
              </span>
              {youtubeConfigured === false && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/45 font-mono-hud text-[10px] font-bold text-amber-200">
                  YOUTUBE FALLBACK MODE (SET YOUTUBE_API_KEY)
                </span>
              )}
            </div>
            <p className="font-mono-hud text-[11px] text-slate-400 mt-0.5">
              Official YouTube Data API v3 search, IFrame playback, queue &amp; 28+ website launcher with bilingual English/Hindi/Hinglish voice control.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="media-wake-word-toggle"
              onClick={onToggleWakeWord}
              className={`px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                isWakeWordActive
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                  : 'bg-[#0D1527] border-slate-700 hover:border-cyan-400/50 text-slate-300'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isWakeWordActive ? 'animate-pulse text-emerald-300' : ''}`} />
              <span>{isWakeWordActive ? 'HEY JARVIS: ON' : 'HEY JARVIS: OFF'}</span>
            </button>

            <button
              type="button"
              data-testid="media-ducking-toggle"
              onClick={onToggleAudioDucking}
              className={`px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                audioDuckingEnabled
                  ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-200'
                  : 'bg-[#0D1527] border-slate-700 text-slate-400'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>DUCKING: {audioDuckingEnabled ? '20% AUTO' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* 6-State Reactor Status Bar */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {REACTOR_STATES.map((st) => {
            const active = reactorState === st;
            return (
              <div
                key={st}
                className={`px-2 py-1.5 rounded-lg border text-center font-mono-hud text-[10px] font-bold tracking-wider transition-all ${
                  active
                    ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.28)]'
                    : 'bg-[#040812]/80 border-slate-800/80 text-slate-500'
                }`}
              >
                {st}
              </div>
            );
          })}
        </div>

        {/* Dedicated YouTube Search Engine Bar (Videos, Music, Education + Voice Search + History) */}
        <div className="rounded-xl bg-[#040812]/90 border border-cyan-500/30 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Youtube className="w-4 h-4 text-rose-400" />
              <span className="font-mono-hud text-[11px] font-bold tracking-wider text-cyan-200">
                YOUTUBE SEARCH ENGINE
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {SEARCH_MODES.map((m) => {
                const Icon = m.icon;
                const active = ytMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`yt-mode-${m.id}`}
                    onClick={() => {
                      setYtMode(m.id);
                      if (ytQuery.trim()) {
                        setRightTab('results');
                        onSearchYouTube(ytQuery.trim(), m.id);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg border font-mono-hud text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                      active
                        ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                        : 'bg-[#0D1527] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleYouTubeSearchSubmit} className="flex flex-wrap sm:flex-nowrap gap-2">
            <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-[#070E1D] border border-slate-700 focus-within:border-cyan-400 rounded-xl px-3.5 py-2">
              <Search className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                data-testid="youtube-search-input"
                value={ytQuery}
                onChange={(e) => setYtQuery(e.target.value)}
                placeholder="Search YouTube videos, Arijit Singh songs, coding tutorials, artists..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              {ytQuery && (
                <button
                  type="button"
                  aria-label="Clear YouTube search"
                  onClick={() => setYtQuery('')}
                  className="text-slate-500 hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              data-testid="youtube-voice-search-btn"
              onClick={isListening ? onStopVoiceCapture : onStartVoiceCapture}
              title={isListening ? 'Stop voice search' : 'Voice Search YouTube'}
              className={`px-3.5 py-2 rounded-xl font-mono-hud text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                isListening
                  ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_16px_rgba(244,63,94,0.4)]'
                  : 'bg-[#0D1527] border border-cyan-400/45 hover:border-cyan-300 text-cyan-200'
              }`}
            >
              {isListening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isListening ? 'STOP' : 'VOICE'}</span>
            </button>

            <button
              type="submit"
              disabled={!ytQuery.trim() || isSearchingYouTube}
              data-testid="youtube-search-submit"
              className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0 shadow-[0_0_14px_rgba(0,240,255,0.28)]"
            >
              {isSearchingYouTube ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{isSearchingYouTube ? 'SEARCHING' : 'SEARCH'}</span>
            </button>
          </form>

          {/* Search History Chips */}
          {searchHistory.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="inline-flex items-center gap-1 font-mono-hud text-[9px] text-slate-400 uppercase mr-1">
                <Clock className="w-3 h-3 text-cyan-400/80" />
                Recent:
              </span>
              {searchHistory.slice(0, 8).map((entry) => (
                <button
                  key={`${entry.query}_${entry.timestamp}`}
                  type="button"
                  onClick={() => {
                    setYtQuery(entry.query);
                    setYtMode(entry.mode);
                    setRightTab('results');
                    onSearchYouTube(entry.query, entry.mode);
                  }}
                  className="px-2 py-0.5 rounded-md bg-[#0D1527] border border-slate-800 hover:border-cyan-400/50 font-mono-hud text-[10px] text-slate-300 hover:text-cyan-200 cursor-pointer"
                >
                  {entry.query}
                </button>
              ))}
              <button
                type="button"
                onClick={onClearSearchHistory}
                className="px-2 py-0.5 rounded-md text-[10px] font-mono-hud text-slate-500 hover:text-rose-300 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Unified Natural Voice + Text Command Bar */}
        <form onSubmit={handleCommandSubmit} className="flex flex-wrap sm:flex-nowrap gap-2">
          <button
            type="button"
            data-testid="media-mic-btn"
            onClick={isListening ? onStopVoiceCapture : onStartVoiceCapture}
            className={`px-4 py-2.5 rounded-xl font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer shrink-0 transition-all ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.45)]'
                : 'bg-cyan-400 hover:bg-cyan-300 text-[#02040A] shadow-[0_0_18px_rgba(0,240,255,0.3)]'
            }`}
          >
            {isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isListening ? 'STOP MIC' : 'VOICE CMD'}</span>
          </button>

          <input
            type="text"
            data-testid="media-command-input"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder='Try: "Search Arijit Singh songs", "पहला वीडियो चलाओ", "वीडियो रोक दो", "दस सेकंड आगे करो", "Open Flipkart"'
            className="flex-1 min-w-[200px] bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!commandInput.trim() || isExecutingCommand}
            data-testid="media-command-submit"
            className="px-4 py-2.5 rounded-xl bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 disabled:opacity-40 text-cyan-200 font-display text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>{isExecutingCommand ? 'EXECUTING' : 'EXECUTE'}</span>
          </button>
        </form>

        {/* Quick Multi-Lingual Command Chips + Headphones Recommendation */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_COMMANDS.map((item) => (
              <button
                key={item.command}
                type="button"
                onClick={() => onExecuteCommand(item.command)}
                className="px-2.5 py-1 rounded-lg bg-[#0D1527] border border-slate-800 hover:border-cyan-400/50 font-mono-hud text-[10px] text-cyan-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <span className="text-[9px] text-slate-400">{item.tag}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1.5 font-mono-hud text-[10px] text-slate-400">
            <Headphones className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tip: Headphones improve &quot;Hey JARVIS&quot; wake accuracy during loud playback.</span>
          </div>
        </div>
      </div>

      {/* Main Split Grid: Left = Reusable YouTube Player Stage & Controls, Right = Results / Queue / Sites / Log */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left 7 Columns: Official YouTube IFrame Stage + Full Control Deck */}
        <div className="xl:col-span-7 glass-panel rounded-2xl p-4 space-y-4 border border-cyan-500/25">
          <YouTubePlayerStage
            mediaState={mediaState}
            mediaMemory={mediaMemory}
            reducedMotion={reducedMotion}
            onPlay={onPlay}
            onNext={onNext}
            onToggleFullscreen={onToggleFullscreen}
            onStageRectChange={onStageRectChange}
          />

          {/* Interactive Timeline Scrubber */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(mediaState.durationSec || 0))}
              value={Math.min(
                Math.max(0, Math.floor(mediaState.currentTimeSec)),
                Math.max(1, Math.floor(mediaState.durationSec || 0))
              )}
              disabled={!track || mediaState.durationSec <= 0}
              aria-label="Seek media timeline"
              onChange={(e) => onSeekTo(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
            />
            <div className="flex justify-between font-mono-hud text-[10px] text-slate-400">
              <span>{formatTime(mediaState.currentTimeSec)}</span>
              <span>{formatTime(mediaState.durationSec)}</span>
            </div>
          </div>

          {/* Full Real Transport Controls Deck */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onPrevious}
                aria-label="Previous track"
                title="Previous track"
                className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 text-slate-200 cursor-pointer"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onSeekBy(-10)}
                aria-label="Seek backward 10 seconds"
                title="Backward 10s"
                className="px-2.5 py-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 text-slate-200 font-mono-hud text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>10s</span>
              </button>

              <button
                type="button"
                onClick={isPlaying ? onPause : onPlay}
                aria-label={isPlaying ? 'Pause media' : 'Play media'}
                className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(0,240,255,0.35)]"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                type="button"
                onClick={() => onSeekBy(10)}
                aria-label="Seek forward 10 seconds"
                title="Forward 10s"
                className="px-2.5 py-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 text-slate-200 font-mono-hud text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <span>10s</span>
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onNext}
                aria-label="Next track"
                title="Next track"
                className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 text-slate-200 cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onStop}
                aria-label="Stop playback"
                title="Stop playback"
                className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-amber-400/60 text-slate-200 hover:text-amber-200 cursor-pointer"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onCycleRepeat}
                aria-label={`Repeat mode: ${mediaState.repeatMode}`}
                title={`Repeat: ${mediaState.repeatMode.toUpperCase()}`}
                className={`px-2.5 py-2.5 rounded-xl border font-mono-hud text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                  mediaState.repeatMode !== 'off'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-[#0D1527] border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {mediaState.repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
                <span>{mediaState.repeatMode.toUpperCase()}</span>
              </button>

              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label={mediaState.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                title={mediaState.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 text-cyan-300 cursor-pointer"
              >
                {mediaState.isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={onClosePlayer}
                aria-label="Close media player"
                title="Close Player"
                className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-rose-400/60 text-slate-300 hover:text-rose-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Volume Up/Down, Slider & Mute Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={mediaState.isMuted ? 'Unmute media' : 'Mute media'}
                className={`p-2 rounded-lg border cursor-pointer ${
                  mediaState.isMuted
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-[#0D1527] border-slate-700 text-cyan-300'
                }`}
              >
                {mediaState.isMuted || mediaState.volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onAdjustVolume(-10)}
                aria-label="Decrease volume"
                title="Volume Down"
                className="p-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/50 text-slate-300 cursor-pointer"
              >
                <Volume1 className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={mediaState.isMuted ? 0 : mediaState.volume}
                aria-label="Media volume"
                onChange={(e) => onSetVolume(Number(e.target.value))}
                className="w-20 sm:w-24 accent-cyan-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => onAdjustVolume(10)}
                aria-label="Increase volume"
                title="Volume Up"
                className="p-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/50 text-slate-300 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono-hud text-[11px] text-cyan-200 w-9 text-right">
                {mediaState.isMuted ? 'MUTE' : `${mediaState.volume}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Tabbed YouTube Results / Queue / 28-Site Launcher / Command Activity Log */}
        <div className="xl:col-span-5 glass-panel rounded-2xl p-4 space-y-3 border border-cyan-500/20">
          <div className="grid grid-cols-4 gap-1 bg-[#040812] p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              data-testid="media-tab-results"
              onClick={() => setRightTab('results')}
              className={`py-2 px-1.5 rounded-lg font-mono-hud text-[9.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                rightTab === 'results'
                  ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/45'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Youtube className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                RESULTS ({ytSearchResults?.items.length || 0})
              </span>
            </button>
            <button
              type="button"
              data-testid="media-tab-queue"
              onClick={() => setRightTab('queue')}
              className={`py-2 px-1.5 rounded-lg font-mono-hud text-[9.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                rightTab === 'queue'
                  ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/45'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">QUEUE ({mediaState.queue.length})</span>
            </button>
            <button
              type="button"
              data-testid="media-tab-websites"
              onClick={() => setRightTab('websites')}
              className={`py-2 px-1.5 rounded-lg font-mono-hud text-[9.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                rightTab === 'websites'
                  ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/45'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">SITES ({BUILTIN_WEBSITE_DIRECTORY.length})</span>
            </button>
            <button
              type="button"
              data-testid="media-tab-log"
              onClick={() => setRightTab('log')}
              className={`py-2 px-1.5 rounded-lg font-mono-hud text-[9.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                rightTab === 'log'
                  ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/45'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">LOG ({activityLog.length})</span>
            </button>
          </div>

          {/* TAB 1: YouTube Search Results with Thumbnails, Durations, Stats & Pagination */}
          {rightTab === 'results' && (
            <div className="space-y-2.5" data-testid="youtube-search-results">
              {isSearchingYouTube ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((sk) => (
                    <div
                      key={sk}
                      className="rounded-xl p-2.5 bg-[#070E1D] border border-slate-800 flex items-center gap-3 animate-pulse"
                    >
                      <div className="w-24 h-14 rounded-lg bg-slate-800 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-800 rounded w-4/5" />
                        <div className="h-2.5 bg-slate-800 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !ytSearchResults ? (
                <div className="rounded-xl bg-[#040812] border border-slate-800 p-6 text-center space-y-2">
                  <Youtube className="w-8 h-8 text-cyan-400/60 mx-auto" />
                  <p className="text-xs font-medium text-slate-300">
                    Search YouTube videos, music, or educational tutorials
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Type a query above or say &quot;Search Arijit Singh songs&quot; to browse results with thumbnails, durations, and view counts.
                  </p>
                </div>
              ) : !ytSearchResults.ok || ytSearchResults.items.length === 0 ? (
                <div className="rounded-xl bg-amber-500/10 border border-amber-400/40 p-4 space-y-2.5 text-center">
                  <AlertTriangle className="w-6 h-6 text-amber-300 mx-auto" />
                  <p className="text-xs font-semibold text-amber-100">
                    {ytSearchResults.reason ||
                      `No YouTube results returned for "${ytSearchResults.query}".`}
                  </p>
                  {ytSearchResults.fallbackUrl && (
                    <a
                      href={ytSearchResults.fallbackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#02040A] font-mono-hud text-[11px] font-bold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>SEARCH ON YOUTUBE</span>
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="font-mono-hud text-[10px] text-slate-400 truncate">
                      Query: <span className="text-cyan-200">&quot;{ytSearchResults.query}&quot;</span>
                      {ytSearchResults.cached ? ' • CACHED' : ''}
                    </span>
                    <span className="font-mono-hud text-[10px] text-cyan-300 shrink-0">
                      {ytSearchResults.items.length} shown
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
                    {ytSearchResults.items.map((item, idx) => {
                      const active = mediaState.currentTrack?.videoId === item.videoId;
                      const views = formatCompactNumber(item.viewCount);
                      const likes = formatCompactNumber(item.likeCount);
                      return (
                        <div
                          key={`${item.videoId}_${idx}`}
                          className={`rounded-xl p-2 border flex items-center gap-2.5 transition-colors ${
                            active
                              ? 'bg-cyan-500/15 border-cyan-400/60'
                              : 'bg-[#070E1D] border-slate-800 hover:border-cyan-500/45'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              onPlaySearchResult(
                                ytSearchResults.items,
                                idx,
                                ytSearchResults.fallbackUrl
                              )
                            }
                            className="relative w-24 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-700 cursor-pointer group bg-slate-900"
                          >
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Youtube className="w-5 h-5 text-cyan-300" />
                              </div>
                            )}
                            {item.durationText && (
                              <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 font-mono-hud text-[9px] text-white">
                                {item.durationText}
                              </span>
                            )}
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-5 h-5 text-cyan-300" />
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onPlaySearchResult(
                                ytSearchResults.items,
                                idx,
                                ytSearchResults.fallbackUrl
                              )
                            }
                            className="min-w-0 flex-1 text-left cursor-pointer space-y-0.5"
                          >
                            <p className="text-xs font-semibold text-slate-100 line-clamp-2 leading-snug">
                              {idx + 1}. {item.title}
                            </p>
                            <p className="font-mono-hud text-[10px] text-slate-400 truncate">
                              {item.channelTitle}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 font-mono-hud text-[9.5px] text-cyan-300/80">
                              {views && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Eye className="w-2.5 h-2.5" />
                                  {views}
                                </span>
                              )}
                              {likes && (
                                <span className="inline-flex items-center gap-0.5 text-emerald-300/80">
                                  <ThumbsUp className="w-2.5 h-2.5" />
                                  {likes}
                                </span>
                              )}
                              {item.embeddable === false && (
                                <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-200">
                                  NO EMBED
                                </span>
                              )}
                            </div>
                          </button>

                          <a
                            href={item.watchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${item.title} on YouTube`}
                            className="p-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-300 shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Bar */}
                  {(ytSearchResults.prevPageToken || ytSearchResults.nextPageToken) && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        type="button"
                        disabled={!ytSearchResults.prevPageToken || isSearchingYouTube}
                        onClick={() =>
                          ytSearchResults.prevPageToken &&
                          onSearchYouTube(
                            ytSearchResults.query,
                            ytSearchResults.mode || ytMode,
                            ytSearchResults.prevPageToken
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 disabled:opacity-35 font-mono-hud text-[10px] font-bold text-cyan-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>PREV PAGE</span>
                      </button>
                      <button
                        type="button"
                        disabled={!ytSearchResults.nextPageToken || isSearchingYouTube}
                        onClick={() =>
                          ytSearchResults.nextPageToken &&
                          onSearchYouTube(
                            ytSearchResults.query,
                            ytSearchResults.mode || ytMode,
                            ytSearchResults.nextPageToken
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 disabled:opacity-35 font-mono-hud text-[10px] font-bold text-cyan-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>NEXT PAGE</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: Active Playback Queue */}
          {rightTab === 'queue' && (
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {mediaState.pendingSelectionQuery && (
                <div className="rounded-xl bg-cyan-500/12 border border-cyan-400/45 px-3 py-2 text-xs font-mono-hud text-cyan-100">
                  Matches for &quot;{mediaState.pendingSelectionQuery}&quot;. Click any item below or say &quot;Play the first video&quot;:
                </div>
              )}

              {mediaState.queue.length === 0 ? (
                <div className="rounded-xl bg-[#040812] border border-slate-800 p-6 text-center space-y-2">
                  <ListMusic className="w-7 h-7 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Your playback queue is empty. Search YouTube above or ask JARVIS to play any song, artist, playlist, or video.
                  </p>
                </div>
              ) : (
                mediaState.queue.map((item, idx) => {
                  const active = idx === mediaState.currentIndex && mediaState.currentTrack?.videoId === item.videoId;
                  return (
                    <div
                      key={`${item.videoId}_${idx}`}
                      className={`rounded-xl p-2.5 border flex items-center gap-3 transition-colors ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-400/60'
                          : 'bg-[#070E1D] border-slate-800 hover:border-cyan-500/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectQueueIndex(idx)}
                        className="relative w-16 h-11 rounded-lg overflow-hidden shrink-0 border border-slate-700 cursor-pointer group"
                      >
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                            <Play className="w-4 h-4 text-cyan-300" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-4 h-4 text-cyan-300" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectQueueIndex(idx)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-slate-100 line-clamp-1">
                          {idx + 1}. {item.title}
                        </p>
                        <p className="font-mono-hud text-[10px] text-slate-400 truncate mt-0.5">
                          {item.channelTitle}
                          {item.durationText ? ` • ${item.durationText}` : ''}
                        </p>
                      </button>

                      <a
                        href={item.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${item.title} on YouTube`}
                        className="p-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-300 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: Built-In 28-Site Universal Website Directory */}
          {rightTab === 'websites' && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#040812] border border-slate-800 focus-within:border-cyan-400/60">
                <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <input
                  type="text"
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  placeholder="Filter 28 built-in sites (Google, Flipkart, IRCTC, GitHub...)"
                  className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[430px] overflow-y-auto pr-1">
                {filteredWebsites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => onExecuteCommand(`Open ${site.name}`)}
                    className="p-2.5 rounded-xl bg-[#070E1D] border border-slate-800 hover:border-cyan-400/55 text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-100 group-hover:text-cyan-200 truncate">
                        {site.name}
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-300 shrink-0" />
                    </div>
                    <p className="font-mono-hud text-[9px] text-slate-400 uppercase mt-0.5 truncate">
                      {site.category}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Command Activity Log */}
          {rightTab === 'log' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono-hud text-[10px] text-slate-400 uppercase">
                  Recent Voice &amp; Web Actions
                </span>
                {activityLog.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearActivityLog}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-rose-400/50 font-mono-hud text-[10px] text-slate-300 hover:text-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>CLEAR</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1" data-testid="command-activity-log">
                {activityLog.length === 0 ? (
                  <div className="rounded-xl bg-[#040812] border border-slate-800 p-6 text-center text-xs text-slate-400">
                    No media or website commands executed yet. Every command, intent, clickable link, and popup status appears here.
                  </div>
                ) : (
                  activityLog.map((entry) => {
                    const badgeStyle =
                      entry.status === 'success'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                        : entry.status === 'popup_blocked'
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                          : entry.status === 'error'
                            ? 'bg-rose-500/15 text-rose-200 border-rose-400/45'
                            : 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40';

                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl bg-[#070E1D] border border-slate-800 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                            {entry.intent}
                          </span>
                          <span className={`font-mono-hud text-[9px] px-1.5 py-0.5 rounded border ${badgeStyle}`}>
                            {entry.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-100">
                          &quot;{entry.rawCommand}&quot;
                        </p>
                        <p className="text-[11px] text-slate-300">{entry.summary}</p>
                        {entry.status === 'popup_blocked' && (
                          <p className="font-mono-hud text-[10px] text-amber-200">
                            Popup blocked by browser — click the link below or allow popups in your address bar.
                          </p>
                        )}
                        {entry.url && (
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/40 hover:border-cyan-300 font-mono-hud text-[10px] text-cyan-200 max-w-full"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{entry.urlLabel || entry.url}</span>
                          </a>
                        )}
                        <div className="flex items-center justify-between font-mono-hud text-[9px] text-slate-500 pt-0.5">
                          <span>SOURCE: {entry.source.toUpperCase()}</span>
                          <span>
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Film,
  Flame,
  Globe,
  GraduationCap,
  Grid,
  Headphones,
  Heart,
  Layers,
  ListMusic,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Search,
  Send,
  Settings,
  Share2,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Star,
  ThumbsUp,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
  X,
  Youtube,
  Zap,
} from 'lucide-react';
import {
  MediaStageRect,
  YouTubePlayerStage,
} from '../components/YouTubePlayerStage';
import { BUILTIN_WEBSITE_DIRECTORY } from '../services/media/websiteResolver.js';
import {
  formatCompactNumber,
  parseYouTubeUrlInput,
  SmartMediaMemoryService,
  YouTubeSearchService,
} from '../services/media/youtubeMediaServices';
import {
  CommandActivityLogEntry,
  CustomPlaylist,
  MediaPlayerState,
  ReactorHudState,
  RecentlyPlayedItem,
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
  onSetPlaybackRate?: (rate: number) => void;
  onUpdateMemory?: (memory: SmartMediaMemory) => void;
}

const REACTOR_STATES: ReactorHudState[] = [
  'SPEAKING',
  'LISTENING',
  'PROCESSING',
  'EXECUTING',
  'PLAYING',
  'PAUSED',
];

const SEARCH_MODES: Array<{ id: YouTubeSearchMode; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'video', label: 'All', icon: Sparkles },
  { id: 'video', label: 'Videos', icon: Film },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'education', label: 'Tutorials', icon: GraduationCap },
];

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const CATEGORY_TAGS = [
  { label: 'Python Tutorials', query: 'Python programming tutorial for beginners', mode: 'education' as const },
  { label: 'Web Dev & React', query: 'Modern Web Development React full course', mode: 'education' as const },
  { label: 'AI & Machine Learning', query: 'Artificial Intelligence and machine learning', mode: 'education' as const },
  { label: 'Cosmic & Space 4K', query: 'Space exploration galaxy documentary 4K', mode: 'video' as const },
  { label: 'Cyberpunk Lo-Fi', query: 'Cyberpunk Synthwave Lo-Fi music beats', mode: 'music' as const },
  { label: 'Cricket Highlights', query: 'Cricket highlights today', mode: 'video' as const },
  { label: 'Tech News Today', query: 'Technology news today', mode: 'video' as const },
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
  youtubeConfigured = true,
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
  onSetPlaybackRate,
  onUpdateMemory,
}) => {
  const [ytQuery, setYtQuery] = useState('');
  const [ytMode, setYtMode] = useState<YouTubeSearchMode>('video');
  const [siteFilter, setSiteFilter] = useState('');
  const [activeTab, setActiveTab] = useState<
    'results' | 'queue' | 'related' | 'favorites' | 'playlists' | 'history' | 'websites' | 'log'
  >(
    initialSection === 'browser'
      ? 'websites'
      : ytSearchResults && ytSearchResults.items.length > 0
        ? 'results'
        : 'results'
  );
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [selectedItemForPlaylist, setSelectedItemForPlaylist] = useState<YouTubeMediaItem | null>(null);
  const [localMemory, setLocalMemory] = useState<SmartMediaMemory>(mediaMemory);
  const [relatedVideos, setRelatedVideos] = useState<YouTubeMediaItem[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [isFetchingTrending, setIsFetchingTrending] = useState(false);

  const memoryService = useMemo(() => new SmartMediaMemoryService(), []);
  const youtubeService = useMemo(() => new YouTubeSearchService(), []);

  // Sync memory when prop changes
  useEffect(() => {
    setLocalMemory(mediaMemory);
  }, [mediaMemory]);

  useEffect(() => {
    if (initialSection === 'browser') {
      setActiveTab('websites');
    } else if (initialSection === 'youtube' && activeTab === 'websites') {
      setActiveTab(ytSearchResults && ytSearchResults.items.length > 0 ? 'results' : 'queue');
    }
  }, [initialSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch to Results tab whenever a fresh YouTube search arrives
  useEffect(() => {
    if (ytSearchResults && (ytSearchResults.items.length > 0 || !ytSearchResults.ok)) {
      setActiveTab('results');
      if (ytSearchResults.query) {
        setYtQuery(ytSearchResults.query);
      }
    }
  }, [ytSearchResults]);

  // Fetch related videos when active video changes
  const activeVideoId = mediaState.currentTrack?.videoId;
  useEffect(() => {
    if (!activeVideoId) {
      setRelatedVideos([]);
      return;
    }
    let cancelled = false;
    setIsLoadingRelated(true);
    youtubeService
      .getRelatedVideos(activeVideoId, 10)
      .then((res) => {
        if (!cancelled && res.ok) {
          setRelatedVideos(res.items);
        }
      })
      .catch(() => {
        if (!cancelled) setRelatedVideos([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRelated(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeVideoId, youtubeService]);

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
      setActiveTab('queue');
      onPlaySearchResult([directItem], 0, directItem.watchUrl);
      return;
    }
    if (parsedUrl?.kind === 'playlist' && parsedUrl.playlistId) {
      setActiveTab('queue');
      onExecuteCommand(`play youtube playlist ${parsedUrl.playlistId}`);
      return;
    }
    setActiveTab('results');
    onSearchYouTube(trimmed, ytMode);
  };

  const handleFetchTrending = async () => {
    setIsFetchingTrending(true);
    try {
      const res = await youtubeService.getTrending({ maxResults: 12 });
      if (res.ok && res.items.length > 0) {
        onPlaySearchResult(res.items, 0, res.items[0]?.watchUrl);
        setActiveTab('results');
      }
    } finally {
      setIsFetchingTrending(false);
    }
  };

  const handleToggleFavorite = (item: YouTubeMediaItem) => {
    const { nextMemory } = memoryService.toggleFavorite(localMemory, item);
    setLocalMemory(nextMemory);
    if (onUpdateMemory) onUpdateMemory(nextMemory);
  };

  const handleCreatePlaylist = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = memoryService.createPlaylist(localMemory, trimmed);
    setLocalMemory(updated);
    if (onUpdateMemory) onUpdateMemory(updated);
    setNewPlaylistName('');
    setShowNewPlaylistModal(false);
  };

  const handleAddToPlaylist = (playlistId: string, item: YouTubeMediaItem) => {
    const updated = memoryService.addToPlaylist(localMemory, playlistId, item);
    setLocalMemory(updated);
    if (onUpdateMemory) onUpdateMemory(updated);
    setSelectedItemForPlaylist(null);
  };

  const track = mediaState.currentTrack;
  const isPlaying = mediaState.status === 'playing';
  const favorites = localMemory.favorites || [];
  const playlists = localMemory.playlists || [];
  const recentlyPlayed = localMemory.recentlyPlayed || [];
  const isCurrentFavorite = track ? memoryService.isFavorite(localMemory, track.videoId) : false;

  return (
    <div className="space-y-4 pb-8" data-testid="media-control-view">
      {!isOnline && (
        <div
          data-testid="media-offline-banner"
          className="rounded-xl border border-amber-400/50 bg-amber-500/12 px-4 py-2.5 flex items-center gap-2.5 font-mono-hud text-xs text-amber-200"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
          <span>
            Offline mode active: YouTube streaming requires an internet connection. Saved playlists, favorites, and local controls remain accessible.
          </span>
        </div>
      )}

      {/* =========================================================================
          HERO BANNER: COSMIC INTELLIGENCE AM PLAYER (Mockup Matched)
          ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/40 bg-gradient-to-br from-[#060D1E] via-[#040813] to-[#020409] p-4 sm:p-6 shadow-[0_0_35px_rgba(0,240,255,0.15)]">
        {/* Decorative background nebula glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          {/* Cybernetic Avatar Container */}
          <div className="relative group shrink-0">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border-2 border-cyan-400/70 p-1 bg-[#02040A] shadow-[0_0_24px_rgba(0,240,255,0.35)] transition-transform duration-300 group-hover:scale-105">
              <img
                src="/am-player-avatar.jpg"
                alt="AM Player Cosmic AI Avatar"
                className="w-full h-full object-cover rounded-xl"
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
                <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-400/50 font-mono-hud text-[9px] font-bold text-cyan-200">
                  AM AI
                </span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                </span>
              </div>
            </div>
          </div>

          {/* Center Brand + Search + Quick Action Tiles */}
          <div className="flex-1 w-full space-y-4">
            {/* Top Brand Header + Action Icons */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-500 text-black shadow-[0_0_16px_rgba(0,240,255,0.5)]">
                  <Play className="w-5 h-5 fill-black ml-0.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-xl sm:text-2xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-white">
                      AM PLAYER
                    </h1>
                  </div>
                  <p className="font-mono-hud text-[10px] tracking-[0.25em] text-cyan-300/80 uppercase">
                    WATCH • SEARCH • ENJOY
                  </p>
                </div>
              </div>

              {/* Right Settings & Pro Badges */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryDrawer((prev) => !prev)}
                  title="Configure AM Player Categories"
                  className="p-2 rounded-xl bg-[#0D1527] border border-cyan-400/30 hover:border-cyan-400 text-slate-300 hover:text-cyan-200 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-yellow-400/60 font-mono-hud text-[10px] font-bold text-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  <span>PRO</span>
                </div>
              </div>
            </div>

            {/* Glowing Search Bar with Voice Mic */}
            <form
              onSubmit={handleYouTubeSearchSubmit}
              className="relative flex items-center gap-2 rounded-2xl bg-[#070E1D]/90 border border-cyan-500/50 p-1.5 focus-within:border-cyan-300 focus-within:shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all"
            >
              <div className="flex items-center flex-1 px-3 gap-2.5">
                <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                <input
                  type="text"
                  data-testid="am_player_search_input"
                  data-alias="youtube-search-input"
                  value={ytQuery}
                  onChange={(e) => setYtQuery(e.target.value)}
                  placeholder="Search videos... (e.g. Python tutorial, Arijit Singh songs)"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
                />
                {ytQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setYtQuery('')}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Glowing Voice Mic Button */}
              <button
                type="button"
                data-testid="am_player_voice_search_btn"
                data-alias="youtube-voice-search-btn"
                onClick={isListening ? onStopVoiceCapture : onStartVoiceCapture}
                title={isListening ? 'Stop voice search' : 'Voice search AM Player'}
                className={`p-2.5 rounded-xl font-mono-hud text-xs font-bold flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white shadow-[0_0_18px_rgba(244,63,94,0.6)] animate-pulse'
                    : 'bg-gradient-to-tr from-cyan-500 to-sky-400 text-black shadow-[0_0_14px_rgba(0,240,255,0.4)] hover:brightness-110'
                }`}
              >
                {isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Submit Search Button */}
              <button
                type="submit"
                disabled={!ytQuery.trim() || isSearchingYouTube}
                data-testid="youtube-search-submit"
                className="px-4 py-2.5 rounded-xl bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 disabled:opacity-40 text-cyan-200 font-display text-xs font-bold tracking-wider flex items-center gap-1.5 transition-colors"
              >
                {isSearchingYouTube ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                ) : (
                  <Search className="w-4 h-4 text-cyan-300" />
                )}
                <span className="hidden sm:inline">
                  {isSearchingYouTube ? 'SEARCHING' : 'SEARCH'}
                </span>
              </button>
            </form>

            {/* 5 Quick Discovery Tiles Matching Mockup */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              {/* Tile 1: Trending */}
              <button
                type="button"
                data-testid="am_tile_trending"
                onClick={handleFetchTrending}
                disabled={isFetchingTrending}
                className="group p-2.5 rounded-xl bg-gradient-to-b from-[#0D172A] to-[#080E1C] border border-rose-500/30 hover:border-rose-400/80 flex flex-col items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.1)] hover:shadow-[0_0_16px_rgba(244,63,94,0.25)] transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                  {isFetchingTrending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Flame className="w-4 h-4" />
                  )}
                </div>
                <span className="font-mono-hud text-[11px] font-bold text-slate-200 group-hover:text-rose-200">
                  Trending
                </span>
              </button>

              {/* Tile 2: Popular */}
              <button
                type="button"
                data-testid="am_tile_popular"
                onClick={() => {
                  setYtQuery('Trending popular songs and videos');
                  setActiveTab('results');
                  onSearchYouTube('Trending popular songs and videos', 'video');
                }}
                className="group p-2.5 rounded-xl bg-gradient-to-b from-[#0D172A] to-[#080E1C] border border-amber-500/30 hover:border-amber-400/80 flex flex-col items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.1)] hover:shadow-[0_0_16px_rgba(245,158,11,0.25)] transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-300 group-hover:scale-110 transition-transform">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                </div>
                <span className="font-mono-hud text-[11px] font-bold text-slate-200 group-hover:text-amber-200">
                  Popular
                </span>
              </button>

              {/* Tile 3: History */}
              <button
                type="button"
                data-testid="am_tile_history"
                onClick={() => setActiveTab('history')}
                className="group p-2.5 rounded-xl bg-gradient-to-b from-[#0D172A] to-[#080E1C] border border-cyan-500/30 hover:border-cyan-400/80 flex flex-col items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.1)] hover:shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="font-mono-hud text-[11px] font-bold text-slate-200 group-hover:text-cyan-200">
                  History
                </span>
              </button>

              {/* Tile 4: Favorites */}
              <button
                type="button"
                data-testid="am_tile_favorites"
                onClick={() => setActiveTab('favorites')}
                className="group p-2.5 rounded-xl bg-gradient-to-b from-[#0D172A] to-[#080E1C] border border-pink-500/30 hover:border-pink-400/80 flex flex-col items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(236,72,153,0.1)] hover:shadow-[0_0_16px_rgba(236,72,153,0.25)] transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                  <Heart className="w-4 h-4 fill-pink-400" />
                </div>
                <span className="font-mono-hud text-[11px] font-bold text-slate-200 group-hover:text-pink-200">
                  Favorites
                </span>
              </button>

              {/* Tile 5: Categories */}
              <button
                type="button"
                data-testid="am_tile_categories"
                onClick={() => setShowCategoryDrawer((prev) => !prev)}
                className="group p-2.5 rounded-xl bg-gradient-to-b from-[#0D172A] to-[#080E1C] border border-indigo-500/30 hover:border-indigo-400/80 flex flex-col items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(99,102,241,0.1)] hover:shadow-[0_0_16px_rgba(99,102,241,0.25)] transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300 group-hover:scale-110 transition-transform">
                  <Grid className="w-4 h-4" />
                </div>
                <span className="font-mono-hud text-[11px] font-bold text-slate-200 group-hover:text-indigo-200">
                  Categories
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Audio Waveform & Speech Strip */}
        <div className="relative mt-4 pt-3 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 h-5 px-1.5 rounded-lg bg-cyan-950/50 border border-cyan-500/30">
              <span className="w-1 h-3 bg-cyan-400 rounded-full animate-pulse" />
              <span className="w-1 h-5 bg-cyan-300 rounded-full animate-pulse" />
              <span className="w-1 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="w-1 h-4 bg-cyan-200 rounded-full animate-pulse" />
              <span className="w-1 h-3 bg-cyan-400 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono-hud text-xs text-cyan-200">
                Hello Sir, <strong className="text-white">welcome in. How are you?</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleWakeWord}
              className={`px-2.5 py-1 rounded-lg border font-mono-hud text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
                isWakeWordActive
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'bg-[#0D1527] border-slate-700 text-slate-400'
              }`}
            >
              <Radio className={`w-3 h-3 ${isWakeWordActive ? 'animate-pulse text-emerald-300' : ''}`} />
              <span>{isWakeWordActive ? 'HEY JARVIS: ON' : 'HEY JARVIS: OFF'}</span>
            </button>
            <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 font-mono-hud text-[10px] font-bold text-cyan-200 uppercase">
              {reactorState}
            </span>
          </div>
        </div>

        {/* Expandable Category Drawer */}
        {showCategoryDrawer && (
          <div className="mt-3 pt-3 border-t border-cyan-500/20 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-mono-hud text-[10px] uppercase tracking-wider text-cyan-300">
                Quick Category Channels:
              </span>
              <button
                type="button"
                onClick={() => setShowCategoryDrawer(false)}
                className="text-slate-400 hover:text-white font-mono-hud text-[10px]"
              >
                Close ✕
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_TAGS.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => {
                    setYtQuery(tag.query);
                    setYtMode(tag.mode);
                    setActiveTab('results');
                    onSearchYouTube(tag.query, tag.mode);
                    setShowCategoryDrawer(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#070E1D] border border-cyan-500/30 hover:border-cyan-400 text-xs text-slate-200 hover:text-cyan-200 font-medium transition-colors"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          FILTER CHIPS (All, Videos, Music, Tutorials)
          ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {SEARCH_MODES.map((m, idx) => {
            const Icon = m.icon;
            const active = ytMode === m.id && (idx !== 0 || ytMode === 'video');
            return (
              <button
                key={`${m.label}_${idx}`}
                type="button"
                onClick={() => {
                  setYtMode(m.id);
                  if (ytQuery.trim()) {
                    setActiveTab('results');
                    onSearchYouTube(ytQuery.trim(), m.id);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl border font-mono-hud text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                  active
                    ? 'bg-cyan-400/25 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                    : 'bg-[#0A1224] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Fast Action Hint */}
        <div className="hidden lg:flex items-center gap-1.5 font-mono-hud text-[11px] text-slate-400">
          <Headphones className="w-3.5 h-3.5 text-cyan-400" />
          <span>Say &quot;AM Player kholo&quot; or &quot;Play Python tutorial&quot;</span>
        </div>
      </div>

      {/* =========================================================================
          MAIN PLAYER STAGE & TABBED NAVIGATION
          ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 7 Columns: YouTubePlayerStage + Custom Deck Controls */}
        <div className="xl:col-span-7 rounded-3xl p-4 sm:p-5 space-y-4 border border-cyan-500/30 bg-[#040813]/90 shadow-[0_0_24px_rgba(0,240,255,0.08)]">
          {/* Player Top Title Bar */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-400/40 font-display text-[11px] font-bold text-cyan-200 shrink-0">
                <Play className="w-3 h-3 fill-cyan-400 text-cyan-400" />
                AM PLAYER
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                {track ? track.title : 'Ready for playback • Select a video'}
              </p>
            </div>
            {track && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 font-mono-hud text-[10px] font-bold text-emerald-300 shrink-0">
                {isPlaying ? '● Playing...' : '● Paused'}
              </span>
            )}
          </div>

          {/* Official YouTube Player Embedded Stage */}
          <YouTubePlayerStage
            mediaState={mediaState}
            mediaMemory={localMemory}
            reducedMotion={reducedMotion}
            onPlay={onPlay}
            onNext={onNext}
            onToggleFullscreen={onToggleFullscreen}
            onStageRectChange={onStageRectChange}
          />

          {/* Interactive Timeline Scrubber Bar */}
          <div className="space-y-1 px-1">
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
            <div className="flex justify-between font-mono-hud text-[11px] text-slate-400">
              <span className="text-cyan-300">{formatTime(mediaState.currentTimeSec)}</span>
              <span>{formatTime(mediaState.durationSec)}</span>
            </div>
          </div>

          {/* Custom AM Player Transport Controls Deck */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            {/* Primary Playback Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onPrevious}
                aria-label="Previous track"
                title="Previous track"
                className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-slate-200 cursor-pointer transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onSeekBy(-10)}
                aria-label="Seek backward 10 seconds"
                title="Backward 10s"
                className="px-2.5 py-2 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-slate-200 font-mono-hud text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>10</span>
              </button>

              {/* Big Glowing Center Play/Pause */}
              <button
                type="button"
                onClick={isPlaying ? onPause : onPlay}
                aria-label={isPlaying ? 'Pause media' : 'Play media'}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 hover:brightness-110 text-black font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                type="button"
                onClick={() => onSeekBy(10)}
                aria-label="Seek forward 10 seconds"
                title="Forward 10s"
                className="px-2.5 py-2 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-slate-200 font-mono-hud text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>10</span>
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onNext}
                aria-label="Next track"
                title="Next track"
                className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-slate-200 cursor-pointer transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Favorite Heart Button */}
              {track && (
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(track)}
                  title={isCurrentFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    isCurrentFavorite
                      ? 'bg-pink-500/20 border-pink-400 text-pink-300'
                      : 'bg-[#0D1527] border-slate-700 hover:border-pink-400/50 text-slate-400'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isCurrentFavorite ? 'fill-pink-400' : ''}`} />
                </button>
              )}

              {/* Add to Playlist Button */}
              {track && (
                <button
                  type="button"
                  onClick={() => setSelectedItemForPlaylist(track)}
                  title="Add to Playlist"
                  className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-200 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}

              {/* Repeat Mode */}
              <button
                type="button"
                onClick={onCycleRepeat}
                title={`Repeat: ${mediaState.repeatMode.toUpperCase()}`}
                className={`p-2.5 rounded-xl border font-mono-hud text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  mediaState.repeatMode !== 'off'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-[#0D1527] border-slate-700 text-slate-400'
                }`}
              >
                {mediaState.repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={onToggleFullscreen}
                title={mediaState.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-cyan-300 cursor-pointer transition-colors"
              >
                {mediaState.isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Playback Speed & Volume Section */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Playback Speed selector */}
              <div className="flex items-center gap-1 bg-[#070E1D] p-1 rounded-xl border border-slate-800">
                <span className="font-mono-hud text-[9px] text-slate-400 px-1">SPEED</span>
                {SPEED_OPTIONS.map((spd) => {
                  const currentRate = mediaState.playbackRate || 1.0;
                  const active = Math.abs(currentRate - spd) < 0.05;
                  return (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => onSetPlaybackRate && onSetPlaybackRate(spd)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-hud font-bold transition-colors ${
                        active
                          ? 'bg-cyan-400 text-black shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  );
                })}
              </div>

              {/* Volume Slider & Mute */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={mediaState.isMuted ? 'Unmute' : 'Mute'}
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
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mediaState.isMuted ? 0 : mediaState.volume}
                  aria-label="Volume slider"
                  onChange={(e) => onSetVolume(Number(e.target.value))}
                  className="w-16 sm:w-20 accent-cyan-400 cursor-pointer"
                />
                <span className="font-mono-hud text-[10px] text-cyan-200 w-8 text-right">
                  {mediaState.isMuted ? 'MUTE' : `${mediaState.volume}%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Tabbed Sections (Results, Related, Queue, Favorites, Playlists, History) */}
        <div className="xl:col-span-5 rounded-3xl p-4 space-y-3 border border-cyan-500/25 bg-[#040813]/90 shadow-[0_0_24px_rgba(0,240,255,0.06)]">
          {/* Tabs Header */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-[#02040A] p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              data-testid="media-tab-results"
              onClick={() => setActiveTab('results')}
              className={`py-2 px-1 rounded-xl font-mono-hud text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'results'
                  ? 'bg-cyan-400/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>RESULTS</span>
            </button>

            <button
              type="button"
              data-testid="media-tab-related"
              onClick={() => setActiveTab('related')}
              className={`py-2 px-1 rounded-xl font-mono-hud text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'related'
                  ? 'bg-cyan-400/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>RELATED</span>
            </button>

            <button
              type="button"
              data-testid="media-tab-queue"
              onClick={() => setActiveTab('queue')}
              className={`py-2 px-1 rounded-xl font-mono-hud text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'queue'
                  ? 'bg-cyan-400/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>QUEUE</span>
            </button>

            <button
              type="button"
              data-testid="media-tab-favorites"
              onClick={() => setActiveTab('favorites')}
              className={`py-2 px-1 rounded-xl font-mono-hud text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'favorites'
                  ? 'bg-cyan-400/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>FAVES ({favorites.length})</span>
            </button>

            <button
              type="button"
              data-testid="media-tab-playlists"
              onClick={() => setActiveTab('playlists')}
              className={`py-2 px-1 rounded-xl font-mono-hud text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'playlists'
                  ? 'bg-cyan-400/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>PLAYLISTS</span>
            </button>

            <button
              type="button"
              data-testid="media-tab-history"
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 rounded-xl font-mono-hud text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                activeTab === 'history'
                  ? 'bg-cyan-400/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>HISTORY</span>
            </button>
          </div>

          {/* TAB 1: Search Results */}
          {activeTab === 'results' && (
            <div className="space-y-2.5" data-testid="youtube-search-results">
              {isSearchingYouTube ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((sk) => (
                    <div
                      key={sk}
                      className="rounded-2xl p-2.5 bg-[#070E1D] border border-slate-800 flex items-center gap-3 animate-pulse"
                    >
                      <div className="w-24 h-14 rounded-xl bg-slate-800 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-800 rounded w-4/5" />
                        <div className="h-2.5 bg-slate-800 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !ytSearchResults || ytSearchResults.items.length === 0 ? (
                <div className="rounded-2xl bg-[#02040A] border border-slate-800/80 p-8 text-center space-y-3">
                  <Play className="w-10 h-10 text-cyan-400/60 mx-auto fill-cyan-400/20" />
                  <p className="text-sm font-semibold text-slate-200">
                    Search videos, music, or educational courses
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Type in the search bar above or tap <strong className="text-rose-300">Trending</strong> to load popular videos instantly.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="font-mono-hud text-[10px] text-slate-400 truncate">
                      Query: <strong className="text-cyan-200">&quot;{ytSearchResults.query}&quot;</strong>
                    </span>
                    <span className="font-mono-hud text-[10px] text-cyan-300 shrink-0">
                      {ytSearchResults.items.length} videos
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {ytSearchResults.items.map((item, idx) => {
                      const active = mediaState.currentTrack?.videoId === item.videoId;
                      const isFave = memoryService.isFavorite(localMemory, item.videoId);
                      const views = formatCompactNumber(item.viewCount);
                      return (
                        <div
                          key={`${item.videoId}_${idx}`}
                          className={`rounded-2xl p-2.5 border flex items-center gap-3 transition-colors ${
                            active
                              ? 'bg-cyan-500/15 border-cyan-400/70 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                              : 'bg-[#070E1D] border-slate-800 hover:border-cyan-500/50'
                          }`}
                        >
                          {/* Thumbnail with duration */}
                          <button
                            type="button"
                            onClick={() =>
                              onPlaySearchResult(
                                ytSearchResults.items,
                                idx,
                                ytSearchResults.fallbackUrl
                              )
                            }
                            className="relative w-28 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-700 cursor-pointer group bg-slate-900"
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
                                <Play className="w-5 h-5 text-cyan-300" />
                              </div>
                            )}
                            {item.durationText && (
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 font-mono-hud text-[9px] text-white">
                                {item.durationText}
                              </span>
                            )}
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-6 h-6 text-cyan-300 fill-cyan-300" />
                            </div>
                          </button>

                          {/* Info */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <button
                              type="button"
                              onClick={() =>
                                onPlaySearchResult(
                                  ytSearchResults.items,
                                  idx,
                                  ytSearchResults.fallbackUrl
                                )
                              }
                              className="text-left w-full cursor-pointer hover:text-cyan-300"
                            >
                              <p className="text-xs font-semibold text-slate-100 line-clamp-2 leading-snug">
                                {item.title}
                              </p>
                            </button>
                            <div className="flex items-center gap-2 font-mono-hud text-[10px] text-slate-400">
                              <span className="truncate text-slate-300">{item.channelTitle}</span>
                              {views && <span>• {views} views</span>}
                            </div>
                          </div>

                          {/* Action icons (Heart + Add) */}
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(item)}
                              title={isFave ? 'Remove favorite' : 'Add favorite'}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isFave
                                  ? 'bg-pink-500/20 border-pink-400 text-pink-300'
                                  : 'bg-[#0D1527] border-slate-700 hover:border-pink-400/50 text-slate-400'
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isFave ? 'fill-pink-400' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedItemForPlaylist(item)}
                              title="Add to playlist"
                              className="p-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-cyan-200"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: Related Videos */}
          {activeTab === 'related' && (
            <div className="space-y-2.5">
              {isLoadingRelated ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : relatedVideos.length === 0 ? (
                <div className="rounded-2xl bg-[#02040A] border border-slate-800 p-8 text-center space-y-2">
                  <Layers className="w-8 h-8 text-cyan-400/60 mx-auto" />
                  <p className="text-xs font-semibold text-slate-200">
                    No related recommendations currently loaded
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Play any video to see relevant recommendations.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {relatedVideos.map((item, idx) => (
                    <div
                      key={`rel_${item.videoId}_${idx}`}
                      className="rounded-2xl p-2.5 border bg-[#070E1D] border-slate-800 hover:border-cyan-500/50 flex items-center gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => onPlaySearchResult(relatedVideos, idx, item.watchUrl)}
                        className="relative w-24 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-700 cursor-pointer"
                      >
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="w-4 h-4 text-cyan-300 fill-cyan-300" />
                        </div>
                      </button>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-semibold text-slate-100 line-clamp-2">
                          {item.title}
                        </p>
                        <p className="text-[10px] font-mono-hud text-slate-400 truncate">
                          {item.channelTitle}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Queue */}
          {activeTab === 'queue' && (
            <div className="space-y-2.5">
              {mediaState.queue.length === 0 ? (
                <div className="rounded-2xl bg-[#02040A] border border-slate-800 p-8 text-center space-y-2">
                  <ListMusic className="w-8 h-8 text-cyan-400/60 mx-auto" />
                  <p className="text-xs font-semibold text-slate-200">Player queue is empty</p>
                  <p className="text-[11px] text-slate-400">
                    Search for a video or tap Trending to build a queue.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {mediaState.queue.map((item, idx) => {
                    const active = idx === mediaState.currentIndex;
                    return (
                      <div
                        key={`queue_${item.videoId}_${idx}`}
                        className={`rounded-2xl p-2.5 border flex items-center gap-3 ${
                          active
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                            : 'bg-[#070E1D] border-slate-800'
                        }`}
                      >
                        <span className="font-mono-hud text-xs font-bold text-slate-400 w-5 text-center">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-100 truncate">
                            {item.title}
                          </p>
                          <p className="text-[10px] font-mono-hud text-slate-400 truncate">
                            {item.channelTitle}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectQueueIndex(idx)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-400 text-black font-mono-hud text-[10px] font-bold"
                        >
                          {active ? 'PLAYING' : 'PLAY'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Favorites */}
          {activeTab === 'favorites' && (
            <div className="space-y-2.5">
              {favorites.length === 0 ? (
                <div className="rounded-2xl bg-[#02040A] border border-slate-800 p-8 text-center space-y-2">
                  <Heart className="w-8 h-8 text-pink-400/60 mx-auto" />
                  <p className="text-xs font-semibold text-slate-200">No favorite videos saved yet</p>
                  <p className="text-[11px] text-slate-400">
                    Tap the heart icon on any video to add it to your cosmic favorites.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {favorites.map((item, idx) => (
                    <div
                      key={`fav_${item.videoId}_${idx}`}
                      className="rounded-2xl p-2.5 border bg-[#070E1D] border-slate-800 flex items-center gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => onPlaySearchResult(favorites, idx, item.watchUrl)}
                        className="relative w-24 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-700 cursor-pointer"
                      >
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="w-4 h-4 text-pink-300 fill-pink-300" />
                        </div>
                      </button>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-semibold text-slate-100 line-clamp-2">
                          {item.title}
                        </p>
                        <p className="text-[10px] font-mono-hud text-slate-400 truncate">
                          {item.channelTitle}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(item)}
                        className="p-1.5 rounded-lg text-pink-400 hover:bg-pink-500/20"
                      >
                        <Heart className="w-4 h-4 fill-pink-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Playlists */}
          {activeTab === 'playlists' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="font-mono-hud text-xs text-slate-300">
                  Custom Playlists ({playlists.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewPlaylistModal(true)}
                  className="px-2.5 py-1 rounded-xl bg-cyan-400 text-black font-mono-hud text-[10px] font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>NEW PLAYLIST</span>
                </button>
              </div>

              {playlists.length === 0 ? (
                <div className="rounded-2xl bg-[#02040A] border border-slate-800 p-8 text-center space-y-2">
                  <ListMusic className="w-8 h-8 text-cyan-400/60 mx-auto" />
                  <p className="text-xs font-semibold text-slate-200">No custom playlists yet</p>
                  <p className="text-[11px] text-slate-400">
                    Create playlists to curate your favorite video courses and music.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className="rounded-2xl p-3 border border-slate-800 bg-[#070E1D] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ListMusic className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-bold text-slate-100">{pl.name}</h4>
                          <span className="font-mono-hud text-[10px] text-slate-400">
                            ({pl.items.length} items)
                          </span>
                        </div>
                        {pl.items.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onPlaySearchResult(pl.items, 0, pl.items[0]?.watchUrl)}
                            className="px-2 py-0.5 rounded-lg bg-cyan-400/20 text-cyan-300 border border-cyan-400/50 font-mono-hud text-[10px] font-bold"
                          >
                            PLAY ALL
                          </button>
                        )}
                      </div>
                      {pl.items.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          {pl.items.slice(0, 3).map((it) => (
                            <img
                              key={it.videoId}
                              src={it.thumbnailUrl}
                              alt={it.title}
                              className="rounded-lg h-12 w-full object-cover border border-slate-700"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: History */}
          {activeTab === 'history' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="font-mono-hud text-xs text-slate-300">
                  Recently Played ({recentlyPlayed.length})
                </span>
                {recentlyPlayed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = memoryService.clearRecentlyPlayed(localMemory);
                      setLocalMemory(updated);
                      if (onUpdateMemory) onUpdateMemory(updated);
                    }}
                    className="text-slate-400 hover:text-rose-400 font-mono-hud text-[10px]"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {recentlyPlayed.length === 0 ? (
                <div className="rounded-2xl bg-[#02040A] border border-slate-800 p-8 text-center space-y-2">
                  <Clock className="w-8 h-8 text-cyan-400/60 mx-auto" />
                  <p className="text-xs font-semibold text-slate-200">No watch history yet</p>
                  <p className="text-[11px] text-slate-400">
                    Played videos will automatically appear in your watch history.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {recentlyPlayed.map((rp) => (
                    <div
                      key={`hist_${rp.item.videoId}_${rp.playedAt}`}
                      className="rounded-2xl p-2.5 border bg-[#070E1D] border-slate-800 flex items-center gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => onPlaySearchResult([rp.item], 0, rp.item.watchUrl)}
                        className="relative w-24 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-700 cursor-pointer"
                      >
                        <img
                          src={rp.item.thumbnailUrl}
                          alt={rp.item.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="w-4 h-4 text-cyan-300 fill-cyan-300" />
                        </div>
                      </button>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-semibold text-slate-100 line-clamp-2">
                          {rp.item.title}
                        </p>
                        <p className="text-[10px] font-mono-hud text-slate-400 truncate">
                          {rp.item.channelTitle}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Playlist Selector Modal */}
      {selectedItemForPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-3xl border border-cyan-500/40 bg-[#060D1E] p-6 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-cyan-200">ADD TO PLAYLIST</h3>
              <button
                type="button"
                onClick={() => setSelectedItemForPlaylist(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2 font-medium">
              {selectedItemForPlaylist.title}
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => handleAddToPlaylist(pl.id, selectedItemForPlaylist)}
                  className="w-full p-2.5 rounded-xl bg-[#0D1527] border border-slate-800 hover:border-cyan-400 text-left font-mono-hud text-xs text-slate-200 flex items-center justify-between"
                >
                  <span>{pl.name}</span>
                  <span className="text-[10px] text-slate-400">({pl.items.length})</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowNewPlaylistModal(true);
              }}
              className="w-full py-2.5 rounded-xl bg-cyan-400 text-black font-mono-hud text-xs font-bold"
            >
              + CREATE NEW PLAYLIST
            </button>
          </div>
        </div>
      )}

      {/* New Playlist Modal */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-3xl border border-cyan-500/40 bg-[#060D1E] p-6 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
            <h3 className="font-display text-sm font-bold text-cyan-200">NEW PLAYLIST NAME</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="e.g. Python Masterclass"
              className="w-full px-3 py-2 rounded-xl bg-[#040812] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewPlaylistModal(false)}
                className="flex-1 py-2 rounded-xl bg-[#0D1527] border border-slate-700 text-slate-300 font-mono-hud text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreatePlaylist(newPlaylistName)}
                disabled={!newPlaylistName.trim()}
                className="flex-1 py-2 rounded-xl bg-cyan-400 disabled:opacity-40 text-black font-mono-hud text-xs font-bold"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

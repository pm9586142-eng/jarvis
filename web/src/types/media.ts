export type UniversalCommandIntent =
  | 'OPEN_WEBSITE'
  | 'SEARCH_WEB'
  | 'PLAY_VIDEO'
  | 'PLAY_SONG'
  | 'PLAY_PLAYLIST'
  | 'PAUSE_MEDIA'
  | 'RESUME_MEDIA'
  | 'NEXT_TRACK'
  | 'PREVIOUS_TRACK'
  | 'STOP_MEDIA'
  | 'CLOSE_PLAYER'
  | 'CHANGE_VOLUME'
  | 'MUTE_MEDIA'
  | 'UNMUTE_MEDIA'
  | 'SEEK_FORWARD'
  | 'SEEK_BACKWARD'
  | 'REPEAT_MEDIA'
  | 'GET_CURRENT_MEDIA'
  | 'UNKNOWN_COMMAND';

export type MediaControlCommandType =
  | 'play'
  | 'pause'
  | 'resume'
  | 'next'
  | 'previous'
  | 'stop'
  | 'close'
  | 'volume_up'
  | 'volume_down'
  | 'set_volume'
  | 'mute'
  | 'unmute'
  | 'seek_forward'
  | 'seek_backward'
  | 'repeat'
  | 'current';

export type CommandSource = 'wake_word' | 'voice_hud' | 'chat' | 'media_ui';

export interface ParsedUniversalCommand {
  intent: UniversalCommandIntent;
  rawText: string;
  normalizedText: string;
  query?: string;
  songName?: string;
  artistName?: string;
  websiteTarget?: string;
  volumeDelta?: number;
  volumeLevel?: number;
  seekSeconds?: number;
  repeatEnabled?: boolean;
  isWhoSingingQuestion?: boolean;
  confidence: number;
  matchedRule?: string;
}

export interface WebsiteDirectoryEntry {
  id: string;
  name: string;
  url: string;
  category:
    | 'SEARCH'
    | 'VIDEO'
    | 'SOCIAL'
    | 'SHOPPING'
    | 'AI'
    | 'DEVELOPER'
    | 'PRODUCTIVITY'
    | 'ENTERTAINMENT'
    | 'UTILITY';
  aliases: string[];
}

export interface WebsiteResolutionResult {
  ok: boolean;
  url: string;
  label: string;
  source: 'directory' | 'spoken_domain' | 'ai_resolved' | 'google_fallback';
  isFallbackSearch?: boolean;
  clarificationQuestion?: string;
  error?: string;
}

export interface YouTubeMediaItem {
  videoId: string;
  title: string;
  channelTitle: string;
  description?: string;
  thumbnailUrl: string;
  publishedAt?: string | null;
  durationText?: string;
  durationSeconds?: number | null;
  watchUrl: string;
  mediaType: 'song' | 'video';
}

export interface YouTubeSearchResponse {
  ok: boolean;
  configured: boolean;
  cached?: boolean;
  staleCacheUsed?: boolean;
  code?: string;
  query: string;
  mode: 'video' | 'music';
  items: YouTubeMediaItem[];
  fallbackUrl: string;
  reason?: string;
}

export type MediaPlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'autoplay_blocked'
  | 'embed_blocked'
  | 'error';

export type MediaRepeatMode = 'off' | 'one' | 'all';

export interface MediaPlayerState {
  status: MediaPlaybackStatus;
  currentTrack: YouTubeMediaItem | null;
  previousTrack: YouTubeMediaItem | null;
  queue: YouTubeMediaItem[];
  currentIndex: number;
  currentTimeSec: number;
  durationSec: number;
  volume: number;
  isMuted: boolean;
  isDucked: boolean;
  duckingSupported: boolean;
  repeatMode: MediaRepeatMode;
  isPlayerVisible: boolean;
  pendingSelectionQuery: string | null;
  pendingSelectionItems: YouTubeMediaItem[];
  fallbackUrl: string | null;
  statusMessage: string | null;
  errorMessage: string | null;
}

export interface SmartMediaMemory {
  currentTrack: YouTubeMediaItem | null;
  previousTrack: YouTubeMediaItem | null;
  queue: YouTubeMediaItem[];
  lastSearchQuery: string;
  lastOpenedWebsite: { label: string; url: string; timestamp: number } | null;
  recentCommands: Array<{
    command: string;
    intent: UniversalCommandIntent;
    timestamp: number;
  }>;
  preferredVolume: number;
  updatedAt: number;
}

export interface CommandActivityLogEntry {
  id: string;
  timestamp: number;
  source: CommandSource;
  rawCommand: string;
  normalizedCommand: string;
  intent: UniversalCommandIntent;
  status:
    | 'success'
    | 'popup_blocked'
    | 'autoplay_blocked'
    | 'embed_blocked'
    | 'fallback'
    | 'clarification'
    | 'error';
  summary: string;
  url?: string;
  urlLabel?: string;
  resultsCount?: number;
  playbackStatus?: MediaPlaybackStatus;
  errorDetail?: string;
}

export type ReactorHudState =
  | 'SPEAKING'
  | 'LISTENING'
  | 'PROCESSING'
  | 'EXECUTING'
  | 'PLAYING'
  | 'PAUSED'
  | 'STANDBY';

export type AiStructuredAction =
  | { action: 'open_url'; url: string; label?: string }
  | { action: 'play_song'; query: string }
  | { action: 'play_video'; query: string }
  | { action: 'media_control'; command: MediaControlCommandType; value?: number }
  | { action: 'clarify'; question: string };

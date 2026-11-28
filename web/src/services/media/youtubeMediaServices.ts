import {
  AiStructuredAction,
  CustomPlaylist,
  MediaPlayerState,
  RecentlyPlayedItem,
  SmartMediaMemory,
  UniversalCommandIntent,
  YouTubeMediaItem,
  YouTubePlaylistResponse,
  YouTubeSearchMode,
  YouTubeSearchResponse,
  YouTubeVideoDetailResponse,
} from '../../types/media';
import { buildJsonHeaders, resolveApiUrl } from '../api';
import { validateClientAiAction } from './universalCommandRouter.js';

const MEDIA_MEMORY_STORAGE_KEY = 'jarvis_web_smart_media_memory_v1';
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

export function buildClientYouTubeFallbackUrl(query: string): string {
  const clean = String(query || '').trim();
  if (!clean) return 'https://www.youtube.com';
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`;
}

import { parseYouTubeUrlInput } from './youtubeUrlParser.js';
export type { ParsedYouTubeUrlInput } from './youtubeUrlParser.js';
export { parseYouTubeUrlInput };

export function formatCompactNumber(count?: number | null): string {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return '';
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.floor(count));
}

export class YouTubeSearchService {
  private cache = new Map<string, { response: YouTubeSearchResponse; ts: number }>();

  async search(params: {
    query: string;
    mode: YouTubeSearchMode;
    maxResults?: number;
    pageToken?: string;
  }): Promise<YouTubeSearchResponse> {
    const cleanQuery = String(params.query || '').trim();
    const mode: YouTubeSearchMode =
      params.mode === 'music' ? 'music' : params.mode === 'education' ? 'education' : 'video';
    const maxResults = Math.min(15, Math.max(1, params.maxResults || 8));
    const pageToken = String(params.pageToken || '').trim();
    const fallbackUrl = buildClientYouTubeFallbackUrl(cleanQuery);

    if (!cleanQuery) {
      return {
        ok: false,
        configured: false,
        code: 'INVALID_QUERY',
        query: '',
        mode,
        items: [],
        nextPageToken: null,
        prevPageToken: null,
        totalResults: 0,
        fallbackUrl,
        reason: 'Search query cannot be empty.',
      };
    }

    const cacheKey = `${mode}::${maxResults}::${pageToken}::${cleanQuery.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CLIENT_CACHE_TTL_MS) {
      return { ...cached.response, cached: true };
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);

    try {
      const qs = new URLSearchParams({
        q: cleanQuery,
        mode,
        maxResults: String(maxResults),
      });
      if (pageToken) qs.set('pageToken', pageToken);

      const res = await fetch(resolveApiUrl(`/api/youtube/search?${qs.toString()}`), {
        method: 'GET',
        headers: buildJsonHeaders(),
        signal: controller.signal,
      });

      const raw = await res.text().catch(() => '');
      let data: Partial<YouTubeSearchResponse> | null = null;
      try {
        data = raw ? (JSON.parse(raw) as Partial<YouTubeSearchResponse>) : null;
      } catch {
        data = null;
      }

      if (!data) {
        return {
          ok: false,
          configured: true,
          code: 'YOUTUBE_BAD_RESPONSE',
          query: cleanQuery,
          mode,
          items: [],
          nextPageToken: null,
          prevPageToken: null,
          totalResults: 0,
          fallbackUrl,
          reason: 'Unexpected response from YouTube search endpoint.',
        };
      }

      const normalized: YouTubeSearchResponse = {
        ok: Boolean(data.ok),
        configured: Boolean(data.configured),
        cached: Boolean(data.cached),
        staleCacheUsed: Boolean(data.staleCacheUsed),
        code: data.code,
        query: data.query || cleanQuery,
        mode,
        items: Array.isArray(data.items) ? data.items : [],
        nextPageToken: data.nextPageToken || null,
        prevPageToken: data.prevPageToken || null,
        totalResults: typeof data.totalResults === 'number' ? data.totalResults : undefined,
        fallbackUrl: data.fallbackUrl || fallbackUrl,
        reason: data.reason,
      };

      if (normalized.ok && normalized.items.length > 0) {
        this.cache.set(cacheKey, { response: normalized, ts: Date.now() });
      }
      return normalized;
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (cached) {
        return {
          ...cached.response,
          cached: true,
          staleCacheUsed: true,
          reason: 'Network timeout contacting server; using cached YouTube results.',
        };
      }
      return {
        ok: false,
        configured: true,
        code: isAbort ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_NETWORK_ERROR',
        query: cleanQuery,
        mode,
        items: [],
        nextPageToken: null,
        prevPageToken: null,
        totalResults: 0,
        fallbackUrl,
        reason: isAbort
          ? 'YouTube search timed out. You can retry or open YouTube search directly.'
          : 'Network error while searching YouTube. Please check your connection or use the YouTube fallback link.',
      };
    } finally {
      window.clearTimeout(timer);
    }
  }

  async getVideoDetails(videoId: string): Promise<YouTubeVideoDetailResponse> {
    const cleanId = String(videoId || '').trim();
    const fallbackUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}`;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(resolveApiUrl(`/api/youtube/video/${encodeURIComponent(cleanId)}`), {
        method: 'GET',
        headers: buildJsonHeaders(),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as Partial<YouTubeVideoDetailResponse> | null;
      if (!data) {
        return {
          ok: false,
          configured: true,
          code: 'YOUTUBE_BAD_RESPONSE',
          video: null,
          fallbackUrl,
          reason: 'Invalid response from YouTube video details endpoint.',
        };
      }
      return {
        ok: Boolean(data.ok),
        configured: Boolean(data.configured),
        cached: Boolean(data.cached),
        staleCacheUsed: Boolean(data.staleCacheUsed),
        code: data.code,
        video: data.video || null,
        fallbackUrl: data.fallbackUrl || fallbackUrl,
        reason: data.reason,
      };
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        configured: true,
        code: isAbort ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_NETWORK_ERROR',
        video: null,
        fallbackUrl,
        reason: isAbort ? 'Timed out loading video details.' : 'Network error loading video details.',
      };
    } finally {
      window.clearTimeout(timer);
    }
  }

  async getPlaylist(
    playlistId: string,
    pageToken = '',
    maxResults = 10
  ): Promise<YouTubePlaylistResponse> {
    const cleanId = String(playlistId || '').trim();
    const fallbackUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(cleanId)}`;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const qs = new URLSearchParams({ maxResults: String(maxResults) });
      if (pageToken) qs.set('pageToken', pageToken);
      const res = await fetch(
        resolveApiUrl(`/api/youtube/playlist/${encodeURIComponent(cleanId)}?${qs.toString()}`),
        {
          method: 'GET',
          headers: buildJsonHeaders(),
          signal: controller.signal,
        }
      );
      const data = (await res.json().catch(() => null)) as Partial<YouTubePlaylistResponse> | null;
      if (!data) {
        return {
          ok: false,
          configured: true,
          code: 'YOUTUBE_BAD_RESPONSE',
          playlist: null,
          items: [],
          fallbackUrl,
          reason: 'Invalid response from YouTube playlist endpoint.',
        };
      }
      return {
        ok: Boolean(data.ok),
        configured: Boolean(data.configured),
        cached: Boolean(data.cached),
        staleCacheUsed: Boolean(data.staleCacheUsed),
        code: data.code,
        playlist: data.playlist || null,
        items: Array.isArray(data.items) ? data.items : [],
        nextPageToken: data.nextPageToken || null,
        prevPageToken: data.prevPageToken || null,
        totalResults: typeof data.totalResults === 'number' ? data.totalResults : undefined,
        fallbackUrl: data.fallbackUrl || fallbackUrl,
        reason: data.reason,
      };
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        configured: true,
        code: isAbort ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_NETWORK_ERROR',
        playlist: null,
        items: [],
        fallbackUrl,
        reason: isAbort ? 'Timed out loading playlist.' : 'Network error loading playlist.',
      };
    } finally {
      window.clearTimeout(timer);
    }
  }

  async getTrending(params: {
    categoryId?: string;
    regionCode?: string;
    maxResults?: number;
    pageToken?: string;
  } = {}): Promise<YouTubeSearchResponse> {
    const qs = new URLSearchParams({
      maxResults: String(params.maxResults || 10),
      regionCode: params.regionCode || 'IN',
    });
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.pageToken) qs.set('pageToken', params.pageToken);

    try {
      const res = await fetch(resolveApiUrl(`/api/youtube/trending?${qs.toString()}`), {
        method: 'GET',
        headers: buildJsonHeaders(),
      });
      const data = (await res.json().catch(() => null)) as Partial<YouTubeSearchResponse> | null;
      return {
        ok: Boolean(data?.ok),
        configured: Boolean(data?.configured),
        cached: Boolean(data?.cached),
        staleCacheUsed: Boolean(data?.staleCacheUsed),
        code: data?.code,
        query: 'Trending',
        mode: 'video',
        items: Array.isArray(data?.items) ? data!.items! : [],
        nextPageToken: data?.nextPageToken || null,
        prevPageToken: data?.prevPageToken || null,
        totalResults: data?.totalResults,
        fallbackUrl: data?.fallbackUrl || 'https://www.youtube.com/feed/trending',
        reason: data?.reason,
      };
    } catch {
      return {
        ok: false,
        configured: true,
        query: 'Trending',
        mode: 'video',
        items: [],
        fallbackUrl: 'https://www.youtube.com/feed/trending',
        reason: 'Unable to reach trending video service.',
      };
    }
  }

  async getRelatedVideos(videoId: string, maxResults = 8): Promise<YouTubeSearchResponse> {
    const cleanId = String(videoId || '').trim();
    if (!cleanId) {
      return {
        ok: false,
        configured: false,
        query: '',
        mode: 'video',
        items: [],
        fallbackUrl: 'https://www.youtube.com',
      };
    }
    try {
      const res = await fetch(
        resolveApiUrl(`/api/youtube/related/${encodeURIComponent(cleanId)}?maxResults=${maxResults}`),
        {
          method: 'GET',
          headers: buildJsonHeaders(),
        }
      );
      const data = (await res.json().catch(() => null)) as Partial<YouTubeSearchResponse> | null;
      return {
        ok: Boolean(data?.ok),
        configured: Boolean(data?.configured),
        cached: Boolean(data?.cached),
        staleCacheUsed: Boolean(data?.staleCacheUsed),
        code: data?.code,
        query: `Related to ${cleanId}`,
        mode: 'video',
        items: Array.isArray(data?.items) ? data!.items! : [],
        totalResults: data?.totalResults,
        fallbackUrl: data?.fallbackUrl || `https://www.youtube.com/watch?v=${cleanId}`,
        reason: data?.reason,
      };
    } catch {
      return {
        ok: false,
        configured: true,
        query: `Related to ${cleanId}`,
        mode: 'video',
        items: [],
        fallbackUrl: `https://www.youtube.com/watch?v=${cleanId}`,
        reason: 'Unable to load related recommendations.',
      };
    }
  }
}

export class VideoSearchService {
  constructor(private youtube: YouTubeSearchService) {}

  async searchVideos(
    query: string,
    maxResults = 8,
    mode: 'video' | 'education' = 'video',
    pageToken = ''
  ): Promise<YouTubeSearchResponse> {
    return this.youtube.search({ query, mode, maxResults, pageToken });
  }
}

export class MusicSearchService {
  constructor(private youtube: YouTubeSearchService) {}

  buildMusicSearchQuery(params: {
    query: string;
    songName?: string;
    artistName?: string;
    isPlaylist?: boolean;
  }): string {
    const base = String(params.query || '').trim();
    if (!base) return 'relaxing instrumental music';
    if (params.isPlaylist) {
      return /\b(playlist|jukebox|mix)\b/i.test(base) ? base : `${base} playlist`;
    }
    if (params.artistName && !params.songName) {
      return /\b(songs?|jukebox|hits|music|gaane|gaana)\b/i.test(base)
        ? base
        : `${params.artistName} songs`;
    }
    return base;
  }

  async searchMusic(params: {
    query: string;
    songName?: string;
    artistName?: string;
    isPlaylist?: boolean;
    maxResults?: number;
    pageToken?: string;
  }): Promise<YouTubeSearchResponse> {
    const searchQuery = this.buildMusicSearchQuery(params);
    return this.youtube.search({
      query: searchQuery,
      mode: 'music',
      maxResults: params.maxResults || 8,
      pageToken: params.pageToken,
    });
  }
}

export async function requestStructuredAiActionFromBackend(params: {
  message: string;
  mode: 'resolve_website' | 'media_fallback';
  mediaContext?: {
    currentTitle?: string | null;
    currentArtist?: string | null;
    status?: string;
    queueLength?: number;
    lastOpenedWebsite?: string | null;
  };
}): Promise<AiStructuredAction | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(resolveApiUrl('/api/chat'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      structuredAction?: unknown;
    } | null;
    if (!data?.ok || !data.structuredAction) return null;
    return validateClientAiAction(data.structuredAction);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function createInitialSmartMediaMemory(defaultVolume = 80): SmartMediaMemory {
  return {
    currentTrack: null,
    previousTrack: null,
    queue: [],
    lastSearchQuery: '',
    searchHistory: [],
    favorites: [],
    playlists: [],
    recentlyPlayed: [],
    lastOpenedWebsite: null,
    recentCommands: [],
    preferredVolume: defaultVolume,
    updatedAt: Date.now(),
  };
}

export class SmartMediaMemoryService {
  load(defaultVolume = 80): SmartMediaMemory {
    if (typeof window === 'undefined') return createInitialSmartMediaMemory(defaultVolume);
    try {
      const raw = window.localStorage.getItem(MEDIA_MEMORY_STORAGE_KEY);
      if (!raw) return createInitialSmartMediaMemory(defaultVolume);
      const parsed = JSON.parse(raw) as Partial<SmartMediaMemory>;
      return {
        ...createInitialSmartMediaMemory(defaultVolume),
        ...parsed,
        queue: Array.isArray(parsed.queue) ? parsed.queue.slice(0, 15) : [],
        searchHistory: Array.isArray(parsed.searchHistory) ? parsed.searchHistory.slice(0, 12) : [],
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites.slice(0, 60) : [],
        playlists: Array.isArray(parsed.playlists) ? parsed.playlists.slice(0, 20) : [],
        recentlyPlayed: Array.isArray(parsed.recentlyPlayed) ? parsed.recentlyPlayed.slice(0, 40) : [],
        recentCommands: Array.isArray(parsed.recentCommands)
          ? parsed.recentCommands.slice(0, 15)
          : [],
      };
    } catch {
      return createInitialSmartMediaMemory(defaultVolume);
    }
  }

  save(memory: SmartMediaMemory): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        MEDIA_MEMORY_STORAGE_KEY,
        JSON.stringify({
          ...memory,
          queue: memory.queue.slice(0, 15),
          searchHistory: (memory.searchHistory || []).slice(0, 12),
          favorites: (memory.favorites || []).slice(0, 60),
          playlists: (memory.playlists || []).slice(0, 20),
          recentlyPlayed: (memory.recentlyPlayed || []).slice(0, 40),
          recentCommands: memory.recentCommands.slice(0, 15),
          updatedAt: Date.now(),
        })
      );
    } catch {
      // Ignore storage quota issues
    }
  }

  recordCommand(
    memory: SmartMediaMemory,
    command: string,
    intent: UniversalCommandIntent
  ): SmartMediaMemory {
    const next: SmartMediaMemory = {
      ...memory,
      recentCommands: [
        { command: command.slice(0, 140), intent, timestamp: Date.now() },
        ...memory.recentCommands,
      ].slice(0, 15),
      updatedAt: Date.now(),
    };
    this.save(next);
    return next;
  }

  recordSearchHistory(
    memory: SmartMediaMemory,
    query: string,
    mode: YouTubeSearchMode
  ): SmartMediaMemory {
    const clean = query.trim();
    if (!clean) return memory;
    const deduped = (memory.searchHistory || []).filter(
      (entry) => !(entry.query.toLowerCase() === clean.toLowerCase() && entry.mode === mode)
    );
    const next: SmartMediaMemory = {
      ...memory,
      lastSearchQuery: clean,
      searchHistory: [{ query: clean, mode, timestamp: Date.now() }, ...deduped].slice(0, 12),
      updatedAt: Date.now(),
    };
    this.save(next);
    return next;
  }

  clearSearchHistory(memory: SmartMediaMemory): SmartMediaMemory {
    const next: SmartMediaMemory = {
      ...memory,
      searchHistory: [],
      updatedAt: Date.now(),
    };
    this.save(next);
    return next;
  }

  recordRecentlyPlayed(memory: SmartMediaMemory, item: YouTubeMediaItem): SmartMediaMemory {
    if (!item?.videoId) return memory;
    const filtered = (memory.recentlyPlayed || []).filter((r) => r.item.videoId !== item.videoId);
    const next: SmartMediaMemory = {
      ...memory,
      recentlyPlayed: [{ item, playedAt: Date.now() }, ...filtered].slice(0, 40),
      updatedAt: Date.now(),
    };
    this.save(next);
    return next;
  }

  toggleFavorite(memory: SmartMediaMemory, item: YouTubeMediaItem): { nextMemory: SmartMediaMemory; isFav: boolean } {
    if (!item?.videoId) return { nextMemory: memory, isFav: false };
    const exists = (memory.favorites || []).some((f) => f.videoId === item.videoId);
    const updated = exists
      ? (memory.favorites || []).filter((f) => f.videoId !== item.videoId)
      : [item, ...(memory.favorites || [])].slice(0, 60);
    const nextMemory: SmartMediaMemory = {
      ...memory,
      favorites: updated,
      updatedAt: Date.now(),
    };
    this.save(nextMemory);
    return { nextMemory, isFav: !exists };
  }

  isFavorite(memory: SmartMediaMemory, videoId: string): boolean {
    return Boolean(videoId && (memory.favorites || []).some((f) => f.videoId === videoId));
  }

  createPlaylist(memory: SmartMediaMemory, name: string): SmartMediaMemory {
    const clean = name.trim();
    if (!clean) return memory;
    const newPl: CustomPlaylist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: clean,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [],
    };
    const next: SmartMediaMemory = {
      ...memory,
      playlists: [newPl, ...(memory.playlists || [])].slice(0, 20),
      updatedAt: Date.now(),
    };
    this.save(next);
    return next;
  }

  deletePlaylist(memory: SmartMediaMemory, playlistId: string): SmartMediaMemory {
    const next: SmartMediaMemory = {
      ...memory,
      playlists: (memory.playlists || []).filter((p) => p.id !== playlistId),
      updatedAt: Date.now(),
    };
    this.save(next);
    return next;
  }

  addToPlaylist(memory: SmartMediaMemory, playlistId: string, item: YouTubeMediaItem): SmartMediaMemory {
    if (!item?.videoId) return memory;
    const next: SmartMediaMemory = {
      ...memory,
      playlists: (memory.playlists || []).map((p) => {
        if (p.id !== playlistId) return p;
        if (p.items.some((it) => it.videoId === item.videoId)) return p;
        return {
          ...p,
          items: [...p.items, item],
          updatedAt: Date.now(),
        };
      }),
      updatedAt: Date.now(),
    };
    this.save(next);
    return next;
  }

  removeFromPlaylist(memory: SmartMediaMemory, playlistId: string, videoId: string): SmartMediaMemory {
    const next: SmartMediaMemory = {
      ...memory,
      playlists: (memory.playlists || []).map((p) => {
        if (p.id !== playlistId) return p;
        return {
          ...p,
          items: p.items.filter((it) => it.videoId !== videoId),
          updatedAt: Date.now(),
        };
      }),
      updatedAt: Date.now(),
    };
    this.save(next);
    return next;
  }

  clearRecentlyPlayed(memory: SmartMediaMemory): SmartMediaMemory {
    const next: SmartMediaMemory = {
      ...memory,
      recentlyPlayed: [],
      updatedAt: Date.now(),
    };
    this.save(next);
    return next;
  }

  formatContextBlockForAi(
    memory: SmartMediaMemory,
    playbackStatus: string,
    liveState?: MediaPlayerState | null
  ): string {
    const activeTrack = liveState?.currentTrack ?? memory.currentTrack;
    const prevTrack = liveState?.previousTrack ?? memory.previousTrack;
    const activeQueue = liveState && liveState.queue.length > 0 ? liveState.queue : memory.queue;
    const effectiveStatus = liveState?.status ?? playbackStatus;

    const parts: string[] = [];
    if (activeTrack) {
      parts.push(
        `Currently ${effectiveStatus === 'playing' ? 'playing' : effectiveStatus}: "${activeTrack.title}" by/channel "${activeTrack.channelTitle}" (${activeTrack.mediaType}).`
      );
    }
    if (prevTrack) {
      parts.push(`Previous track: "${prevTrack.title}" (${prevTrack.channelTitle}).`);
    }
    if (activeQueue.length > 0) {
      parts.push(
        `Active playback queue (${activeQueue.length} items): ${activeQueue
          .slice(0, 5)
          .map((q, i) => `${i + 1}. ${q.title} (${q.channelTitle})`)
          .join('; ')}.`
      );
    }
    if (memory.lastOpenedWebsite) {
      parts.push(`Last opened website: ${memory.lastOpenedWebsite.label} (${memory.lastOpenedWebsite.url}).`);
    }
    if (memory.lastSearchQuery) {
      parts.push(`Last media/web search: "${memory.lastSearchQuery}".`);
    }
    if (!parts.length) return '';
    return `ACTIVE MEDIA & WEB SESSION CONTEXT:\n${parts.join('\n')}`;
  }
}

export function detectAmbiguousVideoMatches(
  query: string,
  items: YouTubeMediaItem[],
  mode: 'music' | 'video' | 'education'
): boolean {
  if (mode === 'music' || items.length < 2) return false;
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['video', 'videos', 'latest', 'play'].includes(w));
  if (tokens.length === 0) return true;
  return false;
}

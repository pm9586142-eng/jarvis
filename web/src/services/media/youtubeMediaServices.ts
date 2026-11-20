import {
  AiStructuredAction,
  SmartMediaMemory,
  UniversalCommandIntent,
  YouTubeMediaItem,
  YouTubeSearchResponse,
} from '../../types/media';
import { buildJsonHeaders, resolveApiUrl } from '../api';
import { validateClientAiAction } from './universalCommandRouter.js';

const MEDIA_MEMORY_STORAGE_KEY = 'jarvis_web_smart_media_memory_v1';
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

export function buildClientYouTubeFallbackUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    String(query || '').trim() || 'music'
  )}`;
}

export class YouTubeSearchService {
  private cache = new Map<string, { response: YouTubeSearchResponse; ts: number }>();

  async search(params: {
    query: string;
    mode: 'video' | 'music';
    maxResults?: number;
  }): Promise<YouTubeSearchResponse> {
    const cleanQuery = String(params.query || '').trim();
    const mode = params.mode === 'music' ? 'music' : 'video';
    const maxResults = Math.min(5, Math.max(1, params.maxResults || 5));
    const fallbackUrl = buildClientYouTubeFallbackUrl(cleanQuery);

    if (!cleanQuery) {
      return {
        ok: false,
        configured: false,
        code: 'INVALID_QUERY',
        query: '',
        mode,
        items: [],
        fallbackUrl,
        reason: 'Search query cannot be empty.',
      };
    }

    const cacheKey = `${mode}::${maxResults}::${cleanQuery.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CLIENT_CACHE_TTL_MS) {
      return { ...cached.response, cached: true };
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(resolveApiUrl('/api/youtube/search'), {
        method: 'POST',
        headers: buildJsonHeaders(),
        body: JSON.stringify({ query: cleanQuery, mode, maxResults }),
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
        fallbackUrl,
        reason: isAbort
          ? 'YouTube search timed out. You can retry or open YouTube search directly.'
          : 'Network error while searching YouTube. Please check your connection or use the YouTube fallback link.',
      };
    } finally {
      window.clearTimeout(timer);
    }
  }
}

export class VideoSearchService {
  constructor(private youtube: YouTubeSearchService) {}

  async searchVideos(query: string, maxResults = 5): Promise<YouTubeSearchResponse> {
    return this.youtube.search({ query, mode: 'video', maxResults });
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
      return /\b(playlist|jukebox|mix)\b/i.test(base) ? base : `${base} jukebox playlist`;
    }
    if (params.artistName && !params.songName) {
      return /\b(songs?|jukebox|hits|music)\b/i.test(base) ? base : `${params.artistName} best songs`;
    }
    if (/\b(music|song|songs|lofi|lo-fi|instrumental|classical|relaxing|audio|lyrical)\b/i.test(base)) {
      return base;
    }
    return `${base} song audio`;
  }

  async searchMusic(params: {
    query: string;
    songName?: string;
    artistName?: string;
    isPlaylist?: boolean;
    maxResults?: number;
  }): Promise<YouTubeSearchResponse> {
    const searchQuery = this.buildMusicSearchQuery(params);
    return this.youtube.search({
      query: searchQuery,
      mode: 'music',
      maxResults: params.maxResults || 5,
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
        queue: Array.isArray(parsed.queue) ? parsed.queue.slice(0, 10) : [],
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
          queue: memory.queue.slice(0, 10),
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

  formatContextBlockForAi(memory: SmartMediaMemory, playbackStatus: string): string {
    const parts: string[] = [];
    if (memory.currentTrack) {
      parts.push(
        `Currently ${playbackStatus === 'playing' ? 'playing' : playbackStatus}: "${memory.currentTrack.title}" by/channel "${memory.currentTrack.channelTitle}" (${memory.currentTrack.mediaType}).`
      );
    }
    if (memory.previousTrack) {
      parts.push(`Previous track: "${memory.previousTrack.title}" (${memory.previousTrack.channelTitle}).`);
    }
    if (memory.queue.length > 0) {
      parts.push(
        `Active playback queue (${memory.queue.length} items): ${memory.queue
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
  mode: 'music' | 'video'
): boolean {
  // User preference confirmed: auto-play top match and load 5 tracks into queue.
  // Only pause for explicit selection if query is extremely vague (1 short generic word in video mode)
  // and top 2 titles have near-zero overlap with query terms.
  if (mode === 'music' || items.length < 2) return false;
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['video', 'videos', 'latest', 'play'].includes(w));
  if (tokens.length === 0) return true;
  return false;
}

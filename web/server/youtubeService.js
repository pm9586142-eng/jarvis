/**
 * Server-Side YouTube Data API v3 Search Service
 * Keeps YOUTUBE_API_KEY strictly server-side with TTL caching,
 * timeout enforcement, duration enrichment, quota recovery, and safe fallbacks.
 */

const YOUTUBE_SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes fresh cache
const DEFAULT_STALE_TTL_MS = 60 * 60 * 1000; // 60 minutes stale cache on quota exhaustion
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 120;

export function buildYouTubeFallbackUrl(query) {
  const clean = String(query || '').trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(clean || 'music')}`;
}

/**
 * Parses ISO-8601 YouTube video duration (e.g. "PT4M28S", "PT1H02M05S") into
 * human-readable clock format ("4:28", "1:02:05") and seconds.
 */
export function parseIso8601Duration(iso) {
  const raw = String(iso || '').trim();
  const match = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) {
    return { durationText: '', durationSeconds: null };
  }
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  if (totalSeconds <= 0) {
    return { durationText: '', durationSeconds: null };
  }
  const pad = (n) => String(n).padStart(2, '0');
  const durationText =
    hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
  return { durationText, durationSeconds: totalSeconds };
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function isYouTubeKeyConfigured(rawKey) {
  const key = String(rawKey ?? process.env.YOUTUBE_API_KEY ?? '').trim();
  return Boolean(
    key &&
      key !== 'UNSET' &&
      key !== 'your_youtube_api_key_here' &&
      key.length >= 10
  );
}

export function normalizeYouTubeItems(searchItems = [], durationMap = new Map(), mode = 'video') {
  const seen = new Set();
  const normalized = [];

  for (const item of searchItems) {
    const videoId = String(item?.id?.videoId || '').trim();
    if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId) || seen.has(videoId)) {
      continue;
    }
    seen.add(videoId);

    const snippet = item?.snippet || {};
    const title = decodeHtmlEntities(snippet.title || 'Untitled Video');
    const channelTitle = decodeHtmlEntities(snippet.channelTitle || 'YouTube Channel');
    const thumbs = snippet.thumbnails || {};
    const thumbnailUrl =
      thumbs.high?.url ||
      thumbs.medium?.url ||
      thumbs.default?.url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const dur = durationMap.get(videoId) || { durationText: '', durationSeconds: null };

    normalized.push({
      videoId,
      title,
      channelTitle,
      description: decodeHtmlEntities(snippet.description || '').slice(0, 220),
      thumbnailUrl,
      publishedAt: snippet.publishedAt || null,
      durationText: dur.durationText || undefined,
      durationSeconds: dur.durationSeconds,
      watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      mediaType: mode === 'music' ? 'song' : 'video',
    });
  }

  return normalized;
}

async function fetchJsonWithTimeout(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const rawText = await res.text().catch(() => '');
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, rawText };
  } finally {
    clearTimeout(timer);
  }
}

function classifyYouTubeError(status, data) {
  const reason =
    data?.error?.errors?.[0]?.reason ||
    data?.error?.status ||
    '';
  const rawMessage = String(data?.error?.message || '');

  if (
    status === 403 &&
    /quota|rateLimitExceeded|dailyLimitExceeded|userRateLimitExceeded/i.test(
      `${reason} ${rawMessage}`
    )
  ) {
    return {
      code: 'YOUTUBE_QUOTA_EXCEEDED',
      message: 'YouTube Data API daily quota is currently exhausted. Using fallback search link.',
      quotaExceeded: true,
    };
  }
  if (status === 400 || status === 403) {
    return {
      code: 'YOUTUBE_API_REJECTED',
      message: 'YouTube Data API request was rejected. Verify server YOUTUBE_API_KEY configuration and API enablement.',
      quotaExceeded: false,
    };
  }
  return {
    code: 'YOUTUBE_API_ERROR',
    message: `YouTube search service returned HTTP ${status || 'error'}.`,
    quotaExceeded: false,
  };
}

export function createYouTubeSearchService(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const cacheTtlMs = Number(options.cacheTtlMs) || DEFAULT_CACHE_TTL_MS;
  const staleTtlMs = Number(options.staleTtlMs) || DEFAULT_STALE_TTL_MS;
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const getApiKey = () =>
    typeof options.apiKey === 'string'
      ? options.apiKey.trim()
      : String(process.env.YOUTUBE_API_KEY || '').trim();

  const cache = new Map();

  function setCache(key, items) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(key, { items, cachedAt: Date.now() });
  }

  async function enrichDurations(apiKey, videoIds) {
    const map = new Map();
    if (!videoIds.length) return map;
    try {
      const params = new URLSearchParams({
        part: 'contentDetails',
        id: videoIds.join(','),
        key: apiKey,
      });
      const res = await fetchJsonWithTimeout(
        fetchImpl,
        `${YOUTUBE_VIDEOS_ENDPOINT}?${params.toString()}`,
        Math.min(timeoutMs, 6000)
      );
      if (res.ok && Array.isArray(res.data?.items)) {
        for (const item of res.data.items) {
          const vid = String(item?.id || '').trim();
          const iso = item?.contentDetails?.duration;
          if (vid && iso) {
            map.set(vid, parseIso8601Duration(iso));
          }
        }
      }
    } catch {
      // Duration enrichment is optional — fail gracefully without breaking search
    }
    return map;
  }

  async function runSearchRequest(apiKey, query, maxResults, useMusicCategory) {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      maxResults: String(maxResults),
      q: query,
      safeSearch: 'moderate',
      key: apiKey,
    });
    if (useMusicCategory) {
      params.set('videoCategoryId', '10');
    }
    return fetchJsonWithTimeout(
      fetchImpl,
      `${YOUTUBE_SEARCH_ENDPOINT}?${params.toString()}`,
      timeoutMs
    );
  }

  async function search({ query, mode = 'video', maxResults = 5 } = {}) {
    const cleanQuery = String(query || '').trim().slice(0, 180);
    const normalizedMode = mode === 'music' ? 'music' : 'video';
    const clampedMax = Math.min(5, Math.max(1, Number(maxResults) || 5));
    const fallbackUrl = buildYouTubeFallbackUrl(cleanQuery);

    if (!cleanQuery) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_QUERY',
        configured: isYouTubeKeyConfigured(getApiKey()),
        query: '',
        mode: normalizedMode,
        items: [],
        fallbackUrl,
        reason: 'Please provide a search query for YouTube.',
      };
    }

    const cacheKey = `${normalizedMode}::${clampedMax}::${cleanQuery.toLowerCase()}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && now - cachedEntry.cachedAt < cacheTtlMs) {
      return {
        ok: true,
        status: 200,
        configured: true,
        cached: true,
        staleCacheUsed: false,
        query: cleanQuery,
        mode: normalizedMode,
        items: cachedEntry.items,
        fallbackUrl,
      };
    }

    const apiKey = getApiKey();
    if (!isYouTubeKeyConfigured(apiKey)) {
      return {
        ok: false,
        status: 200,
        code: 'YOUTUBE_KEY_MISSING',
        configured: false,
        cached: false,
        staleCacheUsed: false,
        query: cleanQuery,
        mode: normalizedMode,
        items: [],
        fallbackUrl,
        reason:
          'YouTube Data API (YOUTUBE_API_KEY) is not configured on the server. Opening YouTube search fallback instead.',
      };
    }

    try {
      const preferMusicCategory = normalizedMode === 'music';
      let response = await runSearchRequest(apiKey, cleanQuery, clampedMax, preferMusicCategory);

      // Handle unavailable music category results gracefully by retrying without videoCategoryId=10
      if (
        preferMusicCategory &&
        response.ok &&
        (!Array.isArray(response.data?.items) || response.data.items.length === 0)
      ) {
        response = await runSearchRequest(apiKey, cleanQuery, clampedMax, false);
      }

      if (!response.ok) {
        const errInfo = classifyYouTubeError(response.status, response.data);
        if (errInfo.quotaExceeded && cachedEntry && now - cachedEntry.cachedAt < staleTtlMs) {
          return {
            ok: true,
            status: 200,
            configured: true,
            cached: true,
            staleCacheUsed: true,
            code: errInfo.code,
            query: cleanQuery,
            mode: normalizedMode,
            items: cachedEntry.items,
            fallbackUrl,
            reason: 'YouTube API quota is exhausted; serving cached results.',
          };
        }
        return {
          ok: false,
          status: 200,
          configured: true,
          cached: false,
          staleCacheUsed: false,
          code: errInfo.code,
          query: cleanQuery,
          mode: normalizedMode,
          items: [],
          fallbackUrl,
          reason: errInfo.message,
        };
      }

      const rawItems = Array.isArray(response.data?.items) ? response.data.items : [];
      const videoIds = rawItems
        .map((item) => String(item?.id?.videoId || '').trim())
        .filter((id) => /^[a-zA-Z0-9_-]{6,20}$/.test(id));

      const durationMap = await enrichDurations(apiKey, videoIds);
      const items = normalizeYouTubeItems(rawItems, durationMap, normalizedMode);

      if (items.length > 0) {
        setCache(cacheKey, items);
      }

      return {
        ok: true,
        status: 200,
        configured: true,
        cached: false,
        staleCacheUsed: false,
        query: cleanQuery,
        mode: normalizedMode,
        items,
        fallbackUrl,
        reason: items.length === 0 ? 'No embeddable YouTube videos were found for this query.' : undefined,
      };
    } catch (err) {
      const isTimeout = err?.name === 'AbortError';
      if (cachedEntry && now - cachedEntry.cachedAt < staleTtlMs) {
        return {
          ok: true,
          status: 200,
          configured: true,
          cached: true,
          staleCacheUsed: true,
          code: isTimeout ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_NETWORK_ERROR',
          query: cleanQuery,
          mode: normalizedMode,
          items: cachedEntry.items,
          fallbackUrl,
          reason: 'Network issue contacting YouTube; serving cached results.',
        };
      }
      return {
        ok: false,
        status: 200,
        configured: true,
        cached: false,
        staleCacheUsed: false,
        code: isTimeout ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_NETWORK_ERROR',
        query: cleanQuery,
        mode: normalizedMode,
        items: [],
        fallbackUrl,
        reason: isTimeout
          ? 'YouTube search request timed out. You can retry or open YouTube search directly.'
          : 'Unable to reach YouTube search service due to a network error.',
      };
    }
  }

  return {
    search,
    isConfigured: () => isYouTubeKeyConfigured(getApiKey()),
    clearCache: () => cache.clear(),
  };
}

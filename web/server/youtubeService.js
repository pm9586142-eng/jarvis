/**
 * Server-Side YouTube Data API v3 Service
 * Keeps YOUTUBE_API_KEY strictly server-side with TTL caching,
 * timeout enforcement, duration/statistics/status enrichment,
 * pagination, video detail lookup, playlist lookup, quota recovery,
 * and safe fallbacks.
 */

const YOUTUBE_SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
const YOUTUBE_PLAYLISTS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlists';
const YOUTUBE_PLAYLIST_ITEMS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlistItems';

const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour fresh cache
const DEFAULT_STALE_TTL_MS = 60 * 60 * 1000; // 60 minutes stale cache on quota exhaustion
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 160;

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const PLAYLIST_ID_REGEX = /^[a-zA-Z0-9_-]{10,64}$/;
const PAGE_TOKEN_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidYouTubeVideoId(videoId) {
  return VIDEO_ID_REGEX.test(String(videoId || '').trim());
}

export function isValidYouTubePlaylistId(playlistId) {
  return PLAYLIST_ID_REGEX.test(String(playlistId || '').trim());
}

export function sanitizePageToken(token) {
  const clean = String(token || '').trim();
  return clean && PAGE_TOKEN_REGEX.test(clean) ? clean : '';
}

export function buildYouTubeFallbackUrl(query) {
  const clean = String(query || '').trim();
  if (!clean) {
    return 'https://www.youtube.com';
  }
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`;
}

export function buildYouTubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(String(videoId || '').trim())}`;
}

export function buildYouTubePlaylistUrl(playlistId) {
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(String(playlistId || '').trim())}`;
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

function parseOptionalCount(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

export function isYouTubeKeyConfigured(rawKey) {
  const key = String(rawKey ?? process.env.YOUTUBE_API_KEY ?? '').trim();
  return Boolean(
    key &&
      key !== 'UNSET' &&
      key !== 'your_youtube_api_key' &&
      key !== 'your_youtube_api_key_here' &&
      key.length >= 10
  );
}

function pickThumbnailUrl(thumbs, videoId) {
  return (
    thumbs?.high?.url ||
    thumbs?.medium?.url ||
    thumbs?.standard?.url ||
    thumbs?.default?.url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
}

export function normalizeYouTubeItems(searchItems = [], detailMap = new Map(), mode = 'video') {
  const seen = new Set();
  const normalized = [];

  for (const item of searchItems) {
    const videoId = String(
      item?.id?.videoId ||
        item?.contentDetails?.videoId ||
        item?.snippet?.resourceId?.videoId ||
        (typeof item?.id === 'string' ? item.id : '')
    ).trim();

    if (!videoId || !VIDEO_ID_REGEX.test(videoId) || seen.has(videoId)) {
      continue;
    }
    seen.add(videoId);

    const snippet = item?.snippet || {};
    const title = decodeHtmlEntities(snippet.title || 'Untitled Video');
    // Skip deleted/private placeholder rows returned in playlists
    if (/^(?:deleted video|private video)$/i.test(title)) {
      continue;
    }
    const channelTitle = decodeHtmlEntities(
      snippet.videoOwnerChannelTitle || snippet.channelTitle || 'YouTube Channel'
    );
    const thumbnailUrl = pickThumbnailUrl(snippet.thumbnails, videoId);
    const details = detailMap.get(videoId) || {};

    normalized.push({
      videoId,
      title,
      channelTitle,
      description: decodeHtmlEntities(snippet.description || '').slice(0, 260),
      thumbnailUrl,
      publishedAt: snippet.publishedAt || null,
      durationText: details.durationText || undefined,
      durationSeconds: details.durationSeconds ?? null,
      viewCount: details.viewCount ?? null,
      likeCount: details.likeCount ?? null,
      embeddable: typeof details.embeddable === 'boolean' ? details.embeddable : true,
      watchUrl: buildYouTubeWatchUrl(videoId),
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`,
      mediaType: mode === 'music' ? 'song' : 'video',
    });
  }

  return normalized;
}

function normalizeSingleVideoResource(item) {
  const videoId = String(item?.id || '').trim();
  if (!isValidYouTubeVideoId(videoId)) return null;
  const snippet = item?.snippet || {};
  const dur = parseIso8601Duration(item?.contentDetails?.duration);
  const stats = item?.statistics || {};
  const status = item?.status || {};

  return {
    videoId,
    title: decodeHtmlEntities(snippet.title || 'Untitled Video'),
    channelTitle: decodeHtmlEntities(snippet.channelTitle || 'YouTube Channel'),
    channelId: snippet.channelId || null,
    description: decodeHtmlEntities(snippet.description || '').slice(0, 600),
    thumbnailUrl: pickThumbnailUrl(snippet.thumbnails, videoId),
    publishedAt: snippet.publishedAt || null,
    categoryId: snippet.categoryId || null,
    tags: Array.isArray(snippet.tags) ? snippet.tags.slice(0, 12) : [],
    durationText: dur.durationText || undefined,
    durationSeconds: dur.durationSeconds,
    viewCount: parseOptionalCount(stats.viewCount),
    likeCount: parseOptionalCount(stats.likeCount),
    commentCount: parseOptionalCount(stats.commentCount),
    embeddable: status.embeddable !== false,
    privacyStatus: status.privacyStatus || 'public',
    watchUrl: buildYouTubeWatchUrl(videoId),
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`,
    mediaType: snippet.categoryId === '10' ? 'song' : 'video',
  };
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
  const reason = data?.error?.errors?.[0]?.reason || data?.error?.status || '';
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
  if (status === 404 || /playlistNotFound|videoNotFound|notFound/i.test(reason)) {
    return {
      code: 'YOUTUBE_NOT_FOUND',
      message: 'The requested YouTube video or playlist could not be found or is private.',
      quotaExceeded: false,
    };
  }
  if (status === 400 || status === 403) {
    return {
      code: 'YOUTUBE_API_REJECTED',
      message:
        'YouTube Data API request was rejected. Verify server YOUTUBE_API_KEY configuration, API restrictions, and YouTube Data API v3 enablement.',
      quotaExceeded: false,
    };
  }
  return {
    code: 'YOUTUBE_API_ERROR',
    message: `YouTube Data API service returned HTTP ${status || 'error'}.`,
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

  function setCache(key, payload) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(key, { payload, cachedAt: Date.now() });
  }

  /**
   * Calls official YouTube Data API v3 videos.list to enrich durations,
   * public statistics (viewCount, likeCount), and embeddable status.
   */
  async function enrichVideoDetails(apiKey, videoIds) {
    const map = new Map();
    if (!videoIds.length) return map;
    try {
      const params = new URLSearchParams({
        part: 'contentDetails,statistics,status',
        id: videoIds.slice(0, 50).join(','),
        key: apiKey,
      });
      const res = await fetchJsonWithTimeout(
        fetchImpl,
        `${YOUTUBE_VIDEOS_ENDPOINT}?${params.toString()}`,
        Math.min(timeoutMs, 6500)
      );
      if (res.ok && Array.isArray(res.data?.items)) {
        for (const item of res.data.items) {
          const vid = String(item?.id || '').trim();
          if (!vid) continue;
          const dur = parseIso8601Duration(item?.contentDetails?.duration);
          const stats = item?.statistics || {};
          const status = item?.status || {};
          map.set(vid, {
            durationText: dur.durationText,
            durationSeconds: dur.durationSeconds,
            viewCount: parseOptionalCount(stats.viewCount),
            likeCount: parseOptionalCount(stats.likeCount),
            embeddable: status.embeddable !== false,
          });
        }
      }
    } catch {
      // Metadata enrichment is non-fatal — search still returns snippets cleanly
    }
    return map;
  }

  async function runSearchRequest(
    apiKey,
    { query, maxResults, categoryId, pageToken, regionCode, relevanceLanguage }
  ) {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      maxResults: String(maxResults),
      q: query,
      safeSearch: 'moderate',
      key: apiKey,
    });
    if (categoryId) {
      params.set('videoCategoryId', String(categoryId));
    }
    if (regionCode) {
      params.set('regionCode', String(regionCode));
    }
    if (relevanceLanguage) {
      params.set('relevanceLanguage', String(relevanceLanguage));
    }
    if (pageToken) {
      params.set('pageToken', pageToken);
    }
    return fetchJsonWithTimeout(
      fetchImpl,
      `${YOUTUBE_SEARCH_ENDPOINT}?${params.toString()}`,
      timeoutMs
    );
  }

  function logSearchDiag(details) {
    if (typeof options.onLog === 'function') {
      options.onLog(details);
      return;
    }
    if (process.env.NODE_ENV !== 'test') {
      console.info('[YouTubeService]', JSON.stringify(details));
    }
  }

  async function search({
    query,
    mode = 'video',
    maxResults = 5,
    pageToken = '',
    regionCode = '',
    relevanceLanguage = '',
  } = {}) {
    const startedAt = Date.now();
    const cleanQuery = String(query || '').trim().slice(0, 180);
    const normalizedMode =
      mode === 'music' ? 'music' : mode === 'education' ? 'education' : 'video';
    const clampedMax = Math.min(15, Math.max(1, Number(maxResults) || 5));
    const safePageToken = sanitizePageToken(pageToken);
    const hasDevanagari = /[\u0900-\u097F]/.test(cleanQuery);
    const safeRegionCode = /^[A-Z]{2}$/i.test(String(regionCode || '').trim())
      ? String(regionCode).trim().toUpperCase()
      : hasDevanagari
        ? 'IN'
        : '';
    const safeRelevanceLang = /^[a-z]{2}(?:-[A-Z]{2})?$/i.test(String(relevanceLanguage || '').trim())
      ? String(relevanceLanguage).trim()
      : hasDevanagari
        ? 'hi'
        : '';
    const fallbackUrl = buildYouTubeFallbackUrl(cleanQuery);

    if (!cleanQuery) {
      logSearchDiag({
        event: 'search',
        ok: false,
        code: 'INVALID_QUERY',
        query: '',
        mode: normalizedMode,
        durationMs: Date.now() - startedAt,
      });
      return {
        ok: false,
        status: 400,
        code: 'INVALID_QUERY',
        configured: isYouTubeKeyConfigured(getApiKey()),
        query: '',
        mode: normalizedMode,
        items: [],
        nextPageToken: null,
        prevPageToken: null,
        totalResults: 0,
        fallbackUrl,
        reason: 'Please provide a search query for YouTube.',
      };
    }

    const cacheKey = `search::${normalizedMode}::${clampedMax}::${safeRegionCode}::${safeRelevanceLang}::${safePageToken}::${cleanQuery.toLowerCase()}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && now - cachedEntry.cachedAt < cacheTtlMs) {
      logSearchDiag({
        event: 'search',
        ok: true,
        cached: true,
        query: cleanQuery,
        mode: normalizedMode,
        itemCount: cachedEntry.payload.items.length,
        durationMs: Date.now() - startedAt,
      });
      return {
        ok: true,
        status: 200,
        configured: true,
        cached: true,
        staleCacheUsed: false,
        query: cleanQuery,
        mode: normalizedMode,
        items: cachedEntry.payload.items,
        nextPageToken: cachedEntry.payload.nextPageToken,
        prevPageToken: cachedEntry.payload.prevPageToken,
        totalResults: cachedEntry.payload.totalResults,
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
        nextPageToken: null,
        prevPageToken: null,
        totalResults: 0,
        fallbackUrl,
        reason:
          'YouTube Data API (YOUTUBE_API_KEY) is not configured on the server. Opening YouTube search fallback instead.',
      };
    }

    try {
      const preferredCategoryId =
        normalizedMode === 'music' ? '10' : normalizedMode === 'education' ? '27' : '';

      let response = await runSearchRequest(apiKey, {
        query: cleanQuery,
        maxResults: clampedMax,
        categoryId: preferredCategoryId,
        pageToken: safePageToken,
        regionCode: safeRegionCode,
        relevanceLanguage: safeRelevanceLang,
      });

      // Handle unavailable category results gracefully by retrying without videoCategoryId
      if (
        preferredCategoryId &&
        response.ok &&
        (!Array.isArray(response.data?.items) || response.data.items.length === 0)
      ) {
        response = await runSearchRequest(apiKey, {
          query: cleanQuery,
          maxResults: clampedMax,
          categoryId: '',
          pageToken: safePageToken,
          regionCode: safeRegionCode,
          relevanceLanguage: safeRelevanceLang,
        });
      }

      if (!response.ok) {
        const errInfo = classifyYouTubeError(response.status, response.data);
        logSearchDiag({
          event: 'search',
          ok: false,
          code: errInfo.code,
          upstreamStatus: response.status,
          query: cleanQuery,
          mode: normalizedMode,
          categoryId: preferredCategoryId || 'none',
          durationMs: Date.now() - startedAt,
        });
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
            items: cachedEntry.payload.items,
            nextPageToken: cachedEntry.payload.nextPageToken,
            prevPageToken: cachedEntry.payload.prevPageToken,
            totalResults: cachedEntry.payload.totalResults,
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
          nextPageToken: null,
          prevPageToken: null,
          totalResults: 0,
          fallbackUrl,
          reason: errInfo.message,
        };
      }

      const rawItems = Array.isArray(response.data?.items) ? response.data.items : [];
      const videoIds = rawItems
        .map((item) => String(item?.id?.videoId || '').trim())
        .filter((id) => VIDEO_ID_REGEX.test(id));

      const detailMap = await enrichVideoDetails(apiKey, videoIds);
      const items = normalizeYouTubeItems(rawItems, detailMap, normalizedMode);
      const nextPageToken =
        typeof response.data?.nextPageToken === 'string' ? response.data.nextPageToken : null;
      const prevPageToken =
        typeof response.data?.prevPageToken === 'string' ? response.data.prevPageToken : null;
      const totalResults =
        parseOptionalCount(response.data?.pageInfo?.totalResults) ?? items.length;

      if (items.length > 0) {
        setCache(cacheKey, { items, nextPageToken, prevPageToken, totalResults });
      }

      logSearchDiag({
        event: 'search',
        ok: true,
        cached: false,
        upstreamStatus: response.status,
        query: cleanQuery,
        mode: normalizedMode,
        categoryId: preferredCategoryId || 'none',
        regionCode: safeRegionCode || 'none',
        relevanceLanguage: safeRelevanceLang || 'none',
        itemCount: items.length,
        durationMs: Date.now() - startedAt,
      });

      return {
        ok: true,
        status: 200,
        configured: true,
        cached: false,
        staleCacheUsed: false,
        query: cleanQuery,
        mode: normalizedMode,
        items,
        nextPageToken,
        prevPageToken,
        totalResults,
        fallbackUrl,
        reason: items.length === 0 ? 'No relevant videos found.' : undefined,
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
          items: cachedEntry.payload.items,
          nextPageToken: cachedEntry.payload.nextPageToken,
          prevPageToken: cachedEntry.payload.prevPageToken,
          totalResults: cachedEntry.payload.totalResults,
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
        nextPageToken: null,
        prevPageToken: null,
        totalResults: 0,
        fallbackUrl,
        reason: isTimeout
          ? 'YouTube search request timed out. You can retry or open YouTube search directly.'
          : 'Unable to reach YouTube search service due to a network error.',
      };
    }
  }

  /**
   * Official YouTube Data API v3 videos.list lookup for GET /api/youtube/video/:videoId
   */
  async function getVideoById(rawVideoId) {
    const videoId = String(rawVideoId || '').trim();
    if (!isValidYouTubeVideoId(videoId)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_VIDEO_ID',
        configured: isYouTubeKeyConfigured(getApiKey()),
        video: null,
        fallbackUrl: buildYouTubeFallbackUrl(''),
        reason: 'A valid 11-character YouTube videoId is required.',
      };
    }

    const fallbackUrl = buildYouTubeWatchUrl(videoId);
    const cacheKey = `video::${videoId}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();
    if (cachedEntry && now - cachedEntry.cachedAt < cacheTtlMs) {
      return {
        ok: true,
        status: 200,
        configured: true,
        cached: true,
        staleCacheUsed: false,
        video: cachedEntry.payload,
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
        video: null,
        fallbackUrl,
        reason: 'YouTube Data API (YOUTUBE_API_KEY) is not configured on the server.',
      };
    }

    try {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails,statistics,status',
        id: videoId,
        key: apiKey,
      });
      const response = await fetchJsonWithTimeout(
        fetchImpl,
        `${YOUTUBE_VIDEOS_ENDPOINT}?${params.toString()}`,
        timeoutMs
      );
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
            video: cachedEntry.payload,
            fallbackUrl,
            reason: 'YouTube API quota exhausted; serving cached video metadata.',
          };
        }
        return {
          ok: false,
          status: 200,
          configured: true,
          cached: false,
          code: errInfo.code,
          video: null,
          fallbackUrl,
          reason: errInfo.message,
        };
      }

      const rawVideo = Array.isArray(response.data?.items) ? response.data.items[0] : null;
      const video = rawVideo ? normalizeSingleVideoResource(rawVideo) : null;
      if (!video) {
        return {
          ok: false,
          status: 404,
          code: 'YOUTUBE_NOT_FOUND',
          configured: true,
          cached: false,
          video: null,
          fallbackUrl,
          reason: 'This YouTube video is unavailable, private, or removed.',
        };
      }

      setCache(cacheKey, video);
      return {
        ok: true,
        status: 200,
        configured: true,
        cached: false,
        staleCacheUsed: false,
        video,
        fallbackUrl,
      };
    } catch (err) {
      const isTimeout = err?.name === 'AbortError';
      return {
        ok: false,
        status: 200,
        configured: true,
        cached: false,
        code: isTimeout ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_NETWORK_ERROR',
        video: null,
        fallbackUrl,
        reason: isTimeout
          ? 'Timed out while loading YouTube video details.'
          : 'Network error while fetching YouTube video details.',
      };
    }
  }

  /**
   * Official YouTube Data API v3 playlists.list + playlistItems.list lookup
   * for GET /api/youtube/playlist/:playlistId
   */
  async function getPlaylistById({ playlistId: rawPlaylistId, maxResults = 10, pageToken = '' } = {}) {
    const playlistId = String(rawPlaylistId || '').trim();
    const clampedMax = Math.min(25, Math.max(1, Number(maxResults) || 10));
    const safePageToken = sanitizePageToken(pageToken);

    if (!isValidYouTubePlaylistId(playlistId)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_PLAYLIST_ID',
        configured: isYouTubeKeyConfigured(getApiKey()),
        playlist: null,
        items: [],
        nextPageToken: null,
        prevPageToken: null,
        fallbackUrl: buildYouTubeFallbackUrl('playlist'),
        reason: 'A valid YouTube playlistId (10–64 alphanumeric/dash/underscore characters) is required.',
      };
    }

    const fallbackUrl = buildYouTubePlaylistUrl(playlistId);
    const cacheKey = `playlist::${playlistId}::${clampedMax}::${safePageToken}`;
    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();
    if (cachedEntry && now - cachedEntry.cachedAt < cacheTtlMs) {
      return {
        ok: true,
        status: 200,
        configured: true,
        cached: true,
        staleCacheUsed: false,
        ...cachedEntry.payload,
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
        playlist: null,
        items: [],
        nextPageToken: null,
        prevPageToken: null,
        fallbackUrl,
        reason: 'YouTube Data API (YOUTUBE_API_KEY) is not configured on the server.',
      };
    }

    try {
      const itemsParams = new URLSearchParams({
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: String(clampedMax),
        key: apiKey,
      });
      if (safePageToken) itemsParams.set('pageToken', safePageToken);

      const metaParams = new URLSearchParams({
        part: 'snippet,contentDetails',
        id: playlistId,
        key: apiKey,
      });

      const [itemsRes, metaRes] = await Promise.all([
        fetchJsonWithTimeout(
          fetchImpl,
          `${YOUTUBE_PLAYLIST_ITEMS_ENDPOINT}?${itemsParams.toString()}`,
          timeoutMs
        ),
        fetchJsonWithTimeout(
          fetchImpl,
          `${YOUTUBE_PLAYLISTS_ENDPOINT}?${metaParams.toString()}`,
          Math.min(timeoutMs, 6500)
        ).catch(() => ({ ok: false, data: null })),
      ]);

      if (!itemsRes.ok) {
        const errInfo = classifyYouTubeError(itemsRes.status, itemsRes.data);
        return {
          ok: false,
          status: errInfo.code === 'YOUTUBE_NOT_FOUND' ? 404 : 200,
          configured: true,
          cached: false,
          code: errInfo.code,
          playlist: null,
          items: [],
          nextPageToken: null,
          prevPageToken: null,
          fallbackUrl,
          reason: errInfo.message,
        };
      }

      const rawItems = Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [];
      const videoIds = rawItems
        .map((it) => String(it?.contentDetails?.videoId || it?.snippet?.resourceId?.videoId || '').trim())
        .filter((id) => VIDEO_ID_REGEX.test(id));

      const detailMap = await enrichVideoDetails(apiKey, videoIds);
      const items = normalizeYouTubeItems(rawItems, detailMap, 'video');

      const rawPlaylistMeta = metaRes.ok && Array.isArray(metaRes.data?.items) ? metaRes.data.items[0] : null;
      const playlist = rawPlaylistMeta
        ? {
            playlistId,
            title: decodeHtmlEntities(rawPlaylistMeta.snippet?.title || 'YouTube Playlist'),
            channelTitle: decodeHtmlEntities(rawPlaylistMeta.snippet?.channelTitle || 'YouTube'),
            description: decodeHtmlEntities(rawPlaylistMeta.snippet?.description || '').slice(0, 300),
            thumbnailUrl: pickThumbnailUrl(rawPlaylistMeta.snippet?.thumbnails, items[0]?.videoId || ''),
            itemCount: parseOptionalCount(rawPlaylistMeta.contentDetails?.itemCount) ?? items.length,
            playlistUrl: fallbackUrl,
          }
        : {
            playlistId,
            title: 'YouTube Playlist',
            channelTitle: items[0]?.channelTitle || 'YouTube',
            description: '',
            thumbnailUrl: items[0]?.thumbnailUrl || '',
            itemCount: parseOptionalCount(itemsRes.data?.pageInfo?.totalResults) ?? items.length,
            playlistUrl: fallbackUrl,
          };

      const payload = {
        playlist,
        items,
        nextPageToken:
          typeof itemsRes.data?.nextPageToken === 'string' ? itemsRes.data.nextPageToken : null,
        prevPageToken:
          typeof itemsRes.data?.prevPageToken === 'string' ? itemsRes.data.prevPageToken : null,
        totalResults: parseOptionalCount(itemsRes.data?.pageInfo?.totalResults) ?? items.length,
      };

      if (items.length > 0) {
        setCache(cacheKey, payload);
      }

      return {
        ok: true,
        status: 200,
        configured: true,
        cached: false,
        staleCacheUsed: false,
        ...payload,
        fallbackUrl,
      };
    } catch (err) {
      const isTimeout = err?.name === 'AbortError';
      return {
        ok: false,
        status: 200,
        configured: true,
        cached: false,
        code: isTimeout ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_NETWORK_ERROR',
        playlist: null,
        items: [],
        nextPageToken: null,
        prevPageToken: null,
        fallbackUrl,
        reason: isTimeout
          ? 'Timed out while loading YouTube playlist.'
          : 'Network error while fetching YouTube playlist.',
      };
    }
  }

  return {
    search,
    getVideoById,
    getPlaylistById,
    isConfigured: () => isYouTubeKeyConfigured(getApiKey()),
    clearCache: () => cache.clear(),
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/index.js';
import { buildYouTubeFallbackUrl } from '../server/youtubeService.js';
import {
  detectWakeWordTrigger,
  UniversalCommandRouter,
  VOICE_COMMAND_REGISTRY,
} from '../src/services/media/universalCommandRouter.js';
import { parseCanonicalOfflineCommand } from '../src/services/offline/canonicalCommandEngine.js';

function startEphemeralServer(appInstance) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${addr.port}`,
      });
    });
    server.on('error', reject);
  });
}

test('YouTube search strictly uses exact user query without music category pollution or music fallback', async () => {
  const seenUrls = [];

  const mockResponse = (ok, status, payload) => ({
    ok,
    status,
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  });

  const mockFetch = async (urlStr) => {
    const s = String(urlStr);
    seenUrls.push(s);

    if (s.includes('/youtube/v3/search')) {
      const parsedUrl = new URL(s);
      const q = parsedUrl.searchParams.get('q') || '';
      if (q === 'nonexistent_obscure_query_999') {
        return mockResponse(true, 200, { items: [] });
      }
      return mockResponse(true, 200, {
        pageInfo: { totalResults: 10 },
        items: [
          {
            id: { videoId: 'dQw4w9WgXcQ' },
            snippet: {
              title: `${q} - Official Video`,
              channelTitle: 'Verified Channel',
              publishedAt: '2025-01-10T00:00:00Z',
              thumbnails: { high: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' } },
            },
          },
        ],
      });
    }

    if (s.includes('/youtube/v3/videos')) {
      return mockResponse(true, 200, {
        items: [
          {
            id: 'dQw4w9WgXcQ',
            contentDetails: { duration: 'PT12M10S' },
            statistics: { viewCount: '15000', likeCount: '800' },
            status: { embeddable: true },
          },
        ],
      });
    }

    return mockResponse(false, 404, {});
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    youtubeApiKey: 'AIzaSy_TEST_KEY_STRICT_QUERY',
    youtubeFetch: mockFetch,
  });
  const { server, baseUrl } = await startEphemeralServer(app);

  try {
    const nonMusicQueries = [
      'Python programming tutorial',
      'Cricket highlights',
      'Shah Rukh Khan movies',
      'News today',
      'How to learn computer',
      'Google Gemini tutorial',
      'Space exploration documentary',
    ];

    for (const q of nonMusicQueries) {
      const beforeIdx = seenUrls.length;
      const res = await fetch(
        `${baseUrl}/api/youtube/search?q=${encodeURIComponent(q)}&mode=video&maxResults=8`
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.equal(json.query, q);
      assert.equal(json.items[0].title, `${q} - Official Video`);

      const searchCallUrl = new URL(seenUrls[beforeIdx]);
      assert.equal(searchCallUrl.searchParams.get('q'), q);
      assert.equal(searchCallUrl.searchParams.get('type'), 'video');
      assert.equal(searchCallUrl.searchParams.get('part'), 'snippet');
      assert.equal(
        searchCallUrl.searchParams.get('videoCategoryId'),
        null,
        `Non-music query "${q}" must NOT force videoCategoryId=10`
      );
    }

    // Hindi Devanagari query auto-attaches regionCode=IN & relevanceLanguage=hi
    const beforeHiIdx = seenUrls.length;
    const hiRes = await fetch(
      `${baseUrl}/api/youtube/search?q=${encodeURIComponent('पायथन ट्यूटोरियल')}&mode=video`
    );
    assert.equal(hiRes.status, 200);
    const hiSearchUrl = new URL(seenUrls[beforeHiIdx]);
    assert.equal(hiSearchUrl.searchParams.get('regionCode'), 'IN');
    assert.equal(hiSearchUrl.searchParams.get('relevanceLanguage'), 'hi');

    // Empty result set returns helpful message and zero random song fallback
    const emptyRes = await fetch(
      `${baseUrl}/api/youtube/search?q=nonexistent_obscure_query_999&mode=video`
    );
    assert.equal(emptyRes.status, 200);
    const emptyJson = await emptyRes.json();
    assert.equal(emptyJson.ok, true);
    assert.equal(emptyJson.items.length, 0);
    assert.equal(emptyJson.reason, 'No relevant videos found.');

    // Fallback URL builder never defaults empty queries to "music"
    assert.equal(buildYouTubeFallbackUrl(''), 'https://www.youtube.com');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Voice command pipeline routes non-music media, Hinglish, internal screens, websites, and conversational fallback', () => {
  const router = new UniversalCommandRouter();
  assert.ok(Array.isArray(VOICE_COMMAND_REGISTRY) && VOICE_COMMAND_REGISTRY.length > 0);

  // Wake-word stripping for both "Hey AM" and "Hey JARVIS"
  const wakeAm = detectWakeWordTrigger('Hey AM, search Python programming tutorial');
  assert.equal(wakeAm.triggered, true);
  assert.equal(wakeAm.remainder, 'search Python programming tutorial');

  const wakeJarvis = detectWakeWordTrigger('Hey JARVIS, play Cricket highlights');
  assert.equal(wakeJarvis.triggered, true);
  assert.equal(wakeJarvis.remainder, 'play Cricket highlights');

  // Strict non-music YouTube queries must route to SEARCH_YOUTUBE or PLAY_VIDEO (never PLAY_SONG)
  const searchPy = router.route('Hey AM, search Python programming tutorial');
  assert.equal(searchPy.intent, 'SEARCH_YOUTUBE');
  assert.match(searchPy.query, /python programming tutorial/i);

  const searchHinglish = router.route('Python tutorial search karo');
  assert.equal(searchHinglish.intent, 'SEARCH_YOUTUBE');
  assert.match(searchHinglish.query, /python tutorial/i);

  const nonMusicPlayCases = [
    'Hey JARVIS, play Cricket highlights',
    'Play Shah Rukh Khan movies',
    'Play News today',
    'Play How to learn computer',
    'Play Google Gemini tutorial',
    'Play Space exploration documentary',
  ];
  for (const phrase of nonMusicPlayCases) {
    const parsed = router.route(phrase);
    assert.equal(parsed.intent, 'PLAY_VIDEO', `Expected PLAY_VIDEO for "${phrase}", got ${parsed.intent}`);
  }

  // Genuine music still routes to PLAY_SONG
  const songCase = router.route('Play Arijit Singh songs');
  assert.equal(songCase.intent, 'PLAY_SONG');

  // Internal AM AI screens pass through UniversalCommandRouter so Stage 6 Canonical Engine handles them
  const screenTargets = [
    ['Open Research', 'research'],
    ['Open Automation', 'automation'],
    ['Open Chat', 'chat'],
    ['Open Tasks', 'productivity'],
    ['Open Ultron', 'ultron'],
    ['Open Security', 'security'],
    ['Open Brain Center', 'brain_center'],
    ['Open Multi Agent', 'multi_agent'],
    ['Open System Telemetry', 'telemetry'],
  ];
  for (const [cmd, expectedScreen] of screenTargets) {
    assert.equal(router.route(cmd).intent, 'UNKNOWN_COMMAND');
    const offline = parseCanonicalOfflineCommand(cmd);
    assert.equal(offline?.intent, 'OPEN_SCREEN', `Expected OPEN_SCREEN for "${cmd}"`);
    assert.equal(offline?.screen, expectedScreen, `Wrong screen for "${cmd}"`);
  }

  // Offline productivity / memory / time commands
  assert.equal(parseCanonicalOfflineCommand('What time is it')?.intent, 'QUERY_TIME');
  assert.equal(parseCanonicalOfflineCommand('Add task Review PR')?.intent, 'CREATE_TASK');
  assert.equal(parseCanonicalOfflineCommand('Save note Architecture check')?.intent, 'CREATE_NOTE');
  assert.equal(parseCanonicalOfflineCommand('Remember that prefer Kotlin')?.intent, 'SAVE_MEMORY');

  // Conversational AI queries are NOT hijacked by either router or offline canonical engine
  const chatPrompts = [
    'Explain how Python decorators work',
    'Tell me about space exploration',
    'Why is the sky blue?',
  ];
  for (const prompt of chatPrompts) {
    assert.equal(router.route(prompt).intent, 'UNKNOWN_COMMAND');
    assert.equal(parseCanonicalOfflineCommand(prompt), null);
  }
});

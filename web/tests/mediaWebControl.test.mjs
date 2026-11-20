import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/index.js';
import {
  extractJsonObjectFromText,
  validateStrictPublicHttpUrl,
  validateWhitelistedAiAction,
} from '../server/mediaActionGuard.js';
import {
  buildYouTubeFallbackUrl,
  parseIso8601Duration,
} from '../server/youtubeService.js';
import {
  BrowserActionService,
  BUILTIN_WEBSITE_DIRECTORY,
  findBuiltInWebsite,
  normalizeSpokenDomain,
  validateSafeHttpUrl,
  WebsiteLauncher,
  WebsiteResolver,
} from '../src/services/media/websiteResolver.js';
import {
  detectWakeWordTrigger,
  UniversalCommandRouter,
  validateClientAiAction,
} from '../src/services/media/universalCommandRouter.js';

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

test('Built-in website directory includes all 28 required platforms', () => {
  assert.equal(BUILTIN_WEBSITE_DIRECTORY.length, 28);
  const expectedNames = [
    'Google',
    'YouTube',
    'Gmail',
    'WhatsApp Web',
    'Instagram',
    'Facebook',
    'X',
    'LinkedIn',
    'GitHub',
    'Amazon',
    'Flipkart',
    'Netflix',
    'Spotify',
    'Google Maps',
    'ChatGPT',
    'Claude',
    'Wikipedia',
    'Hotstar',
    'Swiggy',
    'Zomato',
    'IRCTC',
    'Reddit',
    'Pinterest',
    'Discord',
    'Telegram Web',
    'Microsoft',
    'Apple',
    'Stack Overflow',
  ];
  for (const name of expectedNames) {
    assert.ok(
      findBuiltInWebsite(name),
      `Expected built-in directory to resolve "${name}"`
    );
  }
});

test('Universal Website Launcher resolves English, Hindi, Hinglish, spoken domains, AI official URL, and Google fallback', async () => {
  const router = new UniversalCommandRouter();
  const resolver = new WebsiteResolver({
    aiResolveFn: async (target) => {
      if (target.toLowerCase().includes('isro')) {
        return { action: 'open_url', url: 'https://www.isro.gov.in', label: 'ISRO' };
      }
      return null;
    },
  });

  // 1. 5+ website voice commands in English, Hindi, and Hinglish
  const websiteCommands = [
    ['Open Google', 'https://www.google.com'],
    ['गूगल खोलो', 'https://www.google.com'],
    ['Open Flipkart', 'https://www.flipkart.com'],
    ['मुझे फ्लिपकार्ट पर ले चलो', 'https://www.flipkart.com'],
    ['Flipkart open karo', 'https://www.flipkart.com'],
    ['Open GitHub', 'https://github.com'],
    ['GitHub khol do', 'https://github.com'],
    ['Open YouTube', 'https://www.youtube.com'],
    ['यूट्यूब खोलो', 'https://www.youtube.com'],
    ['YouTube kholo', 'https://www.youtube.com'],
    ['Instagram chalao', 'https://www.instagram.com'],
    ['इंस्टाग्राम खोल दो', 'https://www.instagram.com'],
    ['Go to Wikipedia', 'https://www.wikipedia.org'],
    ['विकिपीडिया खोलो', 'https://www.wikipedia.org'],
    ['Open ChatGPT', 'https://chatgpt.com'],
    ['Visit Amazon', 'https://www.amazon.in'],
    ['Amazon website kholo', 'https://www.amazon.in'],
  ];

  for (const [cmd, expectedUrl] of websiteCommands) {
    const parsed = router.route(cmd);
    assert.equal(parsed.intent, 'OPEN_WEBSITE', `Expected OPEN_WEBSITE for "${cmd}"`);
    const resolved = await resolver.resolve(parsed.websiteTarget || '');
    assert.equal(resolved.ok, true, `Expected valid resolution for "${cmd}"`);
    assert.equal(resolved.url, expectedUrl, `Wrong URL for "${cmd}"`);
  }

  // 2. Spoken domain normalization (English + Hindi Devanagari)
  assert.equal(normalizeSpokenDomain('github dot com')?.url, 'https://github.com');
  assert.equal(normalizeSpokenDomain('wikipedia dot org')?.url, 'https://wikipedia.org');
  assert.equal(normalizeSpokenDomain('example dot in')?.url, 'https://example.in');
  assert.equal(normalizeSpokenDomain('गूगल डॉट कॉम')?.url, 'https://google.com');
  assert.equal(normalizeSpokenDomain('फ्लिपकार्ट डॉट इन')?.url, 'https://flipkart.in');

  // 3. AI-assisted official website resolution
  const isro = await resolver.resolve('ISRO official site');
  assert.equal(isro.ok, true);
  assert.equal(isro.source, 'ai_resolved');
  assert.equal(isro.url, 'https://www.isro.gov.in/');

  // 4. Google Search fallback when not in directory, not a domain, and AI returns null
  const fallback = await resolver.resolve('some obscure non-existent startup xyz123');
  assert.equal(fallback.ok, true);
  assert.equal(fallback.source, 'google_fallback');
  assert.equal(fallback.isFallbackSearch, true);
  assert.ok(fallback.url.startsWith('https://www.google.com/search?q='));
});

test('URL security guard blocks unsafe schemes and reports honest popup-blocked status', async () => {
  const blockedInputs = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
    'http://localhost:3000/admin',
    'http://127.0.0.1/secret',
    'http://192.168.1.10/',
    'https://user:pass@example.com',
  ];

  for (const bad of blockedInputs) {
    assert.equal(validateSafeHttpUrl(bad).valid, false, `Client guard must block: ${bad}`);
    assert.equal(validateStrictPublicHttpUrl(bad).valid, false, `Server guard must block: ${bad}`);
  }

  assert.equal(validateSafeHttpUrl('https://github.com').valid, true);
  assert.equal(validateStrictPublicHttpUrl('https://www.flipkart.com').valid, true);

  // Honest popup-blocked handling when browser returns null from window.open
  const browserActions = new BrowserActionService({
    openFn: () => null,
  });
  const launcher = new WebsiteLauncher(new WebsiteResolver(), browserActions);
  const res = await launcher.launch('Flipkart');
  assert.equal(res.resolved.ok, true);
  assert.equal(res.opened, false);
  assert.equal(res.popupBlocked, true);
  assert.equal(res.resolved.url, 'https://www.flipkart.com');
});

test('Router parses 5 songs, playlists, and 3 videos across English, Hindi, and Hinglish', () => {
  const router = new UniversalCommandRouter();

  // 5 Songs
  const song1 = router.route('Play Kesariya');
  assert.equal(song1.intent, 'PLAY_SONG');
  assert.ok(song1.query.toLowerCase().includes('kesariya'));

  const song1Hinglish = router.route('YouTube par Kesariya chalao');
  assert.equal(song1Hinglish.intent, 'PLAY_SONG');
  assert.ok(song1Hinglish.query.toLowerCase().includes('kesariya'));

  const song2 = router.route('Play Tum Hi Ho');
  assert.equal(song2.intent, 'PLAY_SONG');
  assert.ok(song2.query.toLowerCase().includes('tum hi ho'));

  const song3 = router.route('Play Believer by Imagine Dragons');
  assert.equal(song3.intent, 'PLAY_SONG');
  assert.equal(song3.songName, 'Believer');
  assert.equal(song3.artistName, 'Imagine Dragons');

  const song4 = router.route('Play Arijit Singh songs');
  assert.equal(song4.intent, 'PLAY_SONG');
  assert.equal(song4.artistName, 'Arijit Singh');

  const song4Hindi = router.route('अरिजीत सिंह के गाने बजाओ');
  assert.equal(song4Hindi.intent, 'PLAY_SONG');
  assert.ok(song4Hindi.query.includes('अरिजीत सिंह'));

  const song5 = router.route('Play relaxing music');
  assert.equal(song5.intent, 'PLAY_SONG');

  const playlist = router.route('Play Hindi lofi playlist');
  assert.equal(playlist.intent, 'PLAY_PLAYLIST');

  // 3 Videos
  const vid1 = router.route('Play Iron Man trailer');
  assert.equal(vid1.intent, 'PLAY_VIDEO');
  assert.ok(vid1.query.toLowerCase().includes('iron man trailer'));

  const vid2 = router.route('Play Python programming tutorial');
  assert.equal(vid2.intent, 'PLAY_VIDEO');
  assert.ok(vid2.query.toLowerCase().includes('python programming tutorial'));

  const vid3 = router.route('Play latest AI technology video');
  assert.equal(vid3.intent, 'PLAY_VIDEO');
  assert.ok(vid3.query.toLowerCase().includes('ai technology'));

  const vidHindi = router.route('वीडियो चलाओ');
  assert.equal(vidHindi.intent, 'PLAY_VIDEO');
});

test('Router parses all 16 media player controls in English, Hindi, and Hinglish', () => {
  const router = new UniversalCommandRouter();

  const cases = [
    ['Play', 'RESUME_MEDIA'],
    ['Resume music', 'RESUME_MEDIA'],
    ['दोबारा चलाओ', 'RESUME_MEDIA'],
    ['Pause', 'PAUSE_MEDIA'],
    ['Pause karo', 'PAUSE_MEDIA'],
    ['गाना रोको', 'PAUSE_MEDIA'],
    ['Next song', 'NEXT_TRACK'],
    ['Play the next song', 'NEXT_TRACK'],
    ['Agla gaana bajao', 'NEXT_TRACK'],
    ['अगला गाना चलाओ', 'NEXT_TRACK'],
    ['Previous song', 'PREVIOUS_TRACK'],
    ['Pichla gaana chalao', 'PREVIOUS_TRACK'],
    ['पिछला गाना बजाओ', 'PREVIOUS_TRACK'],
    ['Stop music', 'STOP_MEDIA'],
    ['Gaana band karo', 'STOP_MEDIA'],
    ['म्यूजिक बंद करो', 'STOP_MEDIA'],
    ['Close player', 'CLOSE_PLAYER'],
    ['Player band karo', 'CLOSE_PLAYER'],
    ['प्लेयर बंद करो', 'CLOSE_PLAYER'],
    ['Volume up', 'CHANGE_VOLUME'],
    ['आवाज़ बढ़ाओ', 'CHANGE_VOLUME'],
    ['Volume down', 'CHANGE_VOLUME'],
    ['Awaaz kam karo', 'CHANGE_VOLUME'],
    ['Volume 40', 'CHANGE_VOLUME'],
    ['वॉल्यूम 40 करो', 'CHANGE_VOLUME'],
    ['Mute', 'MUTE_MEDIA'],
    ['Mute karo', 'MUTE_MEDIA'],
    ['Unmute', 'UNMUTE_MEDIA'],
    ['Unmute karo', 'UNMUTE_MEDIA'],
    ['Forward 10 seconds', 'SEEK_FORWARD'],
    ['10 second aage badhao', 'SEEK_FORWARD'],
    ['Rewind 10 seconds', 'SEEK_BACKWARD'],
    ['10 second peeche karo', 'SEEK_BACKWARD'],
    ['Repeat this song', 'REPEAT_MEDIA'],
    ['गाना रिपीट करो', 'REPEAT_MEDIA'],
    ['What is playing?', 'GET_CURRENT_MEDIA'],
    ['Who is singing?', 'GET_CURRENT_MEDIA'],
    ['Abhi kaunsa gaana chal raha hai?', 'GET_CURRENT_MEDIA'],
    ['अभी कौन सा गाना चल रहा है?', 'GET_CURRENT_MEDIA'],
  ];

  for (const [utterance, expectedIntent] of cases) {
    const res = router.route(utterance);
    assert.equal(res.intent, expectedIntent, `Expected ${expectedIntent} for "${utterance}", got ${res.intent}`);
  }

  // Exact volume level check
  assert.equal(router.route('Volume 40').volumeLevel, 40);
  assert.equal(router.route('वॉल्यूम 40 करो').volumeLevel, 40);
  assert.equal(router.route('Volume up').volumeDelta, 15);
  assert.equal(router.route('Volume down').volumeDelta, -15);
  assert.equal(router.route('Forward 25 seconds').seekSeconds, 25);
  assert.equal(router.route('Rewind 15 seconds').seekSeconds, 15);
  assert.equal(router.route('Who is singing?').isWhoSingingQuestion, true);
});

test('Wake-word detection and Stage 6 existing JARVIS command preservation work cleanly', () => {
  const router = new UniversalCommandRouter();

  const bareWake = detectWakeWordTrigger('Hey JARVIS');
  assert.equal(bareWake.triggered, true);
  assert.equal(bareWake.wakeWordOnly, true);
  assert.equal(bareWake.remainder, '');

  const inlineWake = detectWakeWordTrigger('Hey JARVIS, Flipkart kholo');
  assert.equal(inlineWake.triggered, true);
  assert.equal(inlineWake.wakeWordOnly, false);
  assert.equal(inlineWake.remainder, 'Flipkart kholo');

  const hindiWake = detectWakeWordTrigger('हे जार्विस केसरिया गाना चलाओ');
  assert.equal(hindiWake.triggered, true);
  assert.ok(hindiWake.remainder.includes('केसरिया'));

  // Inline wake-word command routes accurately
  assert.equal(router.route('Hey JARVIS, Flipkart kholo').intent, 'OPEN_WEBSITE');
  assert.equal(router.route('Hey JARVIS, play Kesariya').intent, 'PLAY_SONG');

  // Existing Stage 6 internal commands MUST pass through as UNKNOWN_COMMAND so local registry handles them
  const preservedLocalCommands = [
    'open security',
    'open multi ai brain',
    'open brain center',
    'open media control',
    'replay welcome',
    'play welcome',
  ];
  for (const cmd of preservedLocalCommands) {
    assert.equal(
      router.route(cmd).intent,
      'UNKNOWN_COMMAND',
      `Internal JARVIS command "${cmd}" must pass through to Stage 6`
    );
  }
});

test('AI action security allowlist accepts only valid whitelisted actions and rejects unsafe payloads', () => {
  assert.deepEqual(
    validateWhitelistedAiAction({ action: 'open_url', url: 'https://github.com', label: 'GitHub' }),
    { valid: true, action: { action: 'open_url', url: 'https://github.com/', label: 'GitHub' } }
  );
  assert.equal(
    validateWhitelistedAiAction({ action: 'play_song', query: 'Kesariya' }).valid,
    true
  );
  assert.equal(
    validateWhitelistedAiAction({ action: 'media_control', command: 'set_volume', value: 40 }).valid,
    true
  );

  // Reject unsafe or arbitrary actions
  assert.equal(
    validateWhitelistedAiAction({ action: 'open_url', url: 'javascript:alert(1)' }).valid,
    false
  );
  assert.equal(
    validateWhitelistedAiAction({ action: 'exec_shell', command: 'rm -rf /' }).valid,
    false
  );
  assert.equal(
    validateWhitelistedAiAction({ action: 'media_control', command: 'delete_files' }).valid,
    false
  );
  assert.equal(
    validateClientAiAction({ action: 'eval_code', code: 'alert(1)' }),
    null
  );
  assert.deepEqual(
    extractJsonObjectFromText('```json\n{"action":"open_url","url":"https://isro.gov.in"}\n```'),
    { action: 'open_url', url: 'https://isro.gov.in' }
  );
});

test('YouTube duration parser and fallback URL builder work accurately', () => {
  assert.deepEqual(parseIso8601Duration('PT4M28S'), { durationSeconds: 268, durationText: '4:28' });
  assert.deepEqual(parseIso8601Duration('PT1H2M5S'), { durationSeconds: 3725, durationText: '1:02:05' });
  assert.equal(
    buildYouTubeFallbackUrl('Kesariya Arijit Singh'),
    'https://www.youtube.com/results?search_query=Kesariya+Arijit+Singh'
  );
});

test('Express backend /api/health, /api/youtube/search, and /api/chat handle live search, caching, fallbacks, and zero key leaks', async () => {
  const SECRET_YT_KEY = 'AIzaSy_FAKE_SECRET_TEST_KEY_DO_NOT_LEAK_999';
  let upstreamSearchCalls = 0;
  let capturedUrls = [];

  const mockFetch = async (urlStr) => {
    capturedUrls.push(String(urlStr));
    if (String(urlStr).includes('/youtube/v3/search')) {
      upstreamSearchCalls += 1;
      // Simulate empty music-category response on special query to test category retry fallback
      if (String(urlStr).includes('emptycat') && String(urlStr).includes('videoCategoryId=10')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
        };
      }
      if (String(urlStr).includes('quotafail')) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            error: {
              message: 'The request cannot be completed because you have exceeded your quota.',
              errors: [{ reason: 'quotaExceeded' }],
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: { videoId: 'BddP6PYo2gs' },
              snippet: {
                title: 'Kesariya - Brahmāstra | Arijit Singh',
                channelTitle: 'Sony Music India',
                publishedAt: '2022-07-17T06:30:00Z',
                thumbnails: { high: { url: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg' } },
              },
            },
            {
              id: { videoId: 'g6fnFALEseI' },
              snippet: {
                title: 'Kesariya Audio Lyrical',
                channelTitle: 'Sony Music India',
                publishedAt: '2022-07-18T06:30:00Z',
                thumbnails: { medium: { url: 'https://i.ytimg.com/vi/g6fnFALEseI/mqdefault.jpg' } },
              },
            },
          ],
        }),
      };
    }

    if (String(urlStr).includes('/youtube/v3/videos')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 'BddP6PYo2gs', contentDetails: { duration: 'PT4M28S' } },
            { id: 'g6fnFALEseI', contentDetails: { duration: 'PT4M30S' } },
          ],
        }),
      };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  };

  // 1. Server WITH configured YouTube key
  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    youtubeApiKey: SECRET_YT_KEY,
    youtubeFetch: mockFetch,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.youtubeConfigured, true);
    assert.ok(healthJson.capabilities.includes('youtube-search'));
    assert.ok(healthJson.capabilities.includes('structured-ai-actions'));

    // Empty query validation -> 400
    const badRes = await fetch(`${baseUrl}/api/youtube/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '' }),
    });
    assert.equal(badRes.status, 400);

    // Valid music search -> returns normalized items + durations + zero secret key leakage
    const ytRes1 = await fetch(`${baseUrl}/api/youtube/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Kesariya', type: 'music', maxResults: 5 }),
    });
    assert.equal(ytRes1.status, 200);
    const rawBody1 = await ytRes1.text();
    assert.equal(rawBody1.includes(SECRET_YT_KEY), false, 'API key must NEVER leak into response');
    const ytJson1 = JSON.parse(rawBody1);
    assert.equal(ytJson1.ok, true);
    assert.equal(ytJson1.cached, false);
    assert.equal(ytJson1.items.length, 2);
    assert.equal(ytJson1.items[0].videoId, 'BddP6PYo2gs');
    assert.equal(ytJson1.items[0].durationText, '4:28');
    assert.equal(ytJson1.items[0].embedUrl, 'https://www.youtube.com/embed/BddP6PYo2gs');
    assert.ok(capturedUrls[0].includes('videoEmbeddable=true'));
    assert.ok(capturedUrls[0].includes('videoCategoryId=10'));

    // Second identical search -> served from TTL cache (no additional upstream call!)
    const callsBeforeCache = upstreamSearchCalls;
    const ytRes2 = await fetch(`${baseUrl}/api/youtube/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Kesariya', type: 'music', maxResults: 5 }),
    });
    const ytJson2 = await ytRes2.json();
    assert.equal(ytJson2.ok, true);
    assert.equal(ytJson2.cached, true);
    assert.equal(upstreamSearchCalls, callsBeforeCache);

    // Music category empty retry fallback
    const retryRes = await fetch(`${baseUrl}/api/youtube/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'emptycat indie track', type: 'music' }),
    });
    const retryJson = await retryRes.json();
    assert.equal(retryJson.ok, true);
    assert.equal(retryJson.items.length, 2);

    // Quota exceeded -> graceful fallback URL, zero secret leak
    const quotaRes = await fetch(`${baseUrl}/api/youtube/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'quotafail song', type: 'music' }),
    });
    const quotaRaw = await quotaRes.text();
    assert.equal(quotaRaw.includes(SECRET_YT_KEY), false);
    const quotaJson = JSON.parse(quotaRaw);
    assert.equal(quotaJson.ok, false);
    assert.equal(quotaJson.code, 'YOUTUBE_QUOTA_EXCEEDED');
    assert.ok(quotaJson.fallbackUrl.startsWith('https://www.youtube.com/results?search_query='));

    // POST /api/chat validation check
    const badChat = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    assert.equal(badChat.status, 400);
  } finally {
    await new Promise((r) => server.close(r));
  }

  // 2. Server WITHOUT YOUTUBE_API_KEY -> graceful fallback response
  const appNoKey = createApp({
    accessToken: '',
    rateLimitMax: 100,
    youtubeApiKey: '',
  });
  const { server: server2, baseUrl: baseUrl2 } = await startEphemeralServer(appNoKey);
  try {
    const h2 = await (await fetch(`${baseUrl2}/api/health`)).json();
    assert.equal(h2.youtubeConfigured, false);

    const noKeyRes = await fetch(`${baseUrl2}/api/youtube/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Iron Man trailer', type: 'video' }),
    });
    assert.equal(noKeyRes.status, 200);
    const noKeyJson = await noKeyRes.json();
    assert.equal(noKeyJson.ok, false);
    assert.equal(noKeyJson.configured, false);
    assert.equal(noKeyJson.code, 'YOUTUBE_API_KEY_MISSING');
    assert.equal(
      noKeyJson.fallbackUrl,
      'https://www.youtube.com/results?search_query=Iron+Man+trailer'
    );
  } finally {
    await new Promise((r) => server2.close(r));
  }
});

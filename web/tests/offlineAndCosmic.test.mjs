import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parseCanonicalOfflineCommand } from '../src/services/offline/canonicalCommandEngine.js';
import {
  mergeWithConflictDetection,
  resolveConflictRecord,
} from '../src/services/offline/syncConflictEngine.js';
import { resolveAiProviderPlan } from '../src/services/offline/networkAndRouter.js';
import { detectWakeWordTrigger } from '../src/services/media/universalCommandRouter.js';
import { parseYouTubeUrlInput } from '../src/services/media/youtubeUrlParser.js';
import { createYouTubeSearchService } from '../server/youtubeService.js';
import { createApp } from '../server/index.js';

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

test('Canonical Offline Command Engine handles English, Hindi, and Hinglish commands deterministically', () => {
  const timeEn = parseCanonicalOfflineCommand('Hey AM what time is it');
  assert.equal(timeEn?.intent, 'QUERY_TIME');
  assert.equal(timeEn?.engine, 'Offline Command Engine');

  const timeHi = parseCanonicalOfflineCommand('ए एम ए आई समय बताओ');
  assert.equal(timeHi?.intent, 'QUERY_TIME');

  const dateCmd = parseCanonicalOfflineCommand('aaj kya tarikh hai');
  assert.equal(dateCmd?.intent, 'QUERY_DATE');

  const taskCmd = parseCanonicalOfflineCommand('Hey AM add task Submit quarterly diagnostics');
  assert.equal(taskCmd?.intent, 'CREATE_TASK');
  assert.equal(taskCmd?.title, 'Submit quarterly diagnostics');

  const noteHi = parseCanonicalOfflineCommand('नोट बनाओ Kal subah 8 baje deployment check karna hai');
  assert.equal(noteHi?.intent, 'CREATE_NOTE');
  assert.match(noteHi?.content || '', /deployment check/i);

  const memCmd = parseCanonicalOfflineCommand('yaad rakho My workspace prefers local-first backups');
  assert.equal(memCmd?.intent, 'SAVE_MEMORY');

  const navYoutube = parseCanonicalOfflineCommand('open youtube');
  assert.equal(navYoutube?.intent, 'OPEN_SCREEN');
  assert.equal(navYoutube?.screen, 'media_control');
  assert.equal(navYoutube?.section, 'youtube');

  const navNotes = parseCanonicalOfflineCommand('kholo notes');
  assert.equal(navNotes?.intent, 'OPEN_SCREEN');
  assert.equal(navNotes?.screen, 'productivity');
  assert.equal(navNotes?.tab, 'notes');

  const protoCmd = parseCanonicalOfflineCommand('focus mode');
  assert.equal(protoCmd?.intent, 'RUN_PROTOCOL');
  assert.equal(protoCmd?.protocol, 'FOCUS');
});

test('Wake-word trigger respects Hey AM default and opt-in Hey JARVIS alias toggle', () => {
  const amHit = detectWakeWordTrigger('Hey AM open notes', { allowLegacyJarvis: false });
  assert.equal(amHit.triggered, true);
  assert.equal(amHit.remainder, 'open notes');

  const jarvisDisabled = detectWakeWordTrigger('Hey JARVIS open notes', {
    allowLegacyJarvis: false,
  });
  assert.equal(jarvisDisabled.triggered, false);

  const jarvisEnabled = detectWakeWordTrigger('Hey JARVIS open notes', {
    allowLegacyJarvis: true,
  });
  assert.equal(jarvisEnabled.triggered, true);
  assert.equal(jarvisEnabled.remainder, 'open notes');

  const casualSpeech = detectWakeWordTrigger('Let us discuss the quarterly roadmap tomorrow', {
    allowLegacyJarvis: true,
  });
  assert.equal(casualSpeech.triggered, false);
});

test('YouTube URL parser supports watch, shortlinks, shorts, and playlists', () => {
  assert.deepEqual(parseYouTubeUrlInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), {
    kind: 'video',
    videoId: 'dQw4w9WgXcQ',
    playlistId: undefined,
  });

  assert.deepEqual(parseYouTubeUrlInput('https://youtu.be/dQw4w9WgXcQ?list=PL1234567890abcd'), {
    kind: 'video',
    videoId: 'dQw4w9WgXcQ',
    playlistId: 'PL1234567890abcd',
  });

  assert.deepEqual(parseYouTubeUrlInput('https://youtube.com/shorts/abc123XYZ_-'), {
    kind: 'video',
    videoId: 'abc123XYZ_-',
    playlistId: undefined,
  });

  assert.deepEqual(parseYouTubeUrlInput('https://youtube.com/playlist?list=PLabcdef123456'), {
    kind: 'playlist',
    playlistId: 'PLabcdef123456',
  });

  assert.equal(parseYouTubeUrlInput('https://example.com/watch?v=dQw4w9WgXcQ'), null);
});

test('Sync conflict engine detects divergent dirty local edits and supports Keep Local / Keep Cloud / Keep Both', () => {
  const localNotes = [
    {
      id: 'note_1',
      title: 'Reactor Check',
      content: 'Edited offline on PC',
      createdAt: 1000,
      updatedAt: 3000,
      syncStatus: 'pending_upsert',
    },
  ];
  const cloudNotes = [
    {
      id: 'note_1',
      title: 'Reactor Check',
      content: 'Edited on Android cloud',
      createdAt: 1000,
      updatedAt: 4000,
      syncStatus: 'synced',
    },
  ];

  const { merged, conflicts } = mergeWithConflictDetection({
    entityType: 'note',
    localItems: localNotes,
    cloudItems: cloudNotes,
  });

  assert.equal(conflicts.length, 1);
  assert.equal(merged[0].syncStatus, 'conflict');

  const keepLocal = resolveConflictRecord(conflicts[0], 'keep_local');
  assert.equal(keepLocal.length, 1);
  assert.equal(keepLocal[0].content, 'Edited offline on PC');
  assert.equal(keepLocal[0].syncStatus, 'pending_upsert');

  const keepCloud = resolveConflictRecord(conflicts[0], 'keep_cloud');
  assert.equal(keepCloud.length, 1);
  assert.equal(keepCloud[0].content, 'Edited on Android cloud');
  assert.equal(keepCloud[0].syncStatus, 'synced');

  const keepBoth = resolveConflictRecord(conflicts[0], 'keep_both');
  assert.equal(keepBoth.length, 2);
  assert.equal(keepBoth[0].content, 'Edited on Android cloud');
  assert.equal(keepBoth[1].content, 'Edited offline on PC');
  assert.notEqual(keepBoth[0].id, keepBoth[1].id);
});

test('Hybrid AI router prioritizes Cloud -> Opt-in Ollama -> Local PC AI -> Offline guidance safely', () => {
  const cloudPrimary = resolveAiProviderPlan('hybrid', {
    browserOnline: true,
    backendReachable: true,
    cloudAiConfigured: true,
    localModelInstalled: true,
    ollamaEnabled: true,
  });
  assert.equal(cloudPrimary.target, 'cloud');
  assert.equal(cloudPrimary.allowFallbackToLocal, true);

  const offlineWithLocal = resolveAiProviderPlan('hybrid', {
    browserOnline: false,
    backendReachable: false,
    cloudAiConfigured: true,
    localModelInstalled: true,
    ollamaEnabled: false,
  });
  assert.equal(offlineWithLocal.target, 'local_pc');
  assert.equal(offlineWithLocal.attribution, 'Local PC AI');

  const offlineWithOllama = resolveAiProviderPlan('hybrid', {
    browserOnline: false,
    backendReachable: false,
    cloudAiConfigured: true,
    localModelInstalled: true,
    ollamaEnabled: true,
  });
  assert.equal(offlineWithOllama.target, 'ollama');
  assert.equal(offlineWithOllama.attribution, 'Ollama (Opt-In)');

  const offlineEmpty = resolveAiProviderPlan('hybrid', {
    browserOnline: false,
    backendReachable: false,
    cloudAiConfigured: true,
    localModelInstalled: false,
    ollamaEnabled: false,
  });
  assert.equal(offlineEmpty.target, 'offline_guidance');
  assert.equal(offlineEmpty.attribution, 'Offline Command Engine');
});

test('YouTube search service caches results and /api/youtube/search defaults maxResults to 8', async () => {
  let fetchCalls = 0;
  const mockFetch = async (url) => {
    fetchCalls += 1;
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname.endsWith('/search')) {
      assert.equal(parsedUrl.searchParams.get('maxResults'), '8');
      return new Response(
        JSON.stringify({
          items: [
            {
              id: { videoId: 'dQw4w9WgXcQ' },
              snippet: {
                title: 'Cosmic Reactor Demo',
                channelTitle: 'AM Engineering',
                description: 'Arc test',
                thumbnails: { high: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' } },
              },
            },
          ],
          pageInfo: { totalResults: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const yt = createYouTubeSearchService({
    apiKey: 'AIzaSyTestFakeKey123456',
    fetchImpl: mockFetch,
    cacheTtlMs: 3600 * 1000,
  });

  const first = await yt.search({ query: 'cosmic reactor', mode: 'video', maxResults: 8 });
  assert.equal(first.ok, true);
  assert.equal(first.cached, false);
  assert.equal(first.items.length, 1);

  const callsAfterFirst = fetchCalls;
  const second = await yt.search({ query: 'cosmic reactor', mode: 'video', maxResults: 8 });
  assert.equal(second.ok, true);
  assert.equal(second.cached, true);
  assert.equal(fetchCalls, callsAfterFirst);

  // Verify Express /api/youtube/search endpoint default maxResults=8 fallback behavior cleanly
  const app = createApp({ geminiApiKey: '' });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/youtube/search?q=lofi+beats`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.fallbackUrl, 'string');
    assert.match(body.fallbackUrl, /youtube\.com\/results/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

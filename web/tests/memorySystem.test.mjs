import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/index.js';
import {
  containsSensitiveSecret,
  parseMemoryCommand,
  retrieveRelevantConversations,
  retrieveRelevantMemories,
  upsertOrMergeMemory,
} from '../src/services/memoryDedupe.js';

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

test('containsSensitiveSecret blocks API keys, JWTs, passwords, and payment cards', () => {
  assert.equal(containsSensitiveSecret('AIzaSyD1234567890ABCDEFGHIJKLMNOPQRS').blocked, true);
  assert.equal(containsSensitiveSecret('My password is SuperSecret99!').blocked, true);
  assert.equal(
    containsSensitiveSecret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def').blocked,
    true
  );
  assert.equal(containsSensitiveSecret('4532 1234 5678 9010').blocked, true);
  assert.equal(containsSensitiveSecret('I prefer dark cosmic cyan UI in Kotlin Compose').blocked, false);
});

test('upsertOrMergeMemory updates conflicting preferences and rejects duplicates', () => {
  const t1 = 1_700_000_000_000;
  const first = upsertOrMergeMemory(
    { key: 'Preferred Language', category: 'PREFERENCE', content: 'Prefers concise English answers', importance: 4 },
    [],
    t1
  );
  assert.equal(first.status, 'created');

  // Exact duplicate check
  const dup = upsertOrMergeMemory(
    { key: 'Preferred Language', category: 'PREFERENCE', content: 'Prefers concise English answers', importance: 4 },
    [first.memory],
    t1 + 1000
  );
  assert.equal(dup.status, 'duplicate');

  // Conflicting language update replaces outdated memory and updates timestamp
  const t2 = t1 + 5000;
  const updated = upsertOrMergeMemory(
    { key: 'Response Language', category: 'PREFERENCE', content: 'Prefers natural Hinglish explanations', importance: 5 },
    [first.memory],
    t2
  );
  assert.equal(updated.status, 'updated');
  assert.equal(updated.memory.id, first.memory.id);
  assert.equal(updated.memory.updatedAt, t2);
  assert.match(updated.memory.content, /Hinglish/);
});

test('retrieveRelevantMemories ranks query relevance + category + importance cleanly', () => {
  const now = 1_700_100_000_000;
  const pool = [
    { id: '1', key: 'Coffee Order', category: 'FACT', content: 'Drinks black coffee', importance: 2, createdAt: now, updatedAt: now },
    { id: '2', key: 'Android Project', category: 'PROJECT', content: 'Building JARVIS AI using Kotlin Compose and Room v6', importance: 5, createdAt: now, updatedAt: now },
    { id: '3', key: 'Language', category: 'PREFERENCE', content: 'Prefers Hinglish responses', importance: 5, createdAt: now, updatedAt: now },
  ];

  const ranked = retrieveRelevantMemories('How should we migrate our Kotlin Compose Room database?', pool, 2, now);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, '2');
});

test('retrieveRelevantConversations locates yesterday and topic-relevant prior sessions', () => {
  const now = new Date(2026, 4, 15, 14, 0, 0).getTime();
  const yesterdayTs = new Date(2026, 4, 14, 18, 30, 0).getTime();
  const olderTs = new Date(2026, 4, 10, 10, 0, 0).getTime();

  const sessions = [
    {
      id: 'sess_yesterday',
      title: 'Kubernetes Scaling Plan',
      updatedAt: yesterdayTs,
      contextSummary: 'Discussed Cloud Run autoscaling and Redis caching.',
      messages: [
        { role: 'user', text: 'Let us configure Cloud Run min instances', timestamp: yesterdayTs },
        { role: 'model', text: 'Set min-instances to 1 to avoid cold starts.', timestamp: yesterdayTs + 1000 },
      ],
    },
    {
      id: 'sess_older',
      title: 'Recipe Notes',
      updatedAt: olderTs,
      messages: [{ role: 'user', text: 'How to brew espresso cleanly', timestamp: olderTs }],
    },
  ];

  const hits = retrieveRelevantConversations('What did we discuss yesterday?', sessions, {
    activeSessionId: 'sess_today',
    now,
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].sessionId, 'sess_yesterday');
});

test('parseMemoryCommand handles English/Hinglish save, update, forget, recall, clarify, and secret rejection', () => {
  assert.equal(parseMemoryCommand('Remember that I prefer Hindi.').type, 'SAVE');
  assert.equal(parseMemoryCommand('Remember my project details.').type, 'CLARIFY');
  assert.equal(parseMemoryCommand('Remember that my api_key=sk-1234567890abcdef1234').type, 'REJECT_SECRET');
  assert.equal(parseMemoryCommand('What do you remember about me?').type, 'RECALL_MEMORIES');
  assert.equal(parseMemoryCommand('What did we discuss yesterday?').type, 'RECALL_CONVERSATIONS');
  assert.equal(parseMemoryCommand('Forget my previous project preference.').type, 'FORGET');
  assert.equal(parseMemoryCommand('Update my preferred language to Hinglish').type, 'UPDATE');
  assert.equal(parseMemoryCommand('Update my saved preference').type, 'CLARIFY');
  assert.equal(parseMemoryCommand('Explain black hole thermodynamics'), null);
});

test('Express /api/memory CRUD endpoints support create, conflict update, search, edit, guarded clear, and delete', async () => {
  const tmpFile = path.join(os.tmpdir(), `jarvis-mem-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const app = createApp({ accessToken: '', rateLimitMax: 100, memoryStorePath: tmpFile });
  const { server, baseUrl } = await startEphemeralServer(app);

  try {
    // 1. Secret blocked
    const secretRes = await fetch(`${baseUrl}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'Secret', category: 'FACT', content: 'password is letmein123' }),
    });
    assert.equal(secretRes.status, 400);
    const secretJson = await secretRes.json();
    assert.equal(secretJson.code, 'SENSITIVE_SECRET_BLOCKED');

    // 2. Create memory
    const createRes = await fetch(`${baseUrl}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'Preferred Language',
        category: 'PREFERENCE',
        content: 'Prefers English explanations',
        importance: 4,
      }),
    });
    assert.equal(createRes.status, 201);
    const createdJson = await createRes.json();
    const memId = createdJson.memory.id;

    // 3. Conflicting update via POST merges cleanly
    const conflictRes = await fetch(`${baseUrl}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'Response Language',
        category: 'PREFERENCE',
        content: 'Prefers Hindi explanations',
        importance: 5,
      }),
    });
    assert.equal(conflictRes.status, 200);
    const conflictJson = await conflictRes.json();
    assert.equal(conflictJson.status, 'updated');
    assert.equal(conflictJson.memory.id, memId);

    // 4. Search
    const searchRes = await fetch(`${baseUrl}/api/memory/search?q=Hindi`);
    assert.equal(searchRes.status, 200);
    const searchJson = await searchRes.json();
    assert.equal(searchJson.memories.length, 1);

    // 5. PUT edit
    const putRes = await fetch(`${baseUrl}/api/memory/${memId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Prefers Hinglish and Hindi explanations', importance: 5 }),
    });
    assert.equal(putRes.status, 200);

    // 6. Clear requires explicit confirmation
    const unconfirmedClear = await fetch(`${baseUrl}/api/memory/all`, { method: 'DELETE' });
    assert.equal(unconfirmedClear.status, 400);

    const confirmedClear = await fetch(`${baseUrl}/api/memory/all?confirm=true`, { method: 'DELETE' });
    assert.equal(confirmedClear.status, 200);
    const clearedJson = await confirmedClear.json();
    assert.equal(clearedJson.clearedCount, 1);
  } finally {
    await new Promise((r) => server.close(r));
    if (fs.existsSync(tmpFile)) {
      fs.rmSync(tmpFile, { force: true });
    }
  }
});

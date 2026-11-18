import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createApp } from '../server/index.js';
import {
  analyzeBrainRequest,
  buildIntelligentErrorExplanation,
  searchConversations,
} from '../src/services/brainEngine.js';
import { parseDocumentPayload } from '../server/documentParser.js';
import { parseStructuredResearchMarkdown } from '../server/searchService.js';

function startEphemeralServer(appInstance) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
    server.on('error', reject);
  });
}

/**
 * Builds a minimal valid OOXML .docx (ZIP containing word/document.xml) for real parser tests.
 */
function buildMinimalDocxBase64(paragraphText) {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${paragraphText}</w:t></w:r></w:p></w:body></w:document>`;
  const fileNameBuf = Buffer.from('word/document.xml', 'utf8');
  const rawData = Buffer.from(xml, 'utf8');
  const compressed = zlib.deflateRawSync(rawData);

  // CRC32 calculation
  let crc = 0xffffffff;
  for (let i = 0; i < rawData.length; i++) {
    crc ^= rawData[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  crc = (crc ^ 0xffffffff) >>> 0;

  // Local file header
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8); // Deflate
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(rawData.length, 22);
  localHeader.writeUInt16LE(fileNameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const localPart = Buffer.concat([localHeader, fileNameBuf, compressed]);

  // Central directory header
  const cdHeader = Buffer.alloc(46);
  cdHeader.writeUInt32LE(0x02014b50, 0);
  cdHeader.writeUInt16LE(20, 4);
  cdHeader.writeUInt16LE(20, 6);
  cdHeader.writeUInt16LE(0, 8);
  cdHeader.writeUInt16LE(8, 10);
  cdHeader.writeUInt16LE(0, 12);
  cdHeader.writeUInt16LE(0, 14);
  cdHeader.writeUInt32LE(crc, 16);
  cdHeader.writeUInt32LE(compressed.length, 20);
  cdHeader.writeUInt32LE(rawData.length, 24);
  cdHeader.writeUInt16LE(fileNameBuf.length, 28);
  cdHeader.writeUInt16LE(0, 30);
  cdHeader.writeUInt16LE(0, 32);
  cdHeader.writeUInt16LE(0, 34);
  cdHeader.writeUInt16LE(0, 36);
  cdHeader.writeUInt32LE(0, 38);
  cdHeader.writeUInt32LE(0, 42);
  const cdPart = Buffer.concat([cdHeader, fileNameBuf]);

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localPart, cdPart, eocd]).toString('base64');
}

test('Phase 1: Brain Engine handles personalities, explicit reasoning depth, Hinglish detection, searchConversations, and 400/401/403/404/429/500 explanations', () => {
  const analysis = analyzeBrainRequest({
    prompt: 'Bhai microservices architecture ko step by step samjhao',
    history: [],
    preferredLanguage: 'ENGLISH',
    personality: 'deep_analyst',
    responseStyle: 'detailed',
    reasoningPreference: 'deep',
    customInstructions: 'Always include security trade-offs.',
  });

  assert.equal(analysis.detectedLanguage, 'HINGLISH');
  assert.equal(analysis.reasoningMode, 'deep');
  assert.match(analysis.brainDirectiveBlock, /Rigorous Systems & Research Analyst|evidence-driven/i);
  assert.match(analysis.brainDirectiveBlock, /Always include security trade-offs/);

  const hits = searchConversations(
    [
      {
        id: 's1',
        title: 'Firebase Architecture',
        updatedAt: 200,
        messages: [
          { id: 'm1', role: 'user', text: 'Configure Firestore rules for tasks', timestamp: 100 },
          { id: 'm2', role: 'jarvis', text: 'Applied zero-trust user isolation rules.', timestamp: 101 },
        ],
      },
      {
        id: 's2',
        title: 'Grocery List',
        updatedAt: 300,
        messages: [{ id: 'm3', role: 'user', text: 'Buy apples', timestamp: 250 }],
      },
    ],
    'firestore'
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].sessionId, 's1');
  assert.ok(hits[0].matchCount >= 1);

  for (const status of [400, 401, 403, 404, 429, 500]) {
    const exp = buildIntelligentErrorExplanation({ httpStatus: status, code: `HTTP_${status}` });
    assert.ok(exp.cause.length > 10, `Expected cause for HTTP ${status}`);
    assert.ok(exp.suggestedAction.length > 10, `Expected suggestedAction for HTTP ${status}`);
  }
});

test('Phase 2 & 3: Memory & Workspace API enforces user namespace isolation, blocks secrets, and syncs LWW snapshots', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-phase2-test-'));
  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    memoryStorePath: path.join(tmpDir, 'memories.json'),
    dataStorePath: path.join(tmpDir, 'workspace.json'),
    disableStoreFallback: true,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    // User A saves memory
    const saveA = await fetch(`${baseUrl}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jarvis-User-Id': 'user_alpha' },
      body: JSON.stringify({ key: 'Stack', category: 'PROJECT', content: 'Kotlin Compose + Node Express', importance: 5 }),
    });
    assert.equal(saveA.status, 201);
    const savedAJson = await saveA.json();
    assert.equal(savedAJson.persisted, true);

    // Secret blocking check
    const secretAttempt = await fetch(`${baseUrl}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jarvis-User-Id': 'user_alpha' },
      body: JSON.stringify({ key: 'API Key', category: 'FACT', content: 'AIzaSyD1234567890abcdefghijklmnopqrstuvwx' }),
    });
    assert.equal(secretAttempt.status, 400);
    assert.equal((await secretAttempt.json()).code, 'SENSITIVE_SECRET_BLOCKED');

    // User B MUST NOT see User A's memories
    const listB = await fetch(`${baseUrl}/api/memory`, {
      headers: { 'X-Jarvis-User-Id': 'user_beta' },
    });
    const listBJson = await listB.json();
    assert.equal(listBJson.memories.length, 0);

    // Bidirectional workspace sync (/api/sync) for User A
    const syncRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Jarvis-User-Id': 'user_alpha' },
      body: JSON.stringify({
        tasks: [{ id: 't1', title: 'Deploy to Vercel', priority: 'HIGH', category: 'TASK', updatedAt: Date.now() }],
        notes: [{ id: 'n1', title: 'Release Checklist', content: 'Verify free-tier fallback tests', updatedAt: Date.now() }],
        automations: [{ id: 'a1', actionType: 'OPEN_WEBSITE', label: 'Opened Docs', status: 'EXECUTED', confirmedByUser: true }],
      }),
    });
    assert.equal(syncRes.status, 200);
    const syncJson = await syncRes.json();
    assert.equal(syncJson.persisted, true);
    assert.equal(syncJson.tasks.length, 1);
    assert.equal(syncJson.notes.length, 1);
    assert.equal(syncJson.automations.length, 1);
    assert.equal(syncJson.memories.length, 1);
  } finally {
    await new Promise((r) => server.close(r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Phase 4: Real OOXML .docx extraction and Verified vs Uncertain research markdown parsing', async () => {
  const docxBase64 = buildMinimalDocxBase64('JARVIS Phase 4 Document Intelligence Verification Payload');
  const parsed = parseDocumentPayload({
    fileName: 'architecture.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileBase64: docxBase64,
  });
  assert.equal(parsed.kind, 'docx');
  assert.match(parsed.text, /JARVIS Phase 4 Document Intelligence Verification Payload/);
  assert.ok(parsed.wordCount >= 6);

  // Also test via HTTP /api/documents/parse with action: 'extract_only'
  const app = createApp({ accessToken: '', rateLimitMax: 100 });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/documents/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'architecture.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileBase64: docxBase64,
        action: 'extract_only',
      }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.kind, 'docx');
    assert.match(json.extractedText, /JARVIS Phase 4 Document Intelligence/);
  } finally {
    await new Promise((r) => server.close(r));
  }

  const structured = parseStructuredResearchMarkdown(
    '## Executive Summary\nOverview.\n## Verified Facts\n- Fact one\n- Fact two\n## Uncertain / Caveats\n- Pending benchmark'
  );
  assert.deepEqual(structured.verifiedFacts, ['Fact one', 'Fact two']);
  assert.deepEqual(structured.uncertainNotes, ['Pending benchmark']);
});

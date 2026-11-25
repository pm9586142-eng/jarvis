import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../server/index.js';
import { getSanitizedConfig, maskApiKey } from '../server/configManager.js';

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

test('maskApiKey and getSanitizedConfig never expose raw secrets', () => {
  const masked = maskApiKey('AIzaSySuperSecretKey1234567890');
  assert.ok(!masked.includes('SuperSecretKey'));
  assert.ok(masked.startsWith('AIzaSy'));
  assert.ok(masked.endsWith('7890'));

  const sanitized = getSanitizedConfig({
    version: 2,
    appAccessToken: 'secret-token',
    providers: {
      gemini: { enabled: true, apiKey: 'AIzaSySecretValueXYZ9999' },
    },
  });
  assert.equal(sanitized.appAccessToken, undefined);
  assert.equal(sanitized.providers.gemini.apiKey, undefined);
  assert.equal(sanitized.providers.gemini.maskedKey, 'AIzaSy...9999');
});

test('GET /api/config, POST /api/config, rollback, sync/status, and models endpoints enforce security & persistence', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'am-ai-cfg-'));
  const prevDir = process.env.AM_AI_DATA_DIR;
  const prevToken = process.env.APP_ACCESS_TOKEN;
  process.env.AM_AI_DATA_DIR = tempDir;
  process.env.APP_ACCESS_TOKEN = 'test-admin-token-42';

  const app = createApp({ accessToken: 'test-admin-token-42', rateLimitMax: 100 });
  const { server, baseUrl } = await startEphemeralServer(app);

  try {
    // Unauthorized call is blocked
    const unauthRes = await fetch(`${baseUrl}/api/config`);
    assert.equal(unauthRes.status, 401);

    // Authorized GET /api/config
    const headers = {
      Authorization: 'Bearer test-admin-token-42',
      'Content-Type': 'application/json',
    };
    const getRes = await fetch(`${baseUrl}/api/config`, { headers });
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.equal(getJson.ok, true);
    assert.equal(getJson.defaultModel, 'gemini-3.8-flash');
    assert.equal(getJson.providers.gemini.apiKey, undefined);

    // Update configuration and confirm version bump + masking
    const postRes = await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        activeProvider: 'groq',
        voice: { speed: 0.95, pitch: 1.0 },
        providers: { groq: { enabled: true, apiKey: 'gsk_supersecretkey987654' } },
      }),
    });
    assert.equal(postRes.status, 200);
    const postJson = await postRes.json();
    assert.equal(postJson.config.version, getJson.version + 1);
    assert.equal(postJson.config.providers.groq.apiKey, undefined);
    assert.equal(postJson.config.providers.groq.maskedKey, 'gsk_su...7654');

    // Sync status reflects bumped version
    const syncRes = await fetch(`${baseUrl}/api/sync/status`, { headers });
    assert.equal(syncRes.status, 200);
    const syncJson = await syncRes.json();
    assert.equal(syncJson.configVersion, postJson.config.version);

    // Rollback restores version 1 fields at new monotonic version
    const rbRes = await fetch(`${baseUrl}/api/config/rollback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ version: getJson.version }),
    });
    assert.equal(rbRes.status, 200);
    const rbJson = await rbRes.json();
    assert.equal(rbJson.config.activeProvider, 'gemini');
    assert.equal(rbJson.config.version, postJson.config.version + 1);

    // Models & providers list endpoints
    const modelsRes = await fetch(`${baseUrl}/api/models`, { headers });
    assert.equal(modelsRes.status, 200);
    const modelsJson = await modelsRes.json();
    assert.ok(Array.isArray(modelsJson.geminiModels));

    const provRes = await fetch(`${baseUrl}/api/providers`, { headers });
    assert.equal(provRes.status, 200);
    const provJson = await provRes.json();
    assert.ok(Array.isArray(provJson.providers));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (prevDir === undefined) delete process.env.AM_AI_DATA_DIR;
    else process.env.AM_AI_DATA_DIR = prevDir;
    if (prevToken === undefined) delete process.env.APP_ACCESS_TOKEN;
    else process.env.APP_ACCESS_TOKEN = prevToken;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

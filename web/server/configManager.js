import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDataDirectory() {
  if (process.env.AM_AI_DATA_DIR && process.env.AM_AI_DATA_DIR.trim()) {
    return path.resolve(process.env.AM_AI_DATA_DIR.trim());
  }
  if (process.env.VERCEL) {
    return '/tmp/am_ai_data';
  }
  return path.resolve(__dirname, 'data');
}

const DEFAULT_CONFIG_VERSION = 1;
const MAX_HISTORY_SNAPSHOTS = 10;

export const DEFAULT_CONFIG = {
  version: DEFAULT_CONFIG_VERSION,
  updatedAt: new Date().toISOString(),
  apiVersion: '2026-11',
  minClientVersionAndroid: '1.0',
  minClientVersionWeb: '2.0.0',
  defaultModel: 'gemini-3.8-flash',
  fallbackModel: 'gemini-3.8-flash',
  activeProvider: 'gemini',
  fallbackProvider: 'groq',
  defaultLanguage: 'ENGLISH',
  providers: {
    gemini: { enabled: true, maskedKey: '' },
    groq: { enabled: false, maskedKey: '' },
    openrouter: { enabled: false, maskedKey: '' },
  },
  voice: {
    provider: 'elevenlabs',
    voiceId: 'ohvvU75FpBEB8fdaLOMh',
    voiceName: 'Monika Sogam – Lively E-com Support',
    modelId: 'eleven_flash_v2_5',
    defaultPreset: 'laila_soft',
    neuralTtsEnabled: true,
    femaleVoiceEnabled: true,
    speed: 0.96,
    pitch: 1.0,
  },
  featureFlags: {
    continuousVoice: true,
    webSearch: true,
    memoryExtraction: true,
    smartReminders: true,
    multiAiCenter: true,
    researchStudio: true,
    musicStudio: true,
    orbitalGame: true,
    ultronHologram: true,
  },
};

let inMemoryConfigCache = null;

function getPaths() {
  const dataDir = resolveDataDirectory();
  return {
    dataDir,
    configFilePath: path.resolve(dataDir, 'config_store.json'),
    historyFilePath: path.resolve(dataDir, 'config_history.json'),
    auditLogPath: path.resolve(dataDir, 'config_audit.log'),
  };
}

function ensureDataDirectory() {
  const { dataDir } = getPaths();
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return true;
  } catch (e) {
    console.warn('[ConfigManager] Falling back to memory cache (dir unavailable):', e?.message);
    return false;
  }
}

function deepMergeConfig(base, patch) {
  const next = {
    ...base,
    ...patch,
    providers: {
      ...(base.providers || {}),
      ...(patch.providers || {}),
    },
    voice: {
      ...(base.voice || {}),
      ...(patch.voice || {}),
    },
    featureFlags: {
      ...(base.featureFlags || {}),
      ...(patch.featureFlags || {}),
    },
  };
  return next;
}

export function loadPersistentConfig() {
  const { configFilePath } = getPaths();
  try {
    if (fs.existsSync(configFilePath)) {
      const raw = fs.readFileSync(configFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const merged = deepMergeConfig(DEFAULT_CONFIG, parsed);
      inMemoryConfigCache = merged;
      return merged;
    }
  } catch (e) {
    console.warn('[ConfigManager] Failed to read config file, using cache/default:', e?.message);
  }
  if (inMemoryConfigCache) {
    return JSON.parse(JSON.stringify(inMemoryConfigCache));
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

export function validateConfigPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: 'Configuration payload must be a JSON object.' };
  }
  if (patch.activeProvider !== undefined) {
    const allowed = ['gemini', 'groq', 'openrouter'];
    if (!allowed.includes(String(patch.activeProvider).toLowerCase())) {
      return { ok: false, error: `Unsupported activeProvider "${patch.activeProvider}".` };
    }
  }
  if (patch.voice !== undefined) {
    if (typeof patch.voice !== 'object' || Array.isArray(patch.voice)) {
      return { ok: false, error: 'voice configuration must be an object.' };
    }
    if (patch.voice.speed !== undefined) {
      const s = Number(patch.voice.speed);
      if (!Number.isFinite(s) || s < 0.5 || s > 2.0) {
        return { ok: false, error: 'voice.speed must be between 0.5 and 2.0.' };
      }
    }
    if (patch.voice.pitch !== undefined) {
      const p = Number(patch.voice.pitch);
      if (!Number.isFinite(p) || p < 0.5 || p > 2.0) {
        return { ok: false, error: 'voice.pitch must be between 0.5 and 2.0.' };
      }
    }
  }
  return { ok: true };
}

function appendHistorySnapshot(snapshot) {
  const { historyFilePath } = getPaths();
  if (!ensureDataDirectory()) return;
  try {
    let history = [];
    if (fs.existsSync(historyFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(historyFilePath, 'utf-8'));
      if (Array.isArray(parsed)) history = parsed;
    }
    history.unshift(getSanitizedConfig(snapshot));
    const trimmed = history.slice(0, MAX_HISTORY_SNAPSHOTS);
    const tmp = `${historyFilePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2), 'utf-8');
    fs.renameSync(tmp, historyFilePath);
  } catch (e) {
    console.warn('[ConfigManager] Failed to write config history:', e?.message);
  }
}

export function listConfigHistory() {
  const { historyFilePath } = getPaths();
  try {
    if (fs.existsSync(historyFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(historyFilePath, 'utf-8'));
      if (Array.isArray(parsed)) return parsed.map((c) => getSanitizedConfig(c));
    }
  } catch (_) {}
  return [];
}

export function savePersistentConfig(newConfig, actor = 'admin') {
  const validation = validateConfigPatch(newConfig);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.code = 'INVALID_CONFIG';
    throw err;
  }

  const current = loadPersistentConfig();
  appendHistorySnapshot(current);

  const sanitizedPatch = JSON.parse(JSON.stringify(newConfig));
  // Never store plaintext apiKey values inside config_store.json; mask them and strip raw secrets
  if (sanitizedPatch.providers) {
    for (const pKey of Object.keys(sanitizedPatch.providers)) {
      const prov = sanitizedPatch.providers[pKey];
      if (prov && typeof prov === 'object' && typeof prov.apiKey === 'string') {
        if (prov.apiKey.trim()) {
          prov.maskedKey = maskApiKey(prov.apiKey);
        }
        delete prov.apiKey;
      }
    }
  }

  const nextVersion = (Number(current.version) || 0) + 1;
  const updated = deepMergeConfig(current, {
    ...sanitizedPatch,
    version: nextVersion,
    updatedAt: new Date().toISOString(),
  });
  inMemoryConfigCache = updated;

  const { configFilePath } = getPaths();
  if (ensureDataDirectory()) {
    try {
      const tempPath = `${configFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(updated, null, 2), 'utf-8');
      fs.renameSync(tempPath, configFilePath);
    } catch (e) {
      console.warn('[ConfigManager] File write failed, retaining in-memory config:', e?.message);
    }
  }

  logAudit(actor, 'UPDATE_CONFIG', { version: nextVersion });
  return updated;
}

export function rollbackPersistentConfig(targetVersion, actor = 'admin') {
  const history = listConfigHistory();
  const match = history.find((item) => Number(item.version) === Number(targetVersion));
  if (!match) {
    return null;
  }
  return savePersistentConfig(
    {
      ...match,
      rolledBackFromVersion: Number(loadPersistentConfig().version) || 1,
    },
    actor
  );
}

export function maskApiKey(keyStr) {
  if (!keyStr || typeof keyStr !== 'string') return '';
  const trimmed = keyStr.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '****' + trimmed.slice(-2);
  return trimmed.slice(0, 6) + '...' + trimmed.slice(-4);
}

export function getSanitizedConfig(config) {
  const sanitized = JSON.parse(JSON.stringify(config || DEFAULT_CONFIG));
  if (sanitized.providers) {
    for (const pKey of Object.keys(sanitized.providers)) {
      const prov = sanitized.providers[pKey];
      if (prov && typeof prov === 'object') {
        if (prov.apiKey) {
          prov.maskedKey = maskApiKey(prov.apiKey);
          delete prov.apiKey;
        }
        if (prov.secret) {
          delete prov.secret;
        }
      }
    }
  }
  delete sanitized.appAccessToken;
  return sanitized;
}

function logAudit(actor, action, details) {
  const { auditLogPath } = getPaths();
  if (!ensureDataDirectory()) return;
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      actor,
      action,
      details,
    };
    fs.appendFileSync(auditLogPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (e) {
    console.warn('[ConfigManager] Failed to write audit log:', e?.message);
  }
}

export function verifyAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const expectedToken = (process.env.APP_ACCESS_TOKEN || '').trim();

  if (!expectedToken || expectedToken.toLowerCase() === 'unset') {
    return next();
  }

  if (token && token.length === expectedToken.length) {
    try {
      const a = Buffer.from(token);
      const b = Buffer.from(expectedToken);
      if (crypto.timingSafeEqual(a, b)) {
        return next();
      }
    } catch (_) {}
  }

  return res.status(401).json({
    code: 'UNAUTHORIZED',
    error: 'Unauthorized: Valid Bearer token required in Authorization header for admin configuration.',
  });
}

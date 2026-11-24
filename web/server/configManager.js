import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, 'data');
const configFilePath = path.resolve(dataDir, 'config_store.json');
const auditLogPath = path.resolve(dataDir, 'config_audit.log');

const DEFAULT_CONFIG_VERSION = 1;

const DEFAULT_CONFIG = {
  version: DEFAULT_CONFIG_VERSION,
  updatedAt: new Date().toISOString(),
  minClientVersionAndroid: "1.0",
  minClientVersionWeb: "2.0.0",
  defaultModel: "gemini-3.8-flash",
  fallbackModel: "gemini-3.8-flash",
  activeProvider: "gemini",
  providers: {
    gemini: { enabled: true, maskedKey: "" },
    groq: { enabled: false, maskedKey: "" },
    openrouter: { enabled: false, maskedKey: "" }
  },
  voice: {
    defaultPreset: "laila_soft",
    neuralTtsEnabled: true,
    speed: 0.90,
    pitch: 0.98
  },
  featureFlags: {
    continuousVoice: true,
    webSearch: true,
    memoryExtraction: true,
    smartReminders: true
  }
};

function ensureDataDirectory() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch (e) {
    console.error('[ConfigManager] Failed to create data dir:', e);
  }
}

export function loadPersistentConfig() {
  ensureDataDirectory();
  try {
    if (fs.existsSync(configFilePath)) {
      const raw = fs.readFileSync(configFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error('[ConfigManager] Failed to load config file, using default:', e);
  }
  return { ...DEFAULT_CONFIG };
}

export function savePersistentConfig(newConfig, actor = 'admin') {
  ensureDataDirectory();
  try {
    const current = loadPersistentConfig();
    const nextVersion = (Number(current.version) || 0) + 1;
    const updated = {
      ...current,
      ...newConfig,
      version: nextVersion,
      updatedAt: new Date().toISOString()
    };

    const tempPath = `${configFilePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(updated, null, 2), 'utf-8');
    fs.renameSync(tempPath, configFilePath);

    logAudit(actor, 'UPDATE_CONFIG', { version: nextVersion });
    return updated;
  } catch (e) {
    console.error('[ConfigManager] Failed to save config file:', e);
    throw e;
  }
}

export function maskApiKey(keyStr) {
  if (!keyStr || typeof keyStr !== 'string') return '';
  const trimmed = keyStr.trim();
  if (trimmed.length <= 8) return '****' + trimmed.slice(-2);
  return trimmed.slice(0, 6) + '...' + trimmed.slice(-4);
}

export function getSanitizedConfig(config) {
  const sanitized = JSON.parse(JSON.stringify(config));
  if (sanitized.providers) {
    for (const pKey of Object.keys(sanitized.providers)) {
      const prov = sanitized.providers[pKey];
      if (prov.apiKey) {
        prov.maskedKey = maskApiKey(prov.apiKey);
        delete prov.apiKey;
      }
    }
  }
  return sanitized;
}

function logAudit(actor, action, details) {
  try {
    ensureDataDirectory();
    const entry = {
      timestamp: new Date().toISOString(),
      actor,
      action,
      details
    };
    fs.appendFileSync(auditLogPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (e) {
    console.error('[ConfigManager] Failed to write audit log:', e);
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
    error: 'Unauthorized: Valid Bearer token required in Authorization header for admin configuration.'
  });
}

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  containsSensitiveSecret,
  normalizeMemoryCategory,
  normalizeMemoryText,
  retrieveRelevantMemories,
  upsertOrMergeMemory,
} from '../src/services/memoryDedupe.js';

export function sanitizeUserNamespace(raw) {
  const cleaned = String(raw || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
  return cleaned || 'default';
}

export function createMemoryStore(options = {}) {
  const defaultPath = process.env.VERCEL
    ? path.join(os.tmpdir(), 'jarvis-memories.json')
    : path.resolve(options.baseDir || process.cwd(), 'data', 'jarvis-memories.json');

  const baseFilePath = options.filePath || defaultPath;
  const caches = new Map();
  const resolvedPaths = new Map();

  function getPathForNamespace(namespace = 'default') {
    const ns = sanitizeUserNamespace(namespace);
    if (resolvedPaths.has(ns)) return resolvedPaths.get(ns);
    if (ns === 'default') {
      resolvedPaths.set(ns, baseFilePath);
      return baseFilePath;
    }
    const dir = path.dirname(baseFilePath);
    const ext = path.extname(baseFilePath) || '.json';
    const base = path.basename(baseFilePath, ext);
    const nsPath = path.join(dir, `${base}.${ns}${ext}`);
    resolvedPaths.set(ns, nsPath);
    return nsPath;
  }

  function loadFromDisk(namespace = 'default') {
    const ns = sanitizeUserNamespace(namespace);
    if (caches.has(ns)) return caches.get(ns);
    const targetPath = getPathForNamespace(ns);
    try {
      if (fs.existsSync(targetPath)) {
        const raw = fs.readFileSync(targetPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          caches.set(ns, parsed);
          return parsed;
        }
      }
    } catch {
      // Initialize clean store if corrupt or unreadable
    }
    const empty = [];
    caches.set(ns, empty);
    return empty;
  }

  function persistToDisk(items, namespace = 'default') {
    const ns = sanitizeUserNamespace(namespace);
    let activePath = getPathForNamespace(ns);
    const writeTo = (targetPath) => {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(items, null, 2), 'utf8');
      fs.renameSync(tmpPath, targetPath);
    };

    try {
      writeTo(activePath);
      caches.set(ns, items);
      return { persisted: true, path: activePath };
    } catch (primaryErr) {
      if (options.disableFallback === true) {
        return {
          persisted: false,
          persistenceError: primaryErr?.message || 'Unable to write memory store to disk.',
        };
      }
      const fallbackPath = path.join(
        os.tmpdir(),
        ns === 'default' ? 'jarvis-memories.json' : `jarvis-memories.${ns}.json`
      );
      if (fallbackPath !== activePath) {
        try {
          writeTo(fallbackPath);
          resolvedPaths.set(ns, fallbackPath);
          caches.set(ns, items);
          return { persisted: true, path: fallbackPath };
        } catch (fallbackErr) {
          return {
            persisted: false,
            persistenceError: fallbackErr?.message || 'Unable to persist memory store.',
          };
        }
      }
      return {
        persisted: false,
        persistenceError: primaryErr?.message || 'Unable to persist memory store.',
      };
    }
  }

  return {
    getAll({ category, recent = false, namespace = 'default' } = {}) {
      let items = [...loadFromDisk(namespace)];
      if (category && category !== 'ALL') {
        const normCat = normalizeMemoryCategory(category);
        items = items.filter((m) => normalizeMemoryCategory(m.category) === normCat);
      }
      items.sort((a, b) => {
        if (recent) {
          return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
        }
        if ((b.importance || 0) !== (a.importance || 0)) {
          return (b.importance || 0) - (a.importance || 0);
        }
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
      return items;
    },

    search({ query = '', category = 'ALL', limit = 20, namespace = 'default' } = {}) {
      let items = [...loadFromDisk(namespace)];
      if (category && category !== 'ALL') {
        const normCat = normalizeMemoryCategory(category);
        items = items.filter((m) => normalizeMemoryCategory(m.category) === normCat);
      }
      const q = normalizeMemoryText(query);
      if (!q) {
        return items
          .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
          .slice(0, limit);
      }
      const directMatches = items.filter((m) => {
        const haystack = normalizeMemoryText(`${m.key} ${m.content} ${m.category}`);
        return haystack.includes(q);
      });
      if (directMatches.length >= limit) {
        return directMatches.slice(0, limit);
      }
      const ranked = retrieveRelevantMemories(query, items, limit);
      const seen = new Set(directMatches.map((m) => m.id));
      return [...directMatches, ...ranked.filter((m) => !seen.has(m.id))].slice(0, limit);
    },

    saveOrMerge(candidate, namespace = 'default') {
      const current = [...loadFromDisk(namespace)];
      const now = Date.now();
      const result = upsertOrMergeMemory(candidate, current, now);

      if (result.status === 'blocked_secret' || result.status === 'invalid') {
        return { ...result, persisted: false };
      }

      if (result.status === 'duplicate') {
        return { ...result, persisted: true };
      }

      if (result.status === 'updated' && result.memory) {
        const next = current.map((m) => (m.id === result.memory.id ? result.memory : m));
        const writeOutcome = persistToDisk(next, namespace);
        if (!writeOutcome.persisted) {
          return {
            status: 'persistence_failed',
            persisted: false,
            reason: writeOutcome.persistenceError || 'Disk persistence failed.',
          };
        }
        return { ...result, persisted: true };
      }

      if (result.status === 'created' && result.memory) {
        const next = [result.memory, ...current];
        const writeOutcome = persistToDisk(next, namespace);
        if (!writeOutcome.persisted) {
          return {
            status: 'persistence_failed',
            persisted: false,
            reason: writeOutcome.persistenceError || 'Disk persistence failed.',
          };
        }
        return { ...result, persisted: true };
      }

      return { status: 'invalid', persisted: false, reason: 'Unable to save memory.' };
    },

    updateById(id, patch, namespace = 'default') {
      const current = [...loadFromDisk(namespace)];
      const idx = current.findIndex((m) => m.id === id);
      if (idx < 0) return { found: false, persisted: false };

      const existing = current[idx];
      const nextKey = patch.key !== undefined ? String(patch.key).trim().slice(0, 64) : existing.key;
      const nextContent =
        patch.content !== undefined ? String(patch.content).trim().slice(0, 320) : existing.content;

      if (!nextKey || !nextContent) {
        return {
          found: true,
          persisted: false,
          error: 'Memory key and content cannot be empty.',
          code: 'INVALID_REQUEST',
        };
      }

      const secretCheck = containsSensitiveSecret(`${nextKey} ${nextContent}`);
      if (secretCheck.blocked) {
        return {
          found: true,
          persisted: false,
          error: secretCheck.reason,
          code: 'SENSITIVE_SECRET_BLOCKED',
        };
      }

      const rawImp = patch.importance !== undefined ? Number(patch.importance) : existing.importance;
      const nextImportance = Number.isFinite(rawImp) ? Math.min(5, Math.max(1, Math.round(rawImp))) : 3;
      const nextCategory =
        patch.category !== undefined ? normalizeMemoryCategory(patch.category) : existing.category;

      const updated = {
        ...existing,
        key: nextKey,
        category: nextCategory,
        content: nextContent,
        importance: nextImportance,
        updatedAt: Date.now(),
      };
      const next = [...current];
      next[idx] = updated;
      const writeOutcome = persistToDisk(next, namespace);
      if (!writeOutcome.persisted) {
        return {
          found: true,
          persisted: false,
          code: 'PERSISTENCE_FAILED',
          error: writeOutcome.persistenceError || 'Failed to persist updated memory.',
        };
      }
      return { found: true, persisted: true, memory: updated };
    },

    deleteById(id, namespace = 'default') {
      const current = [...loadFromDisk(namespace)];
      const existed = current.some((m) => m.id === id);
      if (!existed) return false;
      const writeOutcome = persistToDisk(
        current.filter((m) => m.id !== id),
        namespace
      );
      return writeOutcome.persisted;
    },

    clearAll(namespace = 'default') {
      const count = loadFromDisk(namespace).length;
      const writeOutcome = persistToDisk([], namespace);
      if (!writeOutcome.persisted) {
        throw new Error(writeOutcome.persistenceError || 'Failed to clear persisted memories.');
      }
      return count;
    },

    mergeBatch(incoming = [], namespace = 'default') {
      let added = 0;
      let updated = 0;
      let skipped = 0;
      for (const item of Array.isArray(incoming) ? incoming : []) {
        if (!item || typeof item !== 'object') continue;
        const outcome = this.saveOrMerge(item, namespace);
        if (outcome.status === 'created') added += 1;
        else if (outcome.status === 'updated') updated += 1;
        else skipped += 1;
      }
      return { added, updated, skipped, memories: this.getAll({ namespace }) };
    },
  };
}

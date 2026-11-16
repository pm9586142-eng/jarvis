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

export function createMemoryStore(options = {}) {
  const defaultPath = process.env.VERCEL
    ? path.join(os.tmpdir(), 'jarvis-memories.json')
    : path.resolve(options.baseDir || process.cwd(), 'data', 'jarvis-memories.json');

  let activePath = options.filePath || defaultPath;
  let cache = null;

  function loadFromDisk() {
    if (cache !== null) return cache;
    try {
      if (fs.existsSync(activePath)) {
        const raw = fs.readFileSync(activePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cache = parsed;
          return cache;
        }
      }
    } catch {
      // Initialize clean store if corrupt or unreadable
    }
    cache = [];
    return cache;
  }

  function persistToDisk(items) {
    cache = items;
    const writeTo = (targetPath) => {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const tmpPath = `${targetPath}.${process.pid}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(items, null, 2), 'utf8');
      fs.renameSync(tmpPath, targetPath);
    };

    try {
      writeTo(activePath);
    } catch {
      // Fallback to OS temp dir if workspace filesystem is read-only (e.g. serverless)
      const fallbackPath = path.join(os.tmpdir(), 'jarvis-memories.json');
      if (fallbackPath !== activePath) {
        activePath = fallbackPath;
        try {
          writeTo(activePath);
        } catch {
          // Retain in-memory cache cleanly if disk is unavailable
        }
      }
    }
  }

  return {
    getAll({ category, recent = false } = {}) {
      let items = [...loadFromDisk()];
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

    search({ query = '', category = 'ALL', limit = 20 } = {}) {
      let items = [...loadFromDisk()];
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

    saveOrMerge(candidate) {
      const current = [...loadFromDisk()];
      const now = Date.now();
      const result = upsertOrMergeMemory(candidate, current, now);

      if (result.status === 'blocked_secret' || result.status === 'invalid') {
        return result;
      }

      if (result.status === 'duplicate') {
        return result;
      }

      if (result.status === 'updated' && result.memory) {
        const next = current.map((m) => (m.id === result.memory.id ? result.memory : m));
        persistToDisk(next);
        return result;
      }

      if (result.status === 'created' && result.memory) {
        const next = [result.memory, ...current];
        persistToDisk(next);
        return result;
      }

      return { status: 'invalid', reason: 'Unable to save memory.' };
    },

    updateById(id, patch) {
      const current = [...loadFromDisk()];
      const idx = current.findIndex((m) => m.id === id);
      if (idx < 0) return { found: false };

      const existing = current[idx];
      const nextKey = patch.key !== undefined ? String(patch.key).trim().slice(0, 64) : existing.key;
      const nextContent =
        patch.content !== undefined ? String(patch.content).trim().slice(0, 320) : existing.content;

      if (!nextKey || !nextContent) {
        return { found: true, error: 'Memory key and content cannot be empty.', code: 'INVALID_REQUEST' };
      }

      const secretCheck = containsSensitiveSecret(`${nextKey} ${nextContent}`);
      if (secretCheck.blocked) {
        return { found: true, error: secretCheck.reason, code: 'SENSITIVE_SECRET_BLOCKED' };
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
      persistToDisk(next);
      return { found: true, memory: updated };
    },

    deleteById(id) {
      const current = [...loadFromDisk()];
      const existed = current.some((m) => m.id === id);
      if (!existed) return false;
      persistToDisk(current.filter((m) => m.id !== id));
      return true;
    },

    clearAll() {
      const count = loadFromDisk().length;
      persistToDisk([]);
      return count;
    },
  };
}

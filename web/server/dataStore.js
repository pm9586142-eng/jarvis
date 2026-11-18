import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { sanitizeUserNamespace } from './memoryStore.js';

const VALID_PRIORITIES = new Set(['HIGH', 'MEDIUM', 'LOW']);
const VALID_TASK_CATEGORIES = new Set(['REMINDER', 'TASK', 'SCHEDULE', 'NOTE']);

function createEmptyState() {
  return {
    tasks: [],
    notes: [],
    automations: [],
    quickActions: [],
    updatedAt: Date.now(),
  };
}

function sanitizeTask(input = {}, existing = null) {
  const now = Date.now();
  const title = String(input.title ?? existing?.title ?? '').trim().slice(0, 140);
  if (!title) return null;
  const description = String(input.description ?? existing?.description ?? '').trim().slice(0, 1000);
  const dueTime = String(input.dueTime ?? existing?.dueTime ?? 'Scheduled').trim().slice(0, 120);
  const rawPriority = String(input.priority ?? existing?.priority ?? 'MEDIUM').toUpperCase();
  const priority = VALID_PRIORITIES.has(rawPriority) ? rawPriority : 'MEDIUM';
  const rawCategory = String(input.category ?? existing?.category ?? 'TASK').toUpperCase();
  const category = VALID_TASK_CATEGORIES.has(rawCategory) ? rawCategory : 'TASK';
  const triggerAtMillis =
    typeof input.triggerAtMillis === 'number' && Number.isFinite(input.triggerAtMillis)
      ? input.triggerAtMillis
      : existing?.triggerAtMillis ?? null;
  const isCompleted =
    typeof input.isCompleted === 'boolean'
      ? input.isCompleted
      : typeof input.completed === 'boolean'
        ? input.completed
        : Boolean(existing?.isCompleted);
  const isDeleted =
    typeof input.isDeleted === 'boolean'
      ? input.isDeleted
      : typeof input.deleted === 'boolean'
        ? input.deleted
        : Boolean(existing?.isDeleted);

  return {
    id: String(input.id || existing?.id || `task_${now}_${crypto.randomBytes(3).toString('hex')}`).slice(0, 96),
    title,
    description,
    dueTime,
    triggerAtMillis,
    isCompleted,
    priority,
    category,
    isDeleted,
    createdAt: Number.isFinite(Number(input.createdAt))
      ? Number(input.createdAt)
      : existing?.createdAt || now,
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : now,
  };
}

function sanitizeNote(input = {}, existing = null) {
  const now = Date.now();
  const title = String(input.title ?? existing?.title ?? '').trim().slice(0, 140);
  const content = String(input.content ?? existing?.content ?? '').trim().slice(0, 8000);
  if (!title && !content) return null;
  const tags = Array.isArray(input.tags)
    ? input.tags
        .map((t) => String(t || '').trim().slice(0, 32))
        .filter(Boolean)
        .slice(0, 8)
    : existing?.tags || [];

  return {
    id: String(input.id || existing?.id || `note_${now}_${crypto.randomBytes(3).toString('hex')}`).slice(0, 96),
    title: title || 'Untitled Note',
    content,
    tags,
    isDeleted: Boolean(input.isDeleted ?? existing?.isDeleted ?? false),
    createdAt: Number.isFinite(Number(input.createdAt))
      ? Number(input.createdAt)
      : existing?.createdAt || now,
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : now,
  };
}

function sanitizeAutomation(input = {}) {
  const now = Date.now();
  const actionType = String(input.actionType || 'QUICK_COMMAND').trim().slice(0, 64);
  const label = String(input.label || actionType).trim().slice(0, 140);
  const target = String(input.target || '').trim().slice(0, 400);
  const status = ['EXECUTED', 'CONFIRMED', 'CANCELLED', 'UNSUPPORTED', 'FAILED'].includes(
    String(input.status || '').toUpperCase()
  )
    ? String(input.status).toUpperCase()
    : 'EXECUTED';
  const detail = String(input.detail || '').trim().slice(0, 500);

  return {
    id: String(input.id || `auto_${now}_${crypto.randomBytes(3).toString('hex')}`).slice(0, 96),
    actionType,
    label,
    target,
    status,
    confirmedByUser: Boolean(input.confirmedByUser),
    detail,
    timestamp: Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : now,
  };
}

export function createDataStore(options = {}) {
  const defaultPath = process.env.VERCEL
    ? path.join(os.tmpdir(), 'jarvis-workspace.json')
    : path.resolve(options.baseDir || process.cwd(), 'data', 'jarvis-workspace.json');

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

  function loadState(namespace = 'default') {
    const ns = sanitizeUserNamespace(namespace);
    if (caches.has(ns)) return caches.get(ns);
    const targetPath = getPathForNamespace(ns);
    try {
      if (fs.existsSync(targetPath)) {
        const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          const hydrated = {
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
            notes: Array.isArray(parsed.notes) ? parsed.notes : [],
            automations: Array.isArray(parsed.automations) ? parsed.automations : [],
            quickActions: Array.isArray(parsed.quickActions) ? parsed.quickActions : [],
            updatedAt: Number(parsed.updatedAt) || Date.now(),
          };
          caches.set(ns, hydrated);
          return hydrated;
        }
      }
    } catch {
      // Fall back to empty state on corruption
    }
    const fresh = createEmptyState();
    caches.set(ns, fresh);
    return fresh;
  }

  function persistState(state, namespace = 'default') {
    const ns = sanitizeUserNamespace(namespace);
    const nextState = { ...state, updatedAt: Date.now() };
    const activePath = getPathForNamespace(ns);
    const writeTo = (targetPath) => {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(nextState, null, 2), 'utf8');
      fs.renameSync(tmpPath, targetPath);
    };

    try {
      writeTo(activePath);
      caches.set(ns, nextState);
      return { persisted: true };
    } catch (err) {
      const fallbackPath = path.join(
        os.tmpdir(),
        ns === 'default' ? 'jarvis-workspace.json' : `jarvis-workspace.${ns}.json`
      );
      if (fallbackPath !== activePath) {
        try {
          writeTo(fallbackPath);
          resolvedPaths.set(ns, fallbackPath);
          caches.set(ns, nextState);
          return { persisted: true };
        } catch (fallbackErr) {
          return { persisted: false, error: fallbackErr?.message || 'Workspace persistence failed.' };
        }
      }
      return { persisted: false, error: err?.message || 'Workspace persistence failed.' };
    }
  }

  return {
    getTasks(namespace = 'default', { includeDeleted = false } = {}) {
      const state = loadState(namespace);
      return state.tasks
        .filter((t) => includeDeleted || !t.isDeleted)
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    },

    upsertTask(input, namespace = 'default') {
      const state = loadState(namespace);
      const existing = input?.id ? state.tasks.find((t) => t.id === input.id) : null;
      const sanitized = sanitizeTask(input, existing);
      if (!sanitized) return { ok: false, error: 'Task title is required.' };

      const nextTasks = existing
        ? state.tasks.map((t) => (t.id === existing.id ? sanitized : t))
        : [sanitized, ...state.tasks];
      const save = persistState({ ...state, tasks: nextTasks }, namespace);
      if (!save.persisted) return { ok: false, error: save.error || 'Failed to persist task.' };
      return { ok: true, task: sanitized, created: !existing };
    },

    deleteTask(id, namespace = 'default') {
      const state = loadState(namespace);
      const existing = state.tasks.find((t) => t.id === id);
      if (!existing) return { found: false, ok: false };
      const now = Date.now();
      const nextTasks = state.tasks.map((t) =>
        t.id === id ? { ...t, isDeleted: true, updatedAt: now } : t
      );
      const save = persistState({ ...state, tasks: nextTasks }, namespace);
      return { found: true, ok: save.persisted, error: save.error };
    },

    getNotes(namespace = 'default', { includeDeleted = false } = {}) {
      const state = loadState(namespace);
      return state.notes
        .filter((n) => includeDeleted || !n.isDeleted)
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    },

    upsertNote(input, namespace = 'default') {
      const state = loadState(namespace);
      const existing = input?.id ? state.notes.find((n) => n.id === input.id) : null;
      const sanitized = sanitizeNote(input, existing);
      if (!sanitized) return { ok: false, error: 'Note title or content is required.' };

      const nextNotes = existing
        ? state.notes.map((n) => (n.id === existing.id ? sanitized : n))
        : [sanitized, ...state.notes];
      const save = persistState({ ...state, notes: nextNotes }, namespace);
      if (!save.persisted) return { ok: false, error: save.error || 'Failed to persist note.' };
      return { ok: true, note: sanitized, created: !existing };
    },

    deleteNote(id, namespace = 'default') {
      const state = loadState(namespace);
      const existing = state.notes.find((n) => n.id === id);
      if (!existing) return { found: false, ok: false };
      const nextNotes = state.notes.map((n) =>
        n.id === id ? { ...n, isDeleted: true, updatedAt: Date.now() } : n
      );
      const save = persistState({ ...state, notes: nextNotes }, namespace);
      return { found: true, ok: save.persisted, error: save.error };
    },

    getAutomations(namespace = 'default', limit = 60) {
      const state = loadState(namespace);
      return state.automations
        .slice()
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, limit);
    },

    recordAutomation(input, namespace = 'default') {
      const state = loadState(namespace);
      const entry = sanitizeAutomation(input);
      const nextAutomations = [entry, ...state.automations].slice(0, 150);
      const save = persistState({ ...state, automations: nextAutomations }, namespace);
      if (!save.persisted) return { ok: false, error: save.error || 'Failed to record automation.' };
      return { ok: true, entry };
    },

    mergeSyncSnapshot({ tasks = [], notes = [], automations = [] } = {}, namespace = 'default') {
      const state = loadState(namespace);
      const taskMap = new Map(state.tasks.map((t) => [t.id, t]));
      for (const incoming of Array.isArray(tasks) ? tasks : []) {
        const sanitized = sanitizeTask(incoming, taskMap.get(incoming?.id));
        if (!sanitized) continue;
        const existing = taskMap.get(sanitized.id);
        if (!existing || sanitized.updatedAt >= (existing.updatedAt || existing.createdAt || 0)) {
          // Tombstone stays deleted once marked deleted
          if (existing?.isDeleted && !sanitized.isDeleted && sanitized.updatedAt <= existing.updatedAt) {
            continue;
          }
          taskMap.set(sanitized.id, sanitized);
        }
      }

      const noteMap = new Map(state.notes.map((n) => [n.id, n]));
      for (const incoming of Array.isArray(notes) ? notes : []) {
        const sanitized = sanitizeNote(incoming, noteMap.get(incoming?.id));
        if (!sanitized) continue;
        const existing = noteMap.get(sanitized.id);
        if (!existing || sanitized.updatedAt >= (existing.updatedAt || existing.createdAt || 0)) {
          noteMap.set(sanitized.id, sanitized);
        }
      }

      const autoMap = new Map(state.automations.map((a) => [a.id, a]));
      for (const incoming of Array.isArray(automations) ? automations : []) {
        const sanitized = sanitizeAutomation(incoming);
        if (!autoMap.has(sanitized.id)) {
          autoMap.set(sanitized.id, sanitized);
        }
      }

      const nextState = {
        ...state,
        tasks: Array.from(taskMap.values()).sort(
          (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
        ),
        notes: Array.from(noteMap.values()).sort(
          (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
        ),
        automations: Array.from(autoMap.values())
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          .slice(0, 150),
      };

      const save = persistState(nextState, namespace);
      return {
        persisted: save.persisted,
        error: save.error,
        tasks: nextState.tasks.filter((t) => !t.isDeleted),
        notes: nextState.notes.filter((n) => !n.isDeleted),
        automations: nextState.automations,
        syncedAt: Date.now(),
      };
    },
  };
}

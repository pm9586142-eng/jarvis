import { ChatMessage, ChatSession, MemoryItem, TaskItem } from '../types/jarvis';
import { isNearDuplicateMemory } from './memoryDedupe';

export const BACKUP_SCHEMA = 'jarvis_backup_v1';

export interface JarvisBackupPayload {
  schema: string;
  exportedAt: string;
  app: string;
  sessions: ChatSession[];
  memories: MemoryItem[];
  tasks: TaskItem[];
}

export interface BackupImportPreview {
  valid: boolean;
  errors: string[];
  warnings: string[];
  exportedAt?: string;
  sessionsToAdd: ChatSession[];
  skippedSessionsCount: number;
  memoriesToAdd: MemoryItem[];
  duplicateMemoriesCount: number;
  tasksToAdd: TaskItem[];
  skippedTasksCount: number;
}

const ALLOWED_MEMORY_CATEGORIES = new Set<MemoryItem['category']>([
  'PREFERENCE',
  'PROJECT',
  'INSTRUCTION',
  'TOPIC',
  'DECISION',
  'COMMAND',
  'FACT',
]);

const ALLOWED_PRIORITIES = new Set<TaskItem['priority']>(['HIGH', 'MEDIUM', 'LOW']);
const ALLOWED_TASK_CATEGORIES = new Set<TaskItem['category']>(['TASK', 'REMINDER', 'SCHEDULE']);

function buildStamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes()
  ).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildBackupJson(data: {
  sessions: ChatSession[];
  memories: MemoryItem[];
  tasks: TaskItem[];
}): { content: string; filename: string; mimeType: string } {
  const payload: JarvisBackupPayload = {
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    app: 'JARVIS AI',
    sessions: data.sessions,
    memories: data.memories,
    tasks: data.tasks,
  };
  return {
    content: JSON.stringify(payload, null, 2),
    filename: `jarvis-backup-${buildStamp()}.json`,
    mimeType: 'application/json;charset=utf-8',
  };
}

export function buildBackupMarkdown(data: {
  sessions: ChatSession[];
  memories: MemoryItem[];
  tasks: TaskItem[];
}): { content: string; filename: string; mimeType: string } {
  const lines: string[] = [
    '# J.A.R.V.I.S. Neural Vault Backup',
    '',
    `- **Exported**: ${new Date().toISOString()}`,
    `- **Chat Sessions**: ${data.sessions.length}`,
    `- **Memory Vault Facts**: ${data.memories.length}`,
    `- **Tasks & Reminders**: ${data.tasks.length}`,
    '',
    '---',
    '',
    '## Memory Vault',
    '',
  ];

  if (data.memories.length === 0) {
    lines.push('_No stored memories._', '');
  } else {
    for (const m of data.memories) {
      lines.push(`- **[${m.category}] ${m.key}** (Importance ${m.importance}/5): ${m.content}`);
    }
    lines.push('');
  }

  lines.push('---', '', '## Tasks & Reminders', '');
  if (data.tasks.length === 0) {
    lines.push('_No tasks or reminders._', '');
  } else {
    for (const t of data.tasks) {
      const box = t.isCompleted ? 'x' : ' ';
      lines.push(`- [${box}] **${t.title}** (${t.priority} • ${t.category} • ${t.dueTime})${t.description ? ` — ${t.description}` : ''}`);
    }
    lines.push('');
  }

  lines.push('---', '', '## Chat Sessions', '');
  if (data.sessions.length === 0) {
    lines.push('_No chat sessions._', '');
  } else {
    for (const s of data.sessions) {
      lines.push(`### ${s.title} (${s.messages.length} messages)`);
      lines.push('');
      for (const msg of s.messages) {
        const speaker = msg.role === 'user' ? 'Sir' : msg.agentCodename || 'JARVIS';
        const ts = new Date(msg.timestamp || Date.now()).toLocaleString();
        lines.push(`#### ${speaker} · ${ts}`);
        lines.push('');
        lines.push(msg.text || '');
        lines.push('');
      }
      lines.push('---', '');
    }
  }

  return {
    content: lines.join('\n'),
    filename: `jarvis-backup-${buildStamp()}.md`,
    mimeType: 'text/markdown;charset=utf-8',
  };
}

function sanitizeMessage(raw: unknown, fallbackSessionId: string, index: number): ChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const text = typeof obj.text === 'string' ? obj.text.trim() : '';
  if (!text) return null;
  const roleRaw = String(obj.role || '').toLowerCase();
  const role: 'user' | 'jarvis' = roleRaw === 'user' ? 'user' : 'jarvis';
  const ts = typeof obj.timestamp === 'number' && Number.isFinite(obj.timestamp)
    ? obj.timestamp
    : Date.now() + index;
  return {
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `imp_msg_${ts}_${index}`,
    sessionId: fallbackSessionId,
    role,
    text,
    agentCodename:
      typeof obj.agentCodename === 'string' && obj.agentCodename.trim()
        ? obj.agentCodename.trim()
        : role === 'user'
        ? 'Sir'
        : 'JARVIS',
    timestamp: ts,
    isVoice: Boolean(obj.isVoice),
    isError: Boolean(obj.isError),
  };
}

export function validateAndPrepareBackupImport(
  rawJson: string,
  existingMemories: MemoryItem[],
  existingSessions: ChatSession[],
  existingTasks: TaskItem[]
): BackupImportPreview {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawJson || !rawJson.trim()) {
    return {
      valid: false,
      errors: ['Backup file is empty.'],
      warnings,
      sessionsToAdd: [],
      skippedSessionsCount: 0,
      memoriesToAdd: [],
      duplicateMemoriesCount: 0,
      tasksToAdd: [],
      skippedTasksCount: 0,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    return {
      valid: false,
      errors: [`Invalid JSON syntax: ${err instanceof Error ? err.message : 'parse error'}`],
      warnings,
      sessionsToAdd: [],
      skippedSessionsCount: 0,
      memoriesToAdd: [],
      duplicateMemoriesCount: 0,
      tasksToAdd: [],
      skippedTasksCount: 0,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ['Backup root must be a JSON object.'],
      warnings,
      sessionsToAdd: [],
      skippedSessionsCount: 0,
      memoriesToAdd: [],
      duplicateMemoriesCount: 0,
      tasksToAdd: [],
      skippedTasksCount: 0,
    };
  }

  const root = parsed as Record<string, unknown>;
  const exportedAt = typeof root.exportedAt === 'string' ? root.exportedAt : undefined;

  if (root.schema && root.schema !== BACKUP_SCHEMA) {
    warnings.push(`Unknown schema tag "${String(root.schema)}". Attempting compatible import.`);
  }

  const hasKnownSection =
    Array.isArray(root.sessions) ||
    Array.isArray(root.memories) ||
    Array.isArray(root.tasks) ||
    Array.isArray(root.messages);

  if (!hasKnownSection) {
    return {
      valid: false,
      errors: ['No recognizable sessions, messages, memories, or tasks arrays found in JSON.'],
      warnings,
      exportedAt,
      sessionsToAdd: [],
      skippedSessionsCount: 0,
      memoriesToAdd: [],
      duplicateMemoriesCount: 0,
      tasksToAdd: [],
      skippedTasksCount: 0,
    };
  }

  // Validate sessions (also support legacy single-transcript export { messages: [...] })
  const existingSessionIds = new Set(existingSessions.map((s) => s.id));
  const sessionsToAdd: ChatSession[] = [];
  let skippedSessionsCount = 0;

  const rawSessions: unknown[] = Array.isArray(root.sessions)
    ? root.sessions
    : Array.isArray(root.messages)
    ? [
        {
          id: `imp_transcript_${Date.now()}`,
          title: `Imported Transcript (${new Date().toLocaleDateString()})`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: root.messages,
        },
      ]
    : [];

  rawSessions.forEach((rawSession, sIdx) => {
    if (!rawSession || typeof rawSession !== 'object') {
      warnings.push(`Skipped malformed session entry at index ${sIdx}.`);
      return;
    }
    const obj = rawSession as Record<string, unknown>;
    const rawMsgs = Array.isArray(obj.messages) ? obj.messages : [];
    const baseId =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim()
        : `imp_session_${Date.now()}_${sIdx}`;
    const existingMatch = existingSessions.find((s) => s.id === baseId);
    if (existingMatch && existingMatch.messages.length >= rawMsgs.length) {
      skippedSessionsCount++;
      return;
    }
    const finalId = existingSessionIds.has(baseId) ? `${baseId}_imp_${Date.now()}` : baseId;
    const msgs = rawMsgs
      .map((m, mIdx) => sanitizeMessage(m, finalId, mIdx))
      .filter((m): m is ChatMessage => m !== null);

    if (msgs.length === 0 && typeof obj.title !== 'string') {
      warnings.push(`Skipped empty chat session at index ${sIdx}.`);
      return;
    }

    const now = Date.now();
    sessionsToAdd.push({
      id: finalId,
      title:
        typeof obj.title === 'string' && obj.title.trim()
          ? obj.title.trim().slice(0, 64)
          : `Imported Session ${sIdx + 1}`,
      createdAt:
        typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) ? obj.createdAt : now,
      updatedAt:
        typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : now,
      messages: msgs,
    });
    existingSessionIds.add(finalId);
  });

  // Validate memories with near-duplicate filtering
  const memoriesToAdd: MemoryItem[] = [];
  let duplicateMemoriesCount = 0;
  const memoryPool = [...existingMemories];

  if (Array.isArray(root.memories)) {
    root.memories.forEach((rawMem, idx) => {
      if (!rawMem || typeof rawMem !== 'object') {
        warnings.push(`Skipped malformed memory item at index ${idx}.`);
        return;
      }
      const obj = rawMem as Record<string, unknown>;
      const key = typeof obj.key === 'string' ? obj.key.trim().slice(0, 64) : '';
      const content = typeof obj.content === 'string' ? obj.content.trim().slice(0, 400) : '';
      if (!key || !content) {
        warnings.push(`Skipped memory #${idx + 1} missing required key or content.`);
        return;
      }

      if (isNearDuplicateMemory({ key, content }, memoryPool)) {
        duplicateMemoriesCount++;
        return;
      }

      const rawCat = String(obj.category || 'FACT').trim().toUpperCase() as MemoryItem['category'];
      const category = ALLOWED_MEMORY_CATEGORIES.has(rawCat) ? rawCat : 'FACT';
      const impNum = Number(obj.importance);
      const importance = Number.isFinite(impNum) ? Math.min(5, Math.max(1, Math.round(impNum))) : 3;

      const candidate: MemoryItem = {
        id: `mem_imp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        key,
        category,
        content,
        importance,
        createdAt:
          typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt)
            ? obj.createdAt
            : Date.now(),
      };
      memoriesToAdd.push(candidate);
      memoryPool.push(candidate);
    });
  }

  // Validate tasks
  const tasksToAdd: TaskItem[] = [];
  let skippedTasksCount = 0;
  const existingTaskTitles = new Set(existingTasks.map((t) => `${t.title.trim().toLowerCase()}::${t.dueTime.trim().toLowerCase()}`));

  if (Array.isArray(root.tasks)) {
    root.tasks.forEach((rawTask, idx) => {
      if (!rawTask || typeof rawTask !== 'object') {
        warnings.push(`Skipped malformed task at index ${idx}.`);
        return;
      }
      const obj = rawTask as Record<string, unknown>;
      const title = typeof obj.title === 'string' ? obj.title.trim().slice(0, 140) : '';
      if (!title) {
        warnings.push(`Skipped task #${idx + 1} missing title.`);
        return;
      }
      const dueTime = typeof obj.dueTime === 'string' && obj.dueTime.trim() ? obj.dueTime.trim() : 'Unscheduled';
      const sig = `${title.toLowerCase()}::${dueTime.toLowerCase()}`;
      if (existingTaskTitles.has(sig)) {
        skippedTasksCount++;
        return;
      }

      const rawPrio = String(obj.priority || 'MEDIUM').trim().toUpperCase() as TaskItem['priority'];
      const rawCat = String(obj.category || 'TASK').trim().toUpperCase() as TaskItem['category'];

      tasksToAdd.push({
        id: `task_imp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        title,
        description: typeof obj.description === 'string' ? obj.description.trim() : '',
        dueTime,
        triggerAtMillis:
          typeof obj.triggerAtMillis === 'number' && Number.isFinite(obj.triggerAtMillis)
            ? obj.triggerAtMillis
            : undefined,
        isCompleted: Boolean(obj.isCompleted),
        priority: ALLOWED_PRIORITIES.has(rawPrio) ? rawPrio : 'MEDIUM',
        category: ALLOWED_TASK_CATEGORIES.has(rawCat) ? rawCat : 'TASK',
        createdAt:
          typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt)
            ? obj.createdAt
            : Date.now(),
      });
      existingTaskTitles.add(sig);
    });
  }

  const totalToAdd = sessionsToAdd.length + memoriesToAdd.length + tasksToAdd.length;
  const totalSkipped = skippedSessionsCount + duplicateMemoriesCount + skippedTasksCount;
  if (totalToAdd === 0 && totalSkipped === 0) {
    errors.push('No valid chat sessions, memories, or tasks could be parsed from this file.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    exportedAt,
    sessionsToAdd,
    skippedSessionsCount,
    memoriesToAdd,
    duplicateMemoriesCount,
    tasksToAdd,
    skippedTasksCount,
  };
}

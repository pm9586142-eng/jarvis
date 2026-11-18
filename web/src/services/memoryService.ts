import { ChatSession, MemoryCategory, MemoryItem } from '../types/jarvis';
import { getActiveUserNamespace, getStoredAccessToken, resolveApiUrl } from './api';
import {
  containsSensitiveSecret,
  normalizeMemoryCategory,
  normalizeMemoryText,
  parseMemoryCommand,
  retrieveRelevantConversations,
  retrieveRelevantMemories,
  upsertOrMergeMemory,
} from './memoryDedupe';

export interface MemoryMutationOutcome {
  ok: boolean;
  status:
    | 'created'
    | 'updated'
    | 'duplicate'
    | 'deleted'
    | 'cleared'
    | 'blocked_secret'
    | 'persistence_failed'
    | 'error';
  syncedWithBackend: boolean;
  memory?: MemoryItem;
  replacedMemoryId?: string;
  deletedId?: string;
  message: string;
}

export interface MemoryCommandExecutionResult {
  handled: boolean;
  replyText?: string;
  nextMemories?: MemoryItem[];
  syncedWithBackend?: boolean;
  needsClarification?: boolean;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Jarvis-User-Id': getActiveUserNamespace(),
  };
  const token = getStoredAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchServerMemories(): Promise<{ ok: boolean; memories: MemoryItem[] }> {
  try {
    const res = await fetch(resolveApiUrl('/api/memory'), {
      method: 'GET',
      headers: buildHeaders(),
    });
    if (!res.ok) return { ok: false, memories: [] };
    const data = (await res.json()) as { memories?: MemoryItem[] };
    return {
      ok: true,
      memories: Array.isArray(data?.memories) ? data.memories : [],
    };
  } catch {
    return { ok: false, memories: [] };
  }
}

export async function saveMemoryWithSync(params: {
  candidate: {
    id?: string;
    key: string;
    category: MemoryCategory;
    content: string;
    importance: number;
    createdAt?: number;
    updatedAt?: number;
  };
  currentMemories: MemoryItem[];
}): Promise<{ outcome: MemoryMutationOutcome; nextMemories: MemoryItem[] }> {
  const { candidate, currentMemories } = params;
  const localResult = upsertOrMergeMemory(candidate, currentMemories, Date.now());

  if (localResult.status === 'blocked_secret') {
    return {
      outcome: {
        ok: false,
        status: 'blocked_secret',
        syncedWithBackend: false,
        message: localResult.reason || 'Sensitive credentials cannot be saved to memory.',
      },
      nextMemories: currentMemories,
    };
  }

  if (localResult.status === 'invalid') {
    return {
      outcome: {
        ok: false,
        status: 'error',
        syncedWithBackend: false,
        message: localResult.reason || 'Invalid memory entry.',
      },
      nextMemories: currentMemories,
    };
  }

  let serverMemory: MemoryItem | undefined;
  let serverStatus: 'created' | 'updated' | 'duplicate' | null = null;
  let syncedWithBackend = false;

  try {
    const res = await fetch(resolveApiUrl('/api/memory'), {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(localResult.memory || candidate),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        status?: 'created' | 'updated' | 'duplicate';
        memory?: MemoryItem;
        persisted?: boolean;
      };
      if (data?.persisted === false) {
        return {
          outcome: {
            ok: false,
            status: 'persistence_failed',
            syncedWithBackend: false,
            message: 'Server failed to persist memory to durable storage. Nothing was falsely confirmed.',
          },
          nextMemories: currentMemories,
        };
      }
      if (data?.memory) {
        serverMemory = data.memory;
        serverStatus = data.status || 'created';
        syncedWithBackend = true;
      }
    } else if (res.status === 400) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (errData.code === 'SENSITIVE_SECRET_BLOCKED') {
        return {
          outcome: {
            ok: false,
            status: 'blocked_secret',
            syncedWithBackend: true,
            message: errData.error || 'Blocked sensitive secret.',
          },
          nextMemories: currentMemories,
        };
      }
    } else if (res.status >= 500) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (errData.code === 'PERSISTENCE_FAILED') {
        return {
          outcome: {
            ok: false,
            status: 'persistence_failed',
            syncedWithBackend: false,
            message:
              errData.error ||
              'Server durable storage write failed. Memory was NOT saved to server.',
          },
          nextMemories: currentMemories,
        };
      }
    }
  } catch {
    // Graceful local-first fallback when backend is offline
  }

  const finalStatus = serverStatus || (localResult.status as 'created' | 'updated' | 'duplicate');
  const finalMemory = serverMemory || localResult.memory || undefined;

  if (finalStatus === 'duplicate') {
    return {
      outcome: {
        ok: true,
        status: 'duplicate',
        syncedWithBackend,
        memory: finalMemory,
        message: `Memory "${finalMemory?.key || candidate.key}" is already stored in your Memory Vault.`,
      },
      nextMemories: currentMemories,
    };
  }

  if (!finalMemory) {
    return {
      outcome: {
        ok: false,
        status: 'error',
        syncedWithBackend,
        message: 'Could not persist memory.',
      },
      nextMemories: currentMemories,
    };
  }

  let nextMemories: MemoryItem[];
  if (finalStatus === 'updated' || localResult.replacedMemory) {
    const targetId = localResult.replacedMemory?.id || finalMemory.id;
    const replaced = currentMemories.some((m) => m.id === targetId);
    nextMemories = replaced
      ? currentMemories.map((m) => (m.id === targetId ? finalMemory : m))
      : [finalMemory, ...currentMemories];
  } else {
    nextMemories = [finalMemory, ...currentMemories.filter((m) => m.id !== finalMemory.id)];
  }

  return {
    outcome: {
      ok: true,
      status: finalStatus,
      syncedWithBackend,
      memory: finalMemory,
      replacedMemoryId: localResult.replacedMemory?.id,
      message:
        finalStatus === 'updated'
          ? `Updated saved memory "${finalMemory.key}" to: ${finalMemory.content}`
          : `Saved new memory "${finalMemory.key}": ${finalMemory.content}`,
    },
    nextMemories,
  };
}

export async function updateMemoryByIdWithSync(params: {
  id: string;
  patch: Partial<Pick<MemoryItem, 'key' | 'category' | 'content' | 'importance'>>;
  currentMemories: MemoryItem[];
}): Promise<{ outcome: MemoryMutationOutcome; nextMemories: MemoryItem[] }> {
  const { id, patch, currentMemories } = params;
  const target = currentMemories.find((m) => m.id === id);
  if (!target) {
    return {
      outcome: {
        ok: false,
        status: 'error',
        syncedWithBackend: false,
        message: 'Target memory was not found.',
      },
      nextMemories: currentMemories,
    };
  }

  const nextKey = (patch.key !== undefined ? patch.key : target.key).trim();
  const nextContent = (patch.content !== undefined ? patch.content : target.content).trim();
  if (!nextKey || !nextContent) {
    return {
      outcome: {
        ok: false,
        status: 'error',
        syncedWithBackend: false,
        message: 'Both memory title and detail are required.',
      },
      nextMemories: currentMemories,
    };
  }

  const secretCheck = containsSensitiveSecret(`${nextKey} ${nextContent}`);
  if (secretCheck.blocked) {
    return {
      outcome: {
        ok: false,
        status: 'blocked_secret',
        syncedWithBackend: false,
        message: secretCheck.reason || 'Sensitive credentials cannot be saved to memory.',
      },
      nextMemories: currentMemories,
    };
  }

  const now = Date.now();
  const localUpdated: MemoryItem = {
    ...target,
    key: nextKey.slice(0, 64),
    category: patch.category ? normalizeMemoryCategory(patch.category) : target.category,
    content: nextContent.slice(0, 320),
    importance:
      patch.importance !== undefined
        ? Math.min(5, Math.max(1, Math.round(patch.importance)))
        : target.importance,
    updatedAt: now,
  };

  let syncedWithBackend = false;
  let finalUpdated = localUpdated;

  try {
    const res = await fetch(resolveApiUrl(`/api/memory/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify({
        key: localUpdated.key,
        category: localUpdated.category,
        content: localUpdated.content,
        importance: localUpdated.importance,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { memory?: MemoryItem };
      if (data?.memory) finalUpdated = data.memory;
      syncedWithBackend = true;
    }
  } catch {
    // Offline fallback applies local update immediately
  }

  const nextMemories = currentMemories.map((m) => (m.id === id ? finalUpdated : m));
  return {
    outcome: {
      ok: true,
      status: 'updated',
      syncedWithBackend,
      memory: finalUpdated,
      message: `Memory "${finalUpdated.key}" updated.`,
    },
    nextMemories,
  };
}

export async function deleteMemoryByIdWithSync(params: {
  id: string;
  currentMemories: MemoryItem[];
}): Promise<{ outcome: MemoryMutationOutcome; nextMemories: MemoryItem[] }> {
  const { id, currentMemories } = params;
  const target = currentMemories.find((m) => m.id === id);
  if (!target) {
    return {
      outcome: {
        ok: false,
        status: 'error',
        syncedWithBackend: false,
        message: 'Memory record was not found.',
      },
      nextMemories: currentMemories,
    };
  }

  let syncedWithBackend = false;
  try {
    const res = await fetch(resolveApiUrl(`/api/memory/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    if (res.ok || res.status === 404) {
      syncedWithBackend = res.ok;
    }
  } catch {
    // Offline fallback deletes locally
  }

  const nextMemories = currentMemories.filter((m) => m.id !== id);
  return {
    outcome: {
      ok: true,
      status: 'deleted',
      syncedWithBackend,
      deletedId: id,
      message: `Deleted memory "${target.key}".`,
    },
    nextMemories,
  };
}

export async function clearAllMemoriesWithSync(): Promise<{
  outcome: MemoryMutationOutcome;
  nextMemories: MemoryItem[];
}> {
  let syncedWithBackend = false;
  try {
    const res = await fetch(resolveApiUrl('/api/memory/all?confirm=true'), {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    syncedWithBackend = res.ok;
  } catch {
    // Offline fallback clears local storage
  }

  return {
    outcome: {
      ok: true,
      status: 'cleared',
      syncedWithBackend,
      message: 'All saved memories have been cleared from the vault.',
    },
    nextMemories: [],
  };
}

export async function executeChatMemoryCommand(params: {
  rawText: string;
  currentMemories: MemoryItem[];
  sessions: ChatSession[];
  activeSessionId: string;
}): Promise<MemoryCommandExecutionResult> {
  const { rawText, currentMemories, sessions, activeSessionId } = params;
  const cmd = parseMemoryCommand(rawText);
  if (!cmd) return { handled: false };

  if (cmd.type === 'REJECT_SECRET' || cmd.type === 'CLARIFY') {
    return {
      handled: true,
      needsClarification: cmd.type === 'CLARIFY',
      replyText: cmd.message,
    };
  }

  if (cmd.type === 'SAVE' || cmd.type === 'UPDATE') {
    const { outcome, nextMemories } = await saveMemoryWithSync({
      candidate: {
        key: cmd.key,
        category: cmd.category,
        content: cmd.content,
        importance: cmd.importance,
      },
      currentMemories,
    });

    if (!outcome.ok) {
      return {
        handled: true,
        replyText: outcome.message,
      };
    }

    const syncNote = outcome.syncedWithBackend
      ? 'Synced with persistent server & local Memory Vault.'
      : 'Saved in local Memory Vault (will stay persisted across restarts).';

    return {
      handled: true,
      nextMemories,
      syncedWithBackend: outcome.syncedWithBackend,
      replyText: `Confirmed, Sir. ${outcome.message}\n\n_${syncNote}_`,
    };
  }

  if (cmd.type === 'FORGET') {
    const qNorm = normalizeMemoryText(cmd.query);
    const cleanedQuery = qNorm.replace(/\b(previous|saved|old|preference|memory|details|about|my)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const effectiveQuery = cleanedQuery || qNorm;

    const matches = currentMemories.filter((m) => {
      const hay = normalizeMemoryText(`${m.key} ${m.content} ${m.category}`);
      return hay.includes(effectiveQuery) || (qNorm && hay.includes(qNorm));
    });

    const rankedMatches =
      matches.length > 0
        ? matches
        : retrieveRelevantMemories(effectiveQuery, currentMemories, 2).filter((m) => {
            const hay = normalizeMemoryText(`${m.key} ${m.content}`);
            return effectiveQuery.split(' ').some((w) => w.length > 2 && hay.includes(w));
          });

    if (rankedMatches.length === 0) {
      return {
        handled: true,
        replyText: `I could not find any saved memory matching "${cmd.query}", Sir. Nothing was deleted.`,
      };
    }

    if (rankedMatches.length > 1 && effectiveQuery.split(' ').length <= 2) {
      const candidates = rankedMatches
        .slice(0, 4)
        .map((m) => `- **${m.key}** (${m.category}): ${m.content}`)
        .join('\n');
      return {
        handled: true,
        needsClarification: true,
        replyText: `I found multiple memories matching "${cmd.query}", Sir. Please clarify which one to delete:\n\n${candidates}`,
      };
    }

    const target = rankedMatches[0];
    const { outcome, nextMemories } = await deleteMemoryByIdWithSync({
      id: target.id,
      currentMemories,
    });
    if (!outcome.ok) {
      return { handled: true, replyText: outcome.message };
    }
    return {
      handled: true,
      nextMemories,
      syncedWithBackend: outcome.syncedWithBackend,
      replyText: `Done, Sir. I have forgotten and removed **${target.key}** (${target.content}) from your Memory Vault.`,
    };
  }

  if (cmd.type === 'RECALL_MEMORIES') {
    const list = cmd.importantOnly
      ? currentMemories.filter((m) => m.importance >= 4)
      : [...currentMemories];

    if (list.length === 0) {
      return {
        handled: true,
        replyText: cmd.importantOnly
          ? 'You have no high-importance memories saved yet, Sir. Say "Remember that ..." anytime to store one.'
          : 'Your Memory Vault is currently empty, Sir. Tell me preferences or project details to remember.',
      };
    }

    const sorted = [...list].sort(
      (a, b) => (b.importance - a.importance) || ((b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    );
    const formatted = sorted
      .slice(0, 12)
      .map(
        (m, idx) =>
          `${idx + 1}. **[${m.category}] ${m.key}** (★${m.importance}): ${m.content}`
      )
      .join('\n');

    return {
      handled: true,
      replyText: `${cmd.importantOnly ? 'Your high-priority' : 'Here are your stored'} memories (${sorted.length} total), Sir:\n\n${formatted}`,
    };
  }

  if (cmd.type === 'RECALL_CONVERSATIONS') {
    const matches = retrieveRelevantConversations(cmd.query, sessions, {
      activeSessionId,
      limit: 3,
    });
    if (matches.length === 0) {
      return {
        handled: true,
        replyText:
          'I checked your saved conversation archive, Sir, and found no matching past sessions for that timeframe or topic.',
      };
    }
    const summaryLines = matches
      .map((match) => {
        const when = new Date(match.updatedAt).toLocaleString();
        const headline = `### ${match.title} _(${when})_`;
        const summary = match.contextSummary ? `**Summary:** ${match.contextSummary}` : '';
        const snippets = match.excerpts
          .map((ex) => `- **${ex.role === 'user' ? 'You' : 'JARVIS'}:** ${ex.text}`)
          .join('\n');
        return [headline, summary, snippets].filter(Boolean).join('\n');
      })
      .join('\n\n---\n\n');

    return {
      handled: true,
      replyText: `Here is what we discussed in your saved history, Sir:\n\n${summaryLines}`,
    };
  }

  return { handled: false };
}

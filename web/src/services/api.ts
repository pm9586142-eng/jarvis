import {
  AgentDescriptor,
  BackendHealth,
  BrowserTelemetry,
  ChatBrainMeta,
  ChatErrorMeta,
  ChatMessage,
  ChatSource,
  LanguageCode,
  LanguageDescriptor,
  MemoryItem,
} from '../types/jarvis';
import { ParsedReminderResult, parseReminderFallback } from './reminderParser';
import { analyzeBrainRequest, BrainAnalysis, shouldAutoExtractMemories } from './brainEngine.js';
import { RelevantConversationExcerpt, retrieveRelevantMemories } from './memoryDedupe';

const RAW_API_BASE =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL?.trim() || '';

export const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, '');

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

const SESSION_ACCESS_TOKEN_KEY = 'jarvis_web_access_token';

export function getStoredAccessToken(): string {
  try {
    return window.sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setStoredAccessToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) {
      window.sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, trimmed);
    } else {
      window.sessionStorage.removeItem(SESSION_ACCESS_TOKEN_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

function buildJsonHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function safeReadJson<T>(res: Response): Promise<{ ok: boolean; data?: T; rawText: string }> {
  const rawText = await res.text().catch(() => '');
  if (!rawText.trim()) return { ok: false, rawText: '' };
  try {
    return { ok: true, data: JSON.parse(rawText) as T, rawText };
  } catch {
    return { ok: false, rawText };
  }
}

export async function checkBackendHealth(timeoutMs = 5000): Promise<BackendHealth> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const probe = async (path: string): Promise<Response> =>
    fetch(resolveApiUrl(path), {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

  try {
    let res = await probe('/api/health');
    if (res.status === 404) {
      res = await probe('/health');
    }
    if (!res.ok) {
      throw new Error(`Health check failed with HTTP ${res.status}`);
    }
    const parsed = await safeReadJson<BackendHealth>(res);
    if (!parsed.ok || !parsed.data || parsed.data.status !== 'ok') {
      throw new Error('Backend health endpoint returned an unexpected non-JSON payload.');
    }
    return parsed.data;
  } finally {
    window.clearTimeout(timer);
  }
}

export function buildSystemInstruction(
  agent: AgentDescriptor,
  language: LanguageDescriptor,
  telemetry: BrowserTelemetry,
  memories: MemoryItem[],
  customSystemPromptOverride?: string,
  userPrompt = '',
  relevantConversations: RelevantConversationExcerpt[] = []
): string {
  const topMemories = userPrompt.trim()
    ? retrieveRelevantMemories(userPrompt, memories, 6)
    : memories.slice(0, 6);

  const memoryBlock =
    topMemories.length > 0
      ? 'Relevant Long-Term Memory Facts from Owner Vault:\n' +
        topMemories
          .map((m) => `- [${m.category}] ${m.key}: ${m.content}`)
          .join('\n')
      : 'No relevant long-term memory entries stored.';

  const recallBlock =
    relevantConversations.length > 0
      ? '\n\nRelevant Past Conversation Archive (use when answering historical references):\n' +
        relevantConversations
          .map((c) => {
            const snippet = c.excerpts
              .map((ex) => `${ex.role === 'user' ? 'User' : 'JARVIS'}: ${ex.text}`)
              .join(' | ');
            return `- [${c.title}] ${c.contextSummary ? `Summary: ${c.contextSummary}. ` : ''}Excerpts: ${snippet}`;
          })
          .join('\n')
      : '';

  const telemetryBlock = [
    'Client Browser Telemetry:',
    `- Network: ${telemetry.networkType}`,
    `- Platform: ${telemetry.platform}`,
    `- Battery: ${telemetry.batteryPercent !== null ? `${telemetry.batteryPercent}%` : 'N/A'}`,
  ].join('\n');

  const langDirective =
    language.code === 'HINDI'
      ? "Respond in refined, sophisticated Hindi (हिंदी). Maintain the elite JARVIS assistant persona, addressing the owner as 'Sir'."
      : language.code === 'HINGLISH'
        ? "Respond naturally in intelligent Hinglish (Hindi + English mix in Latin script), keeping technical terms in English while addressing the owner as 'Sir'."
        : language.code === 'GUJARATI'
          ? "Respond in refined, polite Gujarati (ગુજરાતી). Maintain the elite JARVIS assistant persona, addressing the owner as 'Sir'."
          : "Respond in refined British English. Address the owner respectfully as 'Sir'. Exhibit calm confidence, precision, and subtle wit.";

  const personaPrompt = customSystemPromptOverride?.trim() || agent.systemPrompt;
  return `${personaPrompt}\n\n${langDirective}\n\n${telemetryBlock}\n\n${memoryBlock}${recallBlock}`;
}

export function analyzePromptBrain(params: {
  prompt: string;
  history: ChatMessage[];
  preferredLanguage: LanguageCode;
  conversationSummary?: string;
}): BrainAnalysis {
  return analyzeBrainRequest({
    prompt: params.prompt,
    history: params.history,
    preferredLanguage: params.preferredLanguage,
    conversationSummary: params.conversationSummary,
  });
}

export interface StreamCallbacks {
  onMeta?: (meta: ChatBrainMeta) => void;
  onChunk: (fullText: string) => void;
  onSources?: (sources: ChatSource[]) => void;
  onComplete: (fullText: string) => void;
  onCancelled?: (partialText: string) => void;
  onError: (message: string, errorMeta?: ChatErrorMeta) => void;
}

// Protective client-side cooldown for optional background Gemini helpers (never blocks explicit user chat)
let backgroundQuotaCooldownUntilMs = 0;

function recordClientQuotaSignal(errorMeta?: ChatErrorMeta): void {
  if (!errorMeta) return;
  const cat = errorMeta.quotaCategory;
  if (cat === 'RPD' || cat === 'BILLING' || cat === 'SPEND_CAP') {
    backgroundQuotaCooldownUntilMs = Math.max(backgroundQuotaCooldownUntilMs, Date.now() + 5 * 60 * 1000);
  } else if (cat === 'RPM' || cat === 'TPM' || cat === 'GENERIC_RATE_LIMIT' || errorMeta.upstreamStatus === 429) {
    const retryMs =
      typeof errorMeta.retryAfterSeconds === 'number' && Number.isFinite(errorMeta.retryAfterSeconds)
        ? Math.ceil(errorMeta.retryAfterSeconds * 1000)
        : 0;
    backgroundQuotaCooldownUntilMs = Math.max(
      backgroundQuotaCooldownUntilMs,
      Date.now() + Math.min(3 * 60 * 1000, Math.max(30_000, retryMs))
    );
  }
}

export function isBackgroundQuotaCooldownActive(): boolean {
  return Date.now() < backgroundQuotaCooldownUntilMs;
}

function clearClientQuotaCooldown(): void {
  backgroundQuotaCooldownUntilMs = 0;
}

const inFlightBriefingRequests = new Map<string, Promise<{ line: string; source: 'gemini' | 'fallback' }>>();
const inFlightMemoryExtractions = new Map<string, Promise<ExtractedMemoryCandidateDto[]>>();

async function streamSseEndpoint(params: {
  endpoint: string;
  payload: Record<string, unknown>;
  signal: AbortSignal;
  callbacks: StreamCallbacks;
}): Promise<void> {
  const { endpoint, payload, signal, callbacks } = params;

  const internalController = new AbortController();
  const onExternalAbort = () => internalController.abort();
  if (signal.aborted) {
    internalController.abort();
  } else {
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    internalController.abort();
  }, 60000);

  let completed = false;
  let accumulated = '';

  const processSseLine = (rawLine: string): boolean => {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) return false;
    const jsonStr = line.slice(5).trim();
    if (!jsonStr) return false;

    try {
      const event = JSON.parse(jsonStr) as {
        meta?: ChatBrainMeta;
        text?: string;
        sources?: ChatSource[];
        error?: string;
        code?: string;
        quotaCategory?: string;
        upstreamStatus?: number | null;
        upstreamGrpcStatus?: string | null;
        upstreamMessage?: string;
        retryable?: boolean;
        retryAfterSeconds?: number | null;
        quotaMetrics?: string[];
        attempts?: number;
        done?: boolean;
      };

      if (event.meta && callbacks.onMeta) {
        callbacks.onMeta(event.meta);
      }
      if (event.error) {
        completed = true;
        const errorMeta: ChatErrorMeta = {
          code: event.code,
          quotaCategory: event.quotaCategory,
          upstreamStatus: event.upstreamStatus,
          upstreamGrpcStatus: event.upstreamGrpcStatus,
          upstreamMessage: event.upstreamMessage,
          retryable: event.retryable,
          retryAfterSeconds: event.retryAfterSeconds,
          quotaMetrics: event.quotaMetrics,
          attempts: event.attempts,
        };
        recordClientQuotaSignal(errorMeta);
        callbacks.onError(event.error, errorMeta);
        return true;
      }
      if (event.sources && callbacks.onSources) {
        callbacks.onSources(event.sources);
      }
      if (event.text) {
        accumulated += event.text;
        callbacks.onChunk(accumulated);
      }
      if (event.done) {
        completed = true;
        clearClientQuotaCooldown();
        callbacks.onComplete(accumulated || 'No response generated by Gemini.');
        return true;
      }
    } catch {
      // Ignore incomplete SSE fragments
    }
    return false;
  };

  try {
    const response = await fetch(resolveApiUrl(endpoint), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(payload),
      signal: internalController.signal,
    });

    if (!response.ok) {
      let errMsg = `Server error (HTTP ${response.status})`;
      let errorMeta: ChatErrorMeta = { upstreamStatus: response.status };
      const parsedErr = await safeReadJson<{
        error?: string;
        code?: string;
        quotaCategory?: string;
        upstreamStatus?: number | null;
        upstreamGrpcStatus?: string | null;
        upstreamMessage?: string;
        retryable?: boolean;
        retryAfterSeconds?: number | null;
        quotaMetrics?: string[];
        attempts?: number;
      }>(response);
      if (parsedErr.ok && parsedErr.data) {
        if (parsedErr.data.error) {
          errMsg = parsedErr.data.error;
        }
        errorMeta = {
          code: parsedErr.data.code,
          quotaCategory: parsedErr.data.quotaCategory,
          upstreamStatus: parsedErr.data.upstreamStatus ?? response.status,
          upstreamGrpcStatus: parsedErr.data.upstreamGrpcStatus,
          upstreamMessage: parsedErr.data.upstreamMessage,
          retryable: parsedErr.data.retryable,
          retryAfterSeconds: parsedErr.data.retryAfterSeconds,
          quotaMetrics: parsedErr.data.quotaMetrics,
          attempts: parsedErr.data.attempts,
        };
      } else if (parsedErr.rawText && !/^\s*<!doctype|^\s*<html/i.test(parsedErr.rawText)) {
        errMsg = parsedErr.rawText.slice(0, 600);
      }
      recordClientQuotaSignal(errorMeta);
      callbacks.onError(errMsg, errorMeta);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('Streaming response body unavailable from server.');
      return;
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        if (processSseLine(rawLine)) {
          return;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const rawLine of buffer.split('\n')) {
        if (processSseLine(rawLine)) {
          return;
        }
      }
    }

    if (!completed) {
      callbacks.onComplete(accumulated || 'No response generated by Gemini.');
    }
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') {
      if (!timedOut && callbacks.onCancelled) {
        callbacks.onCancelled(accumulated);
      } else {
        callbacks.onError(
          timedOut
            ? 'Request timed out after 60 seconds. Check server connection and retry.'
            : 'Request cancelled.'
        );
      }
    } else {
      const msg = err instanceof Error ? err.message : 'Unable to reach JARVIS backend server.';
      callbacks.onError(msg);
    }
  } finally {
    window.clearTimeout(timeoutId);
    signal.removeEventListener('abort', onExternalAbort);
  }
}

export async function streamGeminiChat(params: {
  prompt: string;
  agent: AgentDescriptor;
  language: LanguageDescriptor;
  telemetry: BrowserTelemetry;
  memories: MemoryItem[];
  relevantConversations?: RelevantConversationExcerpt[];
  history: ChatMessage[];
  conversationSummary?: string;
  enableWebSearch: boolean;
  customSystemPromptOverride?: string;
  signal: AbortSignal;
  callbacks: StreamCallbacks;
}): Promise<void> {
  const {
    prompt,
    agent,
    language,
    telemetry,
    memories,
    relevantConversations = [],
    history,
    conversationSummary,
    enableWebSearch,
    customSystemPromptOverride,
    signal,
    callbacks,
  } = params;

  const systemInstruction = buildSystemInstruction(
    agent,
    language,
    telemetry,
    memories,
    customSystemPromptOverride,
    prompt,
    relevantConversations
  );
  const formattedHistory = history
    .filter((m) => !m.isError && m.text.trim().length > 0)
    .slice(-24)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      text: m.text,
    }));

  return streamSseEndpoint({
    endpoint: '/api/chat/stream',
    payload: {
      prompt,
      systemInstruction,
      history: formattedHistory,
      conversationSummary: conversationSummary || '',
      preferredLanguage: language.code,
      enableWebSearch: enableWebSearch || Boolean(agent.enableWebSearch),
    },
    signal,
    callbacks,
  });
}

export async function streamMultimodalChat(params: {
  prompt: string;
  fileBase64: string;
  mimeType: string;
  fileName: string;
  agent: AgentDescriptor;
  language: LanguageDescriptor;
  telemetry: BrowserTelemetry;
  memories: MemoryItem[];
  relevantConversations?: RelevantConversationExcerpt[];
  history: ChatMessage[];
  conversationSummary?: string;
  enableWebSearch: boolean;
  customSystemPromptOverride?: string;
  signal: AbortSignal;
  callbacks: StreamCallbacks;
}): Promise<void> {
  const {
    prompt,
    fileBase64,
    mimeType,
    fileName,
    agent,
    language,
    telemetry,
    memories,
    relevantConversations = [],
    history,
    conversationSummary,
    enableWebSearch,
    customSystemPromptOverride,
    signal,
    callbacks,
  } = params;

  const systemInstruction = buildSystemInstruction(
    agent,
    language,
    telemetry,
    memories,
    customSystemPromptOverride,
    prompt,
    relevantConversations
  );
  const formattedHistory = history
    .filter((m) => !m.isError && m.text.trim().length > 0)
    .slice(-24)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      text: m.text,
    }));

  return streamSseEndpoint({
    endpoint: '/api/chat/multimodal',
    payload: {
      prompt,
      systemInstruction,
      history: formattedHistory,
      conversationSummary: conversationSummary || '',
      preferredLanguage: language.code,
      fileBase64,
      mimeType,
      fileName,
      enableWebSearch: enableWebSearch || Boolean(agent.enableWebSearch),
    },
    signal,
    callbacks,
  });
}

export interface ConversationSummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  language: string;
  model?: string;
}

export async function summarizeConversation(params: {
  messages: ChatMessage[];
  language: LanguageCode;
  previousSummary?: string;
}): Promise<ConversationSummaryResult> {
  const validTurns = params.messages
    .filter((m) => !m.isError && m.text.trim().length > 0)
    .slice(-40)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      text: m.text,
    }));

  if (validTurns.length === 0) {
    throw new Error('Start a conversation before summarizing.');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(resolveApiUrl('/api/chat/summarize'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        messages: validTurns,
        language: params.language,
        previousSummary: params.previousSummary || '',
      }),
      signal: controller.signal,
    });
    const parsed = await safeReadJson<ConversationSummaryResult & { error?: string }>(res);
    if (!res.ok) {
      throw new Error(parsed.data?.error || `Summarization failed (HTTP ${res.status})`);
    }
    if (!parsed.ok || !parsed.data) {
      throw new Error('Summarization endpoint returned an invalid response.');
    }
    return parsed.data as ConversationSummaryResult;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function analyzeVisionImage(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<{ analysis: string; model: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(resolveApiUrl('/api/vision'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ imageBase64, mimeType, prompt }),
      signal: controller.signal,
    });

    const parsed = await safeReadJson<{ analysis: string; model: string; error?: string }>(res);
    if (!res.ok) {
      throw new Error(parsed.data?.error || `Vision API error (${res.status})`);
    }
    if (!parsed.ok || !parsed.data) {
      throw new Error('Vision API returned an invalid response.');
    }
    return { analysis: parsed.data.analysis, model: parsed.data.model };
  } finally {
    window.clearTimeout(timer);
  }
}

export interface ExtractedMemoryCandidateDto {
  key: string;
  category: 'PREFERENCE' | 'PROJECT' | 'INSTRUCTION' | 'TOPIC' | 'DECISION' | 'FACT';
  content: string;
  importance: number;
}

export async function extractMemoriesFromTurn(params: {
  userPrompt: string;
  aiReply: string;
  existingMemories: MemoryItem[];
}): Promise<ExtractedMemoryCandidateDto[]> {
  if (!shouldAutoExtractMemories(params.userPrompt)) return [];
  if (isBackgroundQuotaCooldownActive()) return [];

  const dedupeKey = `${params.userPrompt.trim().slice(0, 200)}|${params.aiReply.trim().slice(0, 200)}`;
  const existingRequest = inFlightMemoryExtractions.get(dedupeKey);
  if (existingRequest) return existingRequest;

  const task = (async (): Promise<ExtractedMemoryCandidateDto[]> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(resolveApiUrl('/api/memory/extract'), {
        method: 'POST',
        headers: buildJsonHeaders(),
        body: JSON.stringify({
          userPrompt: params.userPrompt,
          aiReply: params.aiReply,
          existingMemories: params.existingMemories.slice(0, 20).map((m) => ({
            key: m.key,
            category: m.category,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { memories?: ExtractedMemoryCandidateDto[] };
      return Array.isArray(data?.memories) ? data.memories : [];
    } catch {
      return [];
    } finally {
      window.clearTimeout(timer);
      inFlightMemoryExtractions.delete(dedupeKey);
    }
  })();

  inFlightMemoryExtractions.set(dedupeKey, task);
  return task;
}

export async function parseNaturalReminder(
  text: string
): Promise<{ reminder: ParsedReminderResult; source: 'gemini' | 'local_parser' }> {
  const trimmed = text.trim();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(resolveApiUrl('/api/reminders/parse'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        text: trimmed,
        nowIso: new Date().toISOString(),
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        reminder: parseReminderFallback(trimmed),
        source: 'local_parser',
      };
    }
    const data = (await res.json()) as {
      reminder?: ParsedReminderResult;
      source?: 'gemini' | 'local_parser';
    };
    if (!data?.reminder) {
      return {
        reminder: parseReminderFallback(trimmed),
        source: 'local_parser',
      };
    }
    return {
      reminder: data.reminder,
      source: data.source || 'gemini',
    };
  } catch {
    return {
      reminder: parseReminderFallback(trimmed),
      source: 'local_parser',
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export interface GenerateMusicResponse {
  audioBase64: string;
  mimeType: string;
  lyrics: string;
  model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
  mode: 'clip' | 'pro';
  durationLabel: string;
  prompt: string;
}

export async function generateLyriaMusic(params: {
  prompt: string;
  mode: 'clip' | 'pro';
  lyrics?: string;
  signal?: AbortSignal;
}): Promise<GenerateMusicResponse> {
  const controller = new AbortController();
  const timeoutMs = params.mode === 'pro' ? 120000 : 75000;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (params.signal) {
    if (params.signal.aborted) controller.abort();
    else params.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(resolveApiUrl('/api/music/generate'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        prompt: params.prompt,
        mode: params.mode,
        lyrics: params.lyrics ?? '',
      }),
      signal: controller.signal,
    });

    const parsed = await safeReadJson<GenerateMusicResponse & { error?: string }>(res);
    if (!res.ok) {
      throw new Error(parsed.data?.error || `Music generation error (${res.status})`);
    }
    if (!parsed.ok || !parsed.data) {
      throw new Error('Music generation endpoint returned an invalid response.');
    }
    return parsed.data as GenerateMusicResponse;
  } finally {
    window.clearTimeout(timer);
    if (params.signal) {
      params.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export async function fetchAiBriefingLine(params: {
  tasksSummary: string;
  weatherSummary: string;
  batterySummary: string;
  language: string;
}): Promise<{ line: string; source: 'gemini' | 'fallback' }> {
  const fallback =
    'All neural corridors are calibrated and awaiting your command, Sir. Stay focused on your highest-leverage objective today.';
  if (isBackgroundQuotaCooldownActive()) {
    return { line: fallback, source: 'fallback' };
  }

  const dedupeKey = `${params.language}|${params.tasksSummary.slice(0, 160)}|${params.weatherSummary.slice(0, 100)}`;
  const existing = inFlightBriefingRequests.get(dedupeKey);
  if (existing) return existing;

  const task = (async (): Promise<{ line: string; source: 'gemini' | 'fallback' }> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(resolveApiUrl('/api/briefing'), {
        method: 'POST',
        headers: buildJsonHeaders(),
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      if (!res.ok) {
        return { line: fallback, source: 'fallback' };
      }
      const data = (await res.json()) as { line?: string; source?: 'gemini' | 'fallback' };
      return {
        line: data?.line?.trim() || fallback,
        source: data?.source || 'fallback',
      };
    } catch {
      return { line: fallback, source: 'fallback' };
    } finally {
      window.clearTimeout(timer);
      inFlightBriefingRequests.delete(dedupeKey);
    }
  })();

  inFlightBriefingRequests.set(dedupeKey, task);
  return task;
}

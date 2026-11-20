import {
  AgentDescriptor,
  AutomationHistoryItem,
  BackendHealth,
  BrainAgentInfo,
  BrainCollaborationMode,
  BrainCoordinatorConfig,
  BrainPolicyPatch,
  BrainProviderInfo,
  BrainRoutingPolicy,
  BrainStatusSnapshot,
  BrainVerificationReport,
  BrowserTelemetry,
  ChatBrainMeta,
  ChatErrorMeta,
  ChatMessage,
  ChatSource,
  LanguageCode,
  LanguageDescriptor,
  LiveSearchResult,
  MemoryItem,
  NoteItem,
  PersonalityPresetId,
  ReasoningPreference,
  ResponseStyleId,
  TaskItem,
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
const USER_NAMESPACE_KEY = 'jarvis_web_user_namespace_v1';

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

export function sanitizeNamespaceInput(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
  return cleaned || 'default';
}

export function getActiveUserNamespace(): string {
  try {
    const raw = window.localStorage.getItem(USER_NAMESPACE_KEY);
    return sanitizeNamespaceInput(raw || 'default');
  } catch {
    return 'default';
  }
}

export function setActiveUserNamespace(namespace: string): string {
  const sanitized = sanitizeNamespaceInput(namespace);
  try {
    window.localStorage.setItem(USER_NAMESPACE_KEY, sanitized);
  } catch {
    // Ignore storage access errors
  }
  return sanitized;
}

export function buildJsonHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Jarvis-User-Id': getActiveUserNamespace(),
  };
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
        explanation?: string;
        suggestedAction?: string;
        retryable?: boolean;
        retryAfterSeconds?: number | null;
        quotaMetrics?: string[];
        attempts?: number;
        allModelsExhausted?: boolean;
        allProvidersExhausted?: boolean;
        attemptedModels?: string[];
        attemptedProviders?: string[];
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
          explanation: event.explanation,
          suggestedAction: event.suggestedAction,
          retryable: event.retryable,
          retryAfterSeconds: event.retryAfterSeconds,
          quotaMetrics: event.quotaMetrics,
          attempts: event.attempts,
          allModelsExhausted: event.allModelsExhausted,
          allProvidersExhausted: event.allProvidersExhausted,
          attemptedModels: event.attemptedModels,
          attemptedProviders: event.attemptedProviders,
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
        explanation?: string;
        suggestedAction?: string;
        retryable?: boolean;
        retryAfterSeconds?: number | null;
        quotaMetrics?: string[];
        attempts?: number;
        allModelsExhausted?: boolean;
        allProvidersExhausted?: boolean;
        attemptedModels?: string[];
        attemptedProviders?: string[];
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
          explanation: parsedErr.data.explanation,
          suggestedAction: parsedErr.data.suggestedAction,
          retryable: parsedErr.data.retryable,
          retryAfterSeconds: parsedErr.data.retryAfterSeconds,
          quotaMetrics: parsedErr.data.quotaMetrics,
          attempts: parsedErr.data.attempts,
          allModelsExhausted: parsedErr.data.allModelsExhausted,
          allProvidersExhausted: parsedErr.data.allProvidersExhausted,
          attemptedModels: parsedErr.data.attemptedModels,
          attemptedProviders: parsedErr.data.attemptedProviders,
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
  personality?: PersonalityPresetId;
  customInstructions?: string;
  responseStyle?: ResponseStyleId;
  reasoningPreference?: ReasoningPreference;
  documentContext?: string;
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
    personality = 'executive_butler',
    customInstructions = '',
    responseStyle = 'balanced',
    reasoningPreference = 'auto',
    documentContext = '',
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
      personality,
      customInstructions,
      responseStyle,
      reasoningPreference,
      documentContext,
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
  personality?: PersonalityPresetId;
  customInstructions?: string;
  responseStyle?: ResponseStyleId;
  reasoningPreference?: ReasoningPreference;
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
    personality = 'executive_butler',
    customInstructions = '',
    responseStyle = 'balanced',
    reasoningPreference = 'auto',
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
      personality,
      customInstructions,
      responseStyle,
      reasoningPreference,
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
  prompt: string,
  mode: 'analyze' | 'ocr' | 'diagram' | 'qa' = 'analyze',
  question = ''
): Promise<{ analysis: string; model: string; mode?: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(resolveApiUrl('/api/vision'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({ imageBase64, mimeType, prompt, mode, question }),
      signal: controller.signal,
    });

    const parsed = await safeReadJson<{ analysis: string; model: string; mode?: string; error?: string }>(res);
    if (!res.ok) {
      throw new Error(parsed.data?.error || `Vision API error (${res.status})`);
    }
    if (!parsed.ok || !parsed.data) {
      throw new Error('Vision API returned an invalid response.');
    }
    return { analysis: parsed.data.analysis, model: parsed.data.model, mode: parsed.data.mode };
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

// =========================================================================
// Phase 4: Live Web Search, Document Intelligence & Report Studio APIs
// =========================================================================

export async function runLiveWebSearch(params: {
  query: string;
  language?: LanguageCode;
}): Promise<LiveSearchResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(resolveApiUrl('/api/search'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        query: params.query.trim(),
        language: params.language || 'ENGLISH',
      }),
      signal: controller.signal,
    });
    const parsed = await safeReadJson<LiveSearchResult & { error?: string }>(res);
    if (!res.ok) {
      throw new Error(parsed.data?.error || `Live web search failed (HTTP ${res.status})`);
    }
    if (!parsed.ok || !parsed.data) {
      throw new Error('Live search endpoint returned an unexpected payload.');
    }
    return {
      query: parsed.data.query || params.query,
      summary: parsed.data.summary || '',
      verifiedFacts: Array.isArray(parsed.data.verifiedFacts) ? parsed.data.verifiedFacts : [],
      uncertainPoints: Array.isArray(parsed.data.uncertainPoints) ? parsed.data.uncertainPoints : [],
      sources: Array.isArray(parsed.data.sources) ? parsed.data.sources : [],
      providersUsed: Array.isArray(parsed.data.providersUsed) ? parsed.data.providersUsed : [],
      model: parsed.data.model,
      timestamp: Date.now(),
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export interface DocumentIntelligenceResponse {
  fileName: string;
  mimeType: string;
  kind: 'docx' | 'pdf' | 'text';
  extractedText?: string;
  wordCount?: number;
  truncated?: boolean;
  answer?: string;
  model?: string;
}

export async function parseOrAnalyzeDocument(params: {
  fileName: string;
  mimeType: string;
  fileBase64?: string;
  textContent?: string;
  action: 'extract_only' | 'summarize' | 'extract_facts' | 'qa';
  question?: string;
  language?: LanguageCode;
}): Promise<DocumentIntelligenceResponse> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch(resolveApiUrl('/api/documents/parse'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    const parsed = await safeReadJson<DocumentIntelligenceResponse & { error?: string }>(res);
    if (!res.ok) {
      throw new Error(parsed.data?.error || `Document processing failed (HTTP ${res.status})`);
    }
    if (!parsed.ok || !parsed.data) {
      throw new Error('Document endpoint returned an unexpected payload.');
    }
    return parsed.data;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function generateStudioReport(params: {
  reportType: 'executive_report' | 'long_summary' | 'structured_notes' | 'study_guide' | 'coding_explanation';
  title?: string;
  sourceText: string;
  language?: LanguageCode;
}): Promise<{ title: string; reportType: string; content: string; wordCount: number; model?: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch(resolveApiUrl('/api/reports/generate'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    const parsed = await safeReadJson<{
      title: string;
      reportType: string;
      content: string;
      wordCount: number;
      model?: string;
      error?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(parsed.data?.error || `Report generation failed (HTTP ${res.status})`);
    }
    if (!parsed.ok || !parsed.data) {
      throw new Error('Report generation endpoint returned an invalid payload.');
    }
    return parsed.data;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface SmartTaskSuggestion {
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'TASK' | 'REMINDER' | 'SCHEDULE' | 'NOTE';
  dueTime: string;
}

export async function fetchSmartTaskSuggestions(params: {
  tasks: TaskItem[];
  memories: MemoryItem[];
  language?: LanguageCode;
}): Promise<SmartTaskSuggestion[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(resolveApiUrl('/api/tasks/suggest'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        tasks: params.tasks.slice(0, 20),
        memories: params.memories.slice(0, 15),
        language: params.language || 'ENGLISH',
      }),
      signal: controller.signal,
    });
    const parsed = await safeReadJson<{ suggestions?: SmartTaskSuggestion[]; error?: string }>(res);
    if (!res.ok) {
      throw new Error(parsed.data?.error || `Smart task suggestions failed (HTTP ${res.status})`);
    }
    return Array.isArray(parsed.data?.suggestions) ? parsed.data.suggestions : [];
  } finally {
    window.clearTimeout(timer);
  }
}

// =========================================================================
// Phase 2 & 3: Bidirectional Workspace Sync (Tasks, Notes, Memories, Automations)
// =========================================================================

export async function syncWorkspaceWithBackend(payload: {
  tasks?: TaskItem[];
  notes?: NoteItem[];
  memories?: MemoryItem[];
  automations?: AutomationHistoryItem[];
}): Promise<{
  ok: boolean;
  namespace?: string;
  tasks: TaskItem[];
  notes: NoteItem[];
  memories: MemoryItem[];
  automations: AutomationHistoryItem[];
  error?: string;
}> {
  try {
    const res = await fetch(resolveApiUrl('/api/sync'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await safeReadJson<{
      namespace?: string;
      tasks?: TaskItem[];
      notes?: NoteItem[];
      memories?: MemoryItem[];
      automations?: AutomationHistoryItem[];
      error?: string;
    }>(res);
    if (!res.ok || !parsed.ok || !parsed.data) {
      return {
        ok: false,
        tasks: payload.tasks || [],
        notes: payload.notes || [],
        memories: payload.memories || [],
        automations: payload.automations || [],
        error: parsed.data?.error || `Sync failed (HTTP ${res.status})`,
      };
    }
    return {
      ok: true,
      namespace: parsed.data.namespace,
      tasks: Array.isArray(parsed.data.tasks) ? parsed.data.tasks : [],
      notes: Array.isArray(parsed.data.notes) ? parsed.data.notes : [],
      memories: Array.isArray(parsed.data.memories) ? parsed.data.memories : [],
      automations: Array.isArray(parsed.data.automations) ? parsed.data.automations : [],
    };
  } catch (err) {
    return {
      ok: false,
      tasks: payload.tasks || [],
      notes: payload.notes || [],
      memories: payload.memories || [],
      automations: payload.automations || [],
      error: err instanceof Error ? err.message : 'Unable to reach sync server.',
    };
  }
}

export async function upsertTaskOnServer(task: TaskItem): Promise<boolean> {
  try {
    const res = await fetch(resolveApiUrl('/api/tasks'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(task),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteTaskOnServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(resolveApiUrl(`/api/tasks/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: buildJsonHeaders(),
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export async function upsertNoteOnServer(note: NoteItem): Promise<boolean> {
  try {
    const res = await fetch(resolveApiUrl('/api/notes'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(note),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteNoteOnServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(resolveApiUrl(`/api/notes/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: buildJsonHeaders(),
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export async function recordAutomationOnServer(item: AutomationHistoryItem): Promise<boolean> {
  try {
    const res = await fetch(resolveApiUrl('/api/automations'), {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify(item),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// =========================================================================
// Multi-AI Brain Control Plane (/api/brain/*) & Shared Memory Backups
// =========================================================================

export async function fetchBrainStatus(): Promise<BrainStatusSnapshot> {
  const res = await fetch(resolveApiUrl('/api/brain/status'), {
    method: 'GET',
    headers: buildJsonHeaders(),
    cache: 'no-store',
  });
  const parsed = await safeReadJson<BrainStatusSnapshot & { error?: string }>(res);
  if (!res.ok || !parsed.ok || !parsed.data) {
    throw new Error(parsed.data?.error || `Failed to load Multi-AI Brain status (HTTP ${res.status})`);
  }
  return parsed.data;
}

export async function testBrainProvider(providerId: string): Promise<{
  ok: boolean;
  providerId: string;
  connectionState: string;
  latencyMs: number;
  verifiedModelsCount: number;
  message: string;
  provider?: BrainProviderInfo;
}> {
  const res = await fetch(resolveApiUrl(`/api/brain/providers/${encodeURIComponent(providerId)}/test`), {
    method: 'POST',
    headers: buildJsonHeaders(),
  });
  const parsed = await safeReadJson<{
    ok: boolean;
    providerId: string;
    connectionState: string;
    latencyMs: number;
    verifiedModelsCount: number;
    message: string;
    provider?: BrainProviderInfo;
    error?: string;
  }>(res);
  if (!parsed.ok || !parsed.data) {
    throw new Error(`Provider test failed (HTTP ${res.status})`);
  }
  return parsed.data;
}

export async function updateBrainProvider(
  providerId: string,
  patch: {
    enabled?: boolean;
    priority?: number;
    registerModel?: { id: string; domains?: string[]; vision?: boolean };
  }
): Promise<{ ok: boolean; provider?: BrainProviderInfo; error?: string; code?: string }> {
  const res = await fetch(resolveApiUrl(`/api/brain/providers/${encodeURIComponent(providerId)}`), {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify(patch),
  });
  const parsed = await safeReadJson<{
    ok?: boolean;
    provider?: BrainProviderInfo;
    error?: string;
    code?: string;
  }>(res);
  if (!res.ok || !parsed.ok) {
    return {
      ok: false,
      code: parsed.data?.code,
      error: parsed.data?.error || `Update failed (HTTP ${res.status})`,
    };
  }
  return { ok: true, provider: parsed.data?.provider };
}

export async function registerCustomBrainProvider(payload: {
  id: string;
  label: string;
  baseUrl: string;
  models: string[];
  verifiedZeroCost: boolean;
  supportsVision?: boolean;
}): Promise<{ ok: boolean; provider?: BrainProviderInfo; error?: string }> {
  const res = await fetch(resolveApiUrl('/api/brain/providers/custom'), {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const parsed = await safeReadJson<{ ok?: boolean; provider?: BrainProviderInfo; error?: string }>(res);
  if (!res.ok || !parsed.ok) {
    return { ok: false, error: parsed.data?.error || `Custom provider registration failed (HTTP ${res.status})` };
  }
  return { ok: true, provider: parsed.data?.provider };
}

export async function resetBrainCooldowns(providerId?: string): Promise<boolean> {
  const res = await fetch(resolveApiUrl('/api/brain/providers/reset-cooldowns'), {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(providerId ? { providerId } : {}),
  });
  return res.ok;
}

export async function updateBrainRouterPolicy(
  patch: BrainPolicyPatch
): Promise<{
  ok: boolean;
  router?: BrainRoutingPolicy;
  coordinator?: BrainCoordinatorConfig;
  error?: string;
}> {
  const res = await fetch(resolveApiUrl('/api/brain/router'), {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify(patch),
  });
  const parsed = await safeReadJson<{
    ok?: boolean;
    router?: BrainRoutingPolicy;
    coordinator?: BrainCoordinatorConfig;
    error?: string;
  }>(res);
  if (!res.ok || !parsed.ok) {
    return { ok: false, error: parsed.data?.error || `Router update failed (HTTP ${res.status})` };
  }
  return { ok: true, router: parsed.data?.router, coordinator: parsed.data?.coordinator };
}

export async function updateBrainAgent(
  agentId: string,
  patch: Partial<Pick<BrainAgentInfo, 'enabled' | 'instructions' | 'preferredProvider' | 'preferredModel' | 'temperature' | 'maxTokens'>>
): Promise<{ ok: boolean; agent?: BrainAgentInfo; error?: string }> {
  const res = await fetch(resolveApiUrl(`/api/brain/agents/${encodeURIComponent(agentId)}`), {
    method: 'PATCH',
    headers: buildJsonHeaders(),
    body: JSON.stringify(patch),
  });
  const parsed = await safeReadJson<{ ok?: boolean; agent?: BrainAgentInfo; error?: string }>(res);
  if (!res.ok || !parsed.ok) {
    return { ok: false, error: parsed.data?.error || `Agent update failed (HTTP ${res.status})` };
  }
  return { ok: true, agent: parsed.data?.agent };
}

export interface BrainStreamProgressEvent {
  stage: string;
  [key: string]: unknown;
}

export async function runBrainCoordinationStream(params: {
  prompt: string;
  history?: Array<{ role: string; text: string }>;
  languageInstruction?: string;
  memoryEnabled?: boolean;
  temporaryChat?: boolean;
  collaborationMode?: BrainCollaborationMode;
  agentId?: string | null;
  provider?: string | null;
  model?: string | null;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  documentText?: string;
  isVoice?: boolean;
  confirmedSensitiveAction?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: BrainStreamProgressEvent) => void;
  onMeta?: (meta: ChatBrainMeta) => void;
  onText?: (fullText: string) => void;
  onComplete?: (fullText: string, meta?: ChatBrainMeta) => void;
  onError?: (message: string, code?: string) => void;
}): Promise<void> {
  const res = await fetch(resolveApiUrl('/api/brain/coordinate/stream'), {
    method: 'POST',
    headers: buildJsonHeaders(),
    signal: params.signal,
    body: JSON.stringify({
      prompt: params.prompt,
      history: params.history || [],
      languageInstruction: params.languageInstruction || '',
      memoryEnabled: params.memoryEnabled !== false,
      temporaryChat: Boolean(params.temporaryChat),
      collaborationMode: params.collaborationMode,
      agentId: params.agentId || undefined,
      provider: params.provider || undefined,
      model: params.model || undefined,
      imageBase64: params.imageBase64 || undefined,
      imageMimeType: params.imageMimeType || undefined,
      documentText: params.documentText || undefined,
      isVoice: Boolean(params.isVoice),
      confirmedSensitiveAction: Boolean(params.confirmedSensitiveAction),
    }),
  });

  if (!res.ok || !res.body) {
    const parsed = await safeReadJson<{ error?: string; code?: string }>(res);
    params.onError?.(
      parsed.data?.error || `Multi-AI Brain coordination failed (HTTP ${res.status})`,
      parsed.data?.code
    );
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let lastMeta: ChatBrainMeta | undefined;
  let hadError = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const rawEvent of events) {
      const line = rawEvent
        .split('\n')
        .find((l) => l.startsWith('data:'));
      if (!line) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const data = JSON.parse(jsonStr);
        if (data.progress) {
          params.onProgress?.(data.progress as BrainStreamProgressEvent);
        }
        if (data.meta) {
          const m = data.meta;
          lastMeta = {
            intent: m.domain || 'general',
            detectedLanguage: 'ENGLISH',
            isFollowUp: false,
            reasoningMode: m.mode === 'collaboration' ? 'deep' : 'structured',
            recommendedAgent: Array.isArray(m.agentsUsed) && m.agentsUsed[0] ? m.agentsUsed[0] : 'JARVIS',
            provider: m.provider,
            providerLabel: m.providerLabel,
            model: m.model,
            fallbackUsed: Boolean(m.fallbackUsed),
            brainMode: m.mode,
            complexity: m.complexity,
            complexityReason: m.complexityReason,
            agentsUsed: m.agentsUsed,
            subtasks: m.subtasks,
            verification: m.verification,
            selfCorrected: Boolean(m.selfCorrected),
            sensitiveActionWarning: m.sensitiveActionWarning,
            taskId: m.taskId,
          };
          params.onMeta?.(lastMeta);
        }
        if (typeof data.text === 'string' && data.text) {
          fullText += data.text;
          params.onText?.(fullText);
        }
        if (data.error) {
          hadError = true;
          params.onError?.(String(data.error), data.code);
        }
      } catch {
        // Ignore partial chunk JSON parse error
      }
    }
  }

  if (!hadError) {
    params.onComplete?.(fullText, lastMeta);
  }
}

export async function verifyBrainAnswer(payload: {
  prompt: string;
  answer: string;
}): Promise<BrainVerificationReport> {
  const res = await fetch(resolveApiUrl('/api/brain/verify'), {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify(payload),
  });
  const parsed = await safeReadJson<BrainVerificationReport & { error?: string }>(res);
  if (!res.ok || !parsed.ok || !parsed.data) {
    throw new Error(parsed.data?.error || `Verification failed (HTTP ${res.status})`);
  }
  return parsed.data;
}

export async function exportSharedMemories(): Promise<{
  version: string;
  exportedAt: string;
  namespace: string;
  count: number;
  memories: MemoryItem[];
}> {
  const res = await fetch(resolveApiUrl('/api/brain/memory/export'), {
    method: 'GET',
    headers: buildJsonHeaders(),
  });
  const parsed = await safeReadJson<{
    version: string;
    exportedAt: string;
    namespace: string;
    count: number;
    memories: MemoryItem[];
    error?: string;
  }>(res);
  if (!res.ok || !parsed.ok || !parsed.data) {
    throw new Error(parsed.data?.error || `Memory export failed (HTTP ${res.status})`);
  }
  return parsed.data;
}

export async function importSharedMemories(
  memories: Partial<MemoryItem>[]
): Promise<{ ok: boolean; added: number; updated: number; skipped: number; error?: string }> {
  const res = await fetch(resolveApiUrl('/api/brain/memory/import'), {
    method: 'POST',
    headers: buildJsonHeaders(),
    body: JSON.stringify({ memories }),
  });
  const parsed = await safeReadJson<{
    ok?: boolean;
    added?: number;
    updated?: number;
    skipped?: number;
    error?: string;
  }>(res);
  if (!res.ok || !parsed.ok) {
    return {
      ok: false,
      added: 0,
      updated: 0,
      skipped: 0,
      error: parsed.data?.error || `Memory import failed (HTTP ${res.status})`,
    };
  }
  return {
    ok: true,
    added: parsed.data?.added ?? 0,
    updated: parsed.data?.updated ?? 0,
    skipped: parsed.data?.skipped ?? 0,
  };
}

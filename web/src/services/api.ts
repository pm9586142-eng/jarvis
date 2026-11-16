import {
  AgentDescriptor,
  BackendHealth,
  BrowserTelemetry,
  ChatBrainMeta,
  ChatMessage,
  ChatSource,
  LanguageCode,
  LanguageDescriptor,
  MemoryItem,
} from '../types/jarvis';
import { ParsedReminderResult, parseReminderFallback } from './reminderParser';
import { analyzeBrainRequest, BrainAnalysis } from './brainEngine.js';
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

export async function checkBackendHealth(timeoutMs = 5000): Promise<BackendHealth> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(resolveApiUrl('/health'), {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Health check failed with HTTP ${res.status}`);
    }
    return (await res.json()) as BackendHealth;
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
  onError: (message: string) => void;
}

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
        done?: boolean;
      };

      if (event.meta && callbacks.onMeta) {
        callbacks.onMeta(event.meta);
      }
      if (event.error) {
        completed = true;
        callbacks.onError(event.error);
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
      let errMsg = `Server error (${response.status})`;
      try {
        const json = await response.json();
        if (json?.error) errMsg = json.error;
      } catch {
        // Ignore JSON parse fallback
      }
      callbacks.onError(errMsg);
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
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `Summarization failed (HTTP ${res.status})`);
    }
    return data as ConversationSummaryResult;
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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `Vision API error (${res.status})`);
    }
    return data as { analysis: string; model: string };
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
  if (params.userPrompt.trim().length < 6) return [];
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
  }
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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `Music generation error (${res.status})`);
    }
    return data as GenerateMusicResponse;
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
  }
}

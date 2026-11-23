import { buildJsonHeaders, resolveApiUrl } from './api';
import {
  OpenJarvisAgentRunResponse,
  OpenJarvisDocumentItem,
  OpenJarvisResearchReport,
  OpenJarvisSearchResultItem,
  OpenJarvisStatusSnapshot,
} from '../types/openjarvis';

async function ojRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(resolveApiUrl(`/api/openjarvis${path}`), {
    ...init,
    headers: {
      ...buildJsonHeaders(),
      ...(init.headers || {}),
    },
  });
  const text = await res.text().catch(() => '');
  let parsed: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { error: text };
    }
  }
  if (!res.ok && res.status !== 409) {
    throw new Error(String(parsed.error || `OpenJarvis request failed (HTTP ${res.status})`));
  }
  return parsed as T;
}

export async function fetchOpenJarvisStatus(): Promise<OpenJarvisStatusSnapshot> {
  return ojRequest<OpenJarvisStatusSnapshot>('/status', { method: 'GET' });
}

export async function runOpenJarvisAgent(payload: {
  prompt: string;
  agentId?: string;
  assistantMode?: string;
  engineId?: string;
  confirmToken?: string | null;
  confirmedSensitiveAction?: boolean;
}): Promise<OpenJarvisAgentRunResponse> {
  return ojRequest<OpenJarvisAgentRunResponse>('/agents/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function probeOpenJarvisEngine(engineId: string): Promise<Record<string, unknown>> {
  return ojRequest<Record<string, unknown>>(`/engines/${encodeURIComponent(engineId)}/probe`, {
    method: 'POST',
  });
}

export async function discoverOpenJarvisEngines(includeUnconfigured = false): Promise<Record<string, unknown>> {
  return ojRequest<Record<string, unknown>>('/engines/discover', {
    method: 'POST',
    body: JSON.stringify({ includeUnconfigured }),
  });
}

export async function configureOpenJarvisEngine(
  engineId: string,
  patch: { baseUrl?: string; enabled?: boolean; apiKey?: string; makeDefault?: boolean }
): Promise<Record<string, unknown>> {
  return ojRequest<Record<string, unknown>>(`/engines/${encodeURIComponent(engineId)}/config`, {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

export async function listOpenJarvisDocuments(): Promise<{
  ok: boolean;
  documents: OpenJarvisDocumentItem[];
  researchHistory: OpenJarvisResearchReport[];
}> {
  return ojRequest('/memory/documents', { method: 'GET' });
}

export async function indexOpenJarvisDocument(payload: {
  title: string;
  text: string;
  sourceType?: string;
  tags?: string[];
}): Promise<{ ok: boolean; document?: OpenJarvisDocumentItem; chunksIndexed?: number }> {
  return ojRequest('/memory/documents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteOpenJarvisDocument(docId: string): Promise<{ ok: boolean }> {
  return ojRequest(`/memory/documents/${encodeURIComponent(docId)}`, { method: 'DELETE' });
}

export async function searchOpenJarvisHybridMemory(payload: {
  query: string;
  mode: 'hybrid' | 'bm25' | 'vector' | 'colbert';
  limit?: number;
}): Promise<{
  ok: boolean;
  totalCorpusItems: number;
  results: OpenJarvisSearchResultItem[];
}> {
  return ojRequest('/memory/search', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function executeOpenJarvisTool(
  toolId: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return ojRequest('/tools/execute', {
    method: 'POST',
    body: JSON.stringify({ toolId, args }),
  });
}

export async function runOpenJarvisDeepResearch(payload: {
  query: string;
  engineId?: string;
}): Promise<{
  ok: boolean;
  report: OpenJarvisResearchReport;
  steps: Array<{ phase: string; detail: string }>;
  citations: Array<{ kind: string; title: string; uri?: string; score?: number }>;
  engineId: string;
  modelUsed: string;
  latencyMs: number;
}> {
  return ojRequest('/research/deep', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createOpenJarvisWorkflow(payload: {
  name: string;
  kind: string;
  scheduleIntervalMinutes: number;
  prompt: string;
  confirmToken?: string | null;
}): Promise<Record<string, unknown>> {
  return ojRequest('/automation/workflows', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function runOpenJarvisWorkflowNow(workflowId: string): Promise<Record<string, unknown>> {
  return ojRequest(`/automation/workflows/${encodeURIComponent(workflowId)}/run`, { method: 'POST' });
}

export async function deleteOpenJarvisWorkflow(workflowId: string): Promise<{ ok: boolean }> {
  return ojRequest(`/automation/workflows/${encodeURIComponent(workflowId)}`, { method: 'DELETE' });
}

export async function markOpenJarvisNotificationsRead(): Promise<{ ok: boolean }> {
  return ojRequest('/automation/notifications/read', { method: 'POST' });
}

export async function registerOpenJarvisMcpServer(payload: {
  name: string;
  url: string;
  allowedTools?: string[];
}): Promise<Record<string, unknown>> {
  return ojRequest('/mcp/servers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function discoverOpenJarvisMcpTools(serverId: string): Promise<Record<string, unknown>> {
  return ojRequest(`/mcp/servers/${encodeURIComponent(serverId)}/discover`, { method: 'POST' });
}

export async function invokeOpenJarvisMcpTool(
  serverId: string,
  toolName: string,
  confirmed = false
): Promise<Record<string, unknown>> {
  return ojRequest(`/mcp/servers/${encodeURIComponent(serverId)}/invoke`, {
    method: 'POST',
    body: JSON.stringify({ toolName, confirmed }),
  });
}

export async function updateOpenJarvisLearningPolicy(patch: {
  strategy?: 'adaptive_ucb1' | 'prefer_local' | 'cloud_first';
  preferLocalWhenHealthy?: boolean;
}): Promise<Record<string, unknown>> {
  return ojRequest('/learning/policy', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function rateOpenJarvisTrace(traceId: string, rating: number): Promise<Record<string, unknown>> {
  return ojRequest(`/learning/traces/${encodeURIComponent(traceId)}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  });
}

export async function runOpenJarvisBenchmark(engineId = 'amai_cloud', agentId = 'native_react'): Promise<Record<string, unknown>> {
  return ojRequest('/learning/benchmark', {
    method: 'POST',
    body: JSON.stringify({ engineId, agentId }),
  });
}

export type OpenJarvisTabId =
  | 'agents'
  | 'intelligence'
  | 'memory'
  | 'research'
  | 'automation'
  | 'learning';

export interface OpenJarvisHardwareInfo {
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  totalRamGb: number;
  freeRamGb: number;
  isServerless: boolean;
  runtimeMode: string;
  gpu: {
    detected: boolean;
    name: string | null;
    vramTotalGb: number;
    vramFreeGb: number;
    source: string;
  };
  inspectedAt: string;
}

export interface OpenJarvisModelInfo {
  id: string;
  name: string;
  family: string;
  paramsB: number;
  quantization: string;
  minRamGb: number;
  minVramGb: number;
  contextLength: number;
  engines: string[];
  capabilities: string[];
  efficiencyTier: string;
  tokensPerSecEstimate: number;
  wattsEstimate: number;
  costTier: string;
  notes: string;
  fitStatus: string;
  recommended: boolean;
  fitReason: string;
}

export interface OpenJarvisEngineInfo {
  id: string;
  name: string;
  kind: string;
  protocol: string;
  envUrlVar: string | null;
  baseUrl: string;
  defaultUrl: string;
  description: string;
  configured: boolean;
  enabled: boolean;
  status: string;
  latencyMs: number | null;
  lastCheckedAt: number | null;
  lastMessage: string;
  discoveredModels: string[];
  isDefault: boolean;
  supportedOnServerless: boolean;
  supportedOnPc: boolean;
  supportedOnAndroidRemote: boolean;
}

export interface OpenJarvisAgentDef {
  id: string;
  name: string;
  sourceClass: string;
  category: string;
  availability: 'available' | 'optional_python_runtime' | 'optional_cli_license';
  description: string;
  supportsTools: boolean;
}

export interface OpenJarvisAssistantModeDef {
  id: string;
  name: string;
  defaultAgentId: string;
  icon: string;
  description: string;
}

export interface OpenJarvisToolDef {
  id: string;
  name: string;
  source: string;
  description: string;
  requiresConfirmation: boolean;
  parameters: Record<string, string>;
}

export interface OpenJarvisSearchResultItem {
  id: string;
  docId: string;
  kind: string;
  title: string;
  text: string;
  sourceType: string;
  sourceUri: string;
  score: number;
  scores: {
    bm25: number;
    vector: number;
    colbert: number;
    hybrid: number;
  };
}

export interface OpenJarvisDocumentItem {
  id: string;
  title: string;
  sourceType: string;
  sourceUri: string;
  tags: string[];
  charCount: number;
  wordCount: number;
  chunkCount: number;
  excerpt: string;
  createdAt: number;
}

export interface OpenJarvisResearchReport {
  id: string;
  query: string;
  summary: string;
  citations: Array<{ kind: string; title: string; uri?: string; score?: number }>;
  mode: string;
  createdAt: number;
}

export interface OpenJarvisMcpServer {
  id: string;
  name: string;
  transport: string;
  url: string;
  enabled: boolean;
  status: string;
  allowedTools: string[];
  requireConfirmation: boolean;
  discoveredTools: Array<{ name: string; description: string }>;
  lastMessage: string;
  lastCheckedAt: number | null;
}

export interface OpenJarvisTraceItem {
  id: string;
  timestamp: number;
  agentId: string;
  assistantMode: string;
  engineId: string;
  modelUsed: string;
  ok: boolean;
  errorMessage: string | null;
  latencyMs: number;
  totalTokens: number;
  toolsUsed: string[];
  promptPreview: string;
  answerPreview: string;
  confidenceScore: number;
  userRating: number | null;
  efficiency?: {
    isLocalInference: boolean;
    estimatedWatts: number;
    estimatedJoules: number;
    tokensPerSec: number;
    efficiencyNote: string;
  };
}

export interface OpenJarvisWorkflow {
  id: string;
  name: string;
  kind: string;
  agentId: string;
  prompt: string;
  scheduleIntervalMinutes: number;
  enabled: boolean;
  lastRunAt: number | null;
  runCount: number;
  lastStatus: string;
  lastSummary: string;
}

export interface OpenJarvisNotification {
  id: string;
  workflowId: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
}

export interface OpenJarvisStatusSnapshot {
  ok: boolean;
  integrationLayer: string;
  existingAiApiPreserved: boolean;
  namespace: string;
  hardware: OpenJarvisHardwareInfo;
  pythonService: {
    connected: boolean;
    capabilities: Record<string, boolean> | null;
    url: string;
  };
  modelsCount: number;
  models: OpenJarvisModelInfo[];
  engines: OpenJarvisEngineInfo[];
  defaultEngineId: string;
  agents: OpenJarvisAgentDef[];
  assistantModes: OpenJarvisAssistantModeDef[];
  tools: OpenJarvisToolDef[];
  mcpServers: OpenJarvisMcpServer[];
  memoryStats: {
    documentsCount: number;
    chunksCount: number;
    memoriesBridgedCount: number;
    researchHistoryCount: number;
    backends: Record<string, boolean>;
  };
  learning: {
    policy: {
      strategy: 'adaptive_ucb1' | 'prefer_local' | 'cloud_first';
      preferLocalWhenHealthy: boolean;
    };
    summary: {
      totalTraces: number;
      successRate: number;
      avgLatencyMs: number;
      totalTokens: number;
      totalEstimatedJoules: number;
      byAgent: Array<{ id: string; runs: number; successRate: number; avgLatencyMs: number; avgQualityScore: number }>;
      byModel: Array<{ id: string; runs: number; successRate: number; avgLatencyMs: number; avgQualityScore: number }>;
      byEngine: Array<{ id: string; runs: number; successRate: number; avgLatencyMs: number; avgQualityScore: number }>;
      recommendations: string[];
    };
    recentTraces: OpenJarvisTraceItem[];
    benchmarks: Array<{
      id: string;
      timestamp: number;
      engineId: string;
      agentId: string;
      modelUsed: string;
      ok: boolean;
      latencyMs: number;
      tokensPerSecEstimate: number;
    }>;
  };
  automation: {
    scheduler: { backgroundTickerActive: boolean; runtimeMode: string };
    workflows: OpenJarvisWorkflow[];
    notifications: OpenJarvisNotification[];
  };
  timestamp: string;
}

export interface OpenJarvisAgentRunResponse {
  ok: boolean;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  reasons?: Array<{ id: string; label: string }>;
  experimentalOrOptional?: boolean;
  code?: string;
  error?: string;
  agentId?: string;
  agentName?: string;
  assistantMode?: string;
  assistantName?: string;
  answer?: string;
  steps?: Array<{ phase: string; detail: string }>;
  toolCalls?: Array<{ tool: string; ok: boolean; summary: string }>;
  citations?: Array<{ kind: string; title: string; uri?: string; score?: number }>;
  routingNote?: string | null;
  engineId?: string;
  engineName?: string;
  modelUsed?: string;
  fallbackUsed?: boolean;
  traceId?: string;
  latencyMs?: number;
}

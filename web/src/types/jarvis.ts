export type AgentId = 'JARVIS_PRIME' | 'VERONICA_RESEARCH' | 'DUM_E_ENGINEER' | 'FRIDAY_COORDINATOR' | 'HOMER_DIAGNOSTICS';

export type LanguageCode = 'ENGLISH' | 'HINDI' | 'HINGLISH' | 'GUJARATI';

export type ScreenId =
  | 'opening'
  | 'dashboard'
  | 'brain_center'
  | 'chat'
  | 'voice'
  | 'research'
  | 'automation'
  | 'multi_agent'
  | 'security'
  | 'telemetry'
  | 'plugins'
  | 'memory'
  | 'productivity'
  | 'insights'
  | 'smart_home'
  | 'vision'
  | 'orbital_game'
  | 'music_studio'
  | 'media_control'
  | 'ultron'
  | 'settings';

export type ThemeMode = 'dark' | 'light' | 'system';

export type PersonalityPresetId =
  | 'executive_butler'
  | 'concise_tactical'
  | 'friendly_mentor'
  | 'deep_analyst'
  | 'custom';

export type ResponseStyleId = 'concise' | 'balanced' | 'detailed';

export type ReasoningPreference = 'auto' | 'fast' | 'structured' | 'deep';

export type ConnectionState = 'connecting' | 'online' | 'key_missing' | 'offline';

export interface CustomAgent {
  id: string;
  name: string;
  codename: string;
  systemPrompt: string;
  accentColor: string;
  keywords: string[];
  createdAt: number;
}

export type StartupSummaryStatus =
  | 'idle'
  | 'preparing'
  | 'speaking'
  | 'paused'
  | 'completed'
  | 'awaiting_gesture'
  | 'muted'
  | 'disabled'
  | 'unsupported';

export interface DailyBriefingData {
  greeting: string;
  weatherSummary: string;
  tasksSummary: string;
  batterySummary: string;
  securitySummary?: string;
  spokenSummary?: string;
  aiLine: string;
  source: 'gemini' | 'fallback';
  generatedAt: number;
  error?: string;
}

export interface AgentDescriptor {
  id: AgentId;
  codename: string;
  designation: string;
  specialization: string;
  accentColor: string;
  systemPrompt: string;
  enableWebSearch?: boolean;
}

export interface LanguageDescriptor {
  code: LanguageCode;
  displayName: string;
  shortCode: string;
  bcp47: string;
  greeting: string;
  instruction: string;
}

export interface ChatSource {
  title: string;
  uri: string;
  provider?: string;
  snippet?: string;
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  previewDataUrl?: string;
  isTextContext?: boolean;
}

export type AiProviderId =
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'mistral'
  | 'sambanova'
  | 'nvidia'
  | 'cloudflare'
  | 'cohere'
  | 'huggingface'
  | 'ollama'
  | 'deepseek'
  | (string & {});

export interface BrainSubtaskResult {
  subtaskId: string;
  agentId: string;
  agentName: string;
  domain: string;
  status: 'fulfilled' | 'rejected';
  provider: string | null;
  providerLabel: string | null;
  model: string | null;
  latencyMs: number;
  retried: boolean;
  preview: string;
}

export interface BrainVerificationReport {
  confidenceScore: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'NEEDS_REVIEW';
  retryRecommended: boolean;
  codeIssues: Array<{ severity: string; detail: string }>;
  contradictions: Array<{ severity: string; summary: string }>;
  missingInfo: string[];
  toolIssues: string[];
  checkedAt?: string;
}

export interface ChatBrainMeta {
  intent: string;
  detectedLanguage: LanguageCode;
  isFollowUp: boolean;
  reasoningMode: 'fast' | 'structured' | 'deep';
  recommendedAgent: string;
  personality?: PersonalityPresetId;
  responseStyle?: ResponseStyleId;
  contextTurns?: number;
  earlierTurnsCount?: number;
  provider?: AiProviderId;
  providerLabel?: string;
  primaryProvider?: AiProviderId;
  switchedFromProvider?: AiProviderId | null;
  model?: string;
  primaryModel?: string;
  fallbackUsed?: boolean;
  switchedFrom?: string | null;
  brainMode?: 'direct' | 'specialist' | 'collaboration';
  complexity?: 'simple' | 'moderate' | 'complex';
  complexityReason?: string;
  agentsUsed?: string[];
  subtasks?: BrainSubtaskResult[];
  verification?: BrainVerificationReport | null;
  selfCorrected?: boolean;
  sensitiveActionWarning?: string[];
  taskId?: string | null;
}

export interface ChatErrorMeta {
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
}

export interface ChatMessage {
  id: string;
  sessionId?: string;
  role: 'user' | 'jarvis';
  text: string;
  agentCodename: string;
  timestamp: number;
  isVoice?: boolean;
  isError?: boolean;
  errorMeta?: ChatErrorMeta;
  sources?: ChatSource[];
  attachment?: ChatAttachment;
  brainMeta?: ChatBrainMeta;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  isTemporary?: boolean;
  contextSummary?: string;
  summaryKeyPoints?: string[];
  summaryActionItems?: string[];
  summarizedTurnCount?: number;
  lastBrainMeta?: ChatBrainMeta;
}

export type MemoryCategory =
  | 'PREFERENCE'
  | 'PROJECT'
  | 'INSTRUCTION'
  | 'TOPIC'
  | 'DECISION'
  | 'COMMAND'
  | 'FACT'
  | 'USER_PREFERENCES'
  | 'IMPORTANT_INSTRUCTIONS'
  | 'PROJECT_CONTEXT'
  | 'CONVERSATION_SUMMARIES'
  | 'LONG_TERM_KNOWLEDGE'
  | 'TASK_HISTORY'
  | 'AGENT_EXECUTION_HISTORY';

export type SyncRecordStatus = 'synced' | 'pending_upsert' | 'pending_delete' | 'conflict';

export interface MemoryItem {
  id: string;
  key: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  createdAt: number;
  updatedAt?: number;
  syncStatus?: SyncRecordStatus;
  deletedAt?: number | null;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  dueTime: string;
  triggerAtMillis?: number;
  isCompleted: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'REMINDER' | 'TASK' | 'SCHEDULE' | 'NOTE';
  createdAt: number;
  updatedAt?: number;
  syncStatus?: SyncRecordStatus;
  deletedAt?: number | null;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
  syncStatus?: SyncRecordStatus;
  deletedAt?: number | null;
}

export type SyncEntityType = 'task' | 'note' | 'memory';

export interface SyncConflictItem {
  id: string;
  entityType: SyncEntityType;
  label: string;
  localPreview: string;
  cloudPreview: string;
  localUpdatedAt: number;
  cloudUpdatedAt: number;
  localRecord: TaskItem | NoteItem | MemoryItem;
  cloudRecord: TaskItem | NoteItem | MemoryItem;
  detectedAt: number;
}

export type AiRoutingMode = 'hybrid' | 'online_only' | 'local_only' | 'offline_command';

export type ActiveEngineAttribution =
  | 'Cloud AI'
  | 'Local PC AI'
  | 'Ollama (Opt-In)'
  | 'Offline Command Engine'
  | 'Pending';

export type LocalModelDownloadStatus =
  | 'not_installed'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'failed';

export interface LocalModelCatalogEntry {
  id: string;
  displayName: string;
  huggingfaceId: string;
  quantization: 'q4' | 'q8';
  approxSizeMb: number;
  minRamGb: number;
  recommendedTier: 'light' | 'balanced';
  summary: string;
}

export interface LocalModelRuntimeState {
  modelId: string;
  status: LocalModelDownloadStatus;
  progressPercent: number;
  loadedInMemory: boolean;
  backendUsed: 'webgpu' | 'wasm' | null;
  errorMessage?: string | null;
  updatedAt: number;
}

export interface WebGpuHardwareCapabilities {
  webGpuAvailable: boolean;
  wasmAvailable: boolean;
  deviceMemoryGb: number | null;
  cpuCores: number;
  storageQuotaMb: number | null;
  storageUsedMb: number | null;
  storageFreeMb: number | null;
  speechRecognitionAvailable: boolean;
  speechRecognitionOfflineCaveat: string;
  localTtsVoicesCount: number;
  checkedAt: number;
}

export interface AutomationHistoryItem {
  id: string;
  actionType: 'OPEN_WEBSITE' | 'QUICK_COMMAND' | 'REMINDER' | 'NOTE' | 'DAILY_SUMMARY' | 'DRAFT_ACTION';
  label: string;
  target?: string;
  status: 'EXECUTED' | 'CANCELLED' | 'BLOCKED' | 'DRAFT_READY';
  confirmedByUser: boolean;
  detail: string;
  timestamp: number;
}

export interface QuickActionItem {
  id: string;
  label: string;
  type: 'WEBSITE' | 'PROMPT' | 'NAVIGATE';
  value: string;
  requiresConfirmation?: boolean;
}

export interface UploadedDocumentItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'docx' | 'pdf' | 'text';
  extractedText?: string;
  base64Data?: string;
  wordCount?: number;
  summary?: string;
  uploadedAt: number;
}

export interface LiveSearchResult {
  query: string;
  summary: string;
  verifiedFacts: string[];
  uncertainPoints: string[];
  sources: ChatSource[];
  providersUsed: string[];
  model?: string;
  timestamp: number;
}

export interface GeneratedReportItem {
  id: string;
  reportType: 'executive_report' | 'long_summary' | 'structured_notes' | 'study_guide' | 'coding_explanation';
  title: string;
  content: string;
  wordCount: number;
  createdAt: number;
}

export interface SecurityLogItem {
  id: string;
  timestamp: number;
  eventType: 'AUTH' | 'TOOL_EXEC' | 'NETWORK' | 'ANOMALY' | 'SCAN';
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  sourceAgent: string;
}

export interface VulnerabilityCheck {
  title: string;
  description: string;
  isSecure: boolean;
  recommendation: string;
}

export interface SecurityReport {
  score: number;
  defconLevel: 1 | 2 | 3 | 4 | 5;
  threatStatus: string;
  checks: VulnerabilityCheck[];
  alerts: string[];
  lastScanTime: number;
}

export interface AgentCollaborationLog {
  id: string;
  fromCodename: string;
  toCodename: string;
  action: string;
  detail: string;
  timestamp: number;
}

export interface SmartDevice {
  id: string;
  name: string;
  room: string;
  type: 'LIGHT' | 'CLIMATE' | 'SECURITY' | 'APPLIANCE';
  isOn: boolean;
  value: string;
}

export interface BrowserTelemetry {
  online: boolean;
  networkType: string;
  batteryPercent: number | null;
  isCharging: boolean | null;
  deviceMemoryGb: number | null;
  heapUsedMb: number | null;
  heapLimitMb: number | null;
  storageUsedMb?: number | null;
  storageQuotaMb?: number | null;
  cpuCores: number;
  platform: string;
  viewport: string;
  uptimeMinutes: number;
}

export interface FreeModelPoolEntry {
  model: string;
  isPrimary: boolean;
  freeTierApproved: boolean;
  pricingVerified?: boolean;
  status: 'available' | 'cooldown' | 'rpd_exhausted' | 'unavailable' | 'auth_error' | 'billing_blocked';
  cooldownRemainingSeconds: number;
  lastErrorCode: string | null;
}

export interface FreeTierFallbackStatus {
  enabled: boolean;
  freeTierOnly: boolean;
  primaryModel: string;
  lastActiveModel: string;
  fallbackModels: string[];
  rejectedModels: string[];
  availableCount: number;
  allExhausted: boolean;
  shortestCooldownSeconds: number;
  totalFallbackSwitches: number;
  dynamicDiscoveryUsed: boolean;
  models: FreeModelPoolEntry[];
}

export interface FreeProviderHealthSummary {
  id: AiProviderId;
  label: string;
  configured: boolean;
  pricingPolicy: 'FREE_TIER_ALLOWLIST' | 'LIVE_ZERO_PRICE_VERIFIED';
  pricingVerified: boolean;
  status: 'ready' | 'cooldown' | 'exhausted' | 'unconfigured' | 'auth_error';
  availableCount: number;
  totalModels: number;
  cooldownRemainingSeconds: number;
  rejectedModels: string[];
  models: FreeModelPoolEntry[];
}

export interface MultiProviderStatus {
  zeroCostEnforced: boolean;
  paidFallbackBlocked: boolean;
  providerOrder: AiProviderId[];
  configuredProviders: AiProviderId[];
  readyProvidersCount: number;
  primaryProvider: AiProviderId;
  primaryModel: string;
  activeProvider: AiProviderId;
  activeProviderLabel: string;
  activeModel: string;
  totalProviderSwitches: number;
  totalFallbackSwitches: number;
  allProvidersExhausted: boolean;
  shortestCooldownSeconds: number;
  providers: FreeProviderHealthSummary[];
}

export interface BrainHealthBrief {
  enabled: boolean;
  strictZeroCostEnforced: boolean;
  providersCount: number;
  configuredProvidersCount: number;
  specialistAgentsCount: number;
  collaborationMode: 'auto' | 'on' | 'off';
  routingMode: 'auto' | 'manual' | 'task_based';
  runtime: string;
  storageMode: string;
}

export interface BackendHealth {
  status: 'ok' | 'error';
  geminiConfigured: boolean;
  groqConfigured?: boolean;
  openrouterConfigured?: boolean;
  aiConfigured?: boolean;
  zeroCostEnforced?: boolean;
  tavilyConfigured?: boolean;
  youtubeConfigured?: boolean;
  authRequired?: boolean;
  model: string;
  activeProvider?: AiProviderId;
  activeProviderLabel?: string;
  activeModel?: string;
  freeTierFallback?: FreeTierFallbackStatus;
  multiProvider?: MultiProviderStatus;
  brain?: BrainHealthBrief;
  capabilities?: string[];
  uptimeSeconds: number;
  timestamp: string;
}

export type AccentThemeId = 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose';

export interface JarvisSettings {
  speechRate: number;
  speechPitch: number;
  voiceVolume: number;
  voiceMuted: boolean;
  voiceModeEnabled: boolean;
  femaleVoiceEnabled: boolean;
  welcomeGreetingEnabled: boolean;
  autoDetectVoiceLanguage: boolean;
  voiceLanguagePreference: LanguageCode;
  continuousConversationMode: boolean;
  wakeWordEnabled?: boolean;
  audioDuckingEnabled?: boolean;
  mediaDefaultVolume?: number;
  selectedVoiceUri: string;
  reducedMotion: boolean;
  powerSaving: boolean;
  autoSpeakReplies: boolean;
  autoSpeakDailySummary: boolean;
  webSearchEnabled: boolean;
  memoryEnabled: boolean;
  autoExtractMemories: boolean;
  personality: PersonalityPresetId;
  customInstructions: string;
  responseStyle: ResponseStyleId;
  reasoningPreference: ReasoningPreference;
  brainCollaborationMode: BrainCollaborationMode;
  themeMode: ThemeMode;
  userNamespace: string;
  taskNotificationsEnabled: boolean;
  quickActions: QuickActionItem[];
  defaultAgent: AgentId;
  accentTheme: AccentThemeId;
  pinProtected: boolean;
  userPin: string;
  classicMode?: boolean;
  startupAnimationMode?: 'full' | 'short' | 'off';
  animationIntensity?: 'high' | 'balanced' | 'low';
  wakeWordLegacyJarvisAlias?: boolean;
  conversationWindowSeconds?: number;
  pushToTalk?: boolean;
  standbyTimeoutMinutes?: number;
  showClockHud?: boolean;
  showWeatherHud?: boolean;
  showMetricsHud?: boolean;
  showEventLogHud?: boolean;
  weatherCity?: string;
  routingMode?: AiRoutingMode;
  selectedLocalModelId?: string;
  ollamaEnabled?: boolean;
  ollamaEndpoint?: string;
  ollamaModel?: string;
  crossDeviceSyncOptIn?: boolean;
  autoUnloadLocalModelMinutes?: number;
}

export interface SystemEventEntry {
  id: string;
  timestamp: number;
  category: 'COMMAND' | 'AI' | 'VOICE' | 'BACKEND' | 'MEDIA' | 'PROTOCOL' | 'LOCAL_AI' | 'SYNC' | 'ERROR';
  title: string;
  detail: string;
  severity: 'info' | 'success' | 'warn' | 'error';
}

export type BrainControlTabId =
  | 'control_center'
  | 'providers'
  | 'models_router'
  | 'agents'
  | 'collaboration'
  | 'shared_memory'
  | 'usage'
  | 'errors'
  | 'tasks'
  | 'health_audit';

export interface BrainProviderModelInfo {
  id: string;
  domains: string[];
  vision: boolean;
  freeVerified: boolean;
  livePricingVerified: boolean;
  cooldownRemainingSeconds: number;
}

export interface BrainProviderInfo {
  id: string;
  label: string;
  protocol: string;
  envVars: string[];
  baseUrl: string;
  billingTier: string;
  eligibleForZeroCost: boolean;
  requiresLiveZeroPricing: boolean;
  configured: boolean;
  enabled: boolean;
  priority: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  status: string;
  connectionState: string;
  lastProbeAt: number | null;
  lastProbeLatencyMs: number | null;
  lastProbeMessage: string;
  cooldownRemainingSeconds: number;
  lastErrorCode: string | null;
  freeQuotaNote: string;
  isCustom: boolean;
  models: BrainProviderModelInfo[];
}

export interface BrainAgentInfo {
  id: string;
  name: string;
  codename: string;
  domain: string;
  role: string;
  instructions: string;
  enabled: boolean;
  preferredProvider: string | null;
  preferredModel: string | null;
  temperature: number;
  maxTokens: number;
  requiresVision?: boolean;
  keywords: string[];
}

export type BrainRoutingMode = 'auto' | 'manual' | 'task_based';
export type BrainCollaborationMode = 'auto' | 'on' | 'off';

export interface BrainRoutingPolicy {
  mode: BrainRoutingMode;
  strictZeroCost: boolean;
  preferFreeTier: boolean;
  manualProvider: string | null;
  manualModel: string | null;
  fallbackOrder: string[];
  domainPreferences: Record<string, string[]>;
  maxProvidersPerRequest: number;
  maxModelsPerProvider: number;
  requestTimeoutMs: number;
}

export interface BrainCoordinatorConfig {
  collaborationMode: BrainCollaborationMode;
  maxAgents: number;
  tokenBudget: number;
  requestBudgetPerHour: number;
  selfVerificationEnabled: boolean;
  recordExecutionMemories: boolean;
  serverlessDeadlineMs: number;
}

export type BrainPolicyPatch = Partial<
  Pick<
    BrainRoutingPolicy,
    | 'mode'
    | 'manualProvider'
    | 'manualModel'
    | 'fallbackOrder'
    | 'requestTimeoutMs'
    | 'maxProvidersPerRequest'
  >
> &
  Partial<
    Pick<
      BrainCoordinatorConfig,
      | 'collaborationMode'
      | 'maxAgents'
      | 'tokenBudget'
      | 'requestBudgetPerHour'
      | 'selfVerificationEnabled'
      | 'recordExecutionMemories'
    >
  >;

export interface BrainUsageSnapshot {
  uptimeSeconds: number;
  totals: {
    requests: number;
    successes: number;
    failures: number;
    rateLimits: number;
    inputTokens: number;
    outputTokens: number;
    fallbackSwitches: number;
    estimatedCostUsd: number;
  };
  providers: Array<{
    providerId: string;
    requests: number;
    successes: number;
    failures: number;
    rateLimits: number;
    avgLatencyMs: number;
    inputTokens: number;
    outputTokens: number;
    lastStatus: number | null;
    lastError: string | null;
    lastUsedAt: number | null;
  }>;
  models: Array<{
    modelId: string;
    providerId: string;
    requests: number;
    successes: number;
    failures: number;
    avgLatencyMs: number;
    totalTokens: number;
  }>;
  agents: Array<{
    agentId: string;
    invocations: number;
    successes: number;
    failures: number;
    avgLatencyMs: number;
    lastUsedAt: number | null;
  }>;
  recentFallbacks: Array<{
    id: string;
    timestamp: number;
    fromProvider: string;
    fromModel: string;
    toProvider: string;
    toModel: string;
    reason: string;
  }>;
}

export interface BrainErrorEvent {
  id: string;
  timestamp: number;
  category: string;
  providerId: string | null;
  modelId: string | null;
  agentId: string | null;
  code: string;
  httpStatus: number | null;
  message: string;
}

export interface BrainTaskRun {
  id: string;
  type: string;
  promptPreview: string;
  complexity: string;
  requestedAgents: string[];
  routingMode: string;
  status: string;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  provider: string | null;
  model: string | null;
  fallbackUsed: boolean;
  agentsUsed: string[];
  confidenceScore: number | null;
  confidenceLevel: string | null;
  contradictionsCount: number;
  subtasks?: BrainSubtaskResult[];
  verification?: BrainVerificationReport | null;
  error: string | null;
}

export interface BrainAuditEntry {
  id: string;
  timestamp: number;
  category: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  action: string;
  detail: string;
}

export interface BrainSystemHealth {
  status: 'healthy' | 'degraded' | 'offline';
  runtime: string;
  storageMode: string;
  uptimeSeconds: number;
  memoryMb: { rss: number; heapUsed: number };
  providersConfigured: number;
  providersReady: number;
  providersBlockedPaid: number;
  totalRequests: number;
  totalRateLimits: number;
  totalFallbacks: number;
  securityEvents: { total: number; warnings: number; critical: number };
}

export interface BrainStatusSnapshot {
  strictZeroCostEnforced: boolean;
  coordinator: BrainCoordinatorConfig;
  router: BrainRoutingPolicy;
  providers: BrainProviderInfo[];
  agents: BrainAgentInfo[];
  usage: BrainUsageSnapshot;
  recentErrors: BrainErrorEvent[];
  recentTasks: BrainTaskRun[];
  recentCollaborations: BrainTaskRun[];
  auditLogs: BrainAuditEntry[];
  systemHealth: BrainSystemHealth;
  namespace: string;
  timestamp: string;
}

export type LyriaModelMode = 'clip' | 'pro';

export interface GeneratedMusicTrack {
  id: string;
  title: string;
  prompt: string;
  model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
  mode: LyriaModelMode;
  mimeType: string;
  audioBase64: string;
  lyrics?: string;
  durationLabel: string;
  createdAt: number;
}

export type UltronVisualMode =
  | 'normal'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'answering'
  | 'energy'
  | 'hologram';

export type UltronShapeForm =
  | 'sphere'
  | 'icosahedron'
  | 'octahedron'
  | 'torus_knot'
  | 'helix';

export interface UltronChatTurn {
  id: string;
  role: 'user' | 'ultron';
  text: string;
  timestamp: number;
  isVoice?: boolean;
  isError?: boolean;
  provider?: string;
  model?: string;
}

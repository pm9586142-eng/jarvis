export type AgentId = 'JARVIS_PRIME' | 'VERONICA_RESEARCH' | 'DUM_E_ENGINEER' | 'FRIDAY_COORDINATOR' | 'HOMER_DIAGNOSTICS';

export type LanguageCode = 'ENGLISH' | 'HINDI' | 'HINGLISH' | 'GUJARATI';

export type ScreenId =
  | 'opening'
  | 'dashboard'
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

export type AiProviderId = 'gemini' | 'groq' | 'openrouter';

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
  | 'FACT';

export interface MemoryItem {
  id: string;
  key: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  createdAt: number;
  updatedAt?: number;
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
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
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

export interface BackendHealth {
  status: 'ok' | 'error';
  geminiConfigured: boolean;
  groqConfigured?: boolean;
  openrouterConfigured?: boolean;
  aiConfigured?: boolean;
  zeroCostEnforced?: boolean;
  tavilyConfigured?: boolean;
  authRequired?: boolean;
  model: string;
  activeProvider?: AiProviderId;
  activeProviderLabel?: string;
  activeModel?: string;
  freeTierFallback?: FreeTierFallbackStatus;
  multiProvider?: MultiProviderStatus;
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
  continuousConversationMode: boolean;
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
  themeMode: ThemeMode;
  userNamespace: string;
  taskNotificationsEnabled: boolean;
  quickActions: QuickActionItem[];
  defaultAgent: AgentId;
  accentTheme: AccentThemeId;
  pinProtected: boolean;
  userPin: string;
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

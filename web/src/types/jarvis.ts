export type AgentId = 'JARVIS_PRIME' | 'VERONICA_RESEARCH' | 'DUM_E_ENGINEER' | 'FRIDAY_COORDINATOR' | 'HOMER_DIAGNOSTICS';

export type LanguageCode = 'ENGLISH' | 'HINDI' | 'GUJARATI';

export type ScreenId =
  | 'opening'
  | 'dashboard'
  | 'chat'
  | 'voice'
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

export interface DailyBriefingData {
  greeting: string;
  weatherSummary: string;
  tasksSummary: string;
  batterySummary: string;
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
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  previewDataUrl?: string;
  isTextContext?: boolean;
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
  sources?: ChatSource[];
  attachment?: ChatAttachment;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface MemoryItem {
  id: string;
  key: string;
  category: 'PREFERENCE' | 'PROJECT' | 'INSTRUCTION' | 'COMMAND' | 'FACT';
  content: string;
  importance: number;
  createdAt: number;
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

export interface BackendHealth {
  status: 'ok' | 'error';
  geminiConfigured: boolean;
  authRequired?: boolean;
  model: string;
  uptimeSeconds: number;
  timestamp: string;
}

export type AccentThemeId = 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose';

export interface JarvisSettings {
  speechRate: number;
  speechPitch: number;
  reducedMotion: boolean;
  autoSpeakReplies: boolean;
  webSearchEnabled: boolean;
  autoExtractMemories: boolean;
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

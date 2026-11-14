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
  | 'smart_home'
  | 'vision'
  | 'settings';

export type ConnectionState = 'connecting' | 'online' | 'key_missing' | 'offline';

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

export interface ChatMessage {
  id: string;
  role: 'user' | 'jarvis';
  text: string;
  agentCodename: string;
  timestamp: number;
  isVoice?: boolean;
  isError?: boolean;
  sources?: ChatSource[];
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
  cpuCores: number;
  platform: string;
  viewport: string;
  uptimeMinutes: number;
}

export interface BackendHealth {
  status: 'ok' | 'error';
  geminiConfigured: boolean;
  model: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface JarvisSettings {
  speechRate: number;
  speechPitch: number;
  reducedMotion: boolean;
  autoSpeakReplies: boolean;
  webSearchEnabled: boolean;
  pinProtected: boolean;
  userPin: string;
}

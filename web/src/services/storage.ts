import {
  AutomationHistoryItem,
  ChatMessage,
  ChatSession,
  CustomAgent,
  JarvisSettings,
  LanguageCode,
  MemoryItem,
  NoteItem,
  QuickActionItem,
  SecurityLogItem,
  SmartDevice,
  TaskItem,
} from '../types/jarvis';

import { amIndexedDbStore } from './offline/indexedDbStore';

const KEYS = {
  MEMORIES: 'jarvis_web_memories_v1',
  CHATS: 'jarvis_web_chats_v1',
  SESSIONS: 'jarvis_web_sessions_v1',
  ACTIVE_SESSION: 'jarvis_web_active_session_v1',
  CUSTOM_AGENTS: 'jarvis_web_custom_agents_v1',
  TASKS: 'jarvis_web_tasks_v1',
  NOTES: 'jarvis_web_notes_v1',
  AUTOMATIONS: 'jarvis_web_automations_v1',
  LOGS: 'jarvis_web_security_logs_v1',
  DEVICES: 'jarvis_web_smart_devices_v1',
  SETTINGS: 'jarvis_web_settings_v1',
  LANGUAGE: 'jarvis_web_language_v1',
};

const AM_KEYS = {
  MEMORIES: 'am.memories.v1',
  CHATS: 'am.chats.v1',
  SESSIONS: 'am.sessions.v1',
  ACTIVE_SESSION: 'am.activeSession.v1',
  CUSTOM_AGENTS: 'am.customAgents.v1',
  TASKS: 'am.tasks.v1',
  NOTES: 'am.notes.v1',
  AUTOMATIONS: 'am.automations.v1',
  LOGS: 'am.securityLogs.v1',
  DEVICES: 'am.devices.v1',
  SETTINGS: 'am.settings.v1',
  LANGUAGE: 'am.language.v1',
};

const DEFAULT_MEMORIES: MemoryItem[] = [
  {
    id: 'mem_1',
    key: 'Owner Title',
    category: 'PREFERENCE',
    content: "Address owner as 'Sir'. Maintain calm, precise intelligence.",
    importance: 5,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    syncStatus: 'synced',
  },
  {
    id: 'mem_2',
    key: 'Primary Project',
    category: 'PROJECT',
    content: 'AM AI — Cosmic Intelligence Hybrid Offline & Cloud Workspace',
    importance: 5,
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now() - 43200000,
    syncStatus: 'synced',
  },
  {
    id: 'mem_3',
    key: 'Preferred Tone',
    category: 'PREFERENCE',
    content: 'Polite, calm, highly intelligent, and proactive.',
    importance: 4,
    createdAt: Date.now() - 21600000,
    updatedAt: Date.now() - 21600000,
    syncStatus: 'synced',
  },
  {
    id: 'mem_4',
    key: 'Emergency Directive',
    category: 'INSTRUCTION',
    content: 'In DEFCON 1, engage security lockdown and restrict external tool calls.',
    importance: 5,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    syncStatus: 'synced',
  },
];

const DEFAULT_TASKS: TaskItem[] = [
  {
    id: 'task_1',
    title: 'Review AM AI Telemetry & Diagnostics',
    description: 'Verify local model hardware readiness and thermal headroom',
    dueTime: '14:00 Today',
    isCompleted: false,
    priority: 'HIGH',
    category: 'TASK',
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
    syncStatus: 'synced',
  },
  {
    id: 'task_2',
    title: 'Executive Workspace Briefing',
    description: 'Review priority schedule, offline notes, and pending tasks',
    dueTime: '16:30 Today',
    isCompleted: false,
    priority: 'HIGH',
    category: 'SCHEDULE',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    syncStatus: 'synced',
  },
  {
    id: 'task_3',
    title: 'Run Security Audit with HOMER',
    description: 'Routine integrity scan on local vault and API keys',
    dueTime: '19:00 Today',
    isCompleted: false,
    priority: 'MEDIUM',
    category: 'REMINDER',
    createdAt: Date.now() - 1800000,
    updatedAt: Date.now() - 1800000,
    syncStatus: 'synced',
  },
];

const DEFAULT_NOTES: NoteItem[] = [
  {
    id: 'note_1',
    title: 'AM AI Cosmic Command Protocol',
    content:
      'Use Research Studio for live web briefs, Local Model Manager in Settings for offline Windows PC AI, and Voice HUD for bilingual Hey AM commands.',
    tags: ['system', 'briefing'],
    pinned: true,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    syncStatus: 'synced',
  },
];

const DEFAULT_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'qa_1', label: 'Daily Executive Briefing', type: 'PROMPT', value: 'Give me a structured daily executive briefing with priorities and focus recommendations.' },
  { id: 'qa_2', label: 'Open GitHub', type: 'WEBSITE', value: 'https://github.com', requiresConfirmation: false },
  { id: 'qa_3', label: 'Open Google Calendar', type: 'WEBSITE', value: 'https://calendar.google.com', requiresConfirmation: false },
  { id: 'qa_4', label: 'Research Studio', type: 'NAVIGATE', value: 'research' },
];

const DEFAULT_LOGS: SecurityLogItem[] = [
  {
    id: 'sec_1',
    timestamp: Date.now() - 120000,
    eventType: 'AUTH',
    description: 'AM AI Cosmic Intelligence initialized. Local vault & IndexedDB storage mounted.',
    severity: 'INFO',
    sourceAgent: 'AM_AI_SECURITY',
  },
];

const DEFAULT_DEVICES: SmartDevice[] = [
  { id: 'dev_1', name: 'Arc Core Ambient Lighting', room: 'Command Lab', type: 'LIGHT', isOn: true, value: 'Cyan 4000K' },
  { id: 'dev_2', name: 'Cryo-HVAC Climate Control', room: 'Command Lab', type: 'CLIMATE', isOn: true, value: '21.5°C' },
  { id: 'dev_3', name: 'Reactor Containment Bay', room: 'Armor Bay', type: 'SECURITY', isOn: true, value: 'Armed' },
  { id: 'dev_4', name: 'Perimeter Defense Shields', room: 'Perimeter', type: 'SECURITY', isOn: true, value: 'Active 100%' },
  { id: 'dev_5', name: 'Holographic Workspace Array', room: 'Study', type: 'APPLIANCE', isOn: true, value: 'Online' },
];

export const DEFAULT_SETTINGS: JarvisSettings = {
  speechRate: 0.90,
  speechPitch: 0.98,
  voiceVolume: 1.0,
  voiceMuted: false,
  voiceModeEnabled: true,
  femaleVoiceEnabled: true,
  neuralTtsEnabled: true,
  voiceStylePreset: 'laila_soft',
  welcomeGreetingEnabled: true,
  autoDetectVoiceLanguage: true,
  voiceLanguagePreference: 'ENGLISH',
  continuousConversationMode: true,
  wakeWordEnabled: false,
  wakeWordLegacyJarvisAlias: true,
  conversationWindowSeconds: 8,
  pushToTalk: false,
  audioDuckingEnabled: true,
  mediaDefaultVolume: 80,
  selectedVoiceUri: '',
  reducedMotion:
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  powerSaving: false,
  autoSpeakReplies: false,
  autoSpeakDailySummary: true,
  webSearchEnabled: true,
  memoryEnabled: true,
  autoExtractMemories: true,
  personality: 'executive_butler',
  customInstructions: '',
  responseStyle: 'balanced',
  reasoningPreference: 'auto',
  brainCollaborationMode: 'auto',
  themeMode: 'dark',
  hudThemePreset: 'cosmic',
  centerCoreVisualMode: 'hologram_3d',
  userNamespace: 'default',
  taskNotificationsEnabled: true,
  quickActions: DEFAULT_QUICK_ACTIONS,
  defaultAgent: 'JARVIS_PRIME',
  accentTheme: 'cyan',
  pinProtected: true,
  userPin: '1000',
  classicMode: false,
  startupAnimationMode: 'full',
  animationIntensity: 'high',
  standbyTimeoutMinutes: 15,
  showClockHud: true,
  showWeatherHud: true,
  showMetricsHud: true,
  showEventLogHud: true,
  weatherCity: '',
  routingMode: 'hybrid',
  selectedLocalModelId: 'smollm2-135m',
  ollamaEnabled: false,
  ollamaEndpoint: 'http://127.0.0.1:11434',
  ollamaModel: 'llama3.2:1b',
  crossDeviceSyncOptIn: false,
  autoUnloadLocalModelMinutes: 15,
};

function safeRead<T>(amKey: string, legacyKey: string, fallback: T): T {
  try {
    const amRaw = localStorage.getItem(amKey);
    if (amRaw) {
      return JSON.parse(amRaw) as T;
    }
    const legacyRaw = localStorage.getItem(legacyKey);
    if (legacyRaw) {
      // Non-destructive read-through bridge into am.* namespace
      localStorage.setItem(amKey, legacyRaw);
      return JSON.parse(legacyRaw) as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(amKey: string, legacyKey: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(amKey, serialized);
    localStorage.setItem(legacyKey, serialized);
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export const jarvisStore = {
  getMemories: (): MemoryItem[] => safeRead(AM_KEYS.MEMORIES, KEYS.MEMORIES, DEFAULT_MEMORIES),
  saveMemories: (items: MemoryItem[]) => {
    safeWrite(AM_KEYS.MEMORIES, KEYS.MEMORIES, items);
    void amIndexedDbStore.saveMemories(items);
  },

  getChats: (): ChatMessage[] => safeRead(AM_KEYS.CHATS, KEYS.CHATS, []),
  saveChats: (items: ChatMessage[]) => safeWrite(AM_KEYS.CHATS, KEYS.CHATS, items),

  getSessions: (): ChatSession[] => {
    const saved = safeRead<ChatSession[] | null>(AM_KEYS.SESSIONS, KEYS.SESSIONS, null);
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.filter((s) => !s.isTemporary);
    }
    const legacyChats = safeRead<ChatMessage[]>(AM_KEYS.CHATS, KEYS.CHATS, []);
    const firstUser = legacyChats.find((m) => m.role === 'user')?.text.trim();
    const initialTitle = firstUser
      ? firstUser.length <= 42
        ? firstUser
        : `${firstUser.slice(0, 39).trim()}...`
      : 'Primary Neural Link';
    const now = Date.now();
    return [
      {
        id: 'default_session',
        title: initialTitle,
        createdAt: legacyChats[0]?.timestamp ?? now,
        updatedAt: legacyChats[legacyChats.length - 1]?.timestamp ?? now,
        messages: legacyChats.map((m) => ({ ...m, sessionId: m.sessionId || 'default_session' })),
      },
    ];
  },
  saveSessions: (sessions: ChatSession[]) => {
    const filtered = sessions.filter((s) => !s.isTemporary);
    safeWrite(AM_KEYS.SESSIONS, KEYS.SESSIONS, filtered);
    void amIndexedDbStore.saveSessions(filtered);
  },

  getActiveSessionId: (): string =>
    safeRead<string>(AM_KEYS.ACTIVE_SESSION, KEYS.ACTIVE_SESSION, 'default_session'),
  saveActiveSessionId: (id: string) => safeWrite(AM_KEYS.ACTIVE_SESSION, KEYS.ACTIVE_SESSION, id),

  getTasks: (): TaskItem[] => safeRead(AM_KEYS.TASKS, KEYS.TASKS, DEFAULT_TASKS),
  saveTasks: (items: TaskItem[]) => {
    safeWrite(AM_KEYS.TASKS, KEYS.TASKS, items);
    void amIndexedDbStore.saveTasks(items);
  },

  getNotes: (): NoteItem[] => safeRead(AM_KEYS.NOTES, KEYS.NOTES, DEFAULT_NOTES),
  saveNotes: (items: NoteItem[]) => {
    safeWrite(AM_KEYS.NOTES, KEYS.NOTES, items);
    void amIndexedDbStore.saveNotes(items);
  },

  getAutomations: (): AutomationHistoryItem[] =>
    safeRead(AM_KEYS.AUTOMATIONS, KEYS.AUTOMATIONS, []),
  saveAutomations: (items: AutomationHistoryItem[]) =>
    safeWrite(AM_KEYS.AUTOMATIONS, KEYS.AUTOMATIONS, items.slice(0, 120)),

  getSecurityLogs: (): SecurityLogItem[] => safeRead(AM_KEYS.LOGS, KEYS.LOGS, DEFAULT_LOGS),
  saveSecurityLogs: (items: SecurityLogItem[]) => safeWrite(AM_KEYS.LOGS, KEYS.LOGS, items),

  getDevices: (): SmartDevice[] => safeRead(AM_KEYS.DEVICES, KEYS.DEVICES, DEFAULT_DEVICES),
  saveDevices: (items: SmartDevice[]) => safeWrite(AM_KEYS.DEVICES, KEYS.DEVICES, items),

  getSettings: (): JarvisSettings => {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...safeRead<Partial<JarvisSettings>>(AM_KEYS.SETTINGS, KEYS.SETTINGS, {}),
    };
    if (!Array.isArray(merged.quickActions) || merged.quickActions.length === 0) {
      merged.quickActions = DEFAULT_QUICK_ACTIONS;
    }
    return merged;
  },
  saveSettings: (settings: JarvisSettings) => {
    safeWrite(AM_KEYS.SETTINGS, KEYS.SETTINGS, settings);
    void amIndexedDbStore.setMetaValue('settings', settings);
  },

  getLanguage: (): LanguageCode => safeRead<LanguageCode>(AM_KEYS.LANGUAGE, KEYS.LANGUAGE, 'ENGLISH'),
  saveLanguage: (lang: LanguageCode) => safeWrite(AM_KEYS.LANGUAGE, KEYS.LANGUAGE, lang),

  getCustomAgents: (): CustomAgent[] => safeRead<CustomAgent[]>(AM_KEYS.CUSTOM_AGENTS, KEYS.CUSTOM_AGENTS, []),
  saveCustomAgents: (agents: CustomAgent[]) =>
    safeWrite(AM_KEYS.CUSTOM_AGENTS, KEYS.CUSTOM_AGENTS, agents),

  resetAll: () => {
    try {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
      Object.values(AM_KEYS).forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem('jarvis_web_smart_media_memory_v1');
      localStorage.removeItem('jarvis_media_activity_log_v1');
    } catch {
      // Ignore storage access failures
    }
    const now = Date.now();
    return {
      memories: DEFAULT_MEMORIES,
      chats: [] as ChatMessage[],
      sessions: [
        {
          id: 'default_session',
          title: 'Primary Neural Link',
          createdAt: now,
          updatedAt: now,
          messages: [],
        },
      ] as ChatSession[],
      activeSessionId: 'default_session',
      tasks: DEFAULT_TASKS,
      notes: DEFAULT_NOTES,
      automations: [] as AutomationHistoryItem[],
      securityLogs: DEFAULT_LOGS,
      devices: DEFAULT_DEVICES,
      settings: DEFAULT_SETTINGS,
    };
  },
};

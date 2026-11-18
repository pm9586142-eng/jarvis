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

const DEFAULT_MEMORIES: MemoryItem[] = [
  {
    id: 'mem_1',
    key: 'Owner Title',
    category: 'PREFERENCE',
    content: "Address owner as 'Sir'. Maintain subtle British wit.",
    importance: 5,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'mem_2',
    key: 'Primary Project',
    category: 'PROJECT',
    content: 'Project Clean Energy & Mark 85 Autonomous Web Operations',
    importance: 5,
    createdAt: Date.now() - 43200000,
  },
  {
    id: 'mem_3',
    key: 'Preferred Tone',
    category: 'PREFERENCE',
    content: 'Polite, calm, highly intelligent, and proactive.',
    importance: 4,
    createdAt: Date.now() - 21600000,
  },
  {
    id: 'mem_4',
    key: 'Emergency Directive',
    category: 'INSTRUCTION',
    content: 'In DEFCON 1, engage security lockdown and restrict external tool calls.',
    importance: 5,
    createdAt: Date.now() - 3600000,
  },
];

const DEFAULT_TASKS: TaskItem[] = [
  {
    id: 'task_1',
    title: 'Review Mark 85 Flight Telemetry',
    description: 'Analyze thermal dissipation on high-altitude thrusters',
    dueTime: '14:00 Today',
    isCompleted: false,
    priority: 'HIGH',
    category: 'TASK',
    createdAt: Date.now() - 7200000,
  },
  {
    id: 'task_2',
    title: 'Stark Industries Board Briefing',
    description: 'Clean energy distribution Q4 targets',
    dueTime: '16:30 Today',
    isCompleted: false,
    priority: 'HIGH',
    category: 'SCHEDULE',
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'task_3',
    title: 'Run Security Audit with HOMER',
    description: 'Routine integrity scan on satellite link',
    dueTime: '19:00 Today',
    isCompleted: false,
    priority: 'MEDIUM',
    category: 'REMINDER',
    createdAt: Date.now() - 1800000,
  },
];

const DEFAULT_NOTES: NoteItem[] = [
  {
    id: 'note_1',
    title: 'JARVIS Command Protocol',
    content: 'Use Research Studio for live Google Search + Tavily verified briefs, and Smart Automation for approved one-click web actions.',
    tags: ['system', 'briefing'],
    pinned: true,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
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
    description: 'Web Neural Session initialized. Secure storage mounted.',
    severity: 'INFO',
    sourceAgent: 'JARVIS_SECURITY',
  },
];

const DEFAULT_DEVICES: SmartDevice[] = [
  { id: 'dev_1', name: 'Arc Core Ambient Lighting', room: 'Stark Lab', type: 'LIGHT', isOn: true, value: 'Cyan 4000K' },
  { id: 'dev_2', name: 'Cryo-HVAC Climate Control', room: 'Stark Lab', type: 'CLIMATE', isOn: true, value: '21.5°C' },
  { id: 'dev_3', name: 'Mark 85 Armor Bay Doors', room: 'Armor Bay', type: 'SECURITY', isOn: true, value: 'Armed' },
  { id: 'dev_4', name: 'Perimeter Defense Shields', room: 'Tower Perimeter', type: 'SECURITY', isOn: true, value: 'Active 100%' },
  { id: 'dev_5', name: 'Holographic Workspace Array', room: 'Study', type: 'APPLIANCE', isOn: true, value: 'Online' },
];

export const DEFAULT_SETTINGS: JarvisSettings = {
  speechRate: 1.0,
  speechPitch: 1.0,
  voiceVolume: 1.0,
  voiceMuted: false,
  voiceModeEnabled: true,
  continuousConversationMode: false,
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
  themeMode: 'dark',
  userNamespace: 'default',
  taskNotificationsEnabled: true,
  quickActions: DEFAULT_QUICK_ACTIONS,
  defaultAgent: 'JARVIS_PRIME',
  accentTheme: 'cyan',
  pinProtected: true,
  userPin: '1000',
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export const jarvisStore = {
  getMemories: (): MemoryItem[] => safeRead(KEYS.MEMORIES, DEFAULT_MEMORIES),
  saveMemories: (items: MemoryItem[]) => safeWrite(KEYS.MEMORIES, items),

  getChats: (): ChatMessage[] => safeRead(KEYS.CHATS, []),
  saveChats: (items: ChatMessage[]) => safeWrite(KEYS.CHATS, items),

  getSessions: (): ChatSession[] => {
    const saved = safeRead<ChatSession[] | null>(KEYS.SESSIONS, null);
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.filter((s) => !s.isTemporary);
    }
    const legacyChats = safeRead<ChatMessage[]>(KEYS.CHATS, []);
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
  saveSessions: (sessions: ChatSession[]) =>
    safeWrite(
      KEYS.SESSIONS,
      sessions.filter((s) => !s.isTemporary)
    ),

  getActiveSessionId: (): string => safeRead<string>(KEYS.ACTIVE_SESSION, 'default_session'),
  saveActiveSessionId: (id: string) => safeWrite(KEYS.ACTIVE_SESSION, id),

  getTasks: (): TaskItem[] => safeRead(KEYS.TASKS, DEFAULT_TASKS),
  saveTasks: (items: TaskItem[]) => safeWrite(KEYS.TASKS, items),

  getNotes: (): NoteItem[] => safeRead(KEYS.NOTES, DEFAULT_NOTES),
  saveNotes: (items: NoteItem[]) => safeWrite(KEYS.NOTES, items),

  getAutomations: (): AutomationHistoryItem[] => safeRead(KEYS.AUTOMATIONS, []),
  saveAutomations: (items: AutomationHistoryItem[]) => safeWrite(KEYS.AUTOMATIONS, items.slice(0, 120)),

  getSecurityLogs: (): SecurityLogItem[] => safeRead(KEYS.LOGS, DEFAULT_LOGS),
  saveSecurityLogs: (items: SecurityLogItem[]) => safeWrite(KEYS.LOGS, items),

  getDevices: (): SmartDevice[] => safeRead(KEYS.DEVICES, DEFAULT_DEVICES),
  saveDevices: (items: SmartDevice[]) => safeWrite(KEYS.DEVICES, items),

  getSettings: (): JarvisSettings => {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...safeRead<Partial<JarvisSettings>>(KEYS.SETTINGS, {}),
    };
    if (!Array.isArray(merged.quickActions) || merged.quickActions.length === 0) {
      merged.quickActions = DEFAULT_QUICK_ACTIONS;
    }
    return merged;
  },
  saveSettings: (settings: JarvisSettings) => safeWrite(KEYS.SETTINGS, settings),

  getLanguage: (): LanguageCode => safeRead<LanguageCode>(KEYS.LANGUAGE, 'ENGLISH'),
  saveLanguage: (lang: LanguageCode) => safeWrite(KEYS.LANGUAGE, lang),

  getCustomAgents: (): CustomAgent[] => safeRead<CustomAgent[]>(KEYS.CUSTOM_AGENTS, []),
  saveCustomAgents: (agents: CustomAgent[]) => safeWrite(KEYS.CUSTOM_AGENTS, agents),

  resetAll: () => {
    try {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
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

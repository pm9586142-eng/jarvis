import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlarmClock, Brain, Check, Clock, Lock, RotateCcw, X } from 'lucide-react';
import { BackupImportModal } from './components/BackupImportModal';
import { DashboardLayoutMode, HeaderHud } from './components/HeaderHud';
import { OpeningScreen } from './components/OpeningScreen';
import { NavCommandAction, SidebarNav } from './components/SidebarNav';
import {
  AGENT_LIST,
  findMatchingCustomAgent,
  JARVIS_AGENTS,
  JARVIS_LANGUAGES,
  routeIntentToAgent,
} from './data/agents';
import {
  checkBackendHealth,
  extractMemoriesFromTurn,
  parseNaturalReminder,
  StreamCallbacks,
  streamGeminiChat,
  streamMultimodalChat,
  summarizeConversation,
} from './services/api';
import {
  BackupImportPreview,
  buildBackupJson,
  buildBackupMarkdown,
  triggerFileDownload,
  validateAndPrepareBackupImport,
} from './services/backup';
import { generateDailyBriefing, getCachedDailyBriefing } from './services/briefing';
import {
  filterUniqueMemories,
  retrieveRelevantConversations,
  upsertOrMergeMemory,
} from './services/memoryDedupe';
import {
  clearAllMemoriesWithSync,
  deleteMemoryByIdWithSync,
  executeChatMemoryCommand,
  fetchServerMemories,
  saveMemoryWithSync,
  updateMemoryByIdWithSync,
} from './services/memoryService';
import { createInitialPlugins, JarvisPlugin } from './services/plugins';
import { runBrowserSecurityAudit } from './services/security';
import { jarvisStore } from './services/storage';
import { collectBrowserTelemetry, getTelemetryRefreshIntervalMs } from './services/telemetry';
import { isSpeechRecognitionSupported, WebVoiceEngine } from './services/voice';
import { parseLocalVoiceCommand } from './services/voiceCommands';
import {
  AgentCollaborationLog,
  AgentId,
  BackendHealth,
  BrowserTelemetry,
  ChatBrainMeta,
  ChatMessage,
  ChatSession,
  ChatSource,
  ConnectionState,
  CustomAgent,
  DailyBriefingData,
  GeneratedMusicTrack,
  JarvisSettings,
  LanguageCode,
  MemoryItem,
  ScreenId,
  SecurityLogItem,
  SmartDevice,
  TaskItem,
} from './types/jarvis';
import { ChatView, PendingChatAttachment } from './views/ChatView';
import { DashboardView } from './views/DashboardView';
import { InsightsView } from './views/InsightsView';
import { MemoryVaultView } from './views/MemoryVaultView';
import { MultiAgentView } from './views/MultiAgentView';
import { MusicStudioView } from './views/MusicStudioView';
const OrbitalGameView = React.lazy(() =>
  import('./views/OrbitalGameView').then((m) => ({ default: m.OrbitalGameView }))
);
import { PluginsView } from './views/PluginsView';
import { ProductivityView } from './views/ProductivityView';
import { SecurityView } from './views/SecurityView';
import { SettingsView } from './views/SettingsView';
import { SmartHomeView } from './views/SmartHomeView';
import { TelemetryCliView } from './views/TelemetryCliView';
import { VisionScannerView } from './views/VisionScannerView';
import { VoiceHudView } from './views/VoiceHudView';

const INITIAL_TELEMETRY: BrowserTelemetry = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  networkType: typeof navigator !== 'undefined' && navigator.onLine ? 'Online' : 'Offline',
  batteryPercent: null,
  isCharging: null,
  deviceMemoryGb: null,
  heapUsedMb: null,
  heapLimitMb: null,
  cpuCores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
  platform: typeof navigator !== 'undefined' ? navigator.platform || 'Web Browser' : 'Web Browser',
  viewport: typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '1280×720',
  uptimeMinutes: 0,
};

const SCREEN_META: Record<Exclude<ScreenId, 'opening'>, { title: string; subtitle: string }> = {
  dashboard: { title: 'COMMAND CENTER', subtitle: 'JARVIS Quantum HUD • Multi-Subsystem Control' },
  chat: { title: 'NEURAL CHAT MATRIX', subtitle: 'Streaming Gemini 2.5 Intelligence & Citations' },
  voice: { title: 'VOICE INTELLIGENCE', subtitle: 'Web Speech Recognition & Vocal Synthesis' },
  multi_agent: { title: 'MULTI-AGENT HUB', subtitle: 'JARVIS • VERONICA • DUM-E • FRIDAY • HOMER' },
  security: { title: 'STARK SECURITY AUDIT', subtitle: 'DEFCON Posture, Key Isolation & Audit Trail' },
  telemetry: { title: 'TELEMETRY & CLI', subtitle: 'Live Browser Metrics & Neural Terminal' },
  plugins: { title: 'PLUGIN MATRIX', subtitle: 'Modular Tool APIs & Agile Kanban Board' },
  memory: { title: 'MEMORY VAULT', subtitle: 'Persistent Long-Term Context Directives' },
  productivity: { title: 'EXECUTIVE PLANNER', subtitle: 'Tasks, Schedules, Reminders & FRIDAY Briefings' },
  insights: { title: 'USAGE & INSIGHTS', subtitle: '7-Day Neural Telemetry, Agent Analytics & Task Efficiency' },
  smart_home: { title: 'STARK SMART HOME', subtitle: 'Ambient Lighting, Climate & Security Bridge' },
  vision: { title: 'OPTICAL VISION SCANNER', subtitle: 'Webcam Capture, File Upload & Gemini Vision OCR' },
  orbital_game: { title: 'ORBITAL AEGIS 3D', subtitle: 'Three.js 3D Tactical Arena & Lyria Audio' },
  music_studio: { title: 'LYRIA MUSIC CORE', subtitle: 'Gemini Lyria 3 Clip & Full-Track Composer' },
  settings: { title: 'SYSTEM SETTINGS', subtitle: 'Server Health, Voice Calibration & Security PIN' },
};

const VALID_SCREENS = new Set<ScreenId>([
  'opening',
  'dashboard',
  'chat',
  'voice',
  'multi_agent',
  'security',
  'telemetry',
  'plugins',
  'memory',
  'productivity',
  'insights',
  'smart_home',
  'vision',
  'orbital_game',
  'music_studio',
  'settings',
]);

function getNormalizedBasePath(): string {
  const rawBase =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.BASE_URL || '/';
  const withLeading = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function resolveScreenFromLocation(): ScreenId {
  if (typeof window === 'undefined') return 'dashboard';
  try {
    const basePath = getNormalizedBasePath();
    let relPath = window.location.pathname;
    if (basePath !== '/' && relPath.startsWith(basePath)) {
      relPath = relPath.slice(basePath.length);
    }
    const segment = relPath.replace(/^\/+|\/+$/g, '').split('/')[0]?.toLowerCase() as ScreenId | '';
    if (segment && VALID_SCREENS.has(segment)) {
      return segment;
    }
  } catch {
    // Fallback to Command Center dashboard
  }
  return 'dashboard';
}

export const App: React.FC = () => {
  const [activeScreen, setActiveScreenState] = useState<ScreenId>(() => resolveScreenFromLocation());
  const [activeNavKey, setActiveNavKey] = useState<string>('command_center');
  const [layoutMode, setLayoutMode] = useState<DashboardLayoutMode>('command');
  const [productivityFilter, setProductivityFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [openSessionsSignal, setOpenSessionsSignal] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = useCallback(
    (
      nextScreen: ScreenId,
      options?: {
        navKey?: string;
        productivityFilter?: 'ALL' | 'PENDING' | 'COMPLETED';
        openSessionsDrawer?: boolean;
      }
    ) => {
      setActiveScreenState(nextScreen);
      if (options?.navKey) {
        setActiveNavKey(options.navKey);
      } else {
        setActiveNavKey(nextScreen === 'dashboard' ? 'command_center' : nextScreen);
      }
      if (options?.productivityFilter) {
        setProductivityFilter(options.productivityFilter);
      }
      if (options?.openSessionsDrawer) {
        setOpenSessionsSignal((n) => n + 1);
      }
      if (typeof window !== 'undefined') {
        try {
          const basePath = getNormalizedBasePath();
          const targetUrl = nextScreen === 'dashboard' ? basePath : `${basePath}${nextScreen}`;
          if (window.location.pathname !== targetUrl) {
            window.history.pushState({ screen: nextScreen }, '', targetUrl);
          }
        } catch {
          // Ignore history API issues in sandboxed frames
        }
      }
    },
    []
  );

  useEffect(() => {
    const onPopState = () => {
      setActiveScreenState(resolveScreenFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Persistent state hydrated immediately (never blocks on a loading spinner)
  const [memories, setMemories] = useState<MemoryItem[]>(() => jarvisStore.getMemories());
  const [sessions, setSessions] = useState<ChatSession[]>(() => jarvisStore.getSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => jarvisStore.getActiveSessionId());
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>(() => jarvisStore.getCustomAgents());
  const [tasks, setTasks] = useState<TaskItem[]>(() => jarvisStore.getTasks());
  const [securityLogs, setSecurityLogs] = useState<SecurityLogItem[]>(() =>
    jarvisStore.getSecurityLogs()
  );
  const [devices, setDevices] = useState<SmartDevice[]>(() => jarvisStore.getDevices());
  const [settings, setSettings] = useState<JarvisSettings>(() => jarvisStore.getSettings());

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId]
  );
  const resolvedActiveSessionId = activeSession?.id ?? 'default_session';
  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession]);

  // Runtime state
  const [selectedAgent, setSelectedAgent] = useState<AgentId>(() => settings.defaultAgent || 'JARVIS_PRIME');
  const [selectedCustomAgentId, setSelectedCustomAgentId] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageCode>(() => jarvisStore.getLanguage());
  const [telemetry, setTelemetry] = useState<BrowserTelemetry>(INITIAL_TELEMETRY);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [dailyBriefing, setDailyBriefing] = useState<DailyBriefingData | null>(() =>
    getCachedDailyBriefing()
  );
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Chat streaming & summarization state
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [backendMemorySynced, setBackendMemorySynced] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamTimeoutRef = useRef<number | null>(null);
  const lastPromptRef = useRef<{ text: string; isVoice: boolean; agentId?: AgentId } | null>(null);

  // Voice state
  const voiceEngineRef = useRef<WebVoiceEngine | null>(null);
  if (!voiceEngineRef.current) {
    voiceEngineRef.current = new WebVoiceEngine();
  }
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [isHandsFreeMode, setIsHandsFreeMode] = useState(false);
  const handsFreeRef = useRef(false);
  const handsFreeNoSpeechCountRef = useRef(0);
  const startVoiceCaptureRef = useRef<(options?: boolean | { autoNavigateToChat?: boolean; draftOnly?: boolean }) => void>(() => {});
  const handsFreeRestartTimerRef = useRef<number | null>(null);
  const [transcript, setTranscript] = useState('');
  const [voiceDraft, setVoiceDraft] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voicePermissionDenied, setVoicePermissionDenied] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Security & Multi-agent state
  const [isLockdownActive, setIsLockdownActive] = useState(false);
  const [collaborationLogs, setCollaborationLogs] = useState<AgentCollaborationLog[]>([
    {
      id: 'collab_init',
      fromCodename: 'JARVIS',
      toCodename: 'ALL NODES',
      action: 'MESH SYNCHRONIZED',
      detail: 'Web Neural Matrix initialized. Sub-agents awaiting directives.',
      timestamp: Date.now(),
    },
  ]);

  // PIN confirmation modal state
  const [pinModalAction, setPinModalAction] = useState<'lockdown' | 'toggle_pin' | null>(null);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Plugins state
  const pluginsRef = useRef<JarvisPlugin[]>(createInitialPlugins());
  const [, setPluginTick] = useState(0);
  const [lastToolOutput, setLastToolOutput] = useState<string | null>(null);

  // Lyria 3 music library shared between MusicStudioView & OrbitalGameView
  const [generatedTracks, setGeneratedTracks] = useState<GeneratedMusicTrack[]>([]);
  const [activeGameTrackId, setActiveGameTrackId] = useState<string | null>(null);

  // Automatic memory extraction toast + ref to latest memories
  const memoriesRef = useRef<MemoryItem[]>(memories);
  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);
  const [memoryToast, setMemoryToast] = useState<{ id: string; items: MemoryItem[] } | null>(null);
  const memoryToastTimerRef = useRef<number | null>(null);

  // Smart reminder open-tab timers & active alert notification
  const [activeReminderAlert, setActiveReminderAlert] = useState<TaskItem | null>(null);
  const reminderTimersRef = useRef<Map<string, number>>(new Map());
  const firedReminderIdsRef = useRef<Set<string>>(new Set());

  // Persist changes automatically
  useEffect(() => jarvisStore.saveMemories(memories), [memories]);
  useEffect(() => jarvisStore.saveSessions(sessions), [sessions]);
  useEffect(() => jarvisStore.saveActiveSessionId(resolvedActiveSessionId), [resolvedActiveSessionId]);
  useEffect(() => jarvisStore.saveChats(messages), [messages]);
  useEffect(() => jarvisStore.saveTasks(tasks), [tasks]);
  useEffect(() => jarvisStore.saveSecurityLogs(securityLogs), [securityLogs]);
  useEffect(() => jarvisStore.saveDevices(devices), [devices]);
  useEffect(() => jarvisStore.saveSettings(settings), [settings]);
  useEffect(() => jarvisStore.saveLanguage(language), [language]);
  useEffect(() => jarvisStore.saveCustomAgents(customAgents), [customAgents]);
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', settings.accentTheme || 'cyan');
  }, [settings.accentTheme]);
  const effectiveReducedMotion = Boolean(settings.reducedMotion || settings.powerSaving);
  const telemetryIntervalMs = getTelemetryRefreshIntervalMs(Boolean(settings.powerSaving));

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', effectiveReducedMotion);
    document.documentElement.classList.toggle('power-saving', Boolean(settings.powerSaving));
    document.documentElement.setAttribute(
      'data-reduced-motion',
      effectiveReducedMotion ? 'true' : 'false'
    );
    document.documentElement.setAttribute(
      'data-power-saving',
      settings.powerSaving ? 'true' : 'false'
    );
  }, [effectiveReducedMotion, settings.powerSaving]);

  const refreshDailyBriefing = useCallback(
    async (forceRefresh = false) => {
      setBriefingLoading(true);
      try {
        const result = await generateDailyBriefing({
          tasks,
          telemetry,
          language,
          forceRefresh,
        });
        setDailyBriefing(result);
      } finally {
        setBriefingLoading(false);
      }
    },
    [tasks, telemetry, language]
  );

  useEffect(() => {
    if (!dailyBriefing) {
      void refreshDailyBriefing(false);
    }
    // Initial hydration of daily briefing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendSecurityLog = useCallback(
    (
      eventType: SecurityLogItem['eventType'],
      description: string,
      severity: SecurityLogItem['severity'],
      sourceAgent = 'JARVIS_SECURITY'
    ) => {
      setSecurityLogs((prev) => [
        {
          id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          eventType,
          description,
          severity,
          sourceAgent,
        },
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  // Export/Import backup preview state
  const [importPreviewState, setImportPreviewState] = useState<{
    preview: BackupImportPreview;
    filename: string;
  } | null>(null);

  const handleExportBackup = useCallback(
    (format: 'json' | 'md') => {
      const payload =
        format === 'json'
          ? buildBackupJson({ sessions, memories, tasks })
          : buildBackupMarkdown({ sessions, memories, tasks });
      triggerFileDownload(payload.content, payload.filename, payload.mimeType);
    },
    [sessions, memories, tasks]
  );

  const handleInspectBackupFile = useCallback(
    (rawJson: string, filename: string) => {
      const preview = validateAndPrepareBackupImport(rawJson, memories, sessions, tasks);
      setImportPreviewState({ preview, filename });
    },
    [memories, sessions, tasks]
  );

  const handleConfirmBackupImport = useCallback(() => {
    if (!importPreviewState?.preview.valid) return;
    const { sessionsToAdd, memoriesToAdd, tasksToAdd } = importPreviewState.preview;
    if (sessionsToAdd.length > 0) {
      setSessions((prev) => [...sessionsToAdd, ...prev]);
    }
    if (memoriesToAdd.length > 0) {
      setMemories((prev) => [...memoriesToAdd, ...prev]);
    }
    if (tasksToAdd.length > 0) {
      setTasks((prev) => [...tasksToAdd, ...prev]);
    }
    appendSecurityLog(
      'AUTH',
      `Imported backup "${importPreviewState.filename}": ${sessionsToAdd.length} sessions, ${memoriesToAdd.length} memories, ${tasksToAdd.length} tasks.`,
      'INFO',
      'JARVIS_VAULT'
    );
    setImportPreviewState(null);
  }, [importPreviewState, appendSecurityLog]);

  // Backend health probe (returns boolean whether reachable)
  const refreshHealth = useCallback(async (): Promise<boolean> => {
    setConnectionState('connecting');
    try {
      const health = await checkBackendHealth(5000);
      setBackendHealth(health);
      setConnectionState(health.geminiConfigured ? 'online' : 'key_missing');
      fetchServerMemories().then((srv) => {
        if (!srv.ok) return;
        setBackendMemorySynced(true);
        if (srv.memories.length > 0) {
          setMemories((prev) => {
            let next = [...prev];
            for (const remote of srv.memories) {
              const merged = upsertOrMergeMemory(remote, next, remote.updatedAt || remote.createdAt);
              if (merged.status === 'created' && merged.memory) {
                next = [merged.memory, ...next];
              } else if (merged.status === 'updated' && merged.memory && merged.replacedMemory) {
                if ((remote.updatedAt || remote.createdAt) > (merged.replacedMemory.updatedAt || merged.replacedMemory.createdAt)) {
                  next = next.map((m) => (m.id === merged.replacedMemory!.id ? merged.memory! : m));
                }
              }
            }
            return next;
          });
        }
      });
      return true;
    } catch {
      setBackendHealth(null);
      setConnectionState('offline');
      return false;
    }
  }, []);

  useEffect(() => {
    let retryTimer: number | null = null;
    refreshHealth().then((reachable) => {
      if (!reachable) {
        // Retry once after 2.5s in case Express server is still binding during concurrent boot
        retryTimer = window.setTimeout(() => {
          refreshHealth();
        }, 2500);
      }
    });

    const handleOnline = () => {
      refreshHealth();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshHealth]);

  // Real browser telemetry updates
  const refreshTelemetry = useCallback(async () => {
    const snap = await collectBrowserTelemetry();
    setTelemetry(snap);
  }, []);

  useEffect(() => {
    refreshTelemetry();
    const interval = window.setInterval(refreshTelemetry, telemetryIntervalMs);
    window.addEventListener('online', refreshTelemetry);
    window.addEventListener('offline', refreshTelemetry);
    window.addEventListener('resize', refreshTelemetry);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', refreshTelemetry);
      window.removeEventListener('offline', refreshTelemetry);
      window.removeEventListener('resize', refreshTelemetry);
    };
  }, [refreshTelemetry, telemetryIntervalMs]);

  // Cleanup voice/streams on unmount
  useEffect(() => {
    return () => {
      if (handsFreeRestartTimerRef.current !== null) {
        window.clearTimeout(handsFreeRestartTimerRef.current);
      }
      voiceEngineRef.current?.destroy();
      streamAbortRef.current?.abort();
      if (streamTimeoutRef.current !== null) {
        window.clearTimeout(streamTimeoutRef.current);
      }
    };
  }, []);

  // Schedule browser notifications & in-app alerts while the tab is open
  const triggerReminderNotification = useCallback((task: TaskItem) => {
    setActiveReminderAlert(task);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`JARVIS Reminder: ${task.title}`, {
          body: `${task.dueTime} — ${task.description}`,
          tag: `jarvis_rem_${task.id}`,
        });
        notif.onclick = () => {
          window.focus();
          navigateTo('productivity');
          notif.close();
        };
      } catch {
        // Ignore if constructor throws in restricted iframe
      }
    }
  }, [navigateTo]);

  useEffect(() => {
    reminderTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    reminderTimersRef.current.clear();

    const now = Date.now();
    const maxTimeoutMs = 2147483000;

    for (const task of tasks) {
      if (task.isCompleted || typeof task.triggerAtMillis !== 'number') continue;
      const key = `${task.id}_${task.triggerAtMillis}`;
      if (firedReminderIdsRef.current.has(key)) continue;

      const delay = task.triggerAtMillis - now;
      if (delay <= 0) {
        if (now - task.triggerAtMillis <= 5 * 60 * 1000) {
          firedReminderIdsRef.current.add(key);
          triggerReminderNotification(task);
        }
        continue;
      }

      if (delay <= maxTimeoutMs) {
        const timerId = window.setTimeout(() => {
          firedReminderIdsRef.current.add(key);
          triggerReminderNotification(task);
        }, delay);
        reminderTimersRef.current.set(task.id, timerId);
      }
    }

    return () => {
      reminderTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      reminderTimersRef.current.clear();
    };
  }, [tasks, triggerReminderNotification]);

  const handleCreateSmartReminder = useCallback(async (naturalText: string) => {
    const { reminder } = await parseNaturalReminder(naturalText);
    const newTask: TaskItem = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: reminder.title,
      description: reminder.description,
      dueTime: reminder.dueTime,
      triggerAtMillis: reminder.triggerAtMillis,
      isCompleted: false,
      priority: reminder.priority,
      category: reminder.category,
      createdAt: Date.now(),
    };
    setTasks((prev) => [newTask, ...prev]);
  }, []);

  const handleSnoozeTask = useCallback((id: string, minutes = 10) => {
    const nextTrigger = Date.now() + minutes * 60 * 1000;
    const label = new Date(nextTrigger).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              isCompleted: false,
              triggerAtMillis: nextTrigger,
              dueTime: `Snoozed until ${label}`,
            }
          : t
      )
    );
    setActiveReminderAlert((curr) => (curr?.id === id ? null : curr));
  }, []);

  const securityReport = useMemo(
    () =>
      runBrowserSecurityAudit({
        logs: securityLogs,
        isLockdownActive,
        isPinProtected: settings.pinProtected,
        connectionState,
      }),
    [securityLogs, isLockdownActive, settings.pinProtected, connectionState]
  );

  const speakText = useCallback(
    (text: string, allowHandsFreeContinue = true) => {
      if (settings.voiceMuted) {
        setIsSpeaking(false);
        setIsSpeechPaused(false);
        return;
      }
      const langDesc = JARVIS_LANGUAGES[language];
      voiceEngineRef.current?.speak({
        text,
        bcp47Lang: langDesc.bcp47,
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        volume: settings.voiceVolume ?? 1.0,
        muted: settings.voiceMuted,
        onStart: () => {
          setIsSpeaking(true);
          setIsSpeechPaused(false);
        },
        onPauseChange: (paused) => {
          setIsSpeechPaused(paused);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setIsSpeechPaused(false);
          if (
            allowHandsFreeContinue &&
            handsFreeRef.current &&
            settings.continuousConversationMode
          ) {
            if (handsFreeRestartTimerRef.current !== null) {
              window.clearTimeout(handsFreeRestartTimerRef.current);
            }
            handsFreeRestartTimerRef.current = window.setTimeout(() => {
              handsFreeRestartTimerRef.current = null;
              if (handsFreeRef.current) {
                startVoiceCaptureRef.current({ autoNavigateToChat: false });
              }
            }, 450);
          }
        },
      });
    },
    [
      language,
      settings.speechRate,
      settings.speechPitch,
      settings.voiceVolume,
      settings.voiceMuted,
      settings.continuousConversationMode,
    ]
  );

  const pauseSpeaking = useCallback(() => {
    if (voiceEngineRef.current?.pauseSpeaking()) {
      setIsSpeechPaused(true);
    }
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (voiceEngineRef.current?.resumeSpeaking()) {
      setIsSpeechPaused(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (handsFreeRestartTimerRef.current !== null) {
      window.clearTimeout(handsFreeRestartTimerRef.current);
      handsFreeRestartTimerRef.current = null;
    }
    voiceEngineRef.current?.stopSpeaking();
    setIsSpeaking(false);
    setIsSpeechPaused(false);
  }, []);

  const exitHandsFreeMode = useCallback(() => {
    handsFreeRef.current = false;
    handsFreeNoSpeechCountRef.current = 0;
    setIsHandsFreeMode(false);
    if (handsFreeRestartTimerRef.current !== null) {
      window.clearTimeout(handsFreeRestartTimerRef.current);
      handsFreeRestartTimerRef.current = null;
    }
    voiceEngineRef.current?.stopListening();
    voiceEngineRef.current?.stopSpeaking();
    setIsListening(false);
    setIsSpeaking(false);
    setIsSpeechPaused(false);
    setAudioLevel(0);
  }, []);

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    if (streamTimeoutRef.current !== null) {
      window.clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
    setIsThinking(false);
  }, []);

  const generateSessionTitle = (raw: string): string => {
    const clean = raw.trim().replace(/\s+/g, ' ');
    if (!clean) return 'New Neural Session';
    return clean.length <= 42 ? clean : `${clean.slice(0, 39).trim()}...`;
  };

  const createChatSession = useCallback(() => {
    if (isThinking) stopStreaming();
    const now = Date.now();
    const newId = `session_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'New Neural Session',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setStreamingText('');
  }, [isThinking, stopStreaming]);

  const selectChatSession = useCallback(
    (sessionId: string) => {
      if (isThinking && sessionId !== resolvedActiveSessionId) {
        stopStreaming();
        setStreamingText('');
      }
      setActiveSessionId(sessionId);
    },
    [isThinking, resolvedActiveSessionId, stopStreaming]
  );

  const renameChatSession = useCallback((sessionId: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: clean, updatedAt: Date.now() } : s))
    );
  }, []);

  const deleteChatSession = useCallback(
    (sessionId: string) => {
      if (isThinking && sessionId === resolvedActiveSessionId) {
        stopStreaming();
        setStreamingText('');
      }
      const remaining = sessions.filter((s) => s.id !== sessionId);
      if (remaining.length === 0) {
        const now = Date.now();
        const fallbackSession: ChatSession = {
          id: `session_${now}`,
          title: 'Primary Neural Link',
          createdAt: now,
          updatedAt: now,
          messages: [],
        };
        setSessions([fallbackSession]);
        setActiveSessionId(fallbackSession.id);
        return;
      }
      setSessions(remaining);
      if (sessionId === resolvedActiveSessionId) {
        setActiveSessionId(remaining[0].id);
      }
    },
    [isThinking, resolvedActiveSessionId, sessions, stopStreaming]
  );

  const clearActiveSessionMessages = useCallback(() => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === resolvedActiveSessionId
          ? { ...s, messages: [], updatedAt: Date.now() }
          : s
      )
    );
  }, [resolvedActiveSessionId]);

  const saveCustomAgent = useCallback((agentInput: Omit<CustomAgent, 'createdAt'>) => {
    setCustomAgents((prev) => {
      const existing = prev.find((a) => a.id === agentInput.id);
      if (existing) {
        return prev.map((a) => (a.id === agentInput.id ? { ...existing, ...agentInput } : a));
      }
      return [{ ...agentInput, createdAt: Date.now() }, ...prev];
    });
  }, []);

  const deleteCustomAgent = useCallback(
    (id: string) => {
      setCustomAgents((prev) => prev.filter((a) => a.id !== id));
      if (selectedCustomAgentId === id) {
        setSelectedCustomAgentId(null);
      }
    },
    [selectedCustomAgentId]
  );

  const resolveAgentForPrompt = useCallback(
    (
      prompt: string,
      explicitAgentId?: AgentId
    ): { agentId: AgentId; customAgent: CustomAgent | null } => {
      if (explicitAgentId) return { agentId: explicitAgentId, customAgent: null };
      if (selectedCustomAgentId) {
        const picked = customAgents.find((c) => c.id === selectedCustomAgentId) || null;
        if (picked) return { agentId: 'JARVIS_PRIME', customAgent: picked };
      }
      if (selectedAgent !== 'JARVIS_PRIME') return { agentId: selectedAgent, customAgent: null };

      const matchedCustom = findMatchingCustomAgent(prompt, customAgents);
      if (matchedCustom) {
        setSelectedCustomAgentId(matchedCustom.id);
        setCollaborationLogs((prev) => [
          {
            id: `collab_${Date.now()}`,
            fromCodename: 'JARVIS',
            toCodename: matchedCustom.codename,
            action: 'CUSTOM AGENT ROUTING',
            detail: `Matched custom keyword trigger for ${matchedCustom.name}`,
            timestamp: Date.now(),
          },
          ...prev.slice(0, 29),
        ]);
        return { agentId: 'JARVIS_PRIME', customAgent: matchedCustom };
      }

      const routed = routeIntentToAgent(prompt);
      if (routed !== 'JARVIS_PRIME') {
        setSelectedAgent(routed);
        setCollaborationLogs((prev) => [
          {
            id: `collab_${Date.now()}`,
            fromCodename: 'JARVIS',
            toCodename: JARVIS_AGENTS[routed].codename,
            action: 'INTENT DELEGATION',
            detail: `Delegated prompt "${prompt.slice(0, 64)}${prompt.length > 64 ? '...' : ''}"`,
            timestamp: Date.now(),
          },
          ...prev.slice(0, 29),
        ]);
      }
      return { agentId: routed, customAgent: null };
    },
    [selectedAgent, selectedCustomAgentId, customAgents]
  );

  const summarizeActiveSession = useCallback(async () => {
    if (isSummarizing || isThinking || messages.length === 0) return;
    setIsSummarizing(true);
    try {
      const result = await summarizeConversation({
        messages,
        language,
        previousSummary: activeSession?.contextSummary,
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.id === resolvedActiveSessionId
            ? {
                ...s,
                contextSummary: result.summary,
                summaryKeyPoints: result.keyPoints,
                summaryActionItems: result.actionItems,
                summarizedTurnCount: messages.length,
                updatedAt: Date.now(),
              }
            : s
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to summarize conversation.';
      const errMsg: ChatMessage = {
        id: `msg_${Date.now()}_sum_err`,
        sessionId: resolvedActiveSessionId,
        role: 'jarvis',
        text: `Summarization failed: ${msg}`,
        agentCodename: 'JARVIS',
        timestamp: Date.now(),
        isError: true,
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === resolvedActiveSessionId
            ? { ...s, messages: [...s.messages, errMsg], updatedAt: Date.now() }
            : s
        )
      );
    } finally {
      setIsSummarizing(false);
    }
  }, [isSummarizing, isThinking, messages, language, activeSession?.contextSummary, resolvedActiveSessionId]);

  const executeChatStream = useCallback(
    async (params: {
      prompt: string;
      targetSessionId: string;
      historyBeforePrompt: ChatMessage[];
      isVoice: boolean;
      agentId: AgentId;
      customAgent?: CustomAgent | null;
      attachment?: PendingChatAttachment;
    }) => {
      const { prompt, targetSessionId, historyBeforePrompt, isVoice, agentId, customAgent, attachment } =
        params;
      const agent = JARVIS_AGENTS[agentId];
      const speakerCodename = customAgent?.codename || agent.codename;
      const langDesc = JARVIS_LANGUAGES[language];
      const targetSessionObj = sessions.find((s) => s.id === targetSessionId);

      setStreamingText('');
      setIsThinking(true);

      streamAbortRef.current?.abort();
      if (streamTimeoutRef.current !== null) {
        window.clearTimeout(streamTimeoutRef.current);
      }

      const controller = new AbortController();
      streamAbortRef.current = controller;
      streamTimeoutRef.current = window.setTimeout(() => {
        controller.abort();
      }, 60000);

      let latestSources: ChatSource[] = [];
      let latestBrainMeta: ChatBrainMeta | undefined;

      const streamCallbacks: StreamCallbacks = {
        onMeta: (meta) => {
          latestBrainMeta = meta;
        },
        onSources: (sources) => {
          latestSources = sources;
        },
        onChunk: (fullText) => {
          setStreamingText(fullText);
        },
        onComplete: (fullText) => {
          if (streamTimeoutRef.current !== null) {
            window.clearTimeout(streamTimeoutRef.current);
            streamTimeoutRef.current = null;
          }
          streamAbortRef.current = null;
          setStreamingText('');
          setIsThinking(false);

          const replyMsg: ChatMessage = {
            id: `msg_${Date.now()}_j`,
            sessionId: targetSessionId,
            role: 'jarvis',
            text: fullText,
            agentCodename: speakerCodename,
            timestamp: Date.now(),
            sources: latestSources.length > 0 ? latestSources : undefined,
            brainMeta: latestBrainMeta,
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? {
                    ...s,
                    updatedAt: Date.now(),
                    lastBrainMeta: latestBrainMeta || s.lastBrainMeta,
                    messages: [...s.messages, replyMsg],
                  }
                : s
            )
          );

          if (
            settings.voiceModeEnabled &&
            !settings.voiceMuted &&
            (isVoice || settings.autoSpeakReplies || handsFreeRef.current)
          ) {
            speakText(fullText);
          }

          if (
            settings.autoExtractMemories &&
            connectionState === 'online' &&
            prompt.trim().length >= 6 &&
            !fullText.startsWith('No response generated')
          ) {
            const snapshot = memoriesRef.current;
            void extractMemoriesFromTurn({
              userPrompt: prompt,
              aiReply: fullText,
              existingMemories: snapshot,
            }).then(async (candidates) => {
              const unique = filterUniqueMemories(candidates, memoriesRef.current);
              if (unique.length === 0) return;

              let workingMemories = [...memoriesRef.current];
              const savedForToast: MemoryItem[] = [];
              let anyBackendSync = false;

              for (const cand of unique) {
                const { outcome, nextMemories } = await saveMemoryWithSync({
                  candidate: cand,
                  currentMemories: workingMemories,
                });
                if (outcome.ok && outcome.memory && outcome.status !== 'duplicate') {
                  workingMemories = nextMemories;
                  savedForToast.push(outcome.memory);
                  if (outcome.syncedWithBackend) anyBackendSync = true;
                }
              }

              if (savedForToast.length === 0) return;
              if (anyBackendSync) setBackendMemorySynced(true);
              setMemories(workingMemories);
              const now = Date.now();
              setMemoryToast({ id: `toast_${now}`, items: savedForToast });
              if (memoryToastTimerRef.current !== null) {
                window.clearTimeout(memoryToastTimerRef.current);
              }
              memoryToastTimerRef.current = window.setTimeout(() => {
                setMemoryToast(null);
                memoryToastTimerRef.current = null;
              }, 6500);
            });
          }
        },
        onCancelled: (partialText) => {
          if (streamTimeoutRef.current !== null) {
            window.clearTimeout(streamTimeoutRef.current);
            streamTimeoutRef.current = null;
          }
          streamAbortRef.current = null;
          setStreamingText('');
          setIsThinking(false);

          if (partialText.trim()) {
            const stoppedMsg: ChatMessage = {
              id: `msg_${Date.now()}_stop`,
              sessionId: targetSessionId,
              role: 'jarvis',
              text: `${partialText}\n\n_[Generation stopped]_`,
              agentCodename: speakerCodename,
              timestamp: Date.now(),
              sources: latestSources.length > 0 ? latestSources : undefined,
              brainMeta: latestBrainMeta,
            };
            setSessions((prev) =>
              prev.map((s) =>
                s.id === targetSessionId
                  ? { ...s, updatedAt: Date.now(), messages: [...s.messages, stoppedMsg] }
                  : s
              )
            );
          }
        },
        onError: (errMsg) => {
          if (streamTimeoutRef.current !== null) {
            window.clearTimeout(streamTimeoutRef.current);
            streamTimeoutRef.current = null;
          }
          streamAbortRef.current = null;
          setStreamingText('');
          setIsThinking(false);

          const errBubble: ChatMessage = {
            id: `msg_${Date.now()}_err`,
            sessionId: targetSessionId,
            role: 'jarvis',
            text: errMsg,
            agentCodename: speakerCodename,
            timestamp: Date.now(),
            isError: true,
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? { ...s, updatedAt: Date.now(), messages: [...s.messages, errBubble] }
                : s
            )
          );
        },
      };

      const isTextContext = Boolean(attachment?.useAsTextContext && attachment?.textContent);
      const effectivePrompt = isTextContext
        ? `${prompt}\n\n[ATTACHED DOCUMENT: ${attachment!.name}]\n\`\`\`\n${attachment!.textContent}\n\`\`\``
        : prompt;

      const relevantConversations = retrieveRelevantConversations(effectivePrompt, sessions, {
        activeSessionId: targetSessionId,
        limit: 2,
      });

      if (attachment?.base64Data && !isTextContext) {
        await streamMultimodalChat({
          prompt: effectivePrompt,
          fileBase64: attachment.base64Data,
          mimeType: attachment.mimeType,
          fileName: attachment.name,
          agent,
          language: langDesc,
          telemetry,
          memories: memoriesRef.current,
          relevantConversations,
          history: historyBeforePrompt,
          conversationSummary: targetSessionObj?.contextSummary || '',
          enableWebSearch: settings.webSearchEnabled,
          customSystemPromptOverride: customAgent?.systemPrompt,
          signal: controller.signal,
          callbacks: streamCallbacks,
        });
      } else {
        await streamGeminiChat({
          prompt: effectivePrompt,
          agent,
          language: langDesc,
          telemetry,
          memories: memoriesRef.current,
          relevantConversations,
          history: historyBeforePrompt,
          conversationSummary: targetSessionObj?.contextSummary || '',
          enableWebSearch: settings.webSearchEnabled,
          customSystemPromptOverride: customAgent?.systemPrompt,
          signal: controller.signal,
          callbacks: streamCallbacks,
        });
      }
    },
    [
      language,
      sessions,
      telemetry,
      settings.webSearchEnabled,
      settings.autoSpeakReplies,
      settings.voiceModeEnabled,
      settings.voiceMuted,
      settings.autoExtractMemories,
      connectionState,
      speakText,
    ]
  );

  const sendPromptToGemini = useCallback(
    async (
      rawText: string,
      isVoice = false,
      explicitAgentId?: AgentId,
      attachment?: PendingChatAttachment
    ) => {
      const prompt = rawText.trim();
      if ((!prompt && !attachment) || isThinking) return;
      const effectiveText = prompt || `Analyze attached file: ${attachment?.name ?? 'document'}`;

      lastPromptRef.current = { text: effectiveText, isVoice, agentId: explicitAgentId };
      const { agentId: targetAgentId, customAgent } = resolveAgentForPrompt(effectiveText, explicitAgentId);
      const agent = JARVIS_AGENTS[targetAgentId];
      const targetSessionId = resolvedActiveSessionId;
      const historyBeforePrompt = [...messages];

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_u`,
        sessionId: targetSessionId,
        role: 'user',
        text: effectiveText,
        agentCodename: customAgent?.codename || agent.codename,
        timestamp: Date.now(),
        isVoice,
        attachment: attachment
          ? {
              name: attachment.name,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
              previewDataUrl:
                attachment.previewDataUrl && attachment.previewDataUrl.length <= 450_000
                  ? attachment.previewDataUrl
                  : undefined,
              isTextContext: Boolean(attachment.useAsTextContext && attachment.textContent),
            }
          : undefined,
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          const isPlaceholderTitle =
            s.messages.length === 0 &&
            (s.title === 'Primary Neural Link' || s.title === 'New Neural Session');
          return {
            ...s,
            title: isPlaceholderTitle ? generateSessionTitle(effectiveText) : s.title,
            updatedAt: Date.now(),
            messages: [...s.messages, userMsg],
          };
        })
      );

      // Phase 3: Check natural-language memory commands before streaming to Gemini
      if (!attachment) {
        const memCmd = await executeChatMemoryCommand({
          rawText: effectiveText,
          currentMemories: memoriesRef.current,
          sessions,
          activeSessionId: targetSessionId,
        });
        if (memCmd.handled && memCmd.replyText) {
          if (memCmd.nextMemories) {
            setMemories(memCmd.nextMemories);
          }
          if (memCmd.syncedWithBackend) {
            setBackendMemorySynced(true);
          }
          const memReply: ChatMessage = {
            id: `msg_${Date.now()}_mem`,
            sessionId: targetSessionId,
            role: 'jarvis',
            text: memCmd.replyText,
            agentCodename: 'JARVIS MEMORY',
            timestamp: Date.now(),
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? { ...s, updatedAt: Date.now(), messages: [...s.messages, memReply] }
                : s
            )
          );
          if (
            settings.voiceModeEnabled &&
            !settings.voiceMuted &&
            (isVoice || settings.autoSpeakReplies || handsFreeRef.current)
          ) {
            speakText(memCmd.replyText);
          }
          return;
        }
      }

      await executeChatStream({
        prompt: effectiveText,
        targetSessionId,
        historyBeforePrompt,
        isVoice,
        agentId: targetAgentId,
        customAgent,
        attachment,
      });
    },
    [
      isThinking,
      resolveAgentForPrompt,
      resolvedActiveSessionId,
      messages,
      sessions,
      settings.voiceModeEnabled,
      settings.voiceMuted,
      settings.autoSpeakReplies,
      speakText,
      executeChatStream,
    ]
  );

  const regenerateLastResponse = useCallback(async () => {
    if (isThinking) return;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;

    const targetUserMsg = messages[lastUserIdx];
    const targetSessionId = resolvedActiveSessionId;
    const historyBeforePrompt = messages.slice(0, lastUserIdx);
    const truncatedMessages = messages.slice(0, lastUserIdx + 1);

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? { ...s, updatedAt: Date.now(), messages: truncatedMessages }
          : s
      )
    );

    const { agentId: targetAgentId, customAgent } = resolveAgentForPrompt(targetUserMsg.text);
    await executeChatStream({
      prompt: targetUserMsg.text,
      targetSessionId,
      historyBeforePrompt,
      isVoice: Boolean(targetUserMsg.isVoice),
      agentId: targetAgentId,
      customAgent,
    });
  }, [isThinking, messages, resolvedActiveSessionId, resolveAgentForPrompt, executeChatStream]);

  const editAndResendMessage = useCallback(
    async (messageId: string, newText: string) => {
      const cleanText = newText.trim();
      if (!cleanText || isThinking) return;
      const idx = messages.findIndex((m) => m.id === messageId && m.role === 'user');
      if (idx < 0) return;

      const targetSessionId = resolvedActiveSessionId;
      const historyBeforePrompt = messages.slice(0, idx);
      const { agentId: targetAgentId, customAgent } = resolveAgentForPrompt(cleanText);
      const updatedUserMsg: ChatMessage = {
        ...messages[idx],
        text: cleanText,
        timestamp: Date.now(),
        agentCodename: customAgent?.codename || JARVIS_AGENTS[targetAgentId].codename,
      };
      const updatedMessages = [...historyBeforePrompt, updatedUserMsg];

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? { ...s, updatedAt: Date.now(), messages: updatedMessages }
            : s
        )
      );

      await executeChatStream({
        prompt: cleanText,
        targetSessionId,
        historyBeforePrompt,
        isVoice: Boolean(updatedUserMsg.isVoice),
        agentId: targetAgentId,
        customAgent,
      });
    },
    [isThinking, messages, resolvedActiveSessionId, resolveAgentForPrompt, executeChatStream]
  );

  const executeLocalVoiceCommand = useCallback(
    (rawText: string): boolean => {
      const cmd = parseLocalVoiceCommand(rawText);
      if (!cmd) return false;

      switch (cmd) {
        case 'STOP':
          exitHandsFreeMode();
          stopStreaming();
          return true;

        case 'OPEN_SECURITY':
          navigateTo('security');
          speakText('Opening Stark Security Audit, Sir.');
          return true;

        case 'TOGGLE_LOCKDOWN':
          if (settings.pinProtected) {
            navigateTo('security');
            setPinEntry('');
            setPinError(null);
            setPinModalAction('lockdown');
            speakText('Master PIN verification required to toggle emergency lockdown, Sir.');
          } else {
            const nextLocked = !isLockdownActive;
            executeToggleLockdown();
            speakText(
              nextLocked
                ? 'Emergency DEFCON 1 lockdown engaged, Sir.'
                : 'Emergency lockdown disengaged. Systems nominal, Sir.'
            );
          }
          return true;

        case 'CHECK_BATTERY': {
          const msg =
            telemetry.batteryPercent !== null
              ? `System battery is at ${telemetry.batteryPercent} percent and ${telemetry.isCharging ? 'charging' : 'discharging'}, Sir.`
              : 'Browser battery telemetry is restricted on this platform, Sir.';
          speakText(msg);
          return true;
        }

        case 'NEW_CHAT':
          createChatSession();
          navigateTo('chat');
          speakText('Started a new neural chat session, Sir.');
          return true;
      }
    },
    [
      exitHandsFreeMode,
      stopStreaming,
      speakText,
      settings.pinProtected,
      isLockdownActive,
      telemetry.batteryPercent,
      telemetry.isCharging,
      createChatSession,
    ]
  );

  const startVoiceCapture = useCallback(
    (arg: boolean | { autoNavigateToChat?: boolean; draftOnly?: boolean } = false) => {
      const opts =
        typeof arg === 'boolean'
          ? { autoNavigateToChat: arg, draftOnly: false }
          : {
              autoNavigateToChat: Boolean(arg.autoNavigateToChat),
              draftOnly: Boolean(arg.draftOnly),
            };
      setVoiceError(null);
      setVoicePermissionDenied(false);
      setTranscript('');
      let finalCaptured = '';
      const langDesc = JARVIS_LANGUAGES[language];

      voiceEngineRef.current?.startListening({
        bcp47Lang: langDesc.bcp47,
        onStart: () => {
          setIsListening(true);
        },
        onTranscript: (text, isFinal) => {
          setTranscript(text);
          if (opts.draftOnly) {
            setVoiceDraft(text);
          }
          if (isFinal) {
            finalCaptured = text;
            handsFreeNoSpeechCountRef.current = 0;
          }
        },
        onAudioLevel: (rms) => {
          setAudioLevel(rms);
        },
        onError: (msg, code) => {
          setIsListening(false);
          setAudioLevel(0);
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            setVoicePermissionDenied(true);
            setVoiceError(msg);
            handsFreeRef.current = false;
            setIsHandsFreeMode(false);
            return;
          }
          if (code === 'no-speech' && handsFreeRef.current && settings.continuousConversationMode) {
            handsFreeNoSpeechCountRef.current += 1;
            if (handsFreeNoSpeechCountRef.current <= 2) {
              setVoiceError('No speech detected yet — listening once more...');
              if (handsFreeRestartTimerRef.current !== null) {
                window.clearTimeout(handsFreeRestartTimerRef.current);
              }
              handsFreeRestartTimerRef.current = window.setTimeout(() => {
                handsFreeRestartTimerRef.current = null;
                if (handsFreeRef.current) {
                  startVoiceCaptureRef.current({ autoNavigateToChat: false });
                }
              }, 600);
              return;
            }
          }
          setVoiceError(msg);
          if (code !== 'aborted') {
            handsFreeRef.current = false;
            handsFreeNoSpeechCountRef.current = 0;
            setIsHandsFreeMode(false);
          }
        },
        onEnd: () => {
          setIsListening(false);
          setAudioLevel(0);
          const captured = finalCaptured.trim();
          if (!captured) return;
          if (opts.draftOnly) {
            setVoiceDraft(captured);
            return;
          }
          if (executeLocalVoiceCommand(captured)) {
            return;
          }
          if (opts.autoNavigateToChat && !handsFreeRef.current) {
            navigateTo('chat');
          }
          sendPromptToGemini(captured, true);
        },
      });
    },
    [language, settings.continuousConversationMode, executeLocalVoiceCommand, sendPromptToGemini, navigateTo]
  );

  useEffect(() => {
    startVoiceCaptureRef.current = startVoiceCapture;
  }, [startVoiceCapture]);

  const startHandsFreeMode = useCallback(() => {
    handsFreeRef.current = true;
    handsFreeNoSpeechCountRef.current = 0;
    setIsHandsFreeMode(true);
    setSettings((prev) =>
      prev.voiceModeEnabled && prev.continuousConversationMode
        ? prev
        : { ...prev, voiceModeEnabled: true, continuousConversationMode: true }
    );
    setVoiceError(null);
    startVoiceCapture({ autoNavigateToChat: false });
  }, [startVoiceCapture]);

  const stopVoiceCapture = useCallback(() => {
    voiceEngineRef.current?.stopListening();
    setIsListening(false);
    setAudioLevel(0);
  }, []);

  // Security PIN-gated actions
  const executeToggleLockdown = () => {
    setIsLockdownActive((prev) => {
      const next = !prev;
      appendSecurityLog(
        'ANOMALY',
        next
          ? 'Emergency Defense Lockdown ENGAGED (DEFCON 1).'
          : 'Emergency Defense Lockdown disengaged by owner.',
        next ? 'CRITICAL' : 'INFO',
        'HOMER_SECURITY'
      );
      return next;
    });
  };

  const executeTogglePinProtection = () => {
    setSettings((prev) => {
      const next = !prev.pinProtected;
      appendSecurityLog(
        'AUTH',
        `Master Stark PIN protection ${next ? 'ENABLED' : 'DISABLED'}.`,
        next ? 'INFO' : 'WARNING'
      );
      return { ...prev, pinProtected: next };
    });
  };

  const requestProtectedAction = (action: 'lockdown' | 'toggle_pin') => {
    if (!settings.pinProtected) {
      if (action === 'lockdown') executeToggleLockdown();
      else executeTogglePinProtection();
      return;
    }
    setPinEntry('');
    setPinError(null);
    setPinModalAction(action);
  };

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinEntry.trim() !== settings.userPin) {
      setPinError('Invalid Stark PIN entered. Incident logged.');
      appendSecurityLog('AUTH', 'Failed PIN verification attempt on protected control.', 'WARNING');
      return;
    }
    const action = pinModalAction;
    setPinModalAction(null);
    setPinEntry('');
    setPinError(null);
    if (action === 'lockdown') executeToggleLockdown();
    if (action === 'toggle_pin') executeTogglePinProtection();
  };

  // Root container carries reduced-motion & power-saving classes and data attributes
  if (activeScreen === 'opening') {
    return (
      <div
        className={
          [
            effectiveReducedMotion ? 'reduced-motion' : '',
            settings.powerSaving ? 'power-saving' : '',
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
        data-reduced-motion={effectiveReducedMotion ? 'true' : 'false'}
        data-power-saving={settings.powerSaving ? 'true' : 'false'}
      >
        <OpeningScreen
          telemetry={telemetry}
          connectionState={connectionState}
          reducedMotion={effectiveReducedMotion}
          onInitialize={() => navigateTo('dashboard')}
          onEnterVoiceMode={() => {
            navigateTo('voice');
            startVoiceCapture(false);
          }}
        />
      </div>
    );
  }

  if (activeScreen === 'orbital_game') {
    return (
      <div
        className={
          [
            effectiveReducedMotion ? 'reduced-motion' : '',
            settings.powerSaving ? 'power-saving' : '',
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
        data-reduced-motion={effectiveReducedMotion ? 'true' : 'false'}
        data-power-saving={settings.powerSaving ? 'true' : 'false'}
      >
        <Suspense
          fallback={
            <div className="fixed inset-0 z-40 bg-[#030712] flex items-center justify-center font-mono-hud text-xs text-cyan-300 tracking-widest">
              INITIALIZING 3D ORBITAL AEGIS ENGINE...
            </div>
          }
        >
          <OrbitalGameView
            connectionState={connectionState}
            tracks={generatedTracks}
            activeTrackId={activeGameTrackId}
            onTrackGenerated={(track, setAsSoundtrack) => {
              setGeneratedTracks((prev) => [track, ...prev]);
              if (setAsSoundtrack) setActiveGameTrackId(track.id);
            }}
            onSelectTrack={(trackId) => setActiveGameTrackId(trackId)}
            onExitGame={() => navigateTo('dashboard')}
          />
        </Suspense>
      </div>
    );
  }

  const meta = SCREEN_META[activeScreen];

  return (
    <div
      data-reduced-motion={effectiveReducedMotion ? 'true' : 'false'}
      data-power-saving={settings.powerSaving ? 'true' : 'false'}
      className={`min-h-screen bg-[#02040A] hud-grid-bg text-slate-100 flex${
        effectiveReducedMotion ? ' reduced-motion' : ''
      }${settings.powerSaving ? ' power-saving' : ''}`}
    >
      <SidebarNav
        activeScreen={activeScreen}
        activeNavKey={activeNavKey}
        isOpenMobile={mobileMenuOpen}
        onSelect={(scr: ScreenId, action?: NavCommandAction, navKey?: string) => {
          navigateTo(scr, {
            navKey: navKey || (scr === 'dashboard' ? 'command_center' : scr),
            productivityFilter:
              action && 'productivityFilter' in action ? action.productivityFilter : undefined,
            openSessionsDrawer:
              action && 'openSessionsDrawer' in action ? action.openSessionsDrawer : undefined,
          });
        }}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLockScreen={() => {
          stopVoiceCapture();
          stopSpeaking();
          navigateTo('opening');
        }}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <HeaderHud
          title={meta.title}
          subtitle={meta.subtitle}
          connectionState={connectionState}
          telemetry={telemetry}
          securityReport={securityReport}
          language={language}
          reducedMotion={effectiveReducedMotion}
          isListening={isListening}
          isSpeaking={isSpeaking}
          audioLevel={audioLevel}
          layoutMode={layoutMode}
          tasks={tasks}
          memories={memories}
          sessions={sessions}
          securityLogs={securityLogs}
          onStopAudio={() => {
            if (isListening) stopVoiceCapture();
            if (isSpeaking) stopSpeaking();
          }}
          onLanguageChange={(lang) => setLanguage(lang)}
          onToggleLayoutMode={() =>
            setLayoutMode((prev) =>
              prev === 'command' ? 'compact' : prev === 'compact' ? 'focus' : 'command'
            )
          }
          onRetryConnection={refreshHealth}
          onNavigate={(scr) => navigateTo(scr)}
          onSelectSession={(sid) => selectChatSession(sid)}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-3 sm:p-5 max-w-[1600px] w-full mx-auto">
          {activeScreen === 'dashboard' && (
            <DashboardView
              telemetry={telemetry}
              securityReport={securityReport}
              connectionState={connectionState}
              layoutMode={layoutMode}
              isListening={isListening}
              isSpeaking={isSpeaking}
              isThinking={isThinking}
              audioLevel={audioLevel}
              transcript={transcript}
              voiceError={voiceError}
              speechRecognitionSupported={isSpeechRecognitionSupported()}
              reducedMotion={effectiveReducedMotion}
              powerSaving={Boolean(settings.powerSaving)}
              telemetryIntervalMs={telemetryIntervalMs}
              onTogglePowerSaving={() =>
                setSettings((prev) => ({ ...prev, powerSaving: !prev.powerSaving }))
              }
              dailyBriefing={dailyBriefing}
              briefingLoading={briefingLoading}
              memories={memories}
              sessions={sessions}
              tasks={tasks}
              securityLogs={securityLogs}
              collaborationLogs={collaborationLogs}
              customAgents={customAgents}
              onRefreshBriefing={() => void refreshDailyBriefing(true)}
              onSpeakBriefing={(txt) => speakText(txt)}
              onTalkToJarvis={() => startVoiceCapture(false)}
              onStopListening={stopVoiceCapture}
              onStopSpeaking={stopSpeaking}
              onNavigate={(scr, opts) => navigateTo(scr, opts)}
              onSelectAgentAndChat={(agentId, enableWebSearch) => {
                setSelectedCustomAgentId(null);
                setSelectedAgent(agentId);
                if (enableWebSearch !== undefined) {
                  setSettings((prev) => ({ ...prev, webSearchEnabled: enableWebSearch }));
                }
                navigateTo('chat');
              }}
              onAddQuickTask={(title, priority) =>
                setTasks((prev) => [
                  {
                    id: `task_${Date.now()}`,
                    title,
                    description: 'Created from Command Center Quick Commands',
                    dueTime: 'Today',
                    isCompleted: false,
                    priority,
                    category: 'TASK',
                    createdAt: Date.now(),
                  },
                  ...prev,
                ])
              }
              onToggleTask={(id) =>
                setTasks((prev) =>
                  prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t))
                )
              }
              onRunWorkflow={() => navigateTo('multi_agent', { navKey: 'workflows' })}
            />
          )}

          {activeScreen === 'chat' && (
            <ChatView
              selectedAgent={selectedAgent}
              customAgents={customAgents}
              selectedCustomAgentId={selectedCustomAgentId}
              sessions={sessions}
              activeSessionId={resolvedActiveSessionId}
              messages={messages}
              streamingText={streamingText}
              isThinking={isThinking}
              isSummarizing={isSummarizing}
              isListening={isListening}
              isSpeaking={isSpeaking}
              isSpeechPaused={isSpeechPaused}
              isSpeechMuted={settings.voiceMuted}
              voiceDraft={voiceDraft}
              voiceStatusMessage={voiceError}
              connectionState={connectionState}
              webSearchEnabled={settings.webSearchEnabled}
              openSessionsSignal={openSessionsSignal}
              onSelectAgent={(id) => {
                setSelectedCustomAgentId(null);
                setSelectedAgent(id);
              }}
              onSelectCustomAgent={(id) => {
                setSelectedCustomAgentId(id);
              }}
              onCreateSession={createChatSession}
              onSelectSession={selectChatSession}
              onRenameSession={renameChatSession}
              onDeleteSession={deleteChatSession}
              onSummarizeSession={summarizeActiveSession}
              onSendMessage={(txt, attachment) => sendPromptToGemini(txt, false, undefined, attachment)}
              onRetryLast={() => {
                const last = lastPromptRef.current;
                if (last) sendPromptToGemini(last.text, last.isVoice, last.agentId);
              }}
              onRegenerateLast={regenerateLastResponse}
              onEditAndResend={editAndResendMessage}
              onStopStreaming={stopStreaming}
              onClearHistory={clearActiveSessionMessages}
              onStartVoice={() => startVoiceCapture({ draftOnly: true })}
              onStopVoice={stopVoiceCapture}
              onClearVoiceDraft={() => setVoiceDraft('')}
              onSpeakText={(txt) => speakText(txt)}
              onPauseSpeaking={pauseSpeaking}
              onResumeSpeaking={resumeSpeaking}
              onStopSpeaking={stopSpeaking}
              onToggleMute={() =>
                setSettings((prev) => {
                  const nextMuted = !prev.voiceMuted;
                  if (nextMuted) stopSpeaking();
                  return { ...prev, voiceMuted: nextMuted };
                })
              }
              onToggleWebSearch={() =>
                setSettings((prev) => ({ ...prev, webSearchEnabled: !prev.webSearchEnabled }))
              }
              onRetryConnection={refreshHealth}
            />
          )}

          {activeScreen === 'voice' && (
            <VoiceHudView
              language={language}
              isVoiceModeEnabled={settings.voiceModeEnabled}
              isListening={isListening}
              isSpeaking={isSpeaking}
              isSpeechPaused={isSpeechPaused}
              isSpeechMuted={settings.voiceMuted}
              isProcessing={isThinking}
              isHandsFreeMode={isHandsFreeMode}
              transcript={transcript}
              voiceError={voiceError}
              voicePermissionDenied={voicePermissionDenied}
              audioLevel={audioLevel}
              reducedMotion={effectiveReducedMotion}
              onEnableVoiceMode={() =>
                setSettings((prev) => ({ ...prev, voiceModeEnabled: true }))
              }
              onLanguageChange={setLanguage}
              onStartListening={() => startVoiceCapture({ autoNavigateToChat: false })}
              onStopListening={stopVoiceCapture}
              onStartHandsFree={startHandsFreeMode}
              onExitHandsFree={exitHandsFreeMode}
              onDismissError={() => {
                setVoiceError(null);
                setVoicePermissionDenied(false);
              }}
              onPauseSpeaking={pauseSpeaking}
              onResumeSpeaking={resumeSpeaking}
              onStopSpeaking={stopSpeaking}
              onToggleMute={() =>
                setSettings((prev) => {
                  const nextMuted = !prev.voiceMuted;
                  if (nextMuted) stopSpeaking();
                  return { ...prev, voiceMuted: nextMuted };
                })
              }
              onQuickCommand={(cmd) => {
                if (executeLocalVoiceCommand(cmd)) return;
                navigateTo('chat');
                sendPromptToGemini(cmd, true);
              }}
            />
          )}

          {activeScreen === 'multi_agent' && (
            <MultiAgentView
              collaborationLogs={collaborationLogs}
              customAgents={customAgents}
              onEngageAgent={(agentId) => {
                setSelectedCustomAgentId(null);
                setSelectedAgent(agentId);
                navigateTo('chat');
              }}
              onEngageCustomAgent={(customId) => {
                setSelectedCustomAgentId(customId);
                navigateTo('chat');
              }}
              onSaveCustomAgent={saveCustomAgent}
              onDeleteCustomAgent={deleteCustomAgent}
              onDispatchDirective={(directive) => {
                navigateTo('chat');
                sendPromptToGemini(directive, false);
              }}
            />
          )}

          {activeScreen === 'security' && (
            <SecurityView
              report={securityReport}
              logs={securityLogs}
              isLockdownActive={isLockdownActive}
              isPinProtected={settings.pinProtected}
              onRunScan={() => {
                refreshHealth();
                appendSecurityLog(
                  'SCAN',
                  `Manual security audit completed. Score: ${securityReport.score}/100.`,
                  'INFO',
                  'HOMER_SENTINEL'
                );
              }}
              onToggleLockdown={() => requestProtectedAction('lockdown')}
              onTogglePinProtection={() => requestProtectedAction('toggle_pin')}
            />
          )}

          {activeScreen === 'telemetry' && (
            <TelemetryCliView
              telemetry={telemetry}
              settings={settings}
              onRefreshTelemetry={refreshTelemetry}
              onUpdateSpeech={(speechRate, speechPitch) =>
                setSettings((prev) => ({ ...prev, speechRate, speechPitch }))
              }
              onTestVoice={() => speakText(JARVIS_LANGUAGES[language].greeting)}
            />
          )}

          {activeScreen === 'plugins' && (
            <PluginsView
              plugins={pluginsRef.current}
              lastToolOutput={lastToolOutput}
              onTogglePlugin={(pluginId) => {
                const target = pluginsRef.current.find((p) => p.id === pluginId);
                if (target) {
                  target.isEnabled = !target.isEnabled;
                  setPluginTick((n) => n + 1);
                }
              }}
              onExecutePluginTool={async (pluginId, toolId, params) => {
                const target = pluginsRef.current.find((p) => p.id === pluginId);
                if (!target) return;
                const result = await target.executeTool(toolId, params);
                setLastToolOutput(result.summary);
                setPluginTick((n) => n + 1);
                appendSecurityLog(
                  'TOOL_EXEC',
                  `Executed plugin tool ${target.name} :: ${toolId}`,
                  'INFO',
                  'JARVIS_PLUGINS'
                );
              }}
            />
          )}

          {activeScreen === 'memory' && (
            <MemoryVaultView
              memories={memories}
              backendSynced={backendMemorySynced}
              onAddMemory={async (item) => {
                const { outcome, nextMemories } = await saveMemoryWithSync({
                  candidate: item,
                  currentMemories: memoriesRef.current,
                });
                if (outcome.ok) {
                  setMemories(nextMemories);
                  if (outcome.syncedWithBackend) setBackendMemorySynced(true);
                }
                return { ok: outcome.ok, message: outcome.message };
              }}
              onUpdateMemory={async (id, patch) => {
                const { outcome, nextMemories } = await updateMemoryByIdWithSync({
                  id,
                  patch,
                  currentMemories: memoriesRef.current,
                });
                if (outcome.ok) {
                  setMemories(nextMemories);
                  if (outcome.syncedWithBackend) setBackendMemorySynced(true);
                }
                return { ok: outcome.ok, message: outcome.message };
              }}
              onDeleteMemory={async (id) => {
                const { outcome, nextMemories } = await deleteMemoryByIdWithSync({
                  id,
                  currentMemories: memoriesRef.current,
                });
                if (outcome.ok) {
                  setMemories(nextMemories);
                  if (outcome.syncedWithBackend) setBackendMemorySynced(true);
                }
              }}
              onClearAllMemories={async () => {
                const { outcome, nextMemories } = await clearAllMemoriesWithSync();
                setMemories(nextMemories);
                if (outcome.syncedWithBackend) setBackendMemorySynced(true);
              }}
              onExportBackup={handleExportBackup}
              onInspectBackupFile={handleInspectBackupFile}
            />
          )}

          {activeScreen === 'productivity' && (
            <ProductivityView
              tasks={tasks}
              initialFilter={productivityFilter}
              onAddTask={(task) =>
                setTasks((prev) => [
                  {
                    ...task,
                    id: `task_${Date.now()}`,
                    isCompleted: false,
                    createdAt: Date.now(),
                  },
                  ...prev,
                ])
              }
              onCreateSmartReminder={handleCreateSmartReminder}
              onSnoozeTask={handleSnoozeTask}
              onToggleTask={(id) =>
                setTasks((prev) =>
                  prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t))
                )
              }
              onDeleteTask={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
              onRequestFridayBriefing={() => {
                const pendingSummary = tasks
                  .filter((t) => !t.isCompleted)
                  .map((t) => `- [${t.priority}] ${t.title} (${t.dueTime})`)
                  .join('\n');
                setSelectedCustomAgentId(null);
                setSelectedAgent('FRIDAY_COORDINATOR');
                navigateTo('chat');
                sendPromptToGemini(
                  `Prepare a concise executive briefing for my current pending queue:\n${pendingSummary || 'No pending tasks.'}`,
                  false,
                  'FRIDAY_COORDINATOR'
                );
              }}
            />
          )}

          {activeScreen === 'insights' && (
            <InsightsView
              sessions={sessions}
              memories={memories}
              tasks={tasks}
              connectionState={connectionState}
              backendHealth={backendHealth}
            />
          )}

          {activeScreen === 'smart_home' && (
            <SmartHomeView
              devices={devices}
              onToggleDevice={(id) =>
                setDevices((prev) =>
                  prev.map((d) => (d.id === id ? { ...d, isOn: !d.isOn } : d))
                )
              }
              onApplyScene={(scene) =>
                setDevices((prev) =>
                  prev.map((d) => {
                    if (scene === 'STEALTH') {
                      return d.type === 'SECURITY' ? { ...d, isOn: true } : { ...d, isOn: false };
                    }
                    if (scene === 'LAB_FOCUS') {
                      return { ...d, isOn: d.type !== 'APPLIANCE' || d.room === 'Study' };
                    }
                    return { ...d, isOn: true };
                  })
                )
              }
            />
          )}

          {activeScreen === 'vision' && <VisionScannerView connectionState={connectionState} />}

          {activeScreen === 'music_studio' && (
            <MusicStudioView
              connectionState={connectionState}
              tracks={generatedTracks}
              activeGameTrackId={activeGameTrackId}
              onTrackGenerated={(track, setAsSoundtrack) => {
                setGeneratedTracks((prev) => [track, ...prev]);
                if (setAsSoundtrack) setActiveGameTrackId(track.id);
              }}
              onSelectGameTrack={(trackId) => setActiveGameTrackId(trackId)}
              onDeleteTrack={(trackId) => {
                setGeneratedTracks((prev) => prev.filter((t) => t.id !== trackId));
                if (activeGameTrackId === trackId) setActiveGameTrackId(null);
              }}
              onLaunchGame={() => navigateTo('orbital_game')}
            />
          )}

          {activeScreen === 'settings' && (
            <SettingsView
              settings={settings}
              language={language}
              memoriesCount={memories.length}
              sessionsCount={sessions.length}
              tasksCount={tasks.length}
              connectionState={connectionState}
              backendHealth={backendHealth}
              onUpdateSettings={(next) => {
                if (next.defaultAgent !== settings.defaultAgent) {
                  setSelectedAgent(next.defaultAgent);
                }
                setSettings(next);
              }}
              onLanguageChange={setLanguage}
              onTestVoice={() => speakText(JARVIS_LANGUAGES[language].greeting)}
              onRetryConnection={refreshHealth}
              onExportBackup={handleExportBackup}
              onInspectBackupFile={handleInspectBackupFile}
              onClearAllMemories={async () => {
                const { outcome, nextMemories } = await clearAllMemoriesWithSync();
                setMemories(nextMemories);
                if (outcome.syncedWithBackend) setBackendMemorySynced(true);
              }}
              onClearAllChats={() => {
                const now = Date.now();
                const fresh: ChatSession = {
                  id: `session_${now}`,
                  title: 'Primary Neural Link',
                  createdAt: now,
                  updatedAt: now,
                  messages: [],
                };
                setSessions([fresh]);
                setActiveSessionId(fresh.id);
              }}
              onResetAllData={() => {
                const defaults = jarvisStore.resetAll();
                setMemories(defaults.memories);
                setSessions(defaults.sessions);
                setActiveSessionId(defaults.activeSessionId);
                setTasks(defaults.tasks);
                setSecurityLogs(defaults.securityLogs);
                setDevices(defaults.devices);
                setSettings(defaults.settings);
                setLanguage('ENGLISH');
                setSelectedAgent(defaults.settings.defaultAgent);
                setIsLockdownActive(false);
              }}
            />
          )}
        </main>
      </div>

      {/* Validated JSON Backup Import Preview Modal */}
      <BackupImportModal
        preview={importPreviewState?.preview ?? null}
        filename={importPreviewState?.filename}
        onConfirm={handleConfirmBackupImport}
        onClose={() => setImportPreviewState(null)}
      />

      {/* Memory Saved Toast with Undo */}
      {memoryToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm glass-panel-glow rounded-2xl px-4 py-3 border border-emerald-400/50 shadow-2xl flex items-start gap-3"
        >
          <Brain className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-mono-hud text-xs font-bold text-emerald-300">
              Memory saved ({memoryToast.items.length})
            </p>
            <p className="text-xs text-slate-200 truncate mt-0.5">
              {memoryToast.items.map((m) => m.key).join(', ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const removeIds = new Set(memoryToast.items.map((i) => i.id));
              setMemories((prev) => prev.filter((m) => !removeIds.has(m.id)));
              if (memoryToastTimerRef.current !== null) {
                window.clearTimeout(memoryToastTimerRef.current);
                memoryToastTimerRef.current = null;
              }
              setMemoryToast(null);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 font-mono-hud text-[10px] font-bold text-cyan-200 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>UNDO</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (memoryToastTimerRef.current !== null) {
                window.clearTimeout(memoryToastTimerRef.current);
                memoryToastTimerRef.current = null;
              }
              setMemoryToast(null);
            }}
            aria-label="Dismiss memory toast"
            className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Smart Reminder Alert Toast with Snooze & Mark Done */}
      {activeReminderAlert && (
        <div
          role="alert"
          className="fixed bottom-4 left-4 z-50 max-w-md glass-panel-glow rounded-2xl p-4 border border-amber-400/60 shadow-2xl space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlarmClock className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-mono-hud text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                JARVIS REMINDER DUE
              </p>
              <p className="text-sm font-semibold text-slate-100 mt-0.5">
                {activeReminderAlert.title}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {activeReminderAlert.dueTime} • {activeReminderAlert.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveReminderAlert(null)}
              aria-label="Dismiss reminder"
              className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleSnoozeTask(activeReminderAlert.id, 10)}
              className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-amber-400/50 hover:border-amber-300 font-mono-hud text-[11px] font-bold text-amber-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>SNOOZE 10M</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const targetId = activeReminderAlert.id;
                setTasks((prev) =>
                  prev.map((t) => (t.id === targetId ? { ...t, isCompleted: true } : t))
                );
                setActiveReminderAlert(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 font-mono-hud text-[11px] font-bold text-[#02040A] flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>MARK DONE</span>
            </button>
          </div>
        </div>
      )}

      {/* Stark Master PIN Modal */}
      {pinModalAction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmPin}
            className="glass-panel-glow rounded-2xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300">
                <Lock className="w-4 h-4" />
                <h3 className="font-display text-sm font-bold tracking-wider">
                  STARK PIN VERIFICATION
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPinModalAction(null)}
                aria-label="Cancel PIN entry"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Enter your Master Stark PIN (default: <code className="text-cyan-300">1000</code>) to authorize this security change.
            </p>

            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pinEntry}
              onChange={(e) => setPinEntry(e.target.value)}
              placeholder="Enter PIN..."
              className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 font-mono-hud text-sm text-slate-100 focus:outline-none"
            />

            {pinError && <p className="font-mono-hud text-xs text-rose-400">{pinError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPinModalAction(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-mono-hud text-slate-300 cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold cursor-pointer"
              >
                AUTHORIZE
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;

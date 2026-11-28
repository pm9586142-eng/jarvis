import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlarmClock, Brain, Check, Clock, Lock, RotateCcw, X } from 'lucide-react';
import { BackupImportModal } from './components/BackupImportModal';
import { DashboardLayoutMode, HeaderHud } from './components/HeaderHud';
import { LiveSubtitlesHud } from './components/LiveSubtitlesHud';
import { MediaMiniPlayer } from './components/MediaMiniPlayer';
import { OpeningScreen } from './components/OpeningScreen';
import { NavCommandAction, SidebarNav } from './components/SidebarNav';
import { SyncConflictModal } from './components/SyncConflictModal';
import { SharedAiStateProvider } from './context/SharedAiStateContext';
import { HUD_THEME_PRESETS } from './services/sharedAiState.js';
import {
  findMatchingCustomAgent,
  JARVIS_AGENTS,
  JARVIS_LANGUAGES,
  routeIntentToAgent,
} from './data/agents';
import {
  checkBackendHealth,
  deleteNoteOnServer,
  deleteTaskOnServer,
  extractMemoriesFromTurn,
  fetchBrainStatus,
  fetchSmartTaskSuggestions,
  parseNaturalReminder,
  recordAutomationOnServer,
  runBrainCoordinationStream,
  setActiveUserNamespace,
  StreamCallbacks,
  streamGeminiChat,
  streamMultimodalChat,
  summarizeConversation,
  syncWorkspaceWithBackend,
  updateBrainRouterPolicy,
  upsertNoteOnServer,
  upsertTaskOnServer,
} from './services/api';
import {
  BackupImportPreview,
  buildBackupJson,
  buildBackupMarkdown,
  triggerFileDownload,
  validateAndPrepareBackupImport,
} from './services/backup';
import { generateDailyBriefing, getCachedDailyBriefing } from './services/briefing';
import { shouldAutoExtractMemories } from './services/brainEngine.js';
import { composeSpokenDailySummary } from './services/dailySummary';
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
import { parseCanonicalOfflineCommand } from './services/offline/canonicalCommandEngine.js';
import { amIndexedDbStore } from './services/offline/indexedDbStore';
import { sharedLocalAiManager } from './services/offline/localAiManager';
import { resolveAiProviderPlan } from './services/offline/networkAndRouter';
import { captureInstallPromptListener, triggerPwaInstallPrompt } from './services/offline/swRegister';
import { mergeWithConflictDetection, resolveConflictRecord } from './services/offline/syncConflictEngine';
import { createInitialPlugins, JarvisPlugin } from './services/plugins';
import { runBrowserSecurityAudit } from './services/security';
import { jarvisStore } from './services/storage';
import { collectBrowserTelemetry, getTelemetryRefreshIntervalMs } from './services/telemetry';
import {
  buildLocalizedWelcomeSequence,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  unlockBrowserAudio,
  VOICE_STATUS_LABELS,
  WebVoiceEngine,
  WELCOME_SESSION_STORAGE_KEY,
} from './services/voice';
import { getVoiceTestSample } from './services/femaleVoiceCatalog.js';
import {
  PreflightDiagnosticsReport,
  runPreflightDiagnostics,
} from './services/diagnostics';
import {
  getNextUltronShape,
  parseBrainVoiceAction,
  parseLocalVoiceCommand,
  parseOpenJarvisVoiceCommand,
  parseUltronVoiceCommand,
  ULTRON_SHAPE_LABELS,
} from './services/voiceCommands';
import {
  discoverOpenJarvisEngines,
  runOpenJarvisAgent,
  runOpenJarvisDeepResearch,
  searchOpenJarvisHybridMemory,
} from './services/openjarvisApi';
import { MediaPlaybackController } from './services/media/mediaPlaybackController';
import {
  CommandExecutionOutcome,
  VoiceCommandExecutor,
} from './services/media/voiceCommandExecutor';
import {
  ActiveEngineAttribution,
  AgentCollaborationLog,
  AgentId,
  AutomationHistoryItem,
  BackendHealth,
  BrowserTelemetry,
  ChatBrainMeta,
  ChatMediaTrackRef,
  ChatMessage,
  ChatSession,
  ChatSource,
  ConnectionState,
  CustomAgent,
  DailyBriefingData,
  GeneratedMusicTrack,
  HudThemePresetId,
  JarvisSettings,
  LanguageCode,
  MemoryItem,
  NoteItem,
  ScreenId,
  SecurityLogItem,
  SmartDevice,
  StartupSummaryStatus,
  SyncConflictItem,
  SystemEventEntry,
  TaskItem,
  UltronShapeForm,
  UltronVisualMode,
  UploadedDocumentItem,
} from './types/jarvis';
import {
  CommandActivityLogEntry,
  CommandSource,
  MediaPlayerState,
  ReactorHudState,
  SmartMediaMemory,
  YouTubeMediaItem,
  YouTubeSearchMode,
  YouTubeSearchResponse,
} from './types/media';
import { AutomationView } from './views/AutomationView';
import { ChatView, PendingChatAttachment } from './views/ChatView';
import { DashboardView, SignatureProtocolId } from './views/DashboardView';
import { InsightsView } from './views/InsightsView';
import { MediaControlView, MediaStageRect } from './views/MediaControlView';
import { MemoryVaultView } from './views/MemoryVaultView';
import { MultiAgentView } from './views/MultiAgentView';
const MultiAiControlCenterView = React.lazy(() =>
  import('./views/MultiAiControlCenterView').then((m) => ({ default: m.MultiAiControlCenterView }))
);
const MusicStudioView = React.lazy(() =>
  import('./views/MusicStudioView').then((m) => ({ default: m.MusicStudioView }))
);
const OrbitalGameView = React.lazy(() =>
  import('./views/OrbitalGameView').then((m) => ({ default: m.OrbitalGameView }))
);
import { PluginsView } from './views/PluginsView';
import { ProductivityView } from './views/ProductivityView';
const ResearchStudioView = React.lazy(() =>
  import('./views/ResearchStudioView').then((m) => ({ default: m.ResearchStudioView }))
);
import { SecurityView } from './views/SecurityView';
import { SettingsView } from './views/SettingsView';
import { SmartHomeView } from './views/SmartHomeView';
import { TelemetryCliView } from './views/TelemetryCliView';
const VisionScannerView = React.lazy(() =>
  import('./views/VisionScannerView').then((m) => ({ default: m.VisionScannerView }))
);
const UltronAssistantView = React.lazy(() =>
  import('./views/UltronAssistantView').then((m) => ({ default: m.UltronAssistantView }))
);
const OpenJarvisWorkspaceView = React.lazy(() =>
  import('./views/OpenJarvisWorkspaceView').then((m) => ({ default: m.OpenJarvisWorkspaceView }))
);
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
  dashboard: { title: 'COMMAND CENTER', subtitle: 'AM AI • JARVIS Quantum HUD • Multi-Subsystem Control' },
  brain_center: {
    title: 'MULTI-AI BRAIN CONTROL CENTER',
    subtitle: '11+ Free Providers • 14 Specialists • Collaboration & Verification ($0 Guard)',
  },
  chat: { title: 'NEURAL CHAT MATRIX', subtitle: 'Free-Only Multi-Provider AI • Smart Routing & Verification ($0)' },
  media_control: {
    title: 'MEDIA & WEB CONTROL',
    subtitle: 'Universal Website Launcher • YouTube Queue • 16 Voice Media Controls',
  },
  voice: { title: 'AM AI VOICE INTELLIGENCE', subtitle: 'Premium Bilingual Female Voice (Hindi / English / Hinglish)' },
  research: { title: 'RESEARCH & DOCUMENT STUDIO', subtitle: 'Live Web Search, PDF/DOCX/TXT Intelligence & Reports' },
  automation: { title: 'SMART AUTOMATION HUB', subtitle: 'Approved Web Actions, Quick Commands & Confirmation Guard' },
  multi_agent: { title: 'MULTI-AGENT HUB', subtitle: 'JARVIS • VERONICA • DUM-E • FRIDAY • HOMER' },
  security: { title: 'STARK SECURITY AUDIT', subtitle: 'DEFCON Posture, Key Isolation & Audit Trail' },
  telemetry: { title: 'TELEMETRY & CLI', subtitle: 'Live Browser Metrics & Neural Terminal' },
  plugins: { title: 'PLUGIN MATRIX', subtitle: 'Modular Tool APIs & Agile Kanban Board' },
  memory: { title: 'MEMORY VAULT', subtitle: 'Persistent Long-Term Context Directives' },
  productivity: { title: 'EXECUTIVE PLANNER', subtitle: 'Tasks, Notes, Reminders & FRIDAY Briefings' },
  insights: { title: 'USAGE & INSIGHTS', subtitle: '7-Day Neural Telemetry, Agent Analytics & Task Efficiency' },
  smart_home: { title: 'STARK SMART HOME', subtitle: 'Ambient Lighting, Climate & Security Bridge' },
  vision: { title: 'OPTICAL VISION SCANNER', subtitle: 'Webcam Capture, File Upload & Gemini Vision OCR' },
  orbital_game: { title: 'ORBITAL AEGIS 3D', subtitle: 'Three.js 3D Tactical Arena & Lyria Audio' },
  music_studio: { title: 'LYRIA MUSIC CORE', subtitle: 'Gemini Lyria 3 Clip & Full-Track Composer' },
  ultron: {
    title: 'ULTRON HOLOGRAPHIC AI',
    subtitle: '3D Morphing Holographic Avatar • Bilingual Voice • Gemini Free Core',
  },
  openjarvis: {
    title: 'OPENJARVIS CORE WORKSPACE',
    subtitle: '10 Assistants • 6 Engines • Hybrid RAG (BM25/Vector/ColBERT) • Learning Traces',
  },
  settings: { title: 'SYSTEM SETTINGS', subtitle: 'AM AI Voice, Multi-AI Brain, Dual Theme, Sync & Security PIN' },
};

const VALID_SCREENS = new Set<ScreenId>([
  'opening',
  'dashboard',
  'brain_center',
  'chat',
  'media_control',
  'voice',
  'research',
  'automation',
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
  'ultron',
  'openjarvis',
  'settings',
]);

const MEDIA_ACTIVITY_LOG_STORAGE_KEY = 'jarvis_media_activity_log_v1';

function loadMediaActivityLog(): CommandActivityLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MEDIA_ACTIVITY_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function shouldUseMultiAiCoordinator(
  prompt: string,
  mode: 'auto' | 'on' | 'off',
  hasBinaryAttachment: boolean
): boolean {
  if (hasBinaryAttachment) return false;
  if (mode === 'off') return false;
  if (mode === 'on') return true;
  const clean = prompt.trim();
  if (!clean) return false;
  const explicitMultiCue =
    /\b(multi[- ]?agent|collaborate|cross[- ]?check|verify thoroughly|architecture.*security|security.*audit.*and|step[- ]?by[- ]?step.*architecture|compare.*and.*build|design.*end[- ]?to[- ]?end)\b/i.test(
      clean
    );
  if (explicitMultiCue) return true;
  const domains = [
    /\b(code|typescript|python|react|api|database|sql|bug|debug)\b/i.test(clean),
    /\b(security|vulnerability|auth|xss|injection|audit)\b/i.test(clean),
    /\b(research|compare|benchmark|trade[- ]?offs|analysis)\b/i.test(clean),
    /\b(test|unit test|edge case|verify|plan|roadmap)\b/i.test(clean),
  ].filter(Boolean).length;
  return clean.length >= 210 && domains >= 2;
}

function getNormalizedBasePath(): string {
  const rawBase =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.BASE_URL || '/';
  const withLeading = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function resolveScreenFromLocation(): { screen: ScreenId; isKnownPath: boolean } {
  if (typeof window === 'undefined') return { screen: 'chat', isKnownPath: true };
  try {
    const basePath = getNormalizedBasePath();
    let relPath = window.location.pathname;
    if (basePath !== '/' && relPath.startsWith(basePath)) {
      relPath = relPath.slice(basePath.length);
    }
    const cleanRel = relPath.replace(/^\/+|\/+$/g, '');
    if (!cleanRel) {
      return { screen: 'chat', isKnownPath: true };
    }
    const segment = cleanRel.split('/')[0]?.toLowerCase() as ScreenId | '';
    if (segment && VALID_SCREENS.has(segment)) {
      return { screen: segment, isKnownPath: true };
    }
    return { screen: 'chat', isKnownPath: false };
  } catch {
    return { screen: 'chat', isKnownPath: true };
  }
}

function toYouTubeMediaItem(track: ChatMediaTrackRef): YouTubeMediaItem {
  return {
    videoId: track.videoId,
    title: track.title,
    channelTitle: track.channelTitle || 'YouTube',
    thumbnailUrl: track.thumbnailUrl || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`,
    watchUrl: track.watchUrl || `https://www.youtube.com/watch?v=${track.videoId}`,
    embedUrl: track.embedUrl || `https://www.youtube.com/embed/${track.videoId}`,
    durationText: track.durationText,
    durationSeconds: track.durationSeconds ?? null,
    embeddable: true,
    mediaType: 'video',
  };
}

export const App: React.FC = () => {
  const initialRoute = useMemo(() => resolveScreenFromLocation(), []);
  const [activeScreen, setActiveScreenState] = useState<ScreenId>(initialRoute.screen);
  const [activeNavKey, setActiveNavKey] = useState<string>(() =>
    initialRoute.screen === 'dashboard'
      ? 'command_center'
      : initialRoute.screen === 'chat'
        ? 'ai_chat'
        : initialRoute.screen
  );
  const [layoutMode, setLayoutMode] = useState<DashboardLayoutMode>('command');
  const [productivityFilter, setProductivityFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [productivityTab, setProductivityTab] = useState<'all' | 'tasks' | 'notes'>('all');
  const [mediaSection, setMediaSection] = useState<'youtube' | 'browser'>('youtube');
  const [openSessionsSignal, setOpenSessionsSignal] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = useCallback(
    (
      nextScreen: ScreenId,
      options?: {
        navKey?: string;
        productivityFilter?: 'ALL' | 'PENDING' | 'COMPLETED';
        productivityTab?: 'all' | 'tasks' | 'notes';
        mediaSection?: 'youtube' | 'browser';
        openSessionsDrawer?: boolean;
      }
    ) => {
      setActiveScreenState(nextScreen);
      if (options?.navKey) {
        setActiveNavKey(options.navKey);
      } else {
        setActiveNavKey(
          nextScreen === 'dashboard'
            ? 'command_center'
            : nextScreen === 'chat'
              ? 'ai_chat'
              : nextScreen
        );
      }
      if (options?.productivityFilter) {
        setProductivityFilter(options.productivityFilter);
      }
      if (options?.productivityTab) {
        setProductivityTab(options.productivityTab);
      }
      if (options?.mediaSection) {
        setMediaSection(options.mediaSection);
      }
      if (options?.openSessionsDrawer) {
        setOpenSessionsSignal((n) => n + 1);
      }
      if (typeof window !== 'undefined') {
        try {
          const basePath = getNormalizedBasePath();
          const targetUrl = nextScreen === 'chat' ? basePath : `${basePath}${nextScreen}`;
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
    // Cleanly normalize unknown deep paths to the base SPA route without page reload
    if (!initialRoute.isKnownPath && typeof window !== 'undefined') {
      try {
        window.history.replaceState({ screen: 'chat' }, '', getNormalizedBasePath());
      } catch {
        // Ignore history restrictions
      }
    }
  }, [initialRoute.isKnownPath]);

  useEffect(() => {
    const onPopState = () => {
      const resolved = resolveScreenFromLocation();
      setActiveScreenState(resolved.screen);
      setActiveNavKey(
        resolved.screen === 'dashboard'
          ? 'command_center'
          : resolved.screen === 'chat'
            ? 'ai_chat'
            : resolved.screen
      );
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
  const [notes, setNotes] = useState<NoteItem[]>(() => jarvisStore.getNotes());
  const [automations, setAutomations] = useState<AutomationHistoryItem[]>(() =>
    jarvisStore.getAutomations()
  );
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocumentItem[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLogItem[]>(() =>
    jarvisStore.getSecurityLogs()
  );
  const [devices, setDevices] = useState<SmartDevice[]>(() => jarvisStore.getDevices());
  const [settings, setSettings] = useState<JarvisSettings>(() => jarvisStore.getSettings());
  const [isTemporaryChat, setIsTemporaryChat] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => {
    const mode = jarvisStore.getSettings().themeMode || 'dark';
    if (mode === 'light') return 'light';
    if (mode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  });

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
  const [initialHealthSettled, setInitialHealthSettled] = useState(false);
  const [diagnosticsReport, setDiagnosticsReport] = useState<PreflightDiagnosticsReport | null>(
    null
  );
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false
  );
  const [dailyBriefing, setDailyBriefing] = useState<DailyBriefingData | null>(() =>
    getCachedDailyBriefing()
  );
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [initialBriefingSettled, setInitialBriefingSettled] = useState(() =>
    Boolean(getCachedDailyBriefing())
  );
  const [startupSummaryStatus, setStartupSummaryStatus] = useState<StartupSummaryStatus>(() => {
    const initial = jarvisStore.getSettings();
    if (!initial.autoSpeakDailySummary) return 'disabled';
    if (initial.voiceMuted) return 'muted';
    if (!isSpeechSynthesisSupported()) return 'unsupported';
    return 'preparing';
  });
  const [startupSummaryDismissed, setStartupSummaryDismissed] = useState(false);
  const hasTriggeredStartupSummaryRef = useRef(false);
  const isSpeakingDailySummaryRef = useRef(false);
  const startupWatchdogTimerRef = useRef<number | null>(null);

  // AM AI Two-Step Automatic Welcome & Premium Female Voice state
  const [activeVoiceInfo, setActiveVoiceInfo] = useState<{
    name: string;
    lang: string;
    isFemale: boolean;
  } | null>(null);
  const [welcomeAutoplayBlocked, setWelcomeAutoplayBlocked] = useState(false);
  const [welcomeStepLabel, setWelcomeStepLabel] = useState<string | null>(null);
  const hasAttemptedSessionWelcomeRef = useRef(false);
  const welcomeWatchdogTimerRef = useRef<number | null>(null);

  // Chat streaming, offline AI, Cosmic overlays & sync conflict state
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [backendMemorySynced, setBackendMemorySynced] = useState(false);
  const [liveBrainMeta, setLiveBrainMeta] = useState<ChatBrainMeta | null>(null);
  const [activeEngine, setActiveEngine] = useState<ActiveEngineAttribution>('Cloud AI');
  const [localModelReady, setLocalModelReady] = useState<boolean>(() =>
    sharedLocalAiManager.hasAnyInstalledModel()
  );
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [classicUrlOverride, setClassicUrlOverride] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('classic') === '1';
    } catch {
      return false;
    }
  });
  const [standbyMode, setStandbyMode] = useState(false);
  const [conversationWindowActive, setConversationWindowActive] = useState(false);
  const [lastAssistantReply, setLastAssistantReply] = useState('');
  const [systemEvents, setSystemEvents] = useState<SystemEventEntry[]>([]);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflictItem[]>([]);
  const [syncModalDismissed, setSyncModalDismissed] = useState(false);
  const conversationWindowTimerRef = useRef<number | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamTimeoutRef = useRef<number | null>(null);
  const isSendingRef = useRef<boolean>(false);
  const lastSubmittedRef = useRef<{ text: string; timestamp: number } | null>(null);
  const lastPromptRef = useRef<{ text: string; isVoice: boolean; agentId?: AgentId } | null>(null);

  const effectiveClassicMode = Boolean(classicUrlOverride || settings.classicMode);

  const addSystemEvent = useCallback(
    (
      category: SystemEventEntry['category'],
      title: string,
      detail: string,
      severity: SystemEventEntry['severity'] = 'info'
    ) => {
      const entry: SystemEventEntry = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        category,
        title,
        detail,
        severity,
      };
      setSystemEvents((prev) => {
        const next = [entry, ...prev].slice(0, 50);
        void amIndexedDbStore.saveEventLogs(next);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    const unsubModel = sharedLocalAiManager.subscribe(() => {
      setLocalModelReady(sharedLocalAiManager.hasAnyInstalledModel());
    });
    const unsubInstall = captureInstallPromptListener((avail) => {
      setCanInstallPwa(avail);
    });
    return () => {
      unsubModel();
      unsubInstall();
    };
  }, []);

  // Voice state
  const voiceEngineRef = useRef<WebVoiceEngine | null>(null);
  if (!voiceEngineRef.current) {
    voiceEngineRef.current = new WebVoiceEngine();
  }
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [voiceStatusLabel, setVoiceStatusLabel] = useState<string>(
    VOICE_STATUS_LABELS.ELEVENLABS_ACTIVE
  );
  useEffect(() => {
    const engine = voiceEngineRef.current;
    if (!engine) return;
    engine.setVoiceStatusListener(setVoiceStatusLabel);
    return () => engine.setVoiceStatusListener(null);
  }, []);
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

  // ULTRON AI Holographic Avatar state & voice prompt bridge
  const [ultronVisualMode, setUltronVisualMode] = useState<UltronVisualMode>('normal');
  const [ultronShapeForm, setUltronShapeForm] = useState<UltronShapeForm>('sphere');
  const [ultronCommandNotice, setUltronCommandNotice] = useState<string | null>(null);
  const ultronVoiceHandlerRef = useRef<((text: string) => void) | null>(null);

  // Universal Media & Web Control System (singleton playback controller + command executor)
  const mediaControllerRef = useRef<MediaPlaybackController | null>(null);
  if (!mediaControllerRef.current) {
    mediaControllerRef.current = new MediaPlaybackController(settings.mediaDefaultVolume ?? 80);
  }
  const commandExecutorRef = useRef<VoiceCommandExecutor | null>(null);
  if (!commandExecutorRef.current) {
    commandExecutorRef.current = new VoiceCommandExecutor(mediaControllerRef.current);
  }
  const [mediaState, setMediaState] = useState<MediaPlayerState>(() =>
    mediaControllerRef.current!.getState()
  );
  const [mediaMemory, setMediaMemory] = useState<SmartMediaMemory>(() =>
    commandExecutorRef.current!.memoryService.load()
  );
  const mediaMemoryRef = useRef<SmartMediaMemory>(mediaMemory);
  useEffect(() => {
    mediaMemoryRef.current = mediaMemory;
  }, [mediaMemory]);
  const [commandActivityLog, setCommandActivityLog] = useState<CommandActivityLogEntry[]>(() =>
    loadMediaActivityLog()
  );
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [mediaStageRect, setMediaStageRect] = useState<MediaStageRect | null>(null);
  const [chatMediaStageRect, setChatMediaStageRect] = useState<MediaStageRect | null>(null);
  const [ytSearchResults, setYtSearchResults] = useState<YouTubeSearchResponse | null>(null);
  const [isSearchingYouTube, setIsSearchingYouTube] = useState(false);
  const audioDuckingEnabledRef = useRef<boolean>(settings.audioDuckingEnabled !== false);
  useEffect(() => {
    audioDuckingEnabledRef.current = settings.audioDuckingEnabled !== false;
  }, [settings.audioDuckingEnabled]);
  const executeUniversalCommandRef = useRef<
    (
      rawText: string,
      source: CommandSource,
      options?: { allowAiActionFallback?: boolean; skipLocalCommands?: boolean; isVoice?: boolean }
    ) => Promise<CommandExecutionOutcome>
  >(async () => ({ handled: false, intent: 'UNKNOWN_COMMAND', status: 'fallback' }));
  const sendPromptToGeminiRef = useRef<
    (rawText: string, isVoice?: boolean, explicitAgentId?: AgentId) => Promise<void>
  >(async () => {});

  const attachYtHostRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      mediaControllerRef.current?.attachContainer(node);
    }
  }, []);

  useEffect(() => {
    const controller = mediaControllerRef.current;
    if (!controller) return undefined;
    return controller.subscribe((nextState) => {
      setMediaState(nextState);
      // Keep mediaMemory synchronized with UI button clicks and auto-advance transitions
      const mem = mediaMemoryRef.current;
      const trackChanged = nextState.currentTrack?.videoId !== mem.currentTrack?.videoId;
      const volChanged = nextState.volume !== mem.preferredVolume;
      if ((nextState.currentTrack && trackChanged) || volChanged) {
        const updated: SmartMediaMemory = {
          ...mem,
          previousTrack:
            nextState.currentTrack && trackChanged
              ? nextState.previousTrack || mem.currentTrack || mem.previousTrack
              : mem.previousTrack,
          currentTrack: nextState.currentTrack || mem.currentTrack,
          queue: nextState.queue.length > 0 ? nextState.queue : mem.queue,
          preferredVolume: nextState.volume,
          updatedAt: Date.now(),
        };
        mediaMemoryRef.current = updated;
        setMediaMemory(updated);
        commandExecutorRef.current?.memoryService.save(updated);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        MEDIA_ACTIVITY_LOG_STORAGE_KEY,
        JSON.stringify(commandActivityLog.slice(0, 50))
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [commandActivityLog]);

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
  useEffect(() => {
    if (!activeSession?.isTemporary) {
      jarvisStore.saveChats(messages);
    }
  }, [messages, activeSession?.isTemporary]);
  useEffect(() => jarvisStore.saveTasks(tasks), [tasks]);
  useEffect(() => jarvisStore.saveNotes(notes), [notes]);
  useEffect(() => jarvisStore.saveAutomations(automations), [automations]);
  useEffect(() => jarvisStore.saveSecurityLogs(securityLogs), [securityLogs]);
  useEffect(() => jarvisStore.saveDevices(devices), [devices]);
  useEffect(() => jarvisStore.saveSettings(settings), [settings]);
  useEffect(() => jarvisStore.saveLanguage(language), [language]);
  useEffect(() => jarvisStore.saveCustomAgents(customAgents), [customAgents]);
  useEffect(() => {
    void amIndexedDbStore.saveSessions(sessions);
  }, [sessions]);
  useEffect(() => {
    void amIndexedDbStore.saveMemories(memories);
  }, [memories]);
  useEffect(() => {
    void amIndexedDbStore.saveTasks(tasks);
  }, [tasks]);
  useEffect(() => {
    void amIndexedDbStore.saveNotes(notes);
  }, [notes]);
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', settings.accentTheme || 'cyan');
  }, [settings.accentTheme]);
  useEffect(() => {
    setActiveUserNamespace(settings.userNamespace || 'default');
  }, [settings.userNamespace]);
  useEffect(() => {
    const mode = settings.themeMode || 'dark';
    const applyResolved = () => {
      let next: 'dark' | 'light' = mode === 'light' ? 'light' : 'dark';
      if (mode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
        next = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      setResolvedTheme(next);
      document.documentElement.setAttribute('data-theme', next);
    };
    applyResolved();
    if (mode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      mql.addEventListener?.('change', applyResolved);
      return () => mql.removeEventListener?.('change', applyResolved);
    }
    return undefined;
  }, [settings.themeMode]);
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

  const spokenDailySummary = useMemo(
    () =>
      composeSpokenDailySummary({
        greeting: dailyBriefing?.greeting,
        tasks,
        weatherSummary: dailyBriefing?.weatherSummary,
        securityReport,
        aiLine: dailyBriefing?.aiLine,
        aiSource: dailyBriefing?.source,
      }),
    [dailyBriefing, tasks, securityReport]
  );

  const spokenDailySummaryRef = useRef(spokenDailySummary);
  useEffect(() => {
    spokenDailySummaryRef.current = spokenDailySummary;
  }, [spokenDailySummary]);

  const refreshDailyBriefing = useCallback(
    async (forceRefresh = false) => {
      setBriefingLoading(true);
      try {
        const result = await generateDailyBriefing({
          tasks,
          telemetry,
          language,
          securityReport,
          forceRefresh,
        });
        setDailyBriefing(result);
      } finally {
        setBriefingLoading(false);
      }
    },
    [tasks, telemetry, language, securityReport]
  );

  useEffect(() => {
    let fallbackTimer: number | null = null;
    if (!dailyBriefing) {
      fallbackTimer = window.setTimeout(() => {
        setInitialBriefingSettled(true);
      }, 1800);
      void refreshDailyBriefing(false).finally(() => {
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        setInitialBriefingSettled(true);
      });
    } else {
      setInitialBriefingSettled(true);
    }
    return () => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
    };
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

  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  const automationsRef = useRef(automations);
  useEffect(() => {
    automationsRef.current = automations;
  }, [automations]);

  const pendingSyncCount = useMemo(() => {
    const taskPending = tasks.filter((t) => t.syncStatus === 'pending_upsert').length;
    const notePending = notes.filter((n) => n.syncStatus === 'pending_upsert').length;
    const memPending = memories.filter((m) => m.syncStatus === 'pending_upsert').length;
    return taskPending + notePending + memPending;
  }, [tasks, notes, memories]);

  const handleSyncWorkspaceNow = useCallback(
    async (forceManual = false): Promise<{ ok: boolean; message: string }> => {
      if (!settings.crossDeviceSyncOptIn && !forceManual) {
        return {
          ok: false,
          message: 'Cross-device cloud sync is off by default. Enable Sync Opt-In in Settings first.',
        };
      }
      if (!telemetry.online) {
        addSystemEvent('SYNC', 'Offline Sync Deferred', `${pendingSyncCount} item(s) waiting for internet connection.`, 'warn');
        return { ok: false, message: 'Offline: local changes stay queued in IndexedDB until reconnected.' };
      }

      const res = await syncWorkspaceWithBackend({
        tasks: tasksRef.current,
        notes: notesRef.current,
        memories: memoriesRef.current,
        automations: automationsRef.current,
      });
      if (!res.ok) {
        addSystemEvent('ERROR', 'Workspace Sync Failed', res.error || 'Sync failed', 'error');
        return { ok: false, message: res.error || 'Workspace sync failed.' };
      }

      const taskMerge = mergeWithConflictDetection({
        entityType: 'task',
        localItems: tasksRef.current,
        cloudItems: res.tasks || [],
      });
      const noteMerge = mergeWithConflictDetection({
        entityType: 'note',
        localItems: notesRef.current,
        cloudItems: res.notes || [],
      });
      const memMerge = mergeWithConflictDetection({
        entityType: 'memory',
        localItems: memoriesRef.current,
        cloudItems: res.memories || [],
      });

      setTasks(taskMerge.merged);
      setNotes(noteMerge.merged);
      setMemories(memMerge.merged);
      if (res.automations.length > 0) setAutomations(res.automations);
      setBackendMemorySynced(true);

      const detectedConflicts = [
        ...taskMerge.conflicts,
        ...noteMerge.conflicts,
        ...memMerge.conflicts,
      ];
      setSyncConflicts(detectedConflicts);
      if (detectedConflicts.length > 0) {
        setSyncModalDismissed(false);
        addSystemEvent(
          'SYNC',
          'Sync Conflicts Detected',
          `${detectedConflicts.length} divergent item(s) require manual resolution.`,
          'warn'
        );
      } else {
        addSystemEvent(
          'SYNC',
          'Workspace Synchronized',
          `Merged ${memMerge.merged.length} memories, ${taskMerge.merged.length} tasks, ${noteMerge.merged.length} notes.`,
          'success'
        );
      }

      return {
        ok: true,
        message: `Synced "${res.namespace || settings.userNamespace}" (${memMerge.merged.length} memories, ${taskMerge.merged.length} tasks, ${noteMerge.merged.length} notes${detectedConflicts.length > 0 ? `, ${detectedConflicts.length} conflict(s)` : ''}).`,
      };
    },
    [settings.crossDeviceSyncOptIn, settings.userNamespace, telemetry.online, pendingSyncCount, addSystemEvent]
  );

  const handleResolveSyncConflict = useCallback(
    (conflict: SyncConflictItem, choice: 'keep_local' | 'keep_cloud' | 'keep_both') => {
      if (conflict.entityType === 'task') {
        const replacements = resolveConflictRecord<TaskItem>(conflict, choice);
        const origId = (conflict.localRecord as TaskItem).id;
        setTasks((prev) => [
          ...replacements,
          ...prev.filter((t) => t.id !== origId),
        ]);
      } else if (conflict.entityType === 'note') {
        const replacements = resolveConflictRecord<NoteItem>(conflict, choice);
        const origId = (conflict.localRecord as NoteItem).id;
        setNotes((prev) => [
          ...replacements,
          ...prev.filter((n) => n.id !== origId),
        ]);
      } else {
        const replacements = resolveConflictRecord<MemoryItem>(conflict, choice);
        const origId = (conflict.localRecord as MemoryItem).id;
        setMemories((prev) => [
          ...replacements,
          ...prev.filter((m) => m.id !== origId),
        ]);
      }
      setSyncConflicts((prev) => prev.filter((c) => c.id !== conflict.id));
      addSystemEvent(
        'SYNC',
        'Conflict Resolved',
        `Resolved ${conflict.entityType} "${conflict.label}" (${choice.replace('_', ' ')}).`,
        'success'
      );
    },
    [addSystemEvent]
  );

  // Backend health probe (returns boolean whether reachable)
  const refreshHealth = useCallback(async (): Promise<boolean> => {
    setConnectionState('connecting');
    try {
      const health = await checkBackendHealth(5000);
      setBackendHealth(health);
      setConnectionState((health.aiConfigured ?? health.geminiConfigured) ? 'online' : 'key_missing');
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
    } finally {
      setInitialHealthSettled(true);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibility = () => setIsTabHidden(document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const refreshDiagnostics = useCallback(async (): Promise<PreflightDiagnosticsReport> => {
    setDiagnosticsLoading(true);
    try {
      const report = await runPreflightDiagnostics(4500);
      setDiagnosticsReport(report);
      if (report.backendHealth) {
        setBackendHealth(report.backendHealth);
      }
      setConnectionState(report.connectionState);
      return report;
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    refreshHealth().then((reachable) => {
      if (!reachable && !cancelled) {
        // Retry once after 2.5s in case Express server is still binding during concurrent boot
        retryTimer = window.setTimeout(() => {
          if (!cancelled) {
            void refreshHealth();
          }
        }, 2500);
      }
    });

    const handleOnline = () => {
      if (!cancelled) {
        void refreshHealth();
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
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
      mediaControllerRef.current?.destroy();
      streamAbortRef.current?.abort();
      if (streamTimeoutRef.current !== null) {
        window.clearTimeout(streamTimeoutRef.current);
      }
    };
  }, []);

  // Schedule browser notifications & in-app alerts while the tab is open
  const triggerReminderNotification = useCallback((task: TaskItem) => {
    if (settings.taskNotificationsEnabled === false) return;
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
  }, [navigateTo, settings.taskNotificationsEnabled]);

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
    const now = Date.now();
    const newTask: TaskItem = {
      id: `task_${now}_${Math.random().toString(36).slice(2, 6)}`,
      title: reminder.title,
      description: reminder.description,
      dueTime: reminder.dueTime,
      triggerAtMillis: reminder.triggerAtMillis,
      isCompleted: false,
      priority: reminder.priority,
      category: reminder.category,
      createdAt: now,
      updatedAt: now,
    };
    setTasks((prev) => [newTask, ...prev]);
    void upsertTaskOnServer(newTask);
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

  const clearStartupWatchdog = useCallback(() => {
    if (startupWatchdogTimerRef.current !== null) {
      window.clearTimeout(startupWatchdogTimerRef.current);
      startupWatchdogTimerRef.current = null;
    }
    if (welcomeWatchdogTimerRef.current !== null) {
      window.clearTimeout(welcomeWatchdogTimerRef.current);
      welcomeWatchdogTimerRef.current = null;
    }
  }, []);

  const resolvedVoiceBcp47 = useMemo(() => {
    const pref = settings.voiceLanguagePreference || language;
    return JARVIS_LANGUAGES[pref]?.bcp47 || JARVIS_LANGUAGES[language].bcp47 || 'en-IN';
  }, [settings.voiceLanguagePreference, language]);

  const speakText = useCallback(
    (text: string, allowHandsFreeContinue = true) => {
      clearStartupWatchdog();
      isSpeakingDailySummaryRef.current = false;
      setWelcomeStepLabel(null);
      if (text.trim()) {
        setLastAssistantReply(text.trim());
      }
      if (settings.voiceMuted) {
        setIsSpeaking(false);
        setIsSpeechPaused(false);
        return;
      }
      voiceEngineRef.current?.speak({
        text,
        bcp47Lang: resolvedVoiceBcp47,
        voiceUri: settings.selectedVoiceUri || undefined,
        femaleVoiceEnabled: settings.femaleVoiceEnabled ?? true,
        neuralTtsEnabled: settings.neuralTtsEnabled ?? true,
        stylePreset: settings.voiceStylePreset || 'laila_soft',
        autoDetectLanguage: settings.autoDetectVoiceLanguage ?? true,
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        volume: settings.voiceVolume ?? 1.0,
        muted: settings.voiceMuted,
        onVoiceResolved: (info) => setActiveVoiceInfo(info),
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
          const windowSecs = settings.conversationWindowSeconds ?? 8;
          if (windowSecs > 0 && settings.voiceModeEnabled && !settings.voiceMuted) {
            if (conversationWindowTimerRef.current !== null) {
              window.clearTimeout(conversationWindowTimerRef.current);
            }
            setConversationWindowActive(true);
            conversationWindowTimerRef.current = window.setTimeout(() => {
              setConversationWindowActive(false);
              conversationWindowTimerRef.current = null;
            }, windowSecs * 1000);
          }
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
      clearStartupWatchdog,
      resolvedVoiceBcp47,
      settings.selectedVoiceUri,
      settings.femaleVoiceEnabled,
      settings.neuralTtsEnabled,
      settings.voiceStylePreset,
      settings.autoDetectVoiceLanguage,
      settings.speechRate,
      settings.speechPitch,
      settings.voiceVolume,
      settings.voiceMuted,
      settings.voiceModeEnabled,
      settings.conversationWindowSeconds,
      settings.continuousConversationMode,
    ]
  );

  // Two-Step Automatic AM AI Welcome Voice Sequence (strictly honest about /api/health)
  const playWelcomeSequence = useCallback(
    (options?: { isAuto?: boolean }) => {
      const isAuto = Boolean(options?.isAuto);
      if (!isSpeechSynthesisSupported() || settings.voiceMuted) {
        return false;
      }
      if (isAuto && !(settings.welcomeGreetingEnabled ?? true)) {
        return false;
      }
      if (isAuto && typeof window !== 'undefined') {
        try {
          if (window.sessionStorage.getItem(WELCOME_SESSION_STORAGE_KEY) === '1') {
            return false;
          }
        } catch {
          // Ignore sessionStorage restrictions
        }
      }

      clearStartupWatchdog();
      isSpeakingDailySummaryRef.current = false;

      // Strictly honest status check: only announce "all systems are online" if /api/health succeeded & AI is configured
      const backendOnline = connectionState === 'online' || connectionState === 'key_missing';
      const aiConfigured =
        connectionState === 'online' &&
        Boolean(backendHealth?.aiConfigured ?? backendHealth?.geminiConfigured);

      const steps = buildLocalizedWelcomeSequence({
        language,
        backendOnline,
        aiConfigured,
      });
      let started = false;
      let errored = false;

      const markSessionPlayed = () => {
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(WELCOME_SESSION_STORAGE_KEY, '1');
          } catch {
            // Ignore sessionStorage restrictions
          }
        }
      };

      if (isAuto) {
        welcomeWatchdogTimerRef.current = window.setTimeout(() => {
          welcomeWatchdogTimerRef.current = null;
          const synthBusy =
            Boolean(voiceEngineRef.current?.isSpeakingState) ||
            (typeof window !== 'undefined' && Boolean(window.speechSynthesis?.speaking));
          if (!started && !errored && !synthBusy) {
            voiceEngineRef.current?.stopSpeaking(false);
            setIsSpeaking(false);
            setIsSpeechPaused(false);
            setWelcomeStepLabel(null);
            setWelcomeAutoplayBlocked(true);
          }
        }, 1600);
      }

      const queued = voiceEngineRef.current?.speakSequence({
        steps,
        bcp47Lang: 'en-IN',
        voiceUri: settings.selectedVoiceUri || undefined,
        femaleVoiceEnabled: settings.femaleVoiceEnabled ?? true,
        neuralTtsEnabled: settings.neuralTtsEnabled ?? true,
        stylePreset: 'warm_welcome',
        autoDetectLanguage: settings.autoDetectVoiceLanguage ?? true,
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        volume: settings.voiceVolume ?? 1.0,
        muted: settings.voiceMuted,
        onVoiceResolved: (info) => setActiveVoiceInfo(info),
        onStepStart: (stepIdx) => {
          setWelcomeStepLabel(
            stepIdx === 0 ? 'Step 1/2 — Welcome to AM AI' : 'Step 2/2 — System Status'
          );
        },
        onStart: () => {
          started = true;
          clearStartupWatchdog();
          setWelcomeAutoplayBlocked(false);
          markSessionPlayed();
          setIsSpeaking(true);
          setIsSpeechPaused(false);
        },
        onPauseChange: (paused) => {
          setIsSpeechPaused(paused);
        },
        onError: (errCode) => {
          errored = true;
          clearStartupWatchdog();
          setIsSpeaking(false);
          setIsSpeechPaused(false);
          setWelcomeStepLabel(null);
          if (isAuto && (!started || errCode === 'not-allowed' || errCode === 'interrupted')) {
            setWelcomeAutoplayBlocked(true);
          }
        },
        onEnd: () => {
          clearStartupWatchdog();
          setIsSpeaking(false);
          setIsSpeechPaused(false);
          setWelcomeStepLabel(null);
          if (started) {
            markSessionPlayed();
            setWelcomeAutoplayBlocked(false);
          } else if (isAuto && !errored) {
            setWelcomeAutoplayBlocked(true);
          }
        },
      });

      if (!queued && isAuto) {
        clearStartupWatchdog();
        setWelcomeAutoplayBlocked(true);
      }
      return Boolean(queued);
    },
    [
      clearStartupWatchdog,
      connectionState,
      backendHealth?.aiConfigured,
      language,
      backendHealth?.geminiConfigured,
      settings.voiceMuted,
      settings.welcomeGreetingEnabled,
      settings.selectedVoiceUri,
      settings.femaleVoiceEnabled,
      settings.neuralTtsEnabled,
      settings.autoDetectVoiceLanguage,
      settings.speechRate,
      settings.speechPitch,
      settings.voiceVolume,
    ]
  );

  // Trigger Two-Step Automatic Welcome Greeting once per session AFTER real /api/health settles
  useEffect(() => {
    if (activeScreen === 'opening') return;
    if (!initialHealthSettled || hasAttemptedSessionWelcomeRef.current) return;
    hasAttemptedSessionWelcomeRef.current = true;
    if (!(settings.welcomeGreetingEnabled ?? true) || settings.voiceMuted) return;
    playWelcomeSequence({ isAuto: true });
  }, [
    activeScreen,
    initialHealthSettled,
    settings.welcomeGreetingEnabled,
    settings.voiceMuted,
    playWelcomeSequence,
  ]);

  // Graceful browser autoplay fallback: play once automatically on first user gesture if blocked
  useEffect(() => {
    if (!welcomeAutoplayBlocked || !(settings.welcomeGreetingEnabled ?? true) || settings.voiceMuted) {
      return;
    }
    const handleFirstGesture = () => {
      setWelcomeAutoplayBlocked(false);
      playWelcomeSequence({ isAuto: true });
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [welcomeAutoplayBlocked, settings.welcomeGreetingEnabled, settings.voiceMuted, playWelcomeSequence]);

  const speakDailySummary = useCallback(
    (options?: { isStartupAuto?: boolean; overrideText?: string; prefix?: string }) => {
      clearStartupWatchdog();

      if (!isSpeechSynthesisSupported()) {
        setStartupSummaryStatus('unsupported');
        return;
      }

      if (settings.voiceMuted) {
        setStartupSummaryStatus('muted');
        return;
      }

      const baseText = options?.overrideText?.trim() || spokenDailySummaryRef.current;
      const finalText = options?.prefix ? `${options.prefix} ${baseText}` : baseText;
      if (!finalText.trim()) return;

      const langDesc = JARVIS_LANGUAGES[language];
      let started = false;
      let errored = false;
      isSpeakingDailySummaryRef.current = true;
      setStartupSummaryDismissed(false);

      if (options?.isStartupAuto) {
        startupWatchdogTimerRef.current = window.setTimeout(() => {
          startupWatchdogTimerRef.current = null;
          const synthBusy =
            Boolean(voiceEngineRef.current?.isSpeakingState) ||
            (typeof window !== 'undefined' && Boolean(window.speechSynthesis?.speaking));
          if (!started && !errored && !synthBusy) {
            isSpeakingDailySummaryRef.current = false;
            voiceEngineRef.current?.stopSpeaking(false);
            setIsSpeaking(false);
            setIsSpeechPaused(false);
            setStartupSummaryStatus('awaiting_gesture');
          }
        }, 1600);
      }

      const queued = voiceEngineRef.current?.speak({
        text: finalText,
        bcp47Lang: resolvedVoiceBcp47 || langDesc.bcp47,
        voiceUri: settings.selectedVoiceUri || undefined,
        femaleVoiceEnabled: settings.femaleVoiceEnabled ?? true,
        neuralTtsEnabled: settings.neuralTtsEnabled ?? true,
        stylePreset: settings.voiceStylePreset || 'laila_soft',
        autoDetectLanguage: settings.autoDetectVoiceLanguage ?? true,
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        volume: settings.voiceVolume ?? 1.0,
        muted: false,
        onVoiceResolved: (info) => setActiveVoiceInfo(info),
        onStart: () => {
          started = true;
          clearStartupWatchdog();
          setIsSpeaking(true);
          setIsSpeechPaused(false);
          if (isSpeakingDailySummaryRef.current) {
            setStartupSummaryStatus('speaking');
          }
        },
        onPauseChange: (paused) => {
          setIsSpeechPaused(paused);
          if (isSpeakingDailySummaryRef.current) {
            setStartupSummaryStatus(paused ? 'paused' : 'speaking');
          }
        },
        onError: (errCode) => {
          errored = true;
          clearStartupWatchdog();
          const wasSummary = isSpeakingDailySummaryRef.current;
          isSpeakingDailySummaryRef.current = false;
          setIsSpeaking(false);
          setIsSpeechPaused(false);
          if (!wasSummary) return;
          if (
            options?.isStartupAuto &&
            (!started || errCode === 'not-allowed' || errCode === 'interrupted')
          ) {
            setStartupSummaryStatus('awaiting_gesture');
          } else {
            setStartupSummaryStatus('idle');
          }
        },
        onEnd: () => {
          clearStartupWatchdog();
          if (errored) return;
          const wasSummary = isSpeakingDailySummaryRef.current;
          isSpeakingDailySummaryRef.current = false;
          setIsSpeaking(false);
          setIsSpeechPaused(false);
          if (!wasSummary) return;
          if (started) {
            setStartupSummaryStatus('completed');
          } else if (options?.isStartupAuto) {
            setStartupSummaryStatus('awaiting_gesture');
          } else {
            setStartupSummaryStatus('completed');
          }
        },
      });

      if (!queued) {
        clearStartupWatchdog();
        isSpeakingDailySummaryRef.current = false;
        setStartupSummaryStatus(options?.isStartupAuto ? 'awaiting_gesture' : 'idle');
      }
    },
    [
      clearStartupWatchdog,
      language,
      resolvedVoiceBcp47,
      settings.selectedVoiceUri,
      settings.femaleVoiceEnabled,
      settings.neuralTtsEnabled,
      settings.voiceStylePreset,
      settings.autoDetectVoiceLanguage,
      settings.speechRate,
      settings.speechPitch,
      settings.voiceVolume,
      settings.voiceMuted,
    ]
  );

  // Automatically synthesize & speak daily summary once upon opening if two-step AM AI welcome is disabled
  useEffect(() => {
    if (activeScreen === 'opening') return;
    if (!initialBriefingSettled || hasTriggeredStartupSummaryRef.current) return;
    hasTriggeredStartupSummaryRef.current = true;

    // Prevent audio overlap with the Two-Step Automatic AM AI Welcome Sequence
    if (settings.welcomeGreetingEnabled ?? true) {
      setStartupSummaryStatus('idle');
      return;
    }

    if (!settings.autoSpeakDailySummary) {
      setStartupSummaryStatus('disabled');
      return;
    }
    if (settings.voiceMuted) {
      setStartupSummaryStatus('muted');
      return;
    }
    if (!isSpeechSynthesisSupported()) {
      setStartupSummaryStatus('unsupported');
      return;
    }

    speakDailySummary({ isStartupAuto: true });
  }, [
    activeScreen,
    initialBriefingSettled,
    settings.welcomeGreetingEnabled,
    settings.autoSpeakDailySummary,
    settings.voiceMuted,
    speakDailySummary,
  ]);

  // Keep startup summary status synchronized with mute / launch-toggle preference changes
  useEffect(() => {
    if (settings.voiceMuted) {
      if (isSpeakingDailySummaryRef.current) {
        clearStartupWatchdog();
        isSpeakingDailySummaryRef.current = false;
        voiceEngineRef.current?.stopSpeaking();
        setIsSpeaking(false);
        setIsSpeechPaused(false);
      }
      setStartupSummaryStatus('muted');
      return;
    }
    setStartupSummaryStatus((curr) => {
      if (!settings.autoSpeakDailySummary && (curr === 'preparing' || curr === 'idle' || curr === 'muted')) {
        return 'disabled';
      }
      if (settings.autoSpeakDailySummary && (curr === 'disabled' || curr === 'muted')) {
        return 'idle';
      }
      return curr;
    });
  }, [settings.voiceMuted, settings.autoSpeakDailySummary, clearStartupWatchdog]);

  useEffect(() => () => clearStartupWatchdog(), [clearStartupWatchdog]);

  const pauseSpeaking = useCallback(() => {
    if (voiceEngineRef.current?.pauseSpeaking()) {
      setIsSpeechPaused(true);
      if (isSpeakingDailySummaryRef.current) {
        setStartupSummaryStatus('paused');
      }
    }
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (voiceEngineRef.current?.resumeSpeaking()) {
      setIsSpeechPaused(false);
      if (isSpeakingDailySummaryRef.current) {
        setStartupSummaryStatus('speaking');
      }
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    clearStartupWatchdog();
    if (handsFreeRestartTimerRef.current !== null) {
      window.clearTimeout(handsFreeRestartTimerRef.current);
      handsFreeRestartTimerRef.current = null;
    }
    const wasSummary = isSpeakingDailySummaryRef.current;
    isSpeakingDailySummaryRef.current = false;
    voiceEngineRef.current?.stopSpeaking();
    setIsSpeaking(false);
    setIsSpeechPaused(false);
    setWelcomeStepLabel(null);
    if (wasSummary) {
      setStartupSummaryStatus('idle');
    }
  }, [clearStartupWatchdog]);

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

  const createChatSession = useCallback(
    (isTemp = false) => {
      if (isThinking) stopStreaming();
      const now = Date.now();
      const newId = `${isTemp ? 'temp_' : 'session_'}${now}_${Math.random().toString(36).slice(2, 6)}`;
      const newSession: ChatSession = {
        id: newId,
        title: isTemp ? 'Temporary Chat (Private)' : 'New Neural Session',
        createdAt: now,
        updatedAt: now,
        messages: [],
        isTemporary: isTemp,
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newId);
      setIsTemporaryChat(isTemp);
      setStreamingText('');
    },
    [isThinking, stopStreaming]
  );

  const toggleTemporaryChatMode = useCallback(() => {
    if (isTemporaryChat || activeSession?.isTemporary) {
      setIsTemporaryChat(false);
      const nonTemp = sessions.find((s) => !s.isTemporary);
      if (nonTemp) {
        setActiveSessionId(nonTemp.id);
      } else {
        createChatSession(false);
      }
    } else {
      createChatSession(true);
    }
  }, [isTemporaryChat, activeSession?.isTemporary, sessions, createChatSession]);

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

  const toggleSaveChatSession = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, isSaved: !s.isSaved, updatedAt: Date.now() } : s
      )
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

      isSendingRef.current = true;
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
          setLiveBrainMeta(meta);
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
          isSendingRef.current = false;
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

          const allowMemoryForTurn =
            (settings.memoryEnabled ?? true) && !isTemporaryChat && !targetSessionObj?.isTemporary;

          if (
            allowMemoryForTurn &&
            settings.autoExtractMemories &&
            connectionState === 'online' &&
            shouldAutoExtractMemories(prompt) &&
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
          isSendingRef.current = false;
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
        onError: (errMsg, errorMeta) => {
          if (streamTimeoutRef.current !== null) {
            window.clearTimeout(streamTimeoutRef.current);
            streamTimeoutRef.current = null;
          }
          streamAbortRef.current = null;
          isSendingRef.current = false;
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
            errorMeta,
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

      const allowMemoryForTurn =
        (settings.memoryEnabled ?? true) && !isTemporaryChat && !targetSessionObj?.isTemporary;

      const relevantConversations = allowMemoryForTurn
        ? retrieveRelevantConversations(
            effectivePrompt,
            sessions.filter((s) => !s.isTemporary),
            {
              activeSessionId: targetSessionId,
              limit: 2,
            }
          )
        : [];
      const activeMemoriesForTurn = allowMemoryForTurn ? memoriesRef.current : [];
      const liveMediaState = mediaControllerRef.current?.getState();
      const liveMediaContextBlock =
        commandExecutorRef.current?.memoryService.formatContextBlockForAi(
          mediaMemoryRef.current,
          liveMediaState?.status || 'idle',
          liveMediaState
        ) || '';
      const mergedCustomInstructions = [settings.customInstructions, liveMediaContextBlock]
        .filter(Boolean)
        .join('\n\n');

      const commitLocalAssistantMessage = (params: {
        text: string;
        engineAttr: ActiveEngineAttribution;
        modelLabel: string;
        isError?: boolean;
      }) => {
        setActiveEngine(params.engineAttr);
        setStreamingText('');
        setIsThinking(false);
        isSendingRef.current = false;

        const msgObj: ChatMessage = {
          id: `msg_${Date.now()}_local`,
          sessionId: targetSessionId,
          role: 'jarvis',
          text: params.text,
          agentCodename: speakerCodename,
          timestamp: Date.now(),
          isError: params.isError,
          brainMeta: params.isError
            ? undefined
            : {
                intent: 'LOCAL_AI',
                detectedLanguage: language,
                isFollowUp: historyBeforePrompt.length > 0,
                reasoningMode: 'fast',
                recommendedAgent: speakerCodename,
                provider: params.engineAttr,
                providerLabel: params.engineAttr,
                model: params.modelLabel,
              },
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? { ...s, updatedAt: Date.now(), messages: [...s.messages, msgObj] }
              : s
          )
        );
        if (
          !params.isError &&
          settings.voiceModeEnabled &&
          !settings.voiceMuted &&
          (isVoice || settings.autoSpeakReplies || handsFreeRef.current)
        ) {
          speakText(params.text);
        }
      };

      const attemptLocalAiInference = async (
        preferOllama: boolean,
        allowTransformersFallback: boolean
      ): Promise<boolean> => {
        const sysPrompt =
          customAgent?.systemPrompt ||
          `You are ${speakerCodename} inside AM AI Cosmic Intelligence. Reply concisely and politely in ${langDesc.displayName}. Address the user as Sir.`;
        if (preferOllama && settings.ollamaEnabled) {
          try {
            const ollamaRes = await sharedLocalAiManager.generateWithOllama({
              enabled: true,
              endpoint: settings.ollamaEndpoint || 'http://127.0.0.1:11434',
              model: settings.ollamaModel || 'llama3.2:1b',
              systemInstruction: sysPrompt,
              prompt: effectivePrompt,
            });
            addSystemEvent('LOCAL_AI', 'Ollama Inference Complete', ollamaRes.modelLabel, 'success');
            commitLocalAssistantMessage({
              text: ollamaRes.text,
              engineAttr: 'Ollama (Opt-In)',
              modelLabel: ollamaRes.modelLabel,
            });
            return true;
          } catch (err) {
            if (!allowTransformersFallback) {
              addSystemEvent(
                'ERROR',
                'Ollama Unreachable',
                err instanceof Error ? err.message : 'Ollama error',
                'warn'
              );
              return false;
            }
          }
        }
        if (sharedLocalAiManager.hasAnyInstalledModel()) {
          const targetModelId =
            settings.selectedLocalModelId || 'onnx-community/Qwen2.5-0.5B-Instruct';
          try {
            const localRes = await sharedLocalAiManager.generateLocalReply({
              modelId: targetModelId,
              systemInstruction: sysPrompt,
              prompt: effectivePrompt,
              autoUnloadMinutes: settings.autoUnloadLocalModelMinutes ?? 15,
            });
            addSystemEvent('LOCAL_AI', 'Local PC AI Reply', localRes.modelLabel, 'success');
            commitLocalAssistantMessage({
              text: localRes.text,
              engineAttr: 'Local PC AI',
              modelLabel: localRes.modelLabel,
            });
            return true;
          } catch (err) {
            addSystemEvent(
              'ERROR',
              'Local PC AI Error',
              err instanceof Error ? err.message : 'Local generation failed',
              'error'
            );
            return false;
          }
        }
        return false;
      };

      try {
        const hasBinaryAttachment = Boolean(attachment?.base64Data && !isTextContext);
        const routingPlan = resolveAiProviderPlan(settings.routingMode || 'hybrid', {
          browserOnline: telemetry.online,
          backendReachable: connectionState !== 'offline',
          cloudAiConfigured: connectionState === 'online',
          localModelInstalled: sharedLocalAiManager.hasAnyInstalledModel(),
          ollamaEnabled: Boolean(settings.ollamaEnabled),
        });

        // Non-cloud direct routing (Offline Command, Local-Only, or Hybrid automatic offline fallback)
        if (!hasBinaryAttachment && routingPlan.target !== 'cloud') {
          if (streamTimeoutRef.current !== null) {
            window.clearTimeout(streamTimeoutRef.current);
            streamTimeoutRef.current = null;
          }
          if (routingPlan.target === 'ollama' || routingPlan.target === 'local_pc') {
            const ok = await attemptLocalAiInference(
              routingPlan.target === 'ollama',
              routingPlan.allowFallbackToLocal
            );
            if (ok) return;
          }
          commitLocalAssistantMessage({
            text: `${routingPlan.reason}\n\nYou can still create tasks/notes offline, use offline commands (e.g., "What time is it?", "Add task ..."), or install a local browser model in Settings > Local Model Manager.`,
            engineAttr: 'Offline Command Engine',
            modelLabel: 'Offline Command Engine',
            isError: true,
          });
          return;
        }

        setActiveEngine('Cloud AI');
        const collabMode = settings.brainCollaborationMode || 'auto';
        const useCoordinator =
          !customAgent && shouldUseMultiAiCoordinator(effectivePrompt, collabMode, hasBinaryAttachment);

        const wrappedCallbacks: StreamCallbacks = {
          ...streamCallbacks,
          onError: (errMsg, errorMeta) => {
            if (!hasBinaryAttachment && routingPlan.allowFallbackToLocal) {
              void attemptLocalAiInference(Boolean(settings.ollamaEnabled), true).then((ok) => {
                if (!ok) {
                  streamCallbacks.onError(errMsg, errorMeta);
                }
              });
              return;
            }
            streamCallbacks.onError(errMsg, errorMeta);
          },
        };

        if (hasBinaryAttachment) {
          await streamMultimodalChat({
            prompt: effectivePrompt,
            fileBase64: attachment!.base64Data!,
            mimeType: attachment!.mimeType,
            fileName: attachment!.name,
            agent,
            language: langDesc,
            telemetry,
            memories: activeMemoriesForTurn,
            relevantConversations,
            history: historyBeforePrompt,
            conversationSummary: targetSessionObj?.contextSummary || '',
            enableWebSearch: settings.webSearchEnabled,
            customSystemPromptOverride: customAgent?.systemPrompt,
            personality: settings.personality,
            customInstructions: mergedCustomInstructions || undefined,
            responseStyle: settings.responseStyle,
            reasoningPreference: settings.reasoningPreference,
            signal: controller.signal,
            callbacks: wrappedCallbacks,
          });
        } else if (useCoordinator) {
          await runBrainCoordinationStream({
            prompt: effectivePrompt,
            history: historyBeforePrompt.slice(-10).map((m) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              text: m.text,
            })),
            languageInstruction: liveMediaContextBlock
              ? `${langDesc.instruction}\n\n${liveMediaContextBlock}`
              : langDesc.instruction,
            memoryEnabled: allowMemoryForTurn,
            temporaryChat: Boolean(isTemporaryChat || targetSessionObj?.isTemporary),
            collaborationMode: collabMode,
            isVoice,
            signal: controller.signal,
            onMeta: (meta) => wrappedCallbacks.onMeta?.(meta),
            onText: (txt) => wrappedCallbacks.onChunk(txt),
            onComplete: (txt) => wrappedCallbacks.onComplete(txt),
            onError: (errMsg) => wrappedCallbacks.onError(errMsg),
          });
        } else {
          await streamGeminiChat({
            prompt: effectivePrompt,
            agent,
            language: langDesc,
            telemetry,
            memories: activeMemoriesForTurn,
            relevantConversations,
            history: historyBeforePrompt,
            conversationSummary: targetSessionObj?.contextSummary || '',
            enableWebSearch: settings.webSearchEnabled,
            customSystemPromptOverride: customAgent?.systemPrompt,
            personality: settings.personality,
            customInstructions: mergedCustomInstructions || undefined,
            responseStyle: settings.responseStyle,
            reasoningPreference: settings.reasoningPreference,
            signal: controller.signal,
            callbacks: wrappedCallbacks,
          });
        }
      } finally {
        isSendingRef.current = false;
      }
    },
    [
      language,
      sessions,
      telemetry,
      isTemporaryChat,
      settings.memoryEnabled,
      settings.personality,
      settings.customInstructions,
      settings.responseStyle,
      settings.reasoningPreference,
      settings.brainCollaborationMode,
      settings.webSearchEnabled,
      settings.autoSpeakReplies,
      settings.voiceModeEnabled,
      settings.voiceMuted,
      settings.autoExtractMemories,
      settings.routingMode,
      settings.ollamaEnabled,
      settings.ollamaEndpoint,
      settings.ollamaModel,
      settings.selectedLocalModelId,
      settings.autoUnloadLocalModelMinutes,
      connectionState,
      speakText,
      addSystemEvent,
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
      if ((!prompt && !attachment) || isThinking || isSendingRef.current) return;
      const effectiveText = prompt || `Analyze attached file: ${attachment?.name ?? 'document'}`;

      // Guard against rapid accidental double-submits (double-click / Enter + voice race)
      const now = Date.now();
      const prevSubmit = lastSubmittedRef.current;
      if (
        !attachment &&
        prevSubmit &&
        prevSubmit.text === effectiveText &&
        now - prevSubmit.timestamp < 1200
      ) {
        return;
      }
      lastSubmittedRef.current = { text: effectiveText, timestamp: now };
      isSendingRef.current = true;

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

      // Phase I: Deterministic Canonical Offline Commands (time, date, tasks, notes, memory, navigation, protocols)
      if (!attachment) {
        const canonical = parseCanonicalOfflineCommand(effectiveText);
        if (canonical) {
          let canonicalReply = '';
          const now = Date.now();
          if (canonical.intent === 'QUERY_TIME') {
            canonicalReply = `Current local time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, Sir.`;
          } else if (canonical.intent === 'QUERY_DATE') {
            canonicalReply = `Today is ${new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, Sir.`;
          } else if (canonical.intent === 'CREATE_TASK' && canonical.title) {
            const created: TaskItem = {
              id: `task_${now}`,
              title: canonical.title,
              description: 'Created via AM AI Offline Command Engine',
              dueTime: 'Today',
              isCompleted: false,
              priority: 'MEDIUM',
              category: 'TASK',
              createdAt: now,
              updatedAt: now,
              syncStatus: telemetry.online && settings.crossDeviceSyncOptIn ? 'synced' : 'pending_upsert',
            };
            setTasks((prev) => [created, ...prev]);
            if (telemetry.online && settings.crossDeviceSyncOptIn) void upsertTaskOnServer(created);
            canonicalReply = `Task saved offline-first: "${canonical.title}", Sir.`;
          } else if (canonical.intent === 'LIST_TASKS') {
            const pending = tasksRef.current.filter((t) => !t.isCompleted);
            canonicalReply =
              pending.length === 0
                ? 'You have zero pending tasks, Sir.'
                : `You have ${pending.length} pending task(s): ${pending.slice(0, 5).map((t) => t.title).join('; ')}.`;
          } else if (canonical.intent === 'CREATE_NOTE' && canonical.content) {
            const created: NoteItem = {
              id: `note_${now}`,
              title: canonical.title || canonical.content.slice(0, 32),
              content: canonical.content,
              tags: ['offline'],
              pinned: false,
              createdAt: now,
              updatedAt: now,
              syncStatus: telemetry.online && settings.crossDeviceSyncOptIn ? 'synced' : 'pending_upsert',
            };
            setNotes((prev) => [created, ...prev]);
            if (telemetry.online && settings.crossDeviceSyncOptIn) void upsertNoteOnServer(created);
            canonicalReply = `Note saved to Vault: "${created.title}", Sir.`;
          } else if (canonical.intent === 'LIST_NOTES') {
            canonicalReply =
              notesRef.current.length === 0
                ? 'No saved notes yet, Sir.'
                : `You have ${notesRef.current.length} saved note(s): ${notesRef.current.slice(0, 5).map((n) => n.title).join('; ')}.`;
          } else if (canonical.intent === 'OPEN_SCREEN' && canonical.screen) {
            navigateTo(canonical.screen, {
              mediaSection: canonical.section,
              productivityTab: canonical.tab,
            });
            canonicalReply = `Opening ${canonical.screen.replace('_', ' ')} module, Sir.`;
          } else if (canonical.intent === 'RUN_PROTOCOL' && canonical.protocol) {
            if (canonical.protocol === 'STANDBY') {
              setStandbyMode(true);
              canonicalReply = 'Entering Cosmic Standby Mode, Sir.';
            } else if (canonical.protocol === 'DIAGNOSTICS') {
              void refreshDiagnostics();
              canonicalReply = `Diagnostics running. Connection: ${connectionState.toUpperCase()}. Local AI ready: ${localModelReady ? 'YES' : 'NO'}.`;
            } else if (canonical.protocol === 'FOCUS') {
              setDevices((prev) =>
                prev.map((d) => ({ ...d, isOn: d.type !== 'APPLIANCE' || d.room === 'Study' }))
              );
              canonicalReply = 'Focus protocol engaged across workspace, Sir.';
            } else {
              void refreshDailyBriefing(true);
              canonicalReply = spokenDailySummaryRef.current || 'Good morning briefing initialized, Sir.';
            }
          }

          if (canonicalReply) {
            setActiveEngine('Offline Command Engine');
            addSystemEvent('COMMAND', canonical.intent, canonicalReply, 'success');
            const cmdReply: ChatMessage = {
              id: `msg_${now}_cmd`,
              sessionId: targetSessionId,
              role: 'jarvis',
              text: canonicalReply,
              agentCodename: 'AM COMMAND',
              timestamp: now,
              brainMeta: {
                intent: 'OFFLINE_COMMAND',
                detectedLanguage: language,
                isFollowUp: false,
                reasoningMode: 'fast',
                recommendedAgent: 'AM COMMAND',
                provider: 'offline',
                providerLabel: 'Offline Command Engine',
                model: 'Canonical Engine',
              },
            };
            setSessions((prev) =>
              prev.map((s) =>
                s.id === targetSessionId
                  ? { ...s, updatedAt: Date.now(), messages: [...s.messages, cmdReply] }
                  : s
              )
            );
            if (
              settings.voiceModeEnabled &&
              !settings.voiceMuted &&
              (isVoice || settings.autoSpeakReplies || handsFreeRef.current)
            ) {
              speakText(canonicalReply);
            }
            isSendingRef.current = false;
            return;
          }
        }
      }

      // Universal Media & Web Control System: deterministic Stages 1..5 in Chat text input
      if (!attachment) {
        const mediaOutcome = await executeUniversalCommandRef.current(effectiveText, 'chat', {
          allowAiActionFallback: false,
          skipLocalCommands: true,
          isVoice,
        });
        if (mediaOutcome.handled) {
          const replyText =
            mediaOutcome.chatReply ||
            mediaOutcome.spokenReply ||
            'Command executed in Media & Web Control, Sir.';
          const mediaReply: ChatMessage = {
            id: `msg_${Date.now()}_media`,
            sessionId: targetSessionId,
            role: 'jarvis',
            text: replyText,
            agentCodename: 'JARVIS MEDIA',
            timestamp: Date.now(),
            mediaPayload: mediaOutcome.mediaTrack
              ? {
                  track: {
                    videoId: mediaOutcome.mediaTrack.videoId,
                    title: mediaOutcome.mediaTrack.title,
                    channelTitle: mediaOutcome.mediaTrack.channelTitle,
                    thumbnailUrl: mediaOutcome.mediaTrack.thumbnailUrl,
                    durationText: mediaOutcome.mediaTrack.durationText,
                    durationSeconds: mediaOutcome.mediaTrack.durationSeconds,
                    watchUrl: mediaOutcome.mediaTrack.watchUrl,
                    embedUrl: mediaOutcome.mediaTrack.embedUrl,
                  },
                  queue: mediaOutcome.mediaQueue?.map((item) => ({
                    videoId: item.videoId,
                    title: item.title,
                    channelTitle: item.channelTitle,
                    thumbnailUrl: item.thumbnailUrl,
                    durationText: item.durationText,
                    durationSeconds: item.durationSeconds,
                    watchUrl: item.watchUrl,
                    embedUrl: item.embedUrl,
                  })),
                  source: 'youtube',
                }
              : undefined,
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? { ...s, updatedAt: Date.now(), messages: [...s.messages, mediaReply] }
                : s
            )
          );
          isSendingRef.current = false;
          return;
        }
      }

      // Phase 2/3: Check natural-language memory commands before streaming to Gemini
      if (!attachment && (settings.memoryEnabled ?? true) && !isTemporaryChat && !activeSession?.isTemporary) {
        const memCmd = await executeChatMemoryCommand({
          rawText: effectiveText,
          currentMemories: memoriesRef.current,
          sessions: sessions.filter((s) => !s.isTemporary),
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
          isSendingRef.current = false;
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
    if (isThinking || isSendingRef.current) return;
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
      if (!cleanText || isThinking || isSendingRef.current) return;
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
      const ultronAction = parseUltronVoiceCommand(rawText);
      if (ultronAction) {
        switch (ultronAction.type) {
          case 'OPEN_ASSISTANT_MODE':
            navigateTo('ultron', { navKey: 'ultron' });
            setUltronVisualMode('normal');
            setUltronCommandNotice('ASSISTANT MODE ACTIVE');
            speakText('ULTRON Holographic Assistant mode activated, Sir.');
            return true;
          case 'CYCLE_SHAPE':
            setUltronShapeForm((prev) => {
              const next = getNextUltronShape(prev);
              setUltronCommandNotice(`SHAPE → ${ULTRON_SHAPE_LABELS[next].toUpperCase()}`);
              speakText(`Transforming holographic shape to ${ULTRON_SHAPE_LABELS[next]}, Sir.`);
              return next;
            });
            return true;
          case 'SET_SHAPE':
            setUltronShapeForm(ultronAction.shape);
            setUltronCommandNotice(`SHAPE → ${ULTRON_SHAPE_LABELS[ultronAction.shape].toUpperCase()}`);
            speakText(`Holographic shape set to ${ULTRON_SHAPE_LABELS[ultronAction.shape]}, Sir.`);
            return true;
          case 'SET_MODE':
            setUltronVisualMode(ultronAction.mode);
            setUltronCommandNotice(`${ultronAction.mode.toUpperCase()} MODE`);
            if (ultronAction.mode === 'energy') {
              speakText('Energy core mode activated, Sir.');
            } else if (ultronAction.mode === 'hologram') {
              speakText('Transparent hologram mode activated, Sir.');
            } else if (ultronAction.mode === 'thinking') {
              speakText('Entering thinking mode, Sir.');
            } else {
              setUltronShapeForm('sphere');
              speakText('Returned to normal holographic mode, Sir.');
            }
            return true;
          case 'START_LISTENING':
            startVoiceCaptureRef.current({ autoNavigateToChat: false });
            setUltronCommandNotice('LISTENING ACTIVE');
            return true;
          case 'STOP_LISTENING':
            voiceEngineRef.current?.stopListening();
            setIsListening(false);
            setAudioLevel(0);
            exitHandsFreeMode();
            setUltronCommandNotice('MICROPHONE PAUSED');
            return true;
        }
      }

      const ojAction = parseOpenJarvisVoiceCommand(rawText);
      if (ojAction) {
        if (ojAction.type === 'OPEN_OPENJARVIS') {
          navigateTo('openjarvis', { navKey: 'openjarvis' });
          speakText('Opening OpenJarvis Core workspace with 10 assistant modes and hybrid retrieval.');
          return true;
        }
        if (ojAction.type === 'CHECK_ENGINES') {
          void discoverOpenJarvisEngines(false)
            .then((res) => {
              const probes = Array.isArray(res.probes) ? (res.probes as Array<{ engineId: string; ok: boolean }>) : [];
              const okCount = probes.filter((p) => p.ok).length;
              speakText(`OpenJarvis inspected ${probes.length} configured engine(s); ${okCount} connected cleanly.`);
            })
            .catch(() => {
              speakText('Unable to probe OpenJarvis engines right now.');
            });
          return true;
        }
        if (ojAction.type === 'HYBRID_SEARCH') {
          void searchOpenJarvisHybridMemory({ query: ojAction.query, mode: 'hybrid', limit: 3 })
            .then((res) => {
              const top = res.results?.[0];
              speakText(
                top
                  ? `Top hybrid memory match: ${top.title}. ${top.text.slice(0, 220)}`
                  : `No indexed documents or memories matched ${ojAction.query}.`
              );
            })
            .catch(() => speakText('Hybrid memory search encountered an error.'));
          return true;
        }
        if (ojAction.type === 'DEEP_RESEARCH') {
          navigateTo('openjarvis', { navKey: 'openjarvis' });
          speakText(`Starting OpenJarvis deep research on ${ojAction.query}.`);
          void runOpenJarvisDeepResearch({ query: ojAction.query })
            .then((res) => {
              if (res.report?.summary) speakText(res.report.summary.slice(0, 320));
            })
            .catch(() => speakText('Deep research encountered a temporary error.'));
          return true;
        }
        if (ojAction.type === 'RUN_MODE') {
          navigateTo('openjarvis', { navKey: 'openjarvis' });
          void runOpenJarvisAgent({
            prompt: ojAction.prompt,
            assistantMode: ojAction.assistantMode,
          })
            .then((res) => {
              if (res.answer) speakText(res.answer.slice(0, 340));
              else if (res.error) speakText(res.error);
            })
            .catch(() => speakText('OpenJarvis agent execution failed.'));
          return true;
        }
      }

      const brainAction = parseBrainVoiceAction(rawText);
      if (brainAction) {
        if (brainAction.type === 'SWITCH_PROVIDER') {
          void updateBrainRouterPolicy({ mode: 'manual', manualProvider: brainAction.providerId }).then((res) => {
            if (res.ok) {
              speakText(`Preferred AI provider updated to ${brainAction.providerId}, Sir.`);
            } else {
              speakText(
                res.error || `Unable to switch to ${brainAction.providerId} under the zero-dollar guard, Sir.`
              );
            }
          });
          return true;
        }
        if (brainAction.type === 'SELECT_AGENT') {
          navigateTo('brain_center', { navKey: 'multi_ai_brain' });
          speakText(`Opening Multi-AI Brain with the ${brainAction.agentId} specialist agent, Sir.`);
          return true;
        }
        if (brainAction.type === 'RUN_COLLABORATION') {
          setSettings((prev) => ({ ...prev, brainCollaborationMode: 'on' }));
          navigateTo('chat');
          void sendPromptToGemini(brainAction.prompt, true);
          return true;
        }
      }

      const cmd = parseLocalVoiceCommand(rawText);
      if (cmd) {
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

        case 'OPEN_BRAIN_CENTER':
          navigateTo('brain_center', { navKey: 'multi_ai_brain' });
          speakText('Opening the Multi-AI Brain Control Center, Sir.');
          return true;

        case 'OPEN_MEDIA_CONTROL':
          navigateTo('media_control', { navKey: 'media_control' });
          speakText('Opening the Media and Web Control HUD, Sir.');
          return true;

        case 'CHECK_PROVIDER_HEALTH':
          void fetchBrainStatus()
            .then((snap) => {
              const configured = snap.providers.filter((p) => p.configured).length;
              const connected = snap.providers.filter((p) => p.connectionState === 'CONNECTED').length;
              speakText(
                `Multi-AI Brain has ${configured} configured free providers and ${connected} verified live connections. Strict zero-dollar mode is active, Sir.`
              );
            })
            .catch(() => {
              speakText('Unable to reach the Multi-AI Brain health endpoint right now, Sir.');
            });
          return true;

        case 'REPLAY_WELCOME':
          playWelcomeSequence({ isAuto: false });
          return true;
        }
      }

      const canonical = parseCanonicalOfflineCommand(rawText);
      if (canonical) {
        let canonicalReply = '';
        const now = Date.now();
        if (canonical.intent === 'QUERY_TIME') {
          canonicalReply = `Current local time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, Sir.`;
        } else if (canonical.intent === 'QUERY_DATE') {
          canonicalReply = `Today is ${new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, Sir.`;
        } else if (canonical.intent === 'CREATE_TASK' && canonical.title) {
          const created: TaskItem = {
            id: `task_${now}`,
            title: canonical.title,
            description: 'Created via AM AI Voice Command Engine',
            dueTime: 'Today',
            isCompleted: false,
            priority: 'MEDIUM',
            category: 'TASK',
            createdAt: now,
            updatedAt: now,
            syncStatus: telemetry.online && settings.crossDeviceSyncOptIn ? 'synced' : 'pending_upsert',
          };
          setTasks((prev) => [created, ...prev]);
          if (telemetry.online && settings.crossDeviceSyncOptIn) void upsertTaskOnServer(created);
          canonicalReply = `Task added: "${canonical.title}", Sir.`;
        } else if (canonical.intent === 'LIST_TASKS') {
          const pending = tasksRef.current.filter((t) => !t.isCompleted);
          canonicalReply =
            pending.length === 0
              ? 'You have zero pending tasks, Sir.'
              : `You have ${pending.length} pending task(s): ${pending.slice(0, 5).map((t) => t.title).join('; ')}.`;
        } else if (canonical.intent === 'CREATE_NOTE' && canonical.content) {
          const created: NoteItem = {
            id: `note_${now}`,
            title: canonical.title || canonical.content.slice(0, 32),
            content: canonical.content,
            tags: ['voice'],
            pinned: false,
            createdAt: now,
            updatedAt: now,
            syncStatus: telemetry.online && settings.crossDeviceSyncOptIn ? 'synced' : 'pending_upsert',
          };
          setNotes((prev) => [created, ...prev]);
          if (telemetry.online && settings.crossDeviceSyncOptIn) void upsertNoteOnServer(created);
          canonicalReply = `Note saved to Vault: "${created.title}", Sir.`;
        } else if (canonical.intent === 'LIST_NOTES') {
          canonicalReply =
            notesRef.current.length === 0
              ? 'No saved notes yet, Sir.'
              : `You have ${notesRef.current.length} saved note(s): ${notesRef.current.slice(0, 5).map((n) => n.title).join('; ')}.`;
        } else if (canonical.intent === 'SAVE_MEMORY' && canonical.content) {
          const content = canonical.content.trim();
          if (content) {
            const createdMem: MemoryItem = {
              id: `mem_${now}`,
              key: content.split(/\s+/).slice(0, 4).join(' ').slice(0, 48),
              category: 'FACT',
              content: content.slice(0, 260),
              importance: 4,
              createdAt: now,
              updatedAt: now,
              syncStatus: telemetry.online ? 'synced' : 'pending_upsert',
            };
            setMemories((prev) => [createdMem, ...prev]);
            canonicalReply = `Stored in AM Memory Vault: "${content}", Sir.`;
          }
        } else if (canonical.intent === 'OPEN_SCREEN' && canonical.screen) {
          navigateTo(canonical.screen as ScreenId, {
            mediaSection: canonical.section,
            productivityTab: canonical.tab,
          });
          canonicalReply = `Opening ${canonical.screen.replace('_', ' ')} module, Sir.`;
        } else if (canonical.intent === 'RUN_PROTOCOL' && canonical.protocol) {
          if (canonical.protocol === 'STANDBY') {
            setStandbyMode(true);
            canonicalReply = 'Entering Cosmic Standby Mode, Sir.';
          } else if (canonical.protocol === 'DIAGNOSTICS') {
            void refreshDiagnostics();
            canonicalReply = `Diagnostics running. Connection: ${connectionState.toUpperCase()}. Local AI ready: ${localModelReady ? 'YES' : 'NO'}.`;
          } else if (canonical.protocol === 'FOCUS') {
            setDevices((prev) =>
              prev.map((d) => ({ ...d, isOn: d.type !== 'APPLIANCE' || d.room === 'Study' }))
            );
            canonicalReply = 'Focus protocol engaged across workspace, Sir.';
          } else {
            void refreshDailyBriefing(true);
            canonicalReply = spokenDailySummaryRef.current || 'Good morning briefing initialized, Sir.';
          }
        }

        if (canonicalReply) {
          setActiveEngine('Offline Command Engine');
          addSystemEvent('COMMAND', canonical.intent, canonicalReply, 'success');
          speakText(canonicalReply);
          return true;
        }
      }

      return false;
    },
    [
      exitHandsFreeMode,
      stopStreaming,
      speakText,
      settings.pinProtected,
      settings.crossDeviceSyncOptIn,
      isLockdownActive,
      telemetry.batteryPercent,
      telemetry.isCharging,
      telemetry.online,
      createChatSession,
      navigateTo,
      playWelcomeSequence,
      sendPromptToGemini,
      refreshDiagnostics,
      refreshDailyBriefing,
      connectionState,
      localModelReady,
      addSystemEvent,
    ]
  );

  useEffect(() => {
    sendPromptToGeminiRef.current = (rawText, isVoice, explicitAgentId) =>
      sendPromptToGemini(rawText, isVoice, explicitAgentId);
  }, [sendPromptToGemini]);

  const executeUniversalCommand = useCallback(
    async (
      rawText: string,
      source: CommandSource,
      options?: { allowAiActionFallback?: boolean; skipLocalCommands?: boolean; isVoice?: boolean }
    ): Promise<CommandExecutionOutcome> => {
      const executor = commandExecutorRef.current;
      if (!executor) {
        return { handled: false, intent: 'UNKNOWN_COMMAND', status: 'fallback' };
      }

      setIsExecutingCommand(true);
      try {
        const outcome = await executor.execute({
          rawText,
          source,
          memory: mediaMemoryRef.current,
          uiLanguage: language,
          allowAiActionFallback:
            options?.allowAiActionFallback ?? (source !== 'chat'),
          tryExistingLocalCommand: options?.skipLocalCommands
            ? undefined
            : (txt) => executeLocalVoiceCommand(txt),
        });

        if (outcome.updatedMemory) {
          setMediaMemory(outcome.updatedMemory);
        }
        if (outcome.searchResult) {
          setYtSearchResults(outcome.searchResult);
        }
        if (outcome.activityEntry) {
          setCommandActivityLog((prev) => [outcome.activityEntry!, ...prev].slice(0, 50));
        }
        if (outcome.openMediaView) {
          navigateTo('media_control', { navKey: 'media_control' });
        }
        if (
          outcome.handled &&
          outcome.spokenReply &&
          settings.voiceModeEnabled &&
          !settings.voiceMuted &&
          (source !== 'chat' ||
            Boolean(options?.isVoice) ||
            settings.autoSpeakReplies ||
            handsFreeRef.current)
        ) {
          speakText(outcome.spokenReply);
        }
        return outcome;
      } finally {
        setIsExecutingCommand(false);
      }
    },
    [
      executeLocalVoiceCommand,
      language,
      navigateTo,
      settings.voiceModeEnabled,
      settings.voiceMuted,
      settings.autoSpeakReplies,
      speakText,
    ]
  );

  useEffect(() => {
    executeUniversalCommandRef.current = executeUniversalCommand;
  }, [executeUniversalCommand]);

  const handleYouTubeSearch = useCallback(
    async (query: string, mode: YouTubeSearchMode, pageToken?: string) => {
      const executor = commandExecutorRef.current;
      const clean = query.trim();
      if (!executor || !clean) return;

      setIsSearchingYouTube(true);
      try {
        if (!pageToken) {
          setYtSearchResults(null);
          const nextMem = executor.memoryService.recordSearchHistory(
            mediaMemoryRef.current,
            clean,
            mode
          );
          setMediaMemory(nextMem);
        }
        const res = await executor.youtubeSearch.search({
          query: clean,
          mode,
          maxResults: 8,
          pageToken,
        });
        setYtSearchResults(res);
        setCommandActivityLog((prev) =>
          [
            {
              id: `yt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              timestamp: Date.now(),
              source: 'media_ui' as const,
              rawCommand: `Search YouTube (${mode}): ${clean}`,
              normalizedCommand: clean,
              intent: 'SEARCH_YOUTUBE' as const,
              status: res.ok && res.items.length > 0 ? ('success' as const) : ('fallback' as const),
              summary:
                res.ok && res.items.length > 0
                  ? `Found ${res.items.length} YouTube results for "${clean}".`
                  : res.reason || `No embeddable YouTube results for "${clean}".`,
              url: res.fallbackUrl,
              urlLabel: `YouTube: ${clean}`,
              resultsCount: res.items.length,
            },
            ...prev,
          ].slice(0, 50)
        );
      } finally {
        setIsSearchingYouTube(false);
      }
    },
    []
  );

  const handlePlaySearchResult = useCallback(
    (items: YouTubeMediaItem[], index: number, fallbackUrl?: string) => {
      const controller = mediaControllerRef.current;
      if (!controller || items.length === 0) return;
      void controller.loadQueue(items, index, {
        autoPlay: true,
        fallbackUrl,
      });
    },
    []
  );

  const handleClearSearchHistory = useCallback(() => {
    const executor = commandExecutorRef.current;
    if (!executor) return;
    const cleared = executor.memoryService.clearSearchHistory(mediaMemoryRef.current);
    setMediaMemory(cleared);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    void mediaControllerRef.current?.toggleFullscreen();
  }, []);

  // Wire WebVoiceEngine audio ducking hooks to MediaPlaybackController (~20% duck while speaking/listening)
  useEffect(() => {
    const engine = voiceEngineRef.current;
    if (!engine) return undefined;
    engine.setAudioDuckingCallbacks({
      onSpeechStart: () => {
        if (audioDuckingEnabledRef.current) {
          mediaControllerRef.current?.beginAudioDuck(20);
        }
      },
      onSpeechEnd: () => {
        mediaControllerRef.current?.endAudioDuck();
      },
      onListenStart: () => {
        if (audioDuckingEnabledRef.current) {
          mediaControllerRef.current?.beginAudioDuck(20);
        }
      },
      onListenEnd: () => {
        mediaControllerRef.current?.endAudioDuck();
      },
    });
    return () => {
      engine.setAudioDuckingCallbacks(null);
    };
  }, []);

  // Keep latest voice settings in a ref so adjusting sliders does not tear down the active wake-word monitor
  const wakeWordVoiceRef = useRef({
    voiceMuted: settings.voiceMuted,
    selectedVoiceUri: settings.selectedVoiceUri,
    femaleVoiceEnabled: settings.femaleVoiceEnabled ?? true,
    neuralTtsEnabled: settings.neuralTtsEnabled ?? true,
    autoDetectVoiceLanguage: settings.autoDetectVoiceLanguage ?? true,
    speechRate: settings.speechRate,
    speechPitch: settings.speechPitch,
    voiceVolume: settings.voiceVolume ?? 1.0,
    language,
  });
  useEffect(() => {
    wakeWordVoiceRef.current = {
      voiceMuted: settings.voiceMuted,
      selectedVoiceUri: settings.selectedVoiceUri,
      femaleVoiceEnabled: settings.femaleVoiceEnabled ?? true,
      neuralTtsEnabled: settings.neuralTtsEnabled ?? true,
      autoDetectVoiceLanguage: settings.autoDetectVoiceLanguage ?? true,
      speechRate: settings.speechRate,
      speechPitch: settings.speechPitch,
      voiceVolume: settings.voiceVolume ?? 1.0,
      language,
    };
  }, [
    settings.voiceMuted,
    settings.selectedVoiceUri,
    settings.femaleVoiceEnabled,
    settings.neuralTtsEnabled,
    settings.autoDetectVoiceLanguage,
    settings.speechRate,
    settings.speechPitch,
    settings.voiceVolume,
    language,
  ]);

  // Wire "Hey JARVIS" continuous wake-word monitor inside the single existing WebVoiceEngine
  useEffect(() => {
    const engine = voiceEngineRef.current;
    if (!engine) return undefined;

    if (!settings.wakeWordEnabled) {
      engine.stopWakeWordMonitor();
      setIsWakeWordActive(false);
      return undefined;
    }

    const started = engine.startWakeWordMonitor({
      bcp47Lang: resolvedVoiceBcp47,
      allowLegacyJarvis: Boolean(settings.wakeWordLegacyJarvisAlias),
      onStatusChange: (active) => setIsWakeWordActive(active),
      onError: (msg, code) => {
        setVoiceError(msg);
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setVoicePermissionDenied(true);
        }
        setSettings((prev) => (prev.wakeWordEnabled ? { ...prev, wakeWordEnabled: false } : prev));
      },
      onWakeWord: ({ inlineCommand, wakeTarget }) => {
        if (standbyMode) setStandbyMode(false);
        const isUltronWake = wakeTarget === 'ultron';
        if (isUltronWake) {
          navigateTo('ultron', { navKey: 'ultron' });
          setUltronCommandNotice('WAKE WORD: HEY ULTRON');
        }
        const trimmed = inlineCommand.trim();
        if (trimmed) {
          setTranscript(trimmed);
          void executeUniversalCommandRef
            .current(trimmed, 'wake_word', { allowAiActionFallback: true, isVoice: true })
            .then((outcome) => {
              if (!outcome.handled) {
                if (isUltronWake && ultronVoiceHandlerRef.current) {
                  ultronVoiceHandlerRef.current(trimmed);
                } else {
                  void sendPromptToGeminiRef.current(trimmed, true);
                }
              }
            });
          return;
        }

        // Bare wake word ("Hey AM" / "Hey Ultron"): acknowledge clearly and then listen
        const voicePrefs = wakeWordVoiceRef.current;
        setTranscript(isUltronWake ? 'Hey Ultron' : 'Hey AM');
        if (voicePrefs.voiceMuted || !isSpeechSynthesisSupported()) {
          startVoiceCaptureRef.current({ autoNavigateToChat: false });
          return;
        }
        const ackText = isUltronWake
          ? voicePrefs.language === 'HINDI'
            ? 'जी सर, अल्ट्रॉन होलोग्राफिक कोर सुन रहा है।'
            : 'ULTRON Holographic Core online and listening, Sir.'
          : voicePrefs.language === 'HINDI'
            ? 'जी सर, मैं सुन रही हूँ।'
            : "Yes, Sir. I'm listening.";
        engine.speak({
          text: ackText,
          bcp47Lang: resolvedVoiceBcp47,
          voiceUri: voicePrefs.selectedVoiceUri || undefined,
          femaleVoiceEnabled: voicePrefs.femaleVoiceEnabled,
          neuralTtsEnabled: voicePrefs.neuralTtsEnabled,
          stylePreset: 'warm_welcome',
          autoDetectLanguage: voicePrefs.autoDetectVoiceLanguage,
          rate: voicePrefs.speechRate,
          pitch: voicePrefs.speechPitch,
          volume: voicePrefs.voiceVolume,
          muted: voicePrefs.voiceMuted,
          onVoiceResolved: (info) => setActiveVoiceInfo(info),
          onStart: () => {
            setIsSpeaking(true);
            setIsSpeechPaused(false);
          },
          onEnd: () => {
            setIsSpeaking(false);
            setIsSpeechPaused(false);
            startVoiceCaptureRef.current({ autoNavigateToChat: false });
          },
        });
      },
    });

    if (!started) {
      setSettings((prev) => (prev.wakeWordEnabled ? { ...prev, wakeWordEnabled: false } : prev));
    }

    return () => {
      engine.stopWakeWordMonitor();
    };
  }, [
    settings.wakeWordEnabled,
    settings.wakeWordLegacyJarvisAlias,
    resolvedVoiceBcp47,
    standbyMode,
    navigateTo,
  ]);

  const toggleWakeWord = useCallback(() => {
    setVoiceError(null);
    setSettings((prev) => ({
      ...prev,
      voiceModeEnabled: true,
      wakeWordEnabled: !prev.wakeWordEnabled,
    }));
  }, []);

  const toggleAudioDucking = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      audioDuckingEnabled: !(prev.audioDuckingEnabled !== false),
    }));
  }, []);

  const reactorState: ReactorHudState = useMemo(() => {
    if (isSpeaking && !isSpeechPaused) return 'SPEAKING';
    if (isListening) return 'LISTENING';
    if (isExecutingCommand) return 'EXECUTING';
    if (isThinking) return 'PROCESSING';
    if (mediaState.status === 'playing') return 'PLAYING';
    if (mediaState.status === 'paused') return 'PAUSED';
    return 'STANDBY';
  }, [
    isSpeaking,
    isSpeechPaused,
    isListening,
    isExecutingCommand,
    isThinking,
    mediaState.status,
  ]);

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
      let latestTranscript = '';
      let handledCapture = false;
      let captureErrorCode: string | null = null;
      const langDesc = JARVIS_LANGUAGES[language];

      voiceEngineRef.current?.startListening({
        bcp47Lang: langDesc.bcp47,
        onStart: () => {
          setIsListening(true);
        },
        onTranscript: (text, isFinal) => {
          latestTranscript = text;
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
          captureErrorCode = code ?? null;
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
          if (handledCapture) return;
          const captured = (
            finalCaptured.trim() ||
            (captureErrorCode !== 'not-allowed' && captureErrorCode !== 'service-not-allowed'
              ? latestTranscript.trim()
              : '')
          );
          if (!captured) return;
          handledCapture = true;
          if (opts.draftOnly) {
            setVoiceDraft(captured);
            return;
          }
          void executeUniversalCommandRef
            .current(captured, 'voice_hud', { allowAiActionFallback: true, isVoice: true })
            .then((outcome) => {
              if (outcome.handled) return;
              if (ultronVoiceHandlerRef.current) {
                ultronVoiceHandlerRef.current(captured);
                return;
              }
              if (opts.autoNavigateToChat && !handsFreeRef.current) {
                navigateTo('chat');
              }
              void sendPromptToGeminiRef.current(captured, true);
            });
        },
      });
    },
    [language, settings.continuousConversationMode, navigateTo]
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

  const activeHudThemePreset: HudThemePresetId =
    settings.hudThemePreset ||
    (settings.themeMode === 'light'
      ? 'light_hud'
      : settings.accentTheme === 'amber'
        ? 'stark_gold'
        : 'cosmic');

  const handleSelectHudThemePreset = (presetId: HudThemePresetId) => {
    const preset = HUD_THEME_PRESETS[presetId] || HUD_THEME_PRESETS.cosmic;
    setSettings((prev) => ({
      ...prev,
      hudThemePreset: preset.id,
      themeMode: preset.themeMode,
      accentTheme: preset.accentTheme,
    }));
  };

  const withSharedAiState = (node: React.ReactNode) => (
    <SharedAiStateProvider
      isListening={isListening}
      isThinking={isThinking || briefingLoading}
      isSpeaking={isSpeaking}
      isSpeechPaused={isSpeechPaused}
      audioLevel={audioLevel}
      reducedMotion={effectiveReducedMotion}
      hudThemePreset={activeHudThemePreset}
      themeMode={settings.themeMode || 'dark'}
      accentTheme={settings.accentTheme || 'cyan'}
    >
      {node}
    </SharedAiStateProvider>
  );

  // Root container carries reduced-motion & power-saving classes and data attributes
  if (activeScreen === 'opening') {
    const returningStartupMode =
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem('am_ai_boot_seen_v1') === '1' &&
      (settings.startupAnimationMode || 'full') === 'full'
        ? 'short'
        : settings.startupAnimationMode || 'full';

    return withSharedAiState(
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
        data-tab-hidden={isTabHidden ? 'true' : 'false'}
      >
        <OpeningScreen
          telemetry={telemetry}
          connectionState={connectionState}
          diagnostics={diagnosticsReport}
          diagnosticsLoading={diagnosticsLoading}
          startupAnimationMode={returningStartupMode}
          language={language}
          reducedMotion={effectiveReducedMotion}
          powerSaving={Boolean(settings.powerSaving)}
          localModelReady={localModelReady}
          onRefreshDiagnostics={() => void refreshDiagnostics()}
          onInitialize={(unlockAudio = true) => {
            try {
              window.sessionStorage.setItem('am_ai_boot_seen_v1', '1');
            } catch {
              // Ignore sessionStorage restrictions
            }
            if (unlockAudio) {
              unlockBrowserAudio();
            }
            navigateTo('chat');
            if (unlockAudio && (settings.welcomeGreetingEnabled ?? true) && !settings.voiceMuted) {
              hasAttemptedSessionWelcomeRef.current = true;
              playWelcomeSequence({ isAuto: false });
            } else if (settings.autoSpeakDailySummary && !settings.voiceMuted) {
              hasTriggeredStartupSummaryRef.current = true;
              speakDailySummary({ isStartupAuto: false });
            }
          }}
          onEnterVoiceMode={() => {
            unlockBrowserAudio();
            navigateTo('voice');
            startVoiceCapture(false);
          }}
        />
      </div>
    );
  }

  if (activeScreen === 'orbital_game') {
    return withSharedAiState(
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

  return withSharedAiState(
    <div
      data-reduced-motion={effectiveReducedMotion ? 'true' : 'false'}
      data-power-saving={settings.powerSaving ? 'true' : 'false'}
      data-theme={resolvedTheme}
      data-hud-theme={activeHudThemePreset}
      className={`jarvis-app-shell am-cosmic-bg min-h-screen hud-grid-bg text-slate-100 flex${
        effectiveReducedMotion ? ' reduced-motion' : ''
      }${settings.powerSaving ? ' power-saving' : ''}`}
    >
      {activeScreen === 'chat' ? (
        <div className="flex-1 w-full h-dvh overflow-hidden flex flex-col">
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
            backendHealth={backendHealth}
            liveBrainMeta={liveBrainMeta}
            webSearchEnabled={settings.webSearchEnabled}
            isTemporaryChat={isTemporaryChat || Boolean(activeSession?.isTemporary)}
            reasoningPreference={settings.reasoningPreference || 'auto'}
            brainCollaborationMode={settings.brainCollaborationMode || 'auto'}
            femaleVoiceEnabled={settings.femaleVoiceEnabled ?? true}
            activeEngine={activeEngine}
            routingMode={settings.routingMode || 'hybrid'}
            openSessionsSignal={openSessionsSignal}
            mediaState={mediaState}
            onSelectAgent={(id) => {
              setSelectedCustomAgentId(null);
              setSelectedAgent(id);
            }}
            onSelectCustomAgent={(id) => {
              setSelectedCustomAgentId(id);
            }}
            onCreateSession={() => createChatSession(false)}
            onSelectSession={(id) => {
              const target = sessions.find((s) => s.id === id);
              setIsTemporaryChat(Boolean(target?.isTemporary));
              selectChatSession(id);
            }}
            onToggleSaveSession={toggleSaveChatSession}
            onRenameSession={renameChatSession}
            onDeleteSession={deleteChatSession}
            onSummarizeSession={summarizeActiveSession}
            onToggleTemporaryChat={toggleTemporaryChatMode}
            onChangeReasoningPreference={(pref) =>
              setSettings((prev) => ({ ...prev, reasoningPreference: pref }))
            }
            onChangeBrainCollaborationMode={(mode) =>
              setSettings((prev) => ({ ...prev, brainCollaborationMode: mode }))
            }
            onOpenBrainCenter={() => navigateTo('brain_center', { navKey: 'multi_ai_brain' })}
            onNavigateScreen={(scr) => {
              setChatMediaStageRect(null);
              navigateTo(scr);
            }}
            onStartVoiceConversation={() => {
              setChatMediaStageRect(null);
              navigateTo('voice');
              startVoiceCapture(false);
            }}
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
            onPlayMediaTrack={(track, queue) => {
              if (mediaState.currentTrack?.videoId === track.videoId && mediaState.status !== 'idle') {
                mediaControllerRef.current?.play();
                return;
              }
              const items = (queue && queue.length > 0 ? queue : [track]).map(toYouTubeMediaItem);
              const idx = Math.max(0, items.findIndex((it) => it.videoId === track.videoId));
              void mediaControllerRef.current?.loadQueue(items, idx, {
                autoPlay: true,
                fallbackUrl: track.watchUrl,
              });
            }}
            onPauseMedia={() => mediaControllerRef.current?.pause()}
            onNextMedia={() => void mediaControllerRef.current?.next()}
            onPreviousMedia={() => void mediaControllerRef.current?.previous()}
            onToggleMediaMute={() => {
              if (mediaState.isMuted) mediaControllerRef.current?.unmute();
              else mediaControllerRef.current?.mute();
            }}
            onSetMediaVolume={(lvl) => mediaControllerRef.current?.setVolume(lvl)}
            onUpdateChatMediaStageRect={setChatMediaStageRect}
          />
        </div>
      ) : (
        <>
          <SidebarNav
            activeScreen={activeScreen}
            activeNavKey={activeNavKey}
            isOpenMobile={mobileMenuOpen}
            onSelect={(scr: ScreenId, action?: NavCommandAction, navKey?: string) => {
              navigateTo(scr, {
                navKey: navKey || (scr === 'dashboard' ? 'command_center' : scr),
                productivityFilter:
                  action && 'productivityFilter' in action ? action.productivityFilter : undefined,
                productivityTab:
                  action && 'productivityTab' in action ? action.productivityTab : undefined,
                mediaSection:
                  action && 'section' in action ? action.section : undefined,
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
              themeMode={settings.themeMode || 'dark'}
              hudThemePreset={activeHudThemePreset}
              resolvedTheme={resolvedTheme}
              tasks={tasks}
              memories={memories}
              sessions={sessions}
              securityLogs={securityLogs}
              activeEngine={activeEngine}
              localModelReady={localModelReady}
              pendingSyncCount={pendingSyncCount}
              classicMode={effectiveClassicMode}
              wakeWordLegacyJarvis={Boolean(settings.wakeWordLegacyJarvisAlias)}
              canInstallPwa={canInstallPwa}
              onInstallPwa={() => void triggerPwaInstallPrompt().then(() => setCanInstallPwa(false))}
              onToggleClassicMode={() => {
                if (classicUrlOverride && typeof window !== 'undefined') {
                  setClassicUrlOverride(false);
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('classic');
                    window.history.replaceState({}, '', url.toString());
                  } catch {
                    // ignore
                  }
                }
                setSettings((prev) => ({ ...prev, classicMode: !effectiveClassicMode }));
              }}
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
              onSelectHudThemePreset={handleSelectHudThemePreset}
              onToggleTheme={() =>
                setSettings((prev) => {
                  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
                  return {
                    ...prev,
                    themeMode: nextTheme,
                    hudThemePreset: nextTheme === 'light' ? 'light_hud' : 'cosmic',
                  };
                })
              }
              onRetryConnection={refreshHealth}
              onNavigate={(scr) => navigateTo(scr)}
              onSelectSession={(sid) => selectChatSession(sid)}
              onOpenMenu={() => setMobileMenuOpen(true)}
              mediaPlayingTitle={
                mediaState.isPlayerVisible && mediaState.currentTrack
                  ? mediaState.currentTrack.title
                  : null
              }
              isMediaPlaying={mediaState.status === 'playing'}
              isWakeWordActive={isWakeWordActive}
              reactorState={reactorState}
            />

            <main className="flex-1 p-3 sm:p-5 max-w-[1600px] w-full mx-auto">
          {activeScreen === 'dashboard' && (
            <DashboardView
              telemetry={telemetry}
              securityReport={securityReport}
              connectionState={connectionState}
              layoutMode={layoutMode}
              classicMode={effectiveClassicMode}
              centerCoreVisualMode={settings.centerCoreVisualMode || 'hologram_3d'}
              onChangeCenterCoreVisualMode={(mode) =>
                setSettings((prev) => ({ ...prev, centerCoreVisualMode: mode }))
              }
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
              spokenDailySummary={spokenDailySummary}
              startupSummaryStatus={startupSummaryStatus}
              startupSummaryDismissed={startupSummaryDismissed}
              autoSpeakDailySummary={Boolean(settings.autoSpeakDailySummary)}
              isSpeechPaused={isSpeechPaused}
              memories={memories}
              notes={notes}
              sessions={sessions}
              tasks={tasks}
              securityLogs={securityLogs}
              collaborationLogs={collaborationLogs}
              customAgents={customAgents}
              systemEvents={systemEvents}
              activeEngine={activeEngine}
              localModelReady={localModelReady}
              pendingSyncCount={pendingSyncCount}
              mediaPlayingTitle={
                mediaState.isPlayerVisible && mediaState.currentTrack
                  ? mediaState.currentTrack.title
                  : null
              }
              isMediaPlaying={mediaState.status === 'playing'}
              weatherCity={settings.weatherCity || ''}
              onUpdateWeatherCity={(city) =>
                setSettings((prev) => ({ ...prev, weatherCity: city }))
              }
              onToggleClassicMode={() => {
                setClassicUrlOverride(false);
                setSettings((prev) => ({ ...prev, classicMode: !effectiveClassicMode }));
              }}
              onRunProtocol={(protocol) => {
                if (protocol === 'STANDBY') {
                  setStandbyMode(true);
                  stopVoiceCapture();
                  stopSpeaking();
                  addSystemEvent('COMMAND', 'Standby Mode', 'Cosmic Standby hologram engaged.', 'info');
                } else if (protocol === 'DIAGNOSTICS') {
                  void refreshDiagnostics();
                  void refreshTelemetry();
                  addSystemEvent('COMMAND', 'Diagnostics Protocol', `Status: ${connectionState.toUpperCase()} • Engine: ${activeEngine}`, 'success');
                  speakText(`Diagnostics complete, Sir. Neural connection is ${connectionState}, active engine is ${activeEngine}.`);
                } else if (protocol === 'FOCUS') {
                  setDevices((prev) =>
                    prev.map((d) => ({ ...d, isOn: d.type !== 'APPLIANCE' || d.room === 'Study' }))
                  );
                  addSystemEvent('COMMAND', 'Focus Protocol', 'Workspace focus scene applied.', 'success');
                  speakText('Focus protocol activated, Sir.');
                } else if (protocol === 'MUSIC') {
                  addSystemEvent('COMMAND', 'Music Mode', 'Opened Media Control deck.', 'info');
                  if (mediaState.currentTrack) {
                    mediaControllerRef.current?.play();
                  } else {
                    navigateTo('media_control', { mediaSection: 'youtube' });
                  }
                } else if (protocol === 'GOOD_MORNING') {
                  void refreshDailyBriefing(true);
                  addSystemEvent('COMMAND', 'Good Morning Protocol', 'Morning executive briefing started.', 'success');
                  speakDailySummary({ isStartupAuto: false });
                }
              }}
              onSyncNow={() => {
                void handleSyncWorkspaceNow(true);
              }}
              onLockGate={() => {
                stopVoiceCapture();
                stopSpeaking();
                navigateTo('opening');
              }}
              onSubmitCommand={(rawText) => {
                void executeUniversalCommand(rawText, 'chat', { allowAiActionFallback: true }).then(
                  (outcome) => {
                    if (!outcome.handled) {
                      navigateTo('chat');
                      void sendPromptToGemini(rawText, false);
                    }
                  }
                );
              }}
              onMediaPlayPause={() => {
                if (mediaState.status === 'playing') mediaControllerRef.current?.pause();
                else mediaControllerRef.current?.play();
              }}
              onMediaNext={() => void mediaControllerRef.current?.next()}
              onMediaPrev={() => void mediaControllerRef.current?.previous()}
              onRefreshBriefing={() => void refreshDailyBriefing(true)}
              onSpeakBriefing={(txt) => speakDailySummary({ isStartupAuto: false, overrideText: txt })}
              onPauseBriefing={pauseSpeaking}
              onResumeBriefing={resumeSpeaking}
              onDismissStartupSummary={() => setStartupSummaryDismissed(true)}
              onToggleAutoSpeakDailySummary={() =>
                setSettings((prev) => ({
                  ...prev,
                  autoSpeakDailySummary: !prev.autoSpeakDailySummary,
                }))
              }
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
                    updatedAt: Date.now(),
                    syncStatus: 'pending_upsert',
                  },
                  ...prev,
                ])
              }
              onToggleTask={(id) =>
                setTasks((prev) =>
                  prev.map((t) =>
                    t.id === id
                      ? { ...t, isCompleted: !t.isCompleted, updatedAt: Date.now(), syncStatus: 'pending_upsert' }
                      : t
                  )
                )
              }
              onRunWorkflow={() => navigateTo('multi_agent', { navKey: 'workflows' })}
            />
          )}

          {activeScreen === 'brain_center' && (
            <Suspense fallback={<div className="p-8 font-mono-hud text-xs text-cyan-300">Loading Multi-AI Brain Control Center...</div>}>
              <MultiAiControlCenterView
                memories={memories}
                onRefreshMemoriesFromServer={async () => {
                  const srv = await fetchServerMemories();
                  if (srv.ok && srv.memories.length > 0) {
                    setBackendMemorySynced(true);
                    setMemories(srv.memories);
                  }
                }}
                onSpeakText={(txt) => speakText(txt)}
              />
            </Suspense>
          )}

          {activeScreen === 'openjarvis' && (
            <Suspense fallback={<div className="p-8 font-mono-hud text-xs text-cyan-300">Loading OpenJarvis Core Workspace...</div>}>
              <OpenJarvisWorkspaceView onSpeakText={(txt) => speakText(txt)} />
            </Suspense>
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
              speechRate={settings.speechRate}
              voiceVolume={settings.voiceVolume ?? 1.0}
              selectedVoiceUri={settings.selectedVoiceUri || ''}
              autoSpeakReplies={settings.autoSpeakReplies}
              femaleVoiceEnabled={settings.femaleVoiceEnabled ?? true}
              welcomeGreetingEnabled={settings.welcomeGreetingEnabled ?? true}
              autoDetectVoiceLanguage={settings.autoDetectVoiceLanguage ?? true}
              activeVoiceInfo={activeVoiceInfo}
              voiceStatusLabel={voiceStatusLabel}
              welcomeAutoplayBlocked={welcomeAutoplayBlocked}
              welcomeStepLabel={welcomeStepLabel}
              transcript={transcript}
              voiceError={voiceError}
              voicePermissionDenied={voicePermissionDenied}
              audioLevel={audioLevel}
              reducedMotion={effectiveReducedMotion}
              onEnableVoiceMode={() =>
                setSettings((prev) => ({ ...prev, voiceModeEnabled: true }))
              }
              onLanguageChange={(nextLang) => {
                setLanguage(nextLang);
                setSettings((prev) => ({ ...prev, voiceLanguagePreference: nextLang }));
              }}
              onSpeechRateChange={(rate) =>
                setSettings((prev) => ({ ...prev, speechRate: rate }))
              }
              onVoiceVolumeChange={(vol) =>
                setSettings((prev) => ({ ...prev, voiceVolume: vol }))
              }
              onVoiceUriChange={(uri) =>
                setSettings((prev) => ({ ...prev, selectedVoiceUri: uri }))
              }
              onToggleAutoSpeakReplies={() =>
                setSettings((prev) => ({ ...prev, autoSpeakReplies: !prev.autoSpeakReplies }))
              }
              onToggleFemaleVoice={() =>
                setSettings((prev) => ({
                  ...prev,
                  femaleVoiceEnabled: !(prev.femaleVoiceEnabled ?? true),
                }))
              }
              onToggleWelcomeGreeting={() =>
                setSettings((prev) => ({
                  ...prev,
                  welcomeGreetingEnabled: !(prev.welcomeGreetingEnabled ?? true),
                }))
              }
              onToggleAutoDetectVoiceLanguage={() =>
                setSettings((prev) => ({
                  ...prev,
                  autoDetectVoiceLanguage: !(prev.autoDetectVoiceLanguage ?? true),
                }))
              }
              onTestVoice={() => speakText(getVoiceTestSample(language))}
              onTestVoiceHindi={() => speakText(getVoiceTestSample('HINDI'))}
              onTestVoiceEnglish={() => speakText(getVoiceTestSample('ENGLISH'))}
              onReplayWelcome={() => playWelcomeSequence({ isAuto: false })}
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
                void executeUniversalCommand(cmd, 'voice_hud', { allowAiActionFallback: true }).then(
                  (outcome) => {
                    if (outcome.handled) return;
                    navigateTo('chat');
                    void sendPromptToGemini(cmd, true);
                  }
                );
              }}
              reactorState={reactorState}
              isExecutingCommand={isExecutingCommand}
              isWakeWordActive={isWakeWordActive}
              isMediaPlaying={mediaState.status === 'playing'}
              isMediaPaused={mediaState.status === 'paused'}
              currentMediaTitle={
                mediaState.isPlayerVisible && mediaState.currentTrack
                  ? mediaState.currentTrack.title
                  : null
              }
              onToggleWakeWord={toggleWakeWord}
              onOpenMediaControl={() => navigateTo('media_control', { navKey: 'media_control' })}
            />
          )}

          {activeScreen === 'media_control' && (
            <MediaControlView
              mediaState={mediaState}
              mediaMemory={mediaMemory}
              activityLog={commandActivityLog}
              reactorState={reactorState}
              youtubeConfigured={backendHealth?.youtubeConfigured}
              ytSearchResults={ytSearchResults}
              isSearchingYouTube={isSearchingYouTube}
              isListening={isListening}
              isExecutingCommand={isExecutingCommand}
              isWakeWordActive={isWakeWordActive}
              audioDuckingEnabled={settings.audioDuckingEnabled !== false}
              reducedMotion={effectiveReducedMotion}
              initialSection={mediaSection}
              isOnline={telemetry.online}
              onExecuteCommand={(rawCmd) => {
                void executeUniversalCommand(rawCmd, 'media_ui', { allowAiActionFallback: true }).then(
                  (outcome) => {
                    if (!outcome.handled) {
                      setCommandActivityLog((prev) =>
                        [
                          {
                            id: `cmd_${Date.now()}_unmatched`,
                            timestamp: Date.now(),
                            source: 'media_ui' as const,
                            rawCommand: rawCmd,
                            normalizedCommand: rawCmd,
                            intent: 'UNKNOWN_COMMAND' as const,
                            status: 'clarification' as const,
                            summary:
                              'Command did not match a website or media action. Try "Search <topic>", "Open <site>", "Play <song/video>", or ask in Neural Chat.',
                          },
                          ...prev,
                        ].slice(0, 50)
                      );
                    }
                  }
                );
              }}
              onSearchYouTube={(q, mode, pageToken) => void handleYouTubeSearch(q, mode, pageToken)}
              onPlaySearchResult={handlePlaySearchResult}
              onClearSearchHistory={handleClearSearchHistory}
              onStartVoiceCapture={() => startVoiceCapture({ autoNavigateToChat: false })}
              onStopVoiceCapture={stopVoiceCapture}
              onToggleWakeWord={toggleWakeWord}
              onToggleAudioDucking={toggleAudioDucking}
              onPlay={() => mediaControllerRef.current?.play()}
              onPause={() => mediaControllerRef.current?.pause()}
              onNext={() => void mediaControllerRef.current?.next()}
              onPrevious={() => void mediaControllerRef.current?.previous()}
              onStop={() => mediaControllerRef.current?.stop()}
              onClosePlayer={() => mediaControllerRef.current?.closePlayer()}
              onSeekTo={(sec) => mediaControllerRef.current?.seekTo(sec)}
              onSeekBy={(delta) => mediaControllerRef.current?.seekBy(delta)}
              onSetVolume={(lvl) => mediaControllerRef.current?.setVolume(lvl)}
              onAdjustVolume={(delta) => mediaControllerRef.current?.adjustVolume(delta)}
              onToggleMute={() => {
                if (mediaState.isMuted) mediaControllerRef.current?.unmute();
                else mediaControllerRef.current?.mute();
              }}
              onCycleRepeat={() => mediaControllerRef.current?.setRepeatMode()}
              onToggleFullscreen={handleToggleFullscreen}
              onSelectQueueIndex={(idx) => void mediaControllerRef.current?.playTrackAtIndex(idx)}
              onClearActivityLog={() => setCommandActivityLog([])}
              onStageRectChange={setMediaStageRect}
              onSetPlaybackRate={(rate) => mediaControllerRef.current?.setPlaybackRate(rate)}
              onUpdateMemory={(mem) => setMediaMemory(mem)}
            />
          )}

          {activeScreen === 'research' && (
            <Suspense fallback={<div className="p-8 font-mono-hud text-xs text-cyan-300">Loading Research Studio...</div>}>
              <ResearchStudioView
                language={language}
                connectionState={connectionState}
                tavilyConfigured={Boolean(backendHealth?.tavilyConfigured)}
                uploadedDocuments={uploadedDocuments}
                onAddDocument={(doc) => setUploadedDocuments((prev) => [doc, ...prev])}
                onRemoveDocument={(id) =>
                  setUploadedDocuments((prev) => prev.filter((d) => d.id !== id))
                }
                onDiscussDocumentInChat={(doc) => {
                  navigateTo('chat');
                  const attachment: PendingChatAttachment = {
                    name: doc.fileName,
                    mimeType: doc.mimeType,
                    sizeBytes: doc.sizeBytes,
                    textContent: doc.extractedText,
                    base64Data: doc.base64Data,
                    useAsTextContext: Boolean(doc.extractedText && doc.kind !== 'pdf'),
                  };
                  void sendPromptToGemini(
                    `Let's discuss "${doc.fileName}". Summarize its key points and wait for my follow-up questions.`,
                    false,
                    'VERONICA_RESEARCH',
                    attachment
                  );
                }}
              />
            </Suspense>
          )}

          {activeScreen === 'automation' && (
            <AutomationView
              history={automations}
              quickActions={settings.quickActions || []}
              onRecordAutomation={(item) => {
                setAutomations((prev) => [item, ...prev.slice(0, 199)]);
                void recordAutomationOnServer(item);
              }}
              onUpdateQuickActions={(next) =>
                setSettings((prev) => ({ ...prev, quickActions: next }))
              }
              onQuickCreateNote={(title, content) => {
                const now = Date.now();
                const created: NoteItem = {
                  id: `note_${now}_${Math.random().toString(36).slice(2, 6)}`,
                  title,
                  content,
                  tags: ['automation'],
                  pinned: false,
                  createdAt: now,
                  updatedAt: now,
                };
                setNotes((prev) => [created, ...prev]);
                void upsertNoteOnServer(created);
              }}
              onQuickCreateReminder={handleCreateSmartReminder}
              onDispatchPrompt={(prompt) => {
                navigateTo('chat');
                void sendPromptToGemini(prompt, false);
              }}
              onNavigate={(scr) => navigateTo(scr)}
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
              memoryEnabled={settings.memoryEnabled ?? true}
              userNamespace={settings.userNamespace || 'default'}
              onToggleMemoryEnabled={() =>
                setSettings((prev) => ({
                  ...prev,
                  memoryEnabled: !(prev.memoryEnabled ?? true),
                }))
              }
              onSyncNow={async () => {
                await handleSyncWorkspaceNow();
              }}
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
              notes={notes}
              initialFilter={productivityFilter}
              initialTab={productivityTab}
              onAddTask={(task) => {
                const now = Date.now();
                const shouldSync = Boolean(telemetry.online && settings.crossDeviceSyncOptIn);
                const created: TaskItem = {
                  ...task,
                  id: `task_${now}`,
                  isCompleted: false,
                  createdAt: now,
                  updatedAt: now,
                  syncStatus: shouldSync ? 'synced' : 'pending_upsert',
                };
                setTasks((prev) => [created, ...prev]);
                if (shouldSync) void upsertTaskOnServer(created);
              }}
              onCreateSmartReminder={handleCreateSmartReminder}
              onSnoozeTask={handleSnoozeTask}
              onToggleTask={(id) =>
                setTasks((prev) =>
                  prev.map((t) => {
                    if (t.id !== id) return t;
                    const shouldSync = Boolean(telemetry.online && settings.crossDeviceSyncOptIn);
                    const updated: TaskItem = {
                      ...t,
                      isCompleted: !t.isCompleted,
                      updatedAt: Date.now(),
                      syncStatus: shouldSync ? 'synced' : 'pending_upsert',
                    };
                    if (shouldSync) void upsertTaskOnServer(updated);
                    return updated;
                  })
                )
              }
              onDeleteTask={(id) => {
                setTasks((prev) => prev.filter((t) => t.id !== id));
                if (telemetry.online && settings.crossDeviceSyncOptIn) void deleteTaskOnServer(id);
              }}
              onAddNote={(note) => {
                const now = Date.now();
                const shouldSync = Boolean(telemetry.online && settings.crossDeviceSyncOptIn);
                const created: NoteItem = {
                  ...note,
                  id: `note_${now}_${Math.random().toString(36).slice(2, 6)}`,
                  createdAt: now,
                  updatedAt: now,
                  syncStatus: shouldSync ? 'synced' : 'pending_upsert',
                };
                setNotes((prev) => [created, ...prev]);
                if (shouldSync) void upsertNoteOnServer(created);
              }}
              onTogglePinNote={(id) =>
                setNotes((prev) =>
                  prev.map((n) => {
                    if (n.id !== id) return n;
                    const shouldSync = Boolean(telemetry.online && settings.crossDeviceSyncOptIn);
                    const updated: NoteItem = {
                      ...n,
                      pinned: !n.pinned,
                      updatedAt: Date.now(),
                      syncStatus: shouldSync ? 'synced' : 'pending_upsert',
                    };
                    if (shouldSync) void upsertNoteOnServer(updated);
                    return updated;
                  })
                )
              }
              onDeleteNote={(id) => {
                setNotes((prev) => prev.filter((n) => n.id !== id));
                if (telemetry.online && settings.crossDeviceSyncOptIn) void deleteNoteOnServer(id);
              }}
              onFetchSmartSuggestions={() =>
                fetchSmartTaskSuggestions({
                  tasks,
                  memories: (settings.memoryEnabled ?? true) ? memories : [],
                  language,
                })
              }
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

          {activeScreen === 'vision' && (
            <Suspense fallback={<div className="p-8 font-mono-hud text-xs text-cyan-300">Loading Vision Scanner...</div>}>
              <VisionScannerView connectionState={connectionState} />
            </Suspense>
          )}

          {activeScreen === 'music_studio' && (
            <Suspense fallback={<div className="p-8 font-mono-hud text-xs text-cyan-300">Loading Lyria Music Studio...</div>}>
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
            </Suspense>
          )}

          {activeScreen === 'ultron' && (
            <Suspense fallback={<div className="p-8 font-mono-hud text-xs text-cyan-300">Initializing ULTRON 3D Hologram...</div>}>
              <UltronAssistantView
                connectionState={connectionState}
                telemetry={telemetry}
                language={language}
                memories={memories}
                isListening={isListening}
                isSpeaking={isSpeaking}
                isVoiceMuted={settings.voiceMuted}
                isWakeWordActive={isWakeWordActive}
                isHandsFreeMode={isHandsFreeMode}
                audioLevel={audioLevel}
                transcript={transcript}
                voiceError={voiceError}
                reducedMotion={effectiveReducedMotion}
                visualMode={ultronVisualMode}
                shapeForm={ultronShapeForm}
                lastCommandNotice={ultronCommandNotice}
                activeModelLabel={
                  backendHealth?.activeModel
                    ? `${backendHealth.activeProviderLabel || 'Gemini'} • ${backendHealth.activeModel}`
                    : undefined
                }
                onVisualModeChange={(m) => {
                  setUltronVisualMode(m);
                  setUltronCommandNotice(`${m.toUpperCase()} MODE`);
                }}
                onShapeFormChange={(s) => {
                  setUltronShapeForm(s);
                  setUltronCommandNotice(`SHAPE → ${ULTRON_SHAPE_LABELS[s].toUpperCase()}`);
                }}
                onCycleShape={() =>
                  setUltronShapeForm((prev) => {
                    const next = getNextUltronShape(prev);
                    setUltronCommandNotice(`SHAPE → ${ULTRON_SHAPE_LABELS[next].toUpperCase()}`);
                    return next;
                  })
                }
                onLanguageChange={(nextLang) => {
                  setLanguage(nextLang);
                  setSettings((prev) => ({ ...prev, voiceLanguagePreference: nextLang }));
                }}
                onStartListening={() => startVoiceCapture({ autoNavigateToChat: false })}
                onStopListening={stopVoiceCapture}
                onToggleContinuousMode={() =>
                  isHandsFreeMode ? exitHandsFreeMode() : startHandsFreeMode()
                }
                onToggleWakeWord={toggleWakeWord}
                onToggleMute={() =>
                  setSettings((prev) => {
                    const nextMuted = !prev.voiceMuted;
                    if (nextMuted) stopSpeaking();
                    return { ...prev, voiceMuted: nextMuted };
                  })
                }
                onSpeakText={(txt) => speakText(txt)}
                onStopSpeaking={stopSpeaking}
                onResetToNormal={() => {
                  setUltronVisualMode('normal');
                  setUltronShapeForm('sphere');
                  setUltronCommandNotice('NORMAL HOLOGRAM MODE');
                }}
                onExitUltron={() => navigateTo('dashboard')}
                onRegisterVoiceSubmit={(fn) => {
                  ultronVoiceHandlerRef.current = fn;
                }}
              />
            </Suspense>
          )}

          {activeScreen === 'settings' && (
            <SettingsView
              settings={settings}
              language={language}
              memoriesCount={memories.length}
              sessionsCount={sessions.length}
              tasksCount={tasks.length}
              notesCount={notes.length}
              connectionState={connectionState}
              backendHealth={backendHealth}
              onUpdateSettings={(next) => {
                if (next.defaultAgent !== settings.defaultAgent) {
                  setSelectedAgent(next.defaultAgent);
                }
                setSettings(next);
              }}
              onSelectHudThemePreset={handleSelectHudThemePreset}
              onLanguageChange={(nextLang) => {
                setLanguage(nextLang);
                setSettings((prev) => ({ ...prev, voiceLanguagePreference: nextLang }));
              }}
              onTestVoice={(targetLang) => speakText(getVoiceTestSample(targetLang || language))}
              onReplayWelcome={() => playWelcomeSequence({ isAuto: false })}
              isSpeaking={isSpeaking}
              onStopSpeaking={stopSpeaking}
              activeVoiceInfo={activeVoiceInfo}
              voiceStatusLabel={voiceStatusLabel}
              onRetryConnection={refreshHealth}
              onSyncWorkspaceNow={() => handleSyncWorkspaceNow(true)}
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
              pendingSyncCount={pendingSyncCount}
              syncConflictCount={syncConflicts.length}
              onOpenSyncConflicts={() => setSyncModalDismissed(false)}
              onSystemEvent={(cat, t, d, sev) => addSystemEvent(cat, t, d, sev)}
            />
          )}
        </main>
      </div>
        </>
      )}

      {/* Live Bilingual Subtitles + Standby Hologram Overlay */}
      <LiveSubtitlesHud
        isListening={isListening}
        isSpeaking={isSpeaking}
        isThinking={isThinking}
        transcript={transcript}
        lastAssistantReply={lastAssistantReply}
        activeEngine={activeEngine}
        conversationWindowActive={conversationWindowActive}
        standbyMode={standbyMode}
        reducedMotion={effectiveReducedMotion}
        powerSaving={Boolean(settings.powerSaving)}
        onExitStandby={() => setStandbyMode(false)}
        onStopSpeaking={stopSpeaking}
        onStopListening={stopVoiceCapture}
      />

      {/* Offline Cross-Device Sync Conflict Choice Modal */}
      {!syncModalDismissed && (
        <SyncConflictModal
          conflicts={syncConflicts}
          onResolve={handleResolveSyncConflict}
          onDismiss={() => setSyncModalDismissed(true)}
        />
      )}

      {/* Validated JSON Backup Import Preview Modal */}
      <BackupImportModal
        preview={importPreviewState?.preview ?? null}
        filename={importPreviewState?.filename}
        onConfirm={handleConfirmBackupImport}
        onClose={() => setImportPreviewState(null)}
      />

      {/* Non-blocking AM AI Welcome Autoplay Fallback Pill */}
      {welcomeAutoplayBlocked &&
        activeScreen !== 'voice' &&
        (settings.welcomeGreetingEnabled ?? true) &&
        !settings.voiceMuted && (
          <div
            role="status"
            aria-live="polite"
            data-testid="global-welcome-autoplay-toast"
            className="fixed bottom-4 right-4 z-50 max-w-sm glass-panel-glow rounded-2xl px-4 py-3 border border-fuchsia-400/55 shadow-2xl flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-mono-hud text-[11px] font-bold text-fuchsia-200">
                AM AI FEMALE VOICE READY
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                Browser paused autoplay. Tap anywhere or click Play for the 2-step welcome greeting.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setWelcomeAutoplayBlocked(false);
                playWelcomeSequence({ isAuto: false });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-fuchsia-400 hover:bg-fuchsia-300 text-[#02040A] font-mono-hud text-[10px] font-bold cursor-pointer shrink-0"
            >
              PLAY
            </button>
            <button
              type="button"
              onClick={() => setWelcomeAutoplayBlocked(false)}
              aria-label="Dismiss welcome autoplay notice"
              className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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

      {/* Persistent Non-Reparented YouTube IFrame Host (uninterrupted audio across all JARVIS screens) */}
      {(() => {
        const activeStageRect =
          activeScreen === 'media_control'
            ? mediaStageRect
            : activeScreen === 'chat'
              ? chatMediaStageRect
              : null;
        const canOverlayStage =
          Boolean(activeStageRect) &&
          !mobileMenuOpen &&
          pinModalAction === null &&
          mediaState.isPlayerVisible &&
          Boolean(mediaState.currentTrack) &&
          mediaState.status !== 'embed_blocked' &&
          mediaState.status !== 'error' &&
          mediaState.status !== 'idle';

        return (
          <div
            ref={attachYtHostRef}
            data-testid="persistent-youtube-host"
            style={
              canOverlayStage && activeStageRect
                ? {
                    position: 'fixed',
                    top: `${activeStageRect.top}px`,
                    left: `${activeStageRect.left}px`,
                    width: `${activeStageRect.width}px`,
                    height: `${activeStageRect.height}px`,
                    zIndex: activeScreen === 'chat' ? 60 : 25,
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                  }
                : {
                    position: 'fixed',
                    bottom: 0,
                    right: 0,
                    width: '1px',
                    height: '1px',
                    opacity: 0.001,
                    pointerEvents: 'none',
                    overflow: 'hidden',
                    zIndex: -1,
                  }
            }
          />
        );
      })()}

      {/* Persistent Floating Mini-Player Dock across all non-Media views */}
      {activeScreen !== 'media_control' && !(activeScreen === 'chat' && chatMediaStageRect !== null) && (
        <MediaMiniPlayer
          mediaState={mediaState}
          reducedMotion={effectiveReducedMotion}
          bottomOffsetClass={activeScreen === 'chat' ? 'bottom-36' : 'bottom-4'}
          onPlay={() => mediaControllerRef.current?.play()}
          onPause={() => mediaControllerRef.current?.pause()}
          onNext={() => void mediaControllerRef.current?.next()}
          onPrevious={() => void mediaControllerRef.current?.previous()}
          onToggleMute={() => {
            if (mediaState.isMuted) mediaControllerRef.current?.unmute();
            else mediaControllerRef.current?.mute();
          }}
          onVolumeChange={(lvl) => mediaControllerRef.current?.setVolume(lvl)}
          onExpandToMediaView={() => navigateTo('media_control', { navKey: 'media_control' })}
          onClosePlayer={() => mediaControllerRef.current?.closePlayer()}
        />
      )}
    </div>
  );
};

export default App;

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Battery,
  BatteryCharging,
  Bot,
  Brain,
  Calendar,
  CheckCircle2,
  Cloud,
  CloudSun,
  Code2,
  Compass,
  Cpu,
  Database,
  FileText,
  Gamepad2,
  Globe,
  HardDrive,
  Home,
  LayoutDashboard,
  ListTodo,
  Lock,
  MessageSquare,
  Mic,
  Moon,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Square,
  StickyNote,
  Terminal,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
  Youtube,
  Zap,
} from 'lucide-react';
import {
  buildSecurityHudSummary,
  isWeatherSummaryAvailable,
} from '../services/dailySummary';
import { AMReactor, AMReactorState, AMReactorSubsystemArc } from '../components/AMReactor';
import { CommandCenterBottomBar } from '../components/CommandCenterBottomBar';
import {
  LiveIntelligenceFeedPanel,
  LlmStatusPanel,
  MemoryInsightsPanel,
  MissionTimelinePanel,
  SystemMonitorPanel,
} from '../components/CommandCenterPanels';
import { DashboardLayoutMode } from '../components/HeaderHud';
import { QuantumCoreCanvas } from '../components/QuantumCoreCanvas';
import {
  ActiveEngineAttribution,
  AgentCollaborationLog,
  AgentId,
  BrowserTelemetry,
  ChatSession,
  ConnectionState,
  CustomAgent,
  DailyBriefingData,
  MemoryItem,
  NoteItem,
  ScreenId,
  SecurityLogItem,
  SecurityReport,
  StartupSummaryStatus,
  SystemEventEntry,
  TaskItem,
} from '../types/jarvis';

export type SignatureProtocolId =
  | 'GOOD_MORNING'
  | 'FOCUS'
  | 'MUSIC'
  | 'DIAGNOSTICS'
  | 'STANDBY';

interface DashboardViewProps {
  telemetry: BrowserTelemetry;
  securityReport: SecurityReport;
  connectionState: ConnectionState;
  layoutMode: DashboardLayoutMode;
  classicMode?: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  audioLevel: number;
  transcript: string;
  voiceError: string | null;
  speechRecognitionSupported: boolean;
  reducedMotion: boolean;
  powerSaving: boolean;
  telemetryIntervalMs: number;
  dailyBriefing: DailyBriefingData | null;
  briefingLoading: boolean;
  spokenDailySummary: string;
  startupSummaryStatus: StartupSummaryStatus;
  startupSummaryDismissed: boolean;
  autoSpeakDailySummary: boolean;
  isSpeechPaused: boolean;
  memories: MemoryItem[];
  notes?: NoteItem[];
  sessions: ChatSession[];
  tasks: TaskItem[];
  securityLogs: SecurityLogItem[];
  collaborationLogs: AgentCollaborationLog[];
  customAgents: CustomAgent[];
  systemEvents?: SystemEventEntry[];
  activeEngine?: ActiveEngineAttribution;
  localModelReady?: boolean;
  pendingSyncCount?: number;
  mediaPlayingTitle?: string | null;
  isMediaPlaying?: boolean;
  weatherCity?: string;
  onUpdateWeatherCity?: (city: string) => void;
  onTogglePowerSaving: () => void;
  onToggleClassicMode?: () => void;
  onRunProtocol?: (protocol: SignatureProtocolId) => void;
  onSyncNow?: () => void;
  onLockGate?: () => void;
  onSubmitCommand?: (rawText: string) => void;
  onMediaPlayPause?: () => void;
  onMediaNext?: () => void;
  onMediaPrev?: () => void;
  onRefreshBriefing: () => void;
  onSpeakBriefing: (text?: string) => void;
  onPauseBriefing: () => void;
  onResumeBriefing: () => void;
  onDismissStartupSummary: () => void;
  onToggleAutoSpeakDailySummary: () => void;
  onTalkToJarvis: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onNavigate: (
    screen: ScreenId,
    options?: {
      productivityFilter?: 'ALL' | 'PENDING';
      productivityTab?: 'tasks' | 'notes';
      mediaSection?: 'youtube' | 'browser';
      openSessionsDrawer?: boolean;
    }
  ) => void;
  onSelectAgentAndChat: (agentId: AgentId, enableWebSearch?: boolean) => void;
  onAddQuickTask: (title: string, priority: TaskItem['priority']) => void;
  onToggleTask: (id: string) => void;
  onRunWorkflow: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  telemetry,
  securityReport,
  connectionState,
  layoutMode,
  classicMode = false,
  isListening,
  isSpeaking,
  isThinking,
  audioLevel,
  transcript,
  voiceError,
  speechRecognitionSupported,
  reducedMotion,
  powerSaving,
  dailyBriefing,
  briefingLoading,
  spokenDailySummary,
  startupSummaryStatus,
  startupSummaryDismissed,
  autoSpeakDailySummary,
  isSpeechPaused,
  memories,
  notes = [],
  sessions,
  tasks,
  securityLogs,
  collaborationLogs,
  customAgents,
  systemEvents = [],
  activeEngine = 'Cloud AI',
  localModelReady = false,
  pendingSyncCount = 0,
  mediaPlayingTitle = null,
  isMediaPlaying = false,
  weatherCity = 'Local Sector',
  onUpdateWeatherCity,
  onToggleClassicMode,
  onRunProtocol,
  onSyncNow,
  onLockGate,
  onSubmitCommand,
  onMediaPlayPause,
  onMediaNext,
  onMediaPrev,
  onRefreshBriefing,
  onSpeakBriefing,
  onPauseBriefing,
  onResumeBriefing,
  onDismissStartupSummary,
  onToggleAutoSpeakDailySummary,
  onTalkToJarvis,
  onStopListening,
  onStopSpeaking,
  onNavigate,
  onSelectAgentAndChat,
  onAddQuickTask,
  onToggleTask,
  onRunWorkflow,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<TaskItem['priority']>('HIGH');
  const [editingCity, setEditingCity] = useState(false);
  const [cityDraft, setCityDraft] = useState(weatherCity);
  const [showEventDrawer, setShowEventDrawer] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setCityDraft(weatherCity);
  }, [weatherCity]);

  const toolCallCount = securityLogs.filter((l) => l.eventType === 'TOOL_EXEC').length;
  const pendingTasks = tasks.filter((t) => !t.isCompleted);
  const highPriorityPending = pendingTasks.filter((t) => t.priority === 'HIGH').length;
  const hasWeatherUpdate = isWeatherSummaryAvailable(dailyBriefing?.weatherSummary);
  const securityHudSummary = buildSecurityHudSummary(securityReport);

  const speakableBriefing =
    spokenDailySummary ||
    (dailyBriefing
      ? `${dailyBriefing.greeting} Tasks: ${dailyBriefing.tasksSummary}. ${dailyBriefing.aiLine}`
      : 'AM AI Command Matrix nominal, Sir.');

  const reactorState: AMReactorState = useMemo(() => {
    if (isSpeaking && !isSpeechPaused) return 'SPEAKING';
    if (isListening) return 'LISTENING';
    if (isThinking) return 'THINKING';
    if (!telemetry.online || connectionState === 'offline') return 'OFFLINE';
    if (connectionState === 'key_missing' || securityReport.defconLevel === 1) return 'ERROR';
    return 'IDLE';
  }, [
    isSpeaking,
    isSpeechPaused,
    isListening,
    isThinking,
    telemetry.online,
    connectionState,
    securityReport.defconLevel,
  ]);

  const subsystemArcs: AMReactorSubsystemArc[] = useMemo(
    () => [
      { id: 'core', label: 'CORE', status: 'online' },
      {
        id: 'ai',
        label: 'AI',
        status:
          connectionState === 'online' || localModelReady
            ? 'online'
            : connectionState === 'key_missing'
              ? 'degraded'
              : 'offline',
      },
      {
        id: 'voice',
        label: 'VOICE',
        status: speechRecognitionSupported ? 'online' : 'degraded',
      },
      { id: 'memory', label: 'MEMORY', status: 'online' },
      {
        id: 'media',
        label: 'MEDIA',
        status: telemetry.online ? 'online' : 'offline',
      },
    ],
    [connectionState, localModelReady, speechRecognitionSupported, telemetry.online]
  );

  // Real Clock & Calendar tokens matching the reference image
  const hours24 = now.getHours();
  const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const dayNum = String(now.getDate());
  const monthFull = now.toLocaleDateString([], { month: 'long' }).toUpperCase();
  const weekdayFull = now.toLocaleDateString([], { weekday: 'long' }).toUpperCase();
  const headerDateLabel = now.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    weekday: 'long',
  });
  const shortReactorDate = now
    .toLocaleDateString([], { day: '2-digit', month: 'short' })
    .toUpperCase();

  // Analog dial angles
  const secDeg = now.getSeconds() * 6;
  const minDeg = now.getMinutes() * 6 + now.getSeconds() * 0.1;
  const hrDeg = ((now.getHours() % 12) + now.getMinutes() / 60) * 30;

  // Real RAM & Storage metrics (honest null when browser blocks)
  const heapPercent =
    telemetry.heapUsedMb !== null && telemetry.heapLimitMb && telemetry.heapLimitMb > 0
      ? Math.min(100, Math.round((telemetry.heapUsedMb / telemetry.heapLimitMb) * 100))
      : null;

  const storagePercent =
    telemetry.storageUsedMb != null &&
    telemetry.storageQuotaMb != null &&
    telemetry.storageQuotaMb > 0
      ? Math.min(100, Math.round((telemetry.storageUsedMb / telemetry.storageQuotaMb) * 100))
      : null;

  const readinessScore = Math.max(0, Math.min(100, securityReport.score));
  const needleAngleDeg = -120 + (readinessScore / 100) * 240;

  const handleReactorSectorClick = (sectorId: string) => {
    switch (sectorId) {
      case 'chat':
        onNavigate('chat');
        break;
      case 'voice':
        onNavigate('voice');
        break;
      case 'research':
        onNavigate('research');
        break;
      case 'tasks':
        onNavigate('productivity', { productivityTab: 'tasks', productivityFilter: 'PENDING' });
        break;
      case 'notes':
        onNavigate('productivity', { productivityTab: 'notes', productivityFilter: 'ALL' });
        break;
      case 'youtube':
        onNavigate('media_control', { mediaSection: 'youtube' });
        break;
      case 'browser':
        onNavigate('media_control', { mediaSection: 'browser' });
        break;
      case 'memory':
        onNavigate('memory');
        break;
      case 'settings':
        onNavigate('settings');
        break;
      case 'standby':
        onRunProtocol?.('STANDBY');
        break;
      case 'diagnostics':
        onRunProtocol?.('DIAGNOSTICS');
        break;
      case 'classic':
        onToggleClassicMode?.();
        break;
    }
  };

  const handleSubmitQuickTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    onAddQuickTask(quickTaskTitle.trim(), quickTaskPriority);
    setQuickTaskTitle('');
    setShowQuickTaskModal(false);
  };

  // =========================================================================
  // REFERENCE-MATCHED COSMIC INTELLIGENCE HOLOGRAPHIC COCKPIT (DEFAULT)
  // =========================================================================
  if (!classicMode) {
    const leftSkewTabs: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      onClick: () => void;
    }> = [
      { id: 'chat', label: 'AI Chat', icon: MessageSquare, onClick: () => onNavigate('chat') },
      { id: 'voice', label: 'Voice', icon: Mic, onClick: () => onNavigate('voice') },
      {
        id: 'youtube',
        label: 'YouTube',
        icon: Youtube,
        onClick: () => onNavigate('media_control', { mediaSection: 'youtube' }),
      },
      {
        id: 'browser',
        label: 'Browser',
        icon: Globe,
        onClick: () => onNavigate('media_control', { mediaSection: 'browser' }),
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: ListTodo,
        onClick: () =>
          onNavigate('productivity', { productivityTab: 'tasks', productivityFilter: 'PENDING' }),
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: StickyNote,
        onClick: () =>
          onNavigate('productivity', { productivityTab: 'notes', productivityFilter: 'ALL' }),
      },
    ];

    const topDockModules: Array<{
      id: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      onClick: () => void;
    }> = [
      { id: 'home', label: 'Home', icon: LayoutDashboard, onClick: () => onNavigate('dashboard') },
      { id: 'chat', label: 'AI Chat', icon: MessageSquare, onClick: () => onNavigate('chat') },
      { id: 'voice', label: 'Voice', icon: Mic, onClick: () => onNavigate('voice') },
      {
        id: 'yt',
        label: 'YouTube',
        icon: Youtube,
        onClick: () => onNavigate('media_control', { mediaSection: 'youtube' }),
      },
      {
        id: 'web',
        label: 'Browser',
        icon: Globe,
        onClick: () => onNavigate('media_control', { mediaSection: 'browser' }),
      },
      { id: 'mem', label: 'Memory Vault', icon: Database, onClick: () => onNavigate('memory') },
      { id: 'brain', label: 'Multi-AI Brain', icon: Brain, onClick: () => onNavigate('brain_center') },
      {
        id: 'tasks',
        label: 'Tasks & Notes',
        icon: ListTodo,
        onClick: () => onNavigate('productivity'),
      },
      { id: 'cfg', label: 'Settings', icon: Settings, onClick: () => onNavigate('settings') },
    ];

    const flankingMetrics = [
      { label: 'ENGINE', value: activeEngine.replace(' Engine', ''), tone: 'text-[#00E5FF]' },
      {
        label: 'HEAP',
        value: heapPercent !== null ? `${heapPercent}%` : 'N/A',
        tone: 'text-cyan-200',
      },
      { label: 'VAULT', value: `${memories.length} MEM`, tone: 'text-emerald-300' },
      { label: 'TASKS', value: `${pendingTasks.length} DUE`, tone: 'text-amber-300' },
      {
        label: 'LOCAL AI',
        value: localModelReady ? 'READY' : 'NONE',
        tone: localModelReady ? 'text-emerald-300' : 'text-slate-400',
      },
      {
        label: 'SYNC',
        value: pendingSyncCount > 0 ? `${pendingSyncCount} QUEUED` : 'CLEAN',
        tone: pendingSyncCount > 0 ? 'text-amber-300' : 'text-cyan-300',
      },
    ];

    return (
      <div
        data-testid="am-cosmic-reference-hud"
        className="space-y-3 pb-16 lg:pb-2 text-slate-100"
      >
        {/* TOP COCKPIT STRIP: Left AM AI OS Card | Center Subsystem Icon Dock | Right System Strip */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 items-stretch">
          {/* Top-Left AM AI OS Identity Block */}
          <div className="xl:col-span-3 am-hud-frame rounded-xl px-3 py-2 flex items-center gap-3">
            <AMReactor size="xs" state={reactorState} reducedMotion={reducedMotion} interactive={false} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-xs font-black tracking-[0.18em] text-[#00E5FF] truncate">
                  AM AI OS
                </p>
                <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-[#00E5FF]/15 border border-[#00E5FF]/40 text-cyan-200 shrink-0">
                  VER 2.1
                </span>
              </div>
              <p className="font-mono-hud text-[9px] text-slate-400 tracking-wider uppercase truncate mt-0.5">
                COSMIC INTELLIGENCE • {activeEngine.toUpperCase()}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`inline-flex items-center gap-1 font-mono-hud text-[9px] px-1.5 py-0.5 rounded border ${
                    telemetry.online
                      ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-400/45 text-rose-300'
                  }`}
                >
                  {telemetry.online ? 'ONLINE' : 'OFFLINE'}
                </span>
                <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-[#071326] border border-cyan-500/30 text-cyan-200 truncate">
                  {localModelReady ? 'LOCAL PC READY' : 'NO LOCAL MODEL'}
                </span>
              </div>
            </div>
          </div>

          {/* Top-Center Subsystem Icon Dock (Reference Horizontal Ribbon) */}
          <div className="xl:col-span-6 am-hud-frame rounded-xl px-2.5 py-1.5 flex items-center justify-center gap-1.5 overflow-x-auto">
            {topDockModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={mod.onClick}
                  title={mod.label}
                  aria-label={mod.label}
                  className="min-w-[44px] min-h-[42px] px-2 py-1.5 rounded-lg bg-[#071529]/90 hover:bg-[#00E5FF]/18 border border-cyan-500/30 hover:border-[#00E5FF] text-cyan-200 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all shrink-0"
                >
                  <Icon className="w-4 h-4 text-[#00E5FF]" />
                  <span className="font-mono-hud text-[8px] tracking-wider text-slate-300 uppercase">
                    {mod.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Top-Right 5-Button Chamfered Command Action Strip */}
          <div className="xl:col-span-3 am-hud-frame rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1.5">
            {[
              {
                id: 'stby',
                label: 'STBY',
                title: 'Enter Standby Mode',
                onClick: () => onRunProtocol?.('STANDBY'),
              },
              {
                id: 'diag',
                label: 'DIAG',
                title: 'Run Full System Diagnostics',
                onClick: () => onRunProtocol?.('DIAGNOSTICS'),
              },
              {
                id: 'sync',
                label: 'SYNC',
                title: 'Sync Offline Workspace (Opt-In)',
                onClick: () => onSyncNow?.(),
              },
              {
                id: 'clsc',
                label: 'CLSC',
                title: 'Switch to Classic Mode',
                onClick: () => onToggleClassicMode?.(),
              },
              {
                id: 'lock',
                label: 'LOCK',
                title: 'Lock to Opening Gate',
                onClick: () => onLockGate?.(),
              },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                title={btn.title}
                onClick={btn.onClick}
                className="am-chamfer-btn flex-1 min-h-[38px] px-1.5 py-1 bg-[#081A33] hover:bg-[#00E5FF]/20 border border-cyan-400/40 font-mono-hud text-[9px] font-bold text-cyan-200 tracking-wider cursor-pointer transition-colors"
              >
                {btn.label}
              </button>
            ))}
            <span
              title={securityReport.defconLevel === 1 ? 'Lockdown Active' : 'Security Guard Ready'}
              className={`w-6 h-8 rounded border flex items-center justify-center shrink-0 ${
                securityReport.defconLevel === 1
                  ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                  : 'bg-emerald-500/15 border-emerald-400/45 text-emerald-300'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* MAIN 3-WING HOLOGRAPHIC COCKPIT ARENA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* CENTER HERO REACTOR COLUMN (First on Mobile, Center on Desktop!) */}
          <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col items-center justify-center space-y-2.5">
            <div className="w-full relative flex flex-col sm:flex-row items-center justify-center gap-2 py-1">
              {/* Giant Reference Circular Holographic AM Reactor */}
              <div className="relative flex items-center justify-center">
                <AMReactor
                  state={reactorState}
                  audioLevel={isListening || isSpeaking ? Math.max(0.35, audioLevel) : audioLevel}
                  size="hero"
                  hudVariant="reference"
                  innerTopLabel={`${hours12}:${minutes} ${ampm}`}
                  innerBottomLabel={shortReactorDate}
                  subsystems={subsystemArcs}
                  reducedMotion={reducedMotion}
                  powerSaving={powerSaving}
                  onSectorClick={handleReactorSectorClick}
                  onClick={isListening ? onStopListening : onTalkToJarvis}
                />
              </div>

              {/* Right-hugging Arc Telemetry Column (matching FREE / 61.66% / USED pills in reference) */}
              <div className="grid grid-cols-3 sm:grid-cols-1 gap-1.5 shrink-0 w-full sm:w-28">
                {flankingMetrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-lg bg-[#051020]/92 border border-cyan-500/30 px-2.5 py-1.5 text-center sm:text-left"
                  >
                    <p className="font-mono-hud text-[8px] text-slate-400 tracking-widest">
                      {m.label}
                    </p>
                    <p className={`font-mono-hud text-[10px] font-bold truncate ${m.tone}`}>
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Compact Signature Protocols Bar + Live Voice Summary Controls */}
            <div className="w-full am-hud-frame rounded-xl p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'GOOD_MORNING' as const, label: 'Good Morning' },
                    { id: 'FOCUS' as const, label: 'Focus Mode' },
                    { id: 'MUSIC' as const, label: 'Music Mode' },
                    { id: 'DIAGNOSTICS' as const, label: 'Diagnostics' },
                    { id: 'STANDBY' as const, label: 'Standby' },
                  ].map((proto) => (
                    <button
                      key={proto.id}
                      type="button"
                      data-testid={`protocol-btn-${proto.id.toLowerCase()}`}
                      onClick={() => onRunProtocol?.(proto.id)}
                      className="px-2.5 py-1 rounded-lg bg-[#07162A] hover:bg-[#00E5FF]/18 border border-cyan-400/35 hover:border-[#00E5FF] font-mono-hud text-[10px] text-cyan-100 cursor-pointer transition-colors"
                    >
                      {proto.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowQuickTaskModal((v) => !v)}
                    className="px-2.5 py-1 rounded-lg bg-[#00E5FF]/15 border border-[#00E5FF]/50 font-mono-hud text-[10px] font-bold text-[#00E5FF] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>QUICK TASK</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      isSpeaking && !isSpeechPaused
                        ? onPauseBriefing()
                        : isSpeechPaused
                          ? onResumeBriefing()
                          : onSpeakBriefing(speakableBriefing)
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#07162A] border border-cyan-500/40 font-mono-hud text-[10px] text-cyan-200 flex items-center gap-1 cursor-pointer"
                  >
                    {isSpeaking && !isSpeechPaused ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>PAUSE</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3 h-3" />
                        <span>BRIEFING</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showQuickTaskModal && (
                <form
                  onSubmit={handleSubmitQuickTask}
                  className="pt-2 border-t border-cyan-500/20 flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    value={quickTaskTitle}
                    onChange={(e) => setQuickTaskTitle(e.target.value)}
                    placeholder="Enter new mission / task title (saved offline too)..."
                    className="flex-1 min-w-[180px] bg-[#040B17] border border-cyan-500/35 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-[#00E5FF] focus:outline-none"
                  />
                  <select
                    value={quickTaskPriority}
                    onChange={(e) => setQuickTaskPriority(e.target.value as TaskItem['priority'])}
                    aria-label="Task priority"
                    className="bg-[#040B17] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-cyan-200"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-[#00E5FF] text-[#02050B] font-mono-hud text-[11px] font-bold cursor-pointer"
                  >
                    SAVE TASK
                  </button>
                </form>
              )}

              {!startupSummaryDismissed && (
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-cyan-500/15 text-[11px] text-slate-300">
                  <p className="truncate font-mono-hud text-[10px] text-cyan-100/90">
                    {speakableBriefing}
                  </p>
                  <button
                    type="button"
                    onClick={onDismissStartupSummary}
                    aria-label="Hide briefing summary line"
                    className="text-slate-400 hover:text-white cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* LEFT WING COLUMN (Clock + Skewed Metallic Tabs + Quick Links + Cyan Network Arc Gauge) */}
          <div className="order-2 lg:order-1 lg:col-span-3 space-y-2.5">
            {/* Digital Time & Reflection Display (Reference Top-Left) */}
            <div className="am-hud-frame rounded-xl px-3.5 py-2.5">
              <p className="font-mono-hud text-[10px] text-cyan-200/85 tracking-wider">
                {headerDateLabel}
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-display text-4xl xl:text-5xl font-black tracking-[0.08em] text-slate-100 leading-none drop-shadow-[0_0_16px_rgba(0,229,255,0.45)]">
                  {hours12}:{minutes}
                </span>
                <span className="font-mono-hud text-xs font-bold text-[#00E5FF]">{ampm}</span>
              </div>
              <p
                aria-hidden="true"
                className="font-display text-lg font-black tracking-[0.12em] text-cyan-400/15 leading-none scale-y-[-0.6] select-none -mt-1"
              >
                {hours12}:{minutes}
              </p>
            </div>

            {/* Skewed Trapezoid Tabs + Inner Quick Links Grid (Reference Mid-Left) */}
            <div className="grid grid-cols-12 gap-2 items-stretch">
              <div className="col-span-6 space-y-1.5">
                {leftSkewTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={tab.onClick}
                      className="am-skew-tab w-full min-h-[38px] px-2.5 py-1.5 flex items-center gap-2 text-left cursor-pointer"
                    >
                      <span className="w-6 h-6 rounded-full bg-[#02060F] border border-[#00E5FF]/55 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-[#00E5FF]" />
                      </span>
                      <span className="font-mono-hud text-[11px] font-bold text-slate-100 truncate">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="col-span-6 am-hud-frame rounded-xl p-2.5 flex flex-col justify-between">
                <div>
                  <p className="font-mono-hud text-[10px] font-bold text-emerald-300 tracking-[0.18em] border-b border-cyan-500/20 pb-1">
                    LINKS
                  </p>
                  <div className="mt-1.5 space-y-1 font-mono-hud text-[10px]">
                    {[
                      { label: 'OPENJARVIS', val: '10 MODES', scr: 'openjarvis' as ScreenId },
                      { label: 'BRAIN', val: '14 AGNT', scr: 'brain_center' as ScreenId },
                      { label: 'VAULT', val: `${memories.length} MEM`, scr: 'memory' as ScreenId },
                      { label: 'TASKS', val: `${pendingTasks.length} DUE`, scr: 'productivity' as ScreenId },
                      { label: 'NOTES', val: `${notes.length} NOTE`, scr: 'productivity' as ScreenId },
                      { label: 'CHATS', val: `${sessions.length} SESS`, scr: 'chat' as ScreenId },
                      { label: 'AUDIT', val: `${securityReport.score}%`, scr: 'security' as ScreenId },
                      { label: 'PLUGINS', val: 'READY', scr: 'plugins' as ScreenId },
                      { label: 'RESEARCH', val: 'WEB', scr: 'research' as ScreenId },
                    ].map((row) => (
                      <button
                        key={row.label}
                        type="button"
                        onClick={() => onNavigate(row.scr)}
                        className="w-full flex items-center justify-between gap-1 text-left hover:text-[#00E5FF] cursor-pointer py-0.5"
                      >
                        <span className="text-slate-400 truncate">{row.label}</span>
                        <span className="text-cyan-200 font-bold shrink-0">{row.val}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom-Left Cyan Network / WiFi Arc Gauge (Matching Bottom-Left Reference Crescent) */}
            <div className="am-hud-frame rounded-xl p-3 flex items-center gap-3">
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#0D1E36"
                    strokeWidth="9"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke={telemetry.online ? '#00E5FF' : '#FFB020'}
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray="176 240"
                    transform="rotate(140 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  {telemetry.online ? (
                    <Wifi className="w-4 h-4 text-[#00E5FF]" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-300" />
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1 font-mono-hud">
                <p className="text-xs font-bold text-[#00E5FF] tracking-wider">
                  NET: {telemetry.online ? 'ONLINE' : 'OFFLINE'}
                </p>
                <p className="text-[10px] text-slate-300 truncate">{telemetry.networkType}</p>
                <p className="text-[9px] text-slate-400">
                  {telemetry.batteryPercent !== null
                    ? `POWER ${telemetry.batteryPercent}% ${telemetry.isCharging ? '(CHG)' : ''}`
                    : `CORES: ${telemetry.cpuCores} • WEB SANDBOX`}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT WING COLUMN (Giant Date + Analog Chronometer + Weather + Circular RAM/Vault Gauges + Speedometer) */}
          <div className="order-3 lg:col-span-3 space-y-2.5">
            {/* Giant Calendar Date Number + Analog Chronometer Dial */}
            <div className="am-hud-frame rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="text-left">
                <p className="font-display text-5xl font-black leading-none text-slate-100 drop-shadow-[0_0_14px_rgba(0,229,255,0.4)]">
                  {dayNum}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#00E5FF]/20 border border-[#00E5FF]/45 font-mono-hud text-[10px] font-bold text-[#00E5FF] tracking-widest">
                  {monthFull}
                </span>
                <p className="font-mono-hud text-[9px] text-slate-400 mt-0.5 tracking-widest">
                  {weekdayFull}
                </p>
              </div>

              {/* Secondary Holographic Analog Chronometer Dial */}
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="44" fill="#030915" stroke="#00E5FF" strokeOpacity="0.45" strokeWidth="1.5" />
                  <circle cx="50" cy="50" r="37" fill="none" stroke="#2F8BFF" strokeOpacity="0.4" strokeWidth="4" strokeDasharray="3 3" />
                  <line
                    x1="50"
                    y1="50"
                    x2="50"
                    y2="27"
                    stroke="#E0F2FE"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    transform={`rotate(${hrDeg} 50 50)`}
                  />
                  <line
                    x1="50"
                    y1="50"
                    x2="50"
                    y2="18"
                    stroke="#00E5FF"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    transform={`rotate(${minDeg} 50 50)`}
                  />
                  <line
                    x1="50"
                    y1="50"
                    x2="50"
                    y2="14"
                    stroke="#FFB020"
                    strokeWidth="1"
                    transform={`rotate(${secDeg} 50 50)`}
                  />
                  <circle cx="50" cy="50" r="2.8" fill="#00E5FF" />
                </svg>
              </div>
            </div>

            {/* Weather & City Status Card (Honest Standby if Offline) */}
            <div className="am-hud-frame rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-hud text-[10px] font-bold text-cyan-300 flex items-center gap-1.5 truncate">
                  <CloudSun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="truncate">{weatherCity}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingCity((v) => !v)}
                  className="font-mono-hud text-[9px] text-cyan-300 hover:text-white cursor-pointer shrink-0"
                >
                  {editingCity ? 'CLOSE' : 'CITY'}
                </button>
              </div>

              {editingCity && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (cityDraft.trim()) {
                      onUpdateWeatherCity?.(cityDraft.trim());
                      setEditingCity(false);
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={cityDraft}
                    onChange={(e) => setCityDraft(e.target.value)}
                    placeholder="City name..."
                    className="flex-1 bg-[#040B17] border border-cyan-500/35 rounded px-2 py-1 text-[10px] text-slate-100"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 rounded bg-[#00E5FF] text-[#02050B] font-mono-hud text-[9px] font-bold cursor-pointer"
                  >
                    SET
                  </button>
                </form>
              )}

              <p className="font-mono-hud text-xs text-slate-100 font-semibold leading-snug">
                {hasWeatherUpdate
                  ? dailyBriefing?.weatherSummary
                  : telemetry.online
                    ? briefingLoading
                      ? 'Syncing live weather telemetry...'
                      : 'Weather Standby — Click Refresh for summary'
                    : 'Offline — Live weather paused'}
              </p>
              <div className="flex items-center justify-between text-[9px] font-mono-hud text-slate-400">
                <span>LOCAL MODEL: {localModelReady ? 'INSTALLED' : 'OPTIONAL'}</span>
                <button
                  type="button"
                  onClick={onRefreshBriefing}
                  className="text-cyan-300 hover:underline cursor-pointer"
                >
                  REFRESH
                </button>
              </div>
            </div>

            {/* Dual Circular RAM & Vault/Disk Rings (Reference Bottom-Right Dual Circles) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="am-hud-frame rounded-xl p-2.5 flex items-center gap-2">
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
                    <circle cx="30" cy="30" r="24" fill="none" stroke="#0F2036" strokeWidth="5" />
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      fill="none"
                      stroke="#00E5FF"
                      strokeWidth="5"
                      strokeDasharray={150.8}
                      strokeDashoffset={
                        heapPercent !== null ? 150.8 * (1 - heapPercent / 100) : 112
                      }
                    />
                  </svg>
                  <span className="absolute font-mono-hud text-[9px] font-bold text-cyan-200">
                    RAM
                  </span>
                </div>
                <div className="min-w-0 font-mono-hud">
                  <p className="text-[9px] text-slate-400">JS HEAP</p>
                  <p className="text-[10px] font-bold text-slate-100 truncate">
                    {telemetry.heapUsedMb !== null ? `${telemetry.heapUsedMb} MB` : 'Masked'}
                  </p>
                </div>
              </div>

              <div className="am-hud-frame rounded-xl p-2.5 flex items-center gap-2">
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
                    <circle cx="30" cy="30" r="24" fill="none" stroke="#0F2036" strokeWidth="5" />
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      fill="none"
                      stroke="#FFB020"
                      strokeWidth="5"
                      strokeDasharray={150.8}
                      strokeDashoffset={
                        storagePercent !== null ? 150.8 * (1 - storagePercent / 100) : 98
                      }
                    />
                  </svg>
                  <span className="absolute font-mono-hud text-[9px] font-bold text-amber-200">
                    DISK
                  </span>
                </div>
                <div className="min-w-0 font-mono-hud">
                  <p className="text-[9px] text-slate-400">STORAGE</p>
                  <p className="text-[10px] font-bold text-slate-100 truncate">
                    {telemetry.storageUsedMb != null ? `${telemetry.storageUsedMb} MB` : 'Ready'}
                  </p>
                </div>
              </div>
            </div>

            {/* Readiness Speedometer Dial + Live Timestamped System Events Drawer */}
            <div className="am-hud-frame rounded-xl p-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="relative w-14 h-12 shrink-0">
                  <svg viewBox="0 0 80 60" className="w-full h-full">
                    <path
                      d="M 12 48 A 28 28 0 1 1 68 48"
                      fill="none"
                      stroke="#102542"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 12 48 A 28 28 0 1 1 68 48"
                      fill="none"
                      stroke="#00E5FF"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.round((readinessScore / 100) * 124)} 200`}
                    />
                    <line
                      x1="40"
                      y1="42"
                      x2="40"
                      y2="20"
                      stroke="#FFB020"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      transform={`rotate(${needleAngleDeg} 40 42)`}
                    />
                    <circle cx="40" cy="42" r="3" fill="#00E5FF" />
                  </svg>
                </div>
                <div className="font-mono-hud">
                  <p className="text-[9px] text-slate-400">SYSTEM READINESS</p>
                  <p className="text-xs font-bold text-[#00E5FF]">
                    {readinessScore}% • DEFCON {securityReport.defconLevel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="toggle-event-log-btn"
                onClick={() => setShowEventDrawer((v) => !v)}
                className="px-2.5 py-1.5 rounded-lg bg-[#07162A] border border-cyan-500/40 font-mono-hud text-[9px] font-bold text-cyan-200 cursor-pointer shrink-0"
              >
                {showEventDrawer ? 'HIDE LOGS' : `LOGS (${systemEvents.length})`}
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Live Timestamped Event Log Drawer */}
        {showEventDrawer && (
          <div
            data-testid="system-events-drawer"
            className="am-hud-frame rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-hud text-[10px] font-bold text-[#00E5FF] tracking-wider">
                REAL TIMESTAMPED SYSTEM EVENT LOG
              </span>
              <button
                type="button"
                onClick={() => setShowEventDrawer(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {systemEvents.length === 0 ? (
              <p className="font-mono-hud text-[11px] text-slate-400">
                No runtime events recorded in this session yet.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1 font-mono-hud text-[10px]">
                {systemEvents.slice(0, 20).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#040B17] border border-slate-800/80"
                  >
                    <span className="text-cyan-300 font-bold shrink-0">[{ev.category}]</span>
                    <span className="text-slate-200 flex-1 truncate">
                      {ev.title} — {ev.detail}
                    </span>
                    <span className="text-slate-500 shrink-0">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BOTTOM COCKPIT COMMAND, AI SEARCH & MEDIA WAVEFORM DECK */}
        <CommandCenterBottomBar
          telemetry={telemetry}
          dailyBriefing={dailyBriefing}
          briefingLoading={briefingLoading}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isThinking={isThinking}
          audioLevel={audioLevel}
          transcript={transcript}
          voiceError={voiceError}
          speechRecognitionSupported={speechRecognitionSupported}
          reducedMotion={reducedMotion}
          activeEngine={activeEngine}
          mediaPlayingTitle={mediaPlayingTitle}
          isMediaPlaying={isMediaPlaying}
          onMediaPlayPause={onMediaPlayPause}
          onMediaNext={onMediaNext}
          onMediaPrev={onMediaPrev}
          onSubmitCommand={onSubmitCommand}
          onTalkToJarvis={onTalkToJarvis}
          onStopListening={onStopListening}
          onStopSpeaking={onStopSpeaking}
          onExecutiveBriefing={() => onSpeakBriefing(speakableBriefing)}
        />
      </div>
    );
  }

  // =========================================================================
  // CLASSIC MODE DASHBOARD (?classic=1 or Classic Toggle, branded AM AI)
  // =========================================================================
  const summaryStatusBadge = (() => {
    switch (startupSummaryStatus) {
      case 'speaking':
        return { label: 'SPEAKING', cls: 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200' };
      case 'paused':
        return { label: 'PAUSED', cls: 'bg-amber-500/20 border-amber-400/60 text-amber-200' };
      case 'awaiting_gesture':
        return { label: 'TAP TO PLAY', cls: 'bg-amber-500/20 border-amber-400/70 text-amber-200' };
      case 'preparing':
        return { label: 'PREPARING', cls: 'bg-sky-500/15 border-sky-400/50 text-sky-200' };
      case 'completed':
        return { label: 'DELIVERED', cls: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200' };
      case 'muted':
        return { label: 'MUTED', cls: 'bg-slate-800 border-slate-600 text-slate-300' };
      case 'disabled':
        return { label: 'MANUAL', cls: 'bg-slate-900 border-slate-700 text-slate-400' };
      case 'unsupported':
        return { label: 'TEXT ONLY', cls: 'bg-slate-900 border-slate-700 text-slate-400' };
      default:
        return { label: 'READY', cls: 'bg-cyan-500/10 border-cyan-400/40 text-cyan-200' };
    }
  })();

  const aiCoreOverview = [
    {
      label: 'AM AI Core',
      value: isThinking ? 'Thinking' : connectionState === 'offline' ? 'Standby' : 'Active',
      tone: connectionState === 'offline' ? 'text-amber-300' : 'text-cyan-300',
    },
    {
      label: 'Memory',
      value: `Connected (${memories.length})`,
      tone: 'text-emerald-300',
    },
    {
      label: 'Voice',
      value: isListening
        ? 'Listening'
        : isSpeaking
          ? 'Speaking'
          : speechRecognitionSupported
            ? 'Online'
            : 'TTS Only',
      tone: isListening ? 'text-rose-300' : 'text-cyan-300',
    },
    {
      label: 'Agents',
      value: `Running (${6 + customAgents.length})`,
      tone: 'text-sky-300',
    },
    {
      label: 'Engine',
      value: activeEngine,
      tone: connectionState === 'online' ? 'text-emerald-300' : 'text-amber-300',
    },
    {
      label: 'System',
      value: securityReport.defconLevel === 1 ? 'Lockdown' : 'Optimal',
      tone: securityReport.defconLevel === 1 ? 'text-rose-300' : 'text-emerald-300',
    },
  ];

  const activeAgentCards: Array<{
    name: string;
    role: string;
    status: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    onClick: () => void;
  }> = [
    {
      name: 'Coding Agent',
      role: 'DUM-E • Code & Build',
      status: 'ACTIVE',
      icon: Code2,
      color: 'text-amber-300 border-amber-400/30',
      onClick: () => onSelectAgentAndChat('DUM_E_ENGINEER'),
    },
    {
      name: 'Research Agent',
      role: 'VERONICA • Web Intel',
      status: 'READY',
      icon: Search,
      color: 'text-cyan-300 border-cyan-400/30',
      onClick: () => onSelectAgentAndChat('VERONICA_RESEARCH', true),
    },
    {
      name: 'Memory Agent',
      role: `${memories.length} Vault Directives`,
      status: 'SYNCED',
      icon: Database,
      color: 'text-emerald-300 border-emerald-400/30',
      onClick: () => onNavigate('memory'),
    },
    {
      name: 'Browser Agent',
      role: 'Search & Tool Bridges',
      status: 'ONLINE',
      icon: Globe,
      color: 'text-sky-300 border-sky-400/30',
      onClick: () => onNavigate('plugins'),
    },
    {
      name: 'Task Agent',
      role: 'FRIDAY • Schedule Ops',
      status: 'RUNNING',
      icon: ListTodo,
      color: 'text-violet-300 border-violet-400/30',
      onClick: () => onSelectAgentAndChat('FRIDAY_COORDINATOR'),
    },
    {
      name: 'System Agent',
      role: 'HOMER • Telemetry/SEC',
      status: 'GUARD',
      icon: Shield,
      color: 'text-rose-300 border-rose-400/30',
      onClick: () => onSelectAgentAndChat('HOMER_DIAGNOSTICS'),
    },
  ];

  const batteryAvailable = telemetry.batteryPercent !== null;
  const batteryLevel = batteryAvailable ? Math.max(0, Math.min(100, telemetry.batteryPercent!)) : null;
  const isCharging = telemetry.isCharging === true;
  const arcRadius = 42;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcDashOffset =
    batteryLevel !== null ? arcCircumference * (1 - batteryLevel / 100) : arcCircumference * 0.25;
  const arcStrokeColor = !batteryAvailable
    ? '#64748b'
    : isCharging
      ? '#10b981'
      : (batteryLevel ?? 100) <= 20
        ? '#f43f5e'
        : (batteryLevel ?? 100) <= 40
          ? '#fbbf24'
          : '#00f0ff';

  return (
    <div data-testid="am-classic-dashboard" className="space-y-4 pb-16 lg:pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/35">
        <span className="font-mono-hud text-xs text-amber-200">
          AM AI CLASSIC MODE — Preserved Classic Workspace (?classic=1)
        </span>
        {onToggleClassicMode && (
          <button
            type="button"
            onClick={onToggleClassicMode}
            className="px-3 py-1 rounded-lg bg-[#00E5FF] text-[#02050B] font-mono-hud text-[10px] font-bold cursor-pointer"
          >
            RETURN TO COSMIC HUD
          </button>
        )}
      </div>

      <div
        className={`grid gap-4 ${
          layoutMode === 'focus'
            ? 'grid-cols-1 max-w-4xl mx-auto'
            : layoutMode === 'compact'
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1 lg:grid-cols-12'
        }`}
      >
        {layoutMode !== 'focus' && (
          <div className={`${layoutMode === 'compact' ? '' : 'lg:col-span-3'} space-y-4`}>
            <div className="glass-panel rounded-2xl p-4 space-y-3 border border-cyan-500/25">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-300" />
                  <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                    AM AI CORE OVERVIEW
                  </h3>
                </div>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {aiCoreOverview.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl bg-[#040916] border border-slate-800/90 px-2.5 py-2"
                  >
                    <p className="font-mono-hud text-[9px] text-slate-400 uppercase">{item.label}</p>
                    <p className={`font-mono-hud text-[11px] font-bold mt-0.5 truncate ${item.tone}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 space-y-2.5 border border-cyan-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-300" />
                  <h3 className="font-mono-hud text-xs font-bold text-sky-300 tracking-wider">
                    ACTIVE AGENTS
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('multi_agent')}
                  className="font-mono-hud text-[10px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
                >
                  Hub →
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {activeAgentCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.name}
                      type="button"
                      onClick={card.onClick}
                      className={`w-full text-left p-2.5 rounded-xl bg-[#040916] hover:bg-cyan-500/10 border transition-all flex items-center gap-2.5 cursor-pointer ${card.color}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-100 truncate">{card.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{card.role}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <LlmStatusPanel
              connectionState={connectionState}
              onConfigureSettings={() => onNavigate('settings')}
            />
          </div>
        )}

        <div
          className={`${
            layoutMode === 'focus'
              ? ''
              : layoutMode === 'compact'
                ? 'lg:col-span-2'
                : 'lg:col-span-6'
          } space-y-4`}
        >
          {!startupSummaryDismissed && (
            <section className="glass-panel rounded-2xl p-4 space-y-3 border border-cyan-400/35">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-cyan-300" />
                  <h2 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                    AM AI DAILY VOICE SUMMARY
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full border font-mono-hud text-[9px] font-bold ${summaryStatusBadge.cls}`}
                  >
                    {summaryStatusBadge.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSpeakBriefing(speakableBriefing)}
                    className="px-3 py-1 rounded-lg bg-cyan-400 text-[#02040A] font-mono-hud text-[10px] font-bold cursor-pointer"
                  >
                    PLAY
                  </button>
                  <button
                    type="button"
                    onClick={onDismissStartupSummary}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-200 bg-[#040916]/85 border border-slate-800 rounded-xl px-3 py-2">
                {speakableBriefing}
              </p>
            </section>
          )}

          <div className="glass-panel-glow rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <div>
                <p className="font-mono-hud text-[10px] tracking-[0.22em] text-cyan-400">
                  AM AI – COSMIC INTELLIGENCE (CLASSIC VIEW)
                </p>
                <h1 className="font-display text-lg sm:text-xl font-bold tracking-wider text-slate-100">
                  {dailyBriefing?.greeting || 'Welcome back to AM AI, Sir.'}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('chat')}
                className="px-3.5 py-2 rounded-xl bg-cyan-400 text-[#02040A] font-display text-[11px] font-bold cursor-pointer"
              >
                AI CHAT
              </button>
            </div>
            <div className="h-[260px] sm:h-[300px] w-full">
              <QuantumCoreCanvas
                audioPulse={isListening || isSpeaking ? Math.max(0.35, audioLevel) : audioLevel}
                nodeCount={64}
                reducedMotion={reducedMotion}
                showCoreLabel={true}
              />
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 space-y-3 border border-cyan-500/25">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setShowQuickTaskModal((v) => !v)}
                className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-left cursor-pointer"
              >
                <Plus className="w-4 h-4 text-cyan-300" />
                <p className="text-xs font-semibold text-slate-100 mt-1">Start New Task</p>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('productivity')}
                className="p-3 rounded-xl bg-[#070F20] border border-slate-700 text-left cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-amber-300" />
                <p className="text-xs font-semibold text-slate-100 mt-1">Tasks &amp; Notes</p>
              </button>
              <button
                type="button"
                onClick={isListening ? onStopListening : onTalkToJarvis}
                className="p-3 rounded-xl bg-[#070F20] border border-slate-700 text-left cursor-pointer"
              >
                <Mic className="w-4 h-4 text-cyan-300" />
                <p className="text-xs font-semibold text-slate-100 mt-1">Voice</p>
              </button>
              <button
                type="button"
                onClick={onRunWorkflow}
                className="p-3 rounded-xl bg-[#070F20] border border-slate-700 text-left cursor-pointer"
              >
                <Play className="w-4 h-4 text-violet-300" />
                <p className="text-xs font-semibold text-slate-100 mt-1">Workflows</p>
              </button>
            </div>
          </div>
        </div>

        {layoutMode !== 'focus' && (
          <div className={`${layoutMode === 'compact' ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-4`}>
            <LiveIntelligenceFeedPanel
              sessions={sessions}
              tasks={tasks}
              securityLogs={securityLogs}
              collaborationLogs={collaborationLogs}
              onNavigate={(scr) => onNavigate(scr)}
            />
            <MissionTimelinePanel
              tasks={tasks}
              onToggleTask={onToggleTask}
              onOpenCalendar={() => onNavigate('productivity', { productivityFilter: 'ALL' })}
            />
            <SystemMonitorPanel telemetry={telemetry} onOpenTelemetry={() => onNavigate('telemetry')} />
            <MemoryInsightsPanel
              memories={memories}
              sessions={sessions}
              toolCallCount={toolCallCount}
              onViewMemoryMap={() => onNavigate('memory')}
            />
            <div className="glass-panel rounded-2xl p-3 flex items-center gap-3">
              <Zap className="w-5 h-5 text-cyan-300" />
              <div className="font-mono-hud text-xs">
                <p className="text-slate-400">POWER BUS</p>
                <p className="font-bold text-cyan-200">
                  {batteryLevel !== null ? `${batteryLevel}%` : 'NOMINAL (BROWSER)'}
                </p>
              </div>
              <svg viewBox="0 0 120 120" className="w-12 h-12 ml-auto -rotate-90">
                <circle cx="60" cy="60" r={arcRadius} fill="none" stroke="#0f172a" strokeWidth="8" />
                <circle
                  cx="60"
                  cy="60"
                  r={arcRadius}
                  fill="none"
                  stroke={arcStrokeColor}
                  strokeWidth="8"
                  strokeDasharray={arcCircumference}
                  strokeDashoffset={arcDashOffset}
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      <CommandCenterBottomBar
        telemetry={telemetry}
        dailyBriefing={dailyBriefing}
        briefingLoading={briefingLoading}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isThinking={isThinking}
        audioLevel={audioLevel}
        transcript={transcript}
        voiceError={voiceError}
        speechRecognitionSupported={speechRecognitionSupported}
        reducedMotion={reducedMotion}
        activeEngine={activeEngine}
        mediaPlayingTitle={mediaPlayingTitle}
        isMediaPlaying={isMediaPlaying}
        onMediaPlayPause={onMediaPlayPause}
        onMediaNext={onMediaNext}
        onMediaPrev={onMediaPrev}
        onSubmitCommand={onSubmitCommand}
        onTalkToJarvis={onTalkToJarvis}
        onStopListening={onStopListening}
        onStopSpeaking={onStopSpeaking}
        onExecutiveBriefing={() => onSpeakBriefing(speakableBriefing)}
      />
    </div>
  );
};

import React, { useState } from 'react';
import {
  Activity,
  Battery,
  BatteryCharging,
  Bot,
  Calendar,
  Code2,
  Cpu,
  Database,
  Gamepad2,
  Globe,
  Home,
  Leaf,
  ListTodo,
  MessageSquare,
  Mic,
  Music2,
  Play,
  Plus,
  Search,
  Shield,
  Sparkles,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { DashboardLayoutMode } from '../components/HeaderHud';
import { CommandCenterBottomBar } from '../components/CommandCenterBottomBar';
import {
  LiveIntelligenceFeedPanel,
  LlmStatusPanel,
  MemoryInsightsPanel,
  MissionTimelinePanel,
  SystemMonitorPanel,
} from '../components/CommandCenterPanels';
import { QuantumCoreCanvas } from '../components/QuantumCoreCanvas';
import {
  AgentCollaborationLog,
  AgentId,
  BrowserTelemetry,
  ChatSession,
  ConnectionState,
  CustomAgent,
  DailyBriefingData,
  MemoryItem,
  ScreenId,
  SecurityLogItem,
  SecurityReport,
  TaskItem,
} from '../types/jarvis';

interface DashboardViewProps {
  telemetry: BrowserTelemetry;
  securityReport: SecurityReport;
  connectionState: ConnectionState;
  layoutMode: DashboardLayoutMode;
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
  memories: MemoryItem[];
  sessions: ChatSession[];
  tasks: TaskItem[];
  securityLogs: SecurityLogItem[];
  collaborationLogs: AgentCollaborationLog[];
  customAgents: CustomAgent[];
  onTogglePowerSaving: () => void;
  onRefreshBriefing: () => void;
  onSpeakBriefing: (text: string) => void;
  onTalkToJarvis: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onNavigate: (screen: ScreenId, options?: { productivityFilter?: 'ALL' | 'PENDING'; openSessionsDrawer?: boolean }) => void;
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
  isListening,
  isSpeaking,
  isThinking,
  audioLevel,
  transcript,
  voiceError,
  speechRecognitionSupported,
  reducedMotion,
  powerSaving,
  telemetryIntervalMs,
  dailyBriefing,
  briefingLoading,
  memories,
  sessions,
  tasks,
  securityLogs,
  collaborationLogs,
  customAgents,
  onTogglePowerSaving,
  onRefreshBriefing,
  onSpeakBriefing,
  onTalkToJarvis,
  onStopListening,
  onStopSpeaking,
  onNavigate,
  onSelectAgentAndChat,
  onAddQuickTask,
  onToggleTask,
  onRunWorkflow,
}) => {
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<TaskItem['priority']>('HIGH');

  const toolCallCount = securityLogs.filter((l) => l.eventType === 'TOOL_EXEC').length;

  const speakableBriefing = dailyBriefing
    ? `${dailyBriefing.greeting} Weather: ${dailyBriefing.weatherSummary}. Tasks: ${dailyBriefing.tasksSummary}. ${dailyBriefing.aiLine}`
    : 'Initiating live executive briefing synthesis, Sir.';

  const aiCoreOverview = [
    {
      label: 'AI Core',
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
      label: 'LLMs',
      value:
        connectionState === 'online'
          ? 'Connected'
          : connectionState === 'key_missing'
            ? 'Key Missing'
            : connectionState === 'connecting'
              ? 'Checking'
              : 'Offline',
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

  const handleSubmitQuickTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    onAddQuickTask(quickTaskTitle.trim(), quickTaskPriority);
    setQuickTaskTitle('');
    setShowQuickTaskModal(false);
  };

  const batteryAvailable = telemetry.batteryPercent !== null;
  const batteryLevel = batteryAvailable ? Math.max(0, Math.min(100, telemetry.batteryPercent!)) : null;
  const isCharging = telemetry.isCharging === true;
  const arcRadius = 42;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcDashOffset =
    batteryLevel !== null
      ? arcCircumference * (1 - batteryLevel / 100)
      : arcCircumference * 0.25;
  const arcStrokeColor = !batteryAvailable
    ? '#64748b'
    : isCharging
      ? '#10b981'
      : (batteryLevel ?? 100) <= 20
        ? '#f43f5e'
        : (batteryLevel ?? 100) <= 40
          ? '#fbbf24'
          : '#00f0ff';
  const reactorStateLabel = !batteryAvailable
    ? 'UNAVAILABLE'
    : isCharging
      ? 'CHARGING'
      : 'DISCHARGING';
  const reactorOutputMode = !batteryAvailable
    ? 'Browser API Blocked'
    : isCharging
      ? 'Arc Recharge Active'
      : (batteryLevel ?? 100) <= 20
        ? 'Low-Power Reserve'
        : 'Nominal Output';
  const litCells = batteryLevel !== null ? Math.round((batteryLevel / 100) * 10) : 0;

  return (
    <div className="space-y-4">
      {/* Main Command Center Bento Grid (Adapts cleanly across Desktop / Tablet / Mobile & layoutMode) */}
      <div
        className={`grid gap-4 ${
          layoutMode === 'focus'
            ? 'grid-cols-1 max-w-4xl mx-auto'
            : layoutMode === 'compact'
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1 lg:grid-cols-12'
        }`}
      >
        {/* LEFT COLUMN: AI Core Overview + Active Agents + LLM Status */}
        {layoutMode !== 'focus' && (
          <div className={`${layoutMode === 'compact' ? '' : 'lg:col-span-3'} space-y-4`}>
            {/* AI CORE OVERVIEW (#5) */}
            <div className="glass-panel rounded-2xl p-4 space-y-3 border border-cyan-500/25">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-300" />
                  <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                    AI CORE OVERVIEW
                  </h3>
                </div>
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00F0FF] animate-pulse" />
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

            {/* ACTIVE AGENTS (#6) */}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {activeAgentCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.name}
                      type="button"
                      onClick={card.onClick}
                      className={`w-full text-left p-2.5 rounded-xl bg-[#040916] hover:bg-cyan-500/10 border transition-all flex items-center gap-2.5 cursor-pointer ${card.color}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-100 truncate">{card.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{card.role}</p>
                      </div>
                      <span className="flex items-center gap-1 font-mono-hud text-[9px] text-emerald-300 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {card.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LLM STATUS (#12) */}
            <LlmStatusPanel
              connectionState={connectionState}
              onConfigureSettings={() => onNavigate('settings')}
            />
          </div>
        )}

        {/* CENTER COLUMN: Holographic JARVIS Sphere Hero + Quick Commands + Executive Briefing + Subsystem Strip */}
        <div
          className={`${
            layoutMode === 'focus'
              ? ''
              : layoutMode === 'compact'
                ? 'lg:col-span-2'
                : 'lg:col-span-6'
          } space-y-4`}
        >
          {/* CENTER HERO HOLOGRAPHIC AI CORE SPHERE (#4) */}
          <div className="glass-panel-glow rounded-2xl p-4 sm:p-6 relative overflow-hidden bg-gradient-to-b from-[#061124]/90 to-[#02050E]/95">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <div>
                <p className="font-mono-hud text-[10px] tracking-[0.22em] text-cyan-400">
                  STARK QUANTUM OPERATING SYSTEM
                </p>
                <h1 className="font-display text-lg sm:text-xl font-bold tracking-wider text-slate-100">
                  {dailyBriefing?.greeting || 'Welcome back, Sir.'}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('chat')}
                  className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-[11px] font-bold tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>AI CORE CHAT</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('voice')}
                  className="px-3 py-2 rounded-xl bg-[#0D1527] border border-cyan-400/45 hover:border-cyan-300 text-cyan-200 font-mono-hud text-[11px] flex items-center gap-1.5 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>VOICE HUD</span>
                </button>
              </div>
            </div>

            <div className="h-[260px] sm:h-[320px] w-full">
              <QuantumCoreCanvas
                audioPulse={isListening || isSpeaking ? Math.max(0.35, audioLevel) : audioLevel}
                nodeCount={64}
                reducedMotion={reducedMotion}
                showCoreLabel={true}
              />
            </div>

            <div className="mt-2 pt-3 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono-hud text-[11px] text-cyan-200">
                {dailyBriefing?.aiLine ||
                  (connectionState === 'online'
                    ? 'Neural Core synchronized. Ready for multimodal instructions.'
                    : connectionState === 'key_missing'
                      ? 'Configure GEMINI_API_KEY on server for live AI responses.'
                      : 'Local systems online. Backend awaiting connection.')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSpeakBriefing(speakableBriefing)}
                  className="px-2.5 py-1 rounded-lg bg-[#091326] border border-cyan-400/35 font-mono-hud text-[10px] text-cyan-200 flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Speak Status</span>
                </button>
                <button
                  type="button"
                  onClick={onRefreshBriefing}
                  disabled={briefingLoading}
                  className="px-2.5 py-1 rounded-lg bg-[#091326] border border-slate-700 font-mono-hud text-[10px] text-slate-300 cursor-pointer"
                >
                  {briefingLoading ? 'Syncing...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>

          {/* QUICK COMMANDS (#9) */}
          <div className="glass-panel rounded-2xl p-4 space-y-3 border border-cyan-500/25">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                  QUICK COMMANDS
                </h3>
              </div>
              <span className="font-mono-hud text-[10px] text-slate-400">DIRECT EXECUTION</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setShowQuickTaskModal((v) => !v)}
                className="p-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-left space-y-1 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 text-cyan-300" />
                <p className="text-xs font-semibold text-slate-100">Start New Task</p>
                <p className="text-[10px] text-slate-400">Queue directive</p>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('productivity', { productivityFilter: 'ALL' })}
                className="p-3 rounded-xl bg-[#070F20] hover:bg-sky-500/15 border border-slate-700 hover:border-cyan-400/40 text-left space-y-1 cursor-pointer transition-colors"
              >
                <Calendar className="w-4 h-4 text-amber-300" />
                <p className="text-xs font-semibold text-slate-100">Open Calendar</p>
                <p className="text-[10px] text-slate-400">{tasks.length} scheduled</p>
              </button>

              <button
                type="button"
                onClick={isListening ? onStopListening : onTalkToJarvis}
                className={`p-3 rounded-xl border text-left space-y-1 cursor-pointer transition-colors ${
                  isListening
                    ? 'bg-rose-500/20 border-rose-400 text-rose-100'
                    : 'bg-[#070F20] hover:bg-cyan-500/15 border-slate-700 hover:border-cyan-400/40'
                }`}
              >
                <Mic className="w-4 h-4 text-cyan-300" />
                <p className="text-xs font-semibold text-slate-100">
                  {isListening ? 'Stop Voice' : 'Start Voice Chat'}
                </p>
                <p className="text-[10px] text-slate-400">Live STT + TTS</p>
              </button>

              <button
                type="button"
                onClick={onRunWorkflow}
                className="p-3 rounded-xl bg-[#070F20] hover:bg-violet-500/15 border border-slate-700 hover:border-violet-400/45 text-left space-y-1 cursor-pointer transition-colors"
              >
                <Play className="w-4 h-4 text-violet-300" />
                <p className="text-xs font-semibold text-slate-100">Run Workflow</p>
                <p className="text-[10px] text-slate-400">Multi-agent sync</p>
              </button>
            </div>

            {showQuickTaskModal && (
              <form
                onSubmit={handleSubmitQuickTask}
                className="p-3 rounded-xl bg-[#040916] border border-cyan-400/40 flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  placeholder="Enter new mission / task title..."
                  className="flex-1 min-w-[180px] bg-[#0B1426] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
                <select
                  value={quickTaskPriority}
                  onChange={(e) => setQuickTaskPriority(e.target.value as TaskItem['priority'])}
                  aria-label="Priority"
                  className="bg-[#0B1426] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-cyan-200"
                >
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-cyan-400 text-[#02040A] font-mono-hud text-[11px] font-bold cursor-pointer"
                >
                  SAVE
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickTaskModal(false)}
                  aria-label="Cancel quick task"
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>

          {/* Preserved Cosmic Subsystems Quick-Launch Strip */}
          <div className="glass-panel rounded-2xl p-3.5 border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-hud text-[10px] text-slate-400 tracking-wider">
                ALL PRESERVED SUBSYSTEMS
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'insights' as ScreenId, label: 'Insights', icon: Activity },
                  { id: 'vision' as ScreenId, label: 'Vision', icon: Sparkles },
                  { id: 'music_studio' as ScreenId, label: 'Music Core', icon: Music2 },
                  { id: 'smart_home' as ScreenId, label: 'Smart Home', icon: Home },
                  { id: 'orbital_game' as ScreenId, label: 'Orbital 3D', icon: Gamepad2 },
                ].map((sub) => {
                  const Icon = sub.icon;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => onNavigate(sub.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#050B18] hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan-400/40 font-mono-hud text-[10px] text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Icon className="w-3 h-3 text-cyan-300" />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Intelligence Feed + Mission Timeline + System Monitor + Memory Insights */}
        {layoutMode !== 'focus' && (
          <div
            className={`${
              layoutMode === 'compact' ? 'lg:col-span-1' : 'lg:col-span-3'
            } space-y-4`}
          >
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

            {/* ENERGY — ARC REACTOR POWER OUTPUT CARD */}
            <section
              aria-label="Energy Arc Reactor Power Output"
              data-testid="energy-arc-reactor-card"
              className="glass-panel rounded-2xl p-4 space-y-3 border border-cyan-500/30"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Zap
                    className={`w-4 h-4 ${
                      isCharging
                        ? 'text-emerald-300'
                        : batteryAvailable
                          ? 'text-cyan-300'
                          : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                      ENERGY
                    </h3>
                    <p className="font-mono-hud text-[9px] text-slate-400 tracking-widest">
                      ARC REACTOR POWER OUTPUT
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono-hud text-[9px] font-bold border ${
                    !batteryAvailable
                      ? 'bg-slate-900 border-slate-700 text-slate-400'
                      : isCharging
                        ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                        : 'bg-cyan-500/10 border-cyan-400/40 text-cyan-200'
                  }`}
                >
                  {isCharging ? (
                    <BatteryCharging className="w-3 h-3" />
                  ) : (
                    <Battery className="w-3 h-3" />
                  )}
                  {reactorStateLabel}
                </span>
              </div>

              <div className="flex items-center gap-3.5 rounded-xl bg-[#040916]/90 border border-slate-800/90 p-3">
                {/* Concentric Arc Reactor SVG Gauge */}
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg
                    viewBox="0 0 120 120"
                    className="w-full h-full -rotate-90"
                    aria-hidden="true"
                  >
                    <defs>
                      <filter id="arcReactorGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {/* Outer segmented reactor ring */}
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke="rgba(0, 240, 255, 0.2)"
                      strokeWidth="3"
                      strokeDasharray="6 5"
                    />
                    {/* Background power track */}
                    <circle
                      cx="60"
                      cy="60"
                      r={arcRadius}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="7"
                    />
                    {/* Active charge / output arc */}
                    <circle
                      cx="60"
                      cy="60"
                      r={arcRadius}
                      fill="none"
                      stroke={arcStrokeColor}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={arcCircumference}
                      strokeDashoffset={arcDashOffset}
                      filter="url(#arcReactorGlow)"
                      style={{
                        transition: reducedMotion ? 'none' : 'stroke-dashoffset 0.6s ease',
                      }}
                    />
                    {/* Inner palladium containment ring */}
                    <circle
                      cx="60"
                      cy="60"
                      r="30"
                      fill="rgba(0, 240, 255, 0.06)"
                      stroke={arcStrokeColor}
                      strokeOpacity="0.45"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-display text-base font-bold text-slate-100 leading-none">
                      {batteryLevel !== null ? `${batteryLevel}%` : 'N/A'}
                    </span>
                    <span className="font-mono-hud text-[8px] text-cyan-300 tracking-widest mt-1">
                      OUTPUT
                    </span>
                  </div>
                </div>

                {/* Power Telemetry Metrics */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="font-mono-hud text-[9px] text-slate-400 uppercase">
                      CORE RESERVE
                    </p>
                    <p className="font-mono-hud text-xs font-bold text-slate-100">
                      {batteryLevel !== null
                        ? `${batteryLevel}% Power Cell`
                        : 'Unavailable in Browser'}
                    </p>
                  </div>

                  <div>
                    <p className="font-mono-hud text-[9px] text-slate-400 uppercase">
                      POWER BUS
                    </p>
                    <p
                      className={`font-mono-hud text-[11px] font-semibold ${
                        isCharging ? 'text-emerald-300' : 'text-cyan-200'
                      }`}
                    >
                      {reactorOutputMode}
                    </p>
                  </div>

                  {/* 10-Cell Arc Array */}
                  <div className="grid grid-cols-10 gap-1 pt-0.5" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, idx) => {
                      const active = idx < litCells;
                      return (
                        <span
                          key={idx}
                          className={`h-1.5 rounded-sm ${
                            active
                              ? isCharging
                                ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                                : (batteryLevel ?? 100) <= 20
                                  ? 'bg-rose-400'
                                  : 'bg-cyan-400 shadow-[0_0_6px_#00f0ff]'
                              : 'bg-slate-800'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Power Saving Mode Toggle */}
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#040916]/90 border border-slate-800/90 px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Leaf
                    className={`w-4 h-4 shrink-0 ${
                      powerSaving ? 'text-emerald-300' : 'text-slate-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-mono-hud text-[11px] font-bold text-slate-100 truncate">
                      POWER SAVING
                    </p>
                    <p
                      data-testid="power-saving-telemetry-caption"
                      className="font-mono-hud text-[10px] text-slate-400 truncate"
                    >
                      {powerSaving
                        ? `Telemetry ${Math.round(telemetryIntervalMs / 1000)}s • Animations Off`
                        : `Telemetry ${Math.round(telemetryIntervalMs / 1000)}s • Full HUD`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={powerSaving}
                  aria-label="Toggle Power Saving Mode"
                  data-testid="power-saving-toggle"
                  onClick={onTogglePowerSaving}
                  className={`min-h-[36px] px-3 py-1 rounded-lg font-mono-hud text-[11px] font-bold border shrink-0 cursor-pointer transition-colors ${
                    powerSaving
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-[#070E1D] border-slate-700 text-slate-300 hover:border-cyan-400/50'
                  }`}
                >
                  {powerSaving ? 'ON' : 'OFF'}
                </button>
              </div>
            </section>

            <SystemMonitorPanel
              telemetry={telemetry}
              onOpenTelemetry={() => onNavigate('telemetry')}
            />

            <MemoryInsightsPanel
              memories={memories}
              sessions={sessions}
              toolCallCount={toolCallCount}
              onViewMemoryMap={() => onNavigate('memory')}
            />
          </div>
        )}
      </div>

      {/* BOTTOM COMMAND BAR (#13 & #14) */}
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
        onTalkToJarvis={onTalkToJarvis}
        onStopListening={onStopListening}
        onStopSpeaking={onStopSpeaking}
        onExecutiveBriefing={() => {
          onRefreshBriefing();
          onSpeakBriefing(speakableBriefing);
        }}
      />
    </div>
  );
};

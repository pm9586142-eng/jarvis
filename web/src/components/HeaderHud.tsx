import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Clock,
  Cpu,
  Download,
  Globe,
  LayoutGrid,
  Menu,
  Moon,
  Palette,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { AGENT_LIST, JARVIS_LANGUAGES } from '../data/agents';
import { useSharedAiState } from '../context/SharedAiStateContext';
import { HUD_THEME_PRESET_LIST } from '../services/sharedAiState.js';
import {
  ActiveEngineAttribution,
  BrowserTelemetry,
  ChatSession,
  ConnectionState,
  HudThemePresetId,
  LanguageCode,
  MemoryItem,
  ScreenId,
  SecurityLogItem,
  SecurityReport,
  TaskItem,
  ThemeMode,
} from '../types/jarvis';
import { ReactorHudState } from '../types/media';
import { GlobalAudioVisualizer } from './GlobalAudioVisualizer';
import { MediaEqualizer } from './MediaEqualizer';

export type DashboardLayoutMode = 'command' | 'compact' | 'focus';

interface HeaderHudProps {
  title: string;
  subtitle: string;
  connectionState: ConnectionState;
  telemetry: BrowserTelemetry;
  securityReport?: SecurityReport;
  language: LanguageCode;
  reducedMotion: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  layoutMode: DashboardLayoutMode;
  themeMode?: ThemeMode;
  hudThemePreset?: HudThemePresetId;
  resolvedTheme?: 'dark' | 'light';
  tasks?: TaskItem[];
  memories?: MemoryItem[];
  sessions?: ChatSession[];
  securityLogs?: SecurityLogItem[];
  activeEngine?: ActiveEngineAttribution;
  localModelReady?: boolean;
  pendingSyncCount?: number;
  classicMode?: boolean;
  wakeWordLegacyJarvis?: boolean;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
  onToggleClassicMode?: () => void;
  onStopAudio?: () => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onToggleLayoutMode: () => void;
  onToggleTheme?: () => void;
  onSelectHudThemePreset?: (preset: HudThemePresetId) => void;
  onRetryConnection: () => void;
  onNavigate: (screen: ScreenId) => void;
  onSelectSession?: (sessionId: string) => void;
  onOpenMenu: () => void;
  mediaPlayingTitle?: string | null;
  isMediaPlaying?: boolean;
  isWakeWordActive?: boolean;
  reactorState?: ReactorHudState;
}

export const HeaderHud: React.FC<HeaderHudProps> = ({
  title,
  subtitle,
  connectionState,
  telemetry,
  securityReport,
  language,
  reducedMotion,
  isListening,
  isSpeaking,
  audioLevel,
  layoutMode,
  themeMode = 'dark',
  hudThemePreset = 'cosmic',
  resolvedTheme = 'dark',
  tasks = [],
  memories = [],
  sessions = [],
  securityLogs = [],
  activeEngine = 'Cloud AI',
  localModelReady = false,
  pendingSyncCount = 0,
  classicMode = false,
  wakeWordLegacyJarvis = false,
  canInstallPwa = false,
  onInstallPwa,
  onToggleClassicMode,
  onStopAudio,
  onLanguageChange,
  onToggleLayoutMode,
  onToggleTheme,
  onSelectHudThemePreset,
  onRetryConnection,
  onNavigate,
  onSelectSession,
  onOpenMenu,
  mediaPlayingTitle = null,
  isMediaPlaying = false,
  isWakeWordActive = false,
  reactorState,
}) => {
  const { aiState, stateLabel, stateDetail, themePreset } = useSharedAiState();
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isOptimal =
    connectionState === 'online' &&
    telemetry.online &&
    (securityReport ? securityReport.defconLevel > 1 : true);

  const systemStatusMeta = (() => {
    if (securityReport?.defconLevel === 1) {
      return {
        label: 'LOCKDOWN',
        badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/45',
      };
    }
    if (!telemetry.online || connectionState === 'offline') {
      return {
        label: localModelReady ? 'OFFLINE • LOCAL AI READY' : 'OFFLINE COMMAND MODE',
        badgeClass: localModelReady
          ? 'bg-cyan-500/15 text-cyan-200 border-cyan-400/50'
          : 'bg-amber-500/15 text-amber-200 border-amber-400/50',
      };
    }
    switch (connectionState) {
      case 'online':
        return {
          label: 'ONLINE • OPTIMAL',
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45',
        };
      case 'connecting':
        return {
          label: 'SYNCING',
          badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/45',
        };
      case 'key_missing':
        return {
          label: 'CLOUD KEY MISSING',
          badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/45',
        };
      default:
        return {
          label: 'OFFLINE',
          badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/45',
        };
    }
  })();

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.isCompleted), [tasks]);
  const alertLogs = useMemo(
    () => securityLogs.filter((l) => l.severity !== 'INFO').slice(0, 5),
    [securityLogs]
  );
  const notificationCount = pendingTasks.length + alertLogs.length;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ label: string; category: string; action: () => void }> = [];

    const quickRoutes: Array<{ label: string; screen: ScreenId }> = [
      { label: 'Home / AM Cosmic Cockpit', screen: 'dashboard' },
      { label: 'ULTRON Hologram AI', screen: 'ultron' },
      { label: 'AI Chat', screen: 'chat' },
      { label: 'Voice Assistant', screen: 'voice' },
      { label: 'YouTube & Browser', screen: 'media_control' },
      { label: 'Memory Vault', screen: 'memory' },
      { label: 'Tasks & Notes', screen: 'productivity' },
      { label: 'Multi-AI Brain', screen: 'brain_center' },
      { label: 'Research Studio', screen: 'research' },
      { label: 'Smart Automation', screen: 'automation' },
      { label: 'Agents & Workflows', screen: 'multi_agent' },
      { label: 'Usage & Insights', screen: 'insights' },
      { label: 'Plugins & Tools', screen: 'plugins' },
      { label: 'Security Audit', screen: 'security' },
      { label: 'Telemetry & CLI', screen: 'telemetry' },
      { label: 'Smart Home', screen: 'smart_home' },
      { label: 'Vision Scanner', screen: 'vision' },
      { label: 'Lyria Music Core', screen: 'music_studio' },
      { label: 'Settings & Local AI', screen: 'settings' },
    ];

    for (const r of quickRoutes) {
      if (r.label.toLowerCase().includes(q)) {
        results.push({ label: r.label, category: 'MODULE', action: () => onNavigate(r.screen) });
      }
    }
    for (const a of AGENT_LIST) {
      if (`${a.codename} ${a.designation}`.toLowerCase().includes(q)) {
        results.push({
          label: `${a.codename} — ${a.designation}`,
          category: 'AGENT',
          action: () => onNavigate('multi_agent'),
        });
      }
    }
    for (const t of tasks) {
      if (t.title.toLowerCase().includes(q)) {
        results.push({
          label: t.title,
          category: t.isCompleted ? 'DONE TASK' : 'TASK',
          action: () => onNavigate('productivity'),
        });
      }
    }
    for (const m of memories) {
      if (`${m.key} ${m.content}`.toLowerCase().includes(q)) {
        results.push({
          label: `${m.key}: ${m.content}`,
          category: 'MEMORY',
          action: () => onNavigate('memory'),
        });
      }
    }
    for (const s of sessions) {
      if (s.title.toLowerCase().includes(q)) {
        results.push({
          label: s.title,
          category: 'SESSION',
          action: () => {
            onSelectSession?.(s.id);
            onNavigate('chat');
          },
        });
      }
    }
    return results.slice(0, 8);
  }, [searchQuery, tasks, memories, sessions, onNavigate, onSelectSession]);

  const dateStr = now.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const layoutLabel =
    layoutMode === 'command' ? 'COSMIC' : layoutMode === 'compact' ? 'COMPACT' : 'FOCUS';

  return (
    <header className="sticky top-0 z-30 border-b border-cyan-500/20 bg-[#02050B]/94 backdrop-blur-md px-3 sm:px-5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Mobile Drawer Trigger + Offline/Engine Status + Date/Time */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="lg:hidden min-h-[40px] min-w-[40px] p-2 rounded-lg border border-cyan-500/30 bg-[#071326] text-cyan-300 hover:border-cyan-400 cursor-pointer flex items-center justify-center"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            data-testid="header-connection-pill"
            onClick={onRetryConnection}
            title="Click to re-verify backend and network status"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono-hud text-[10px] font-bold tracking-wider cursor-pointer transition-opacity hover:opacity-90 ${systemStatusMeta.badgeClass}`}
          >
            {!telemetry.online || connectionState === 'offline' ? (
              <WifiOff className="w-3.5 h-3.5" />
            ) : connectionState === 'connecting' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{isOptimal ? 'AM AI: ONLINE' : systemStatusMeta.label}</span>
          </button>

          {/* Active Engine Attribution Pill */}
          <span
            data-testid="header-engine-pill"
            title="Current AI / Command Execution Engine"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#071326] border border-cyan-500/35 font-mono-hud text-[10px] font-semibold text-cyan-200"
          >
            <Cpu className="w-3 h-3 text-[#00E5FF]" />
            <span>{activeEngine}</span>
          </span>

          {pendingSyncCount > 0 && (
            <span
              data-testid="header-sync-pending-pill"
              className="hidden md:inline-flex items-center px-2 py-1 rounded-full bg-amber-500/15 border border-amber-400/45 font-mono-hud text-[9px] font-bold text-amber-200"
            >
              SYNC PENDING ({pendingSyncCount})
            </span>
          )}

          {classicMode && onToggleClassicMode && (
            <button
              type="button"
              data-testid="header-classic-badge"
              onClick={onToggleClassicMode}
              title="Classic Mode active — click to switch to AM AI Cosmic HUD"
              className="px-2 py-1 rounded-full bg-amber-500/15 border border-amber-400/50 font-mono-hud text-[9px] font-bold text-amber-200 cursor-pointer"
            >
              CLASSIC MODE • SWITCH
            </button>
          )}

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#071326] border border-slate-800 font-mono-hud text-[11px] text-cyan-200">
            <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>{dateStr}</span>
            <span className="text-slate-500">•</span>
            <span className="font-bold text-slate-100">{timeStr}</span>
          </div>

          <div className="hidden 2xl:block min-w-0 pl-1">
            <p className="font-display text-xs tracking-wider text-slate-200 truncate">{title}</p>
            <p className="font-mono-hud text-[10px] text-slate-400 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="relative flex-1 max-w-md min-w-[160px] order-last sm:order-none w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#040B17] border border-cyan-500/25 focus-within:border-[#00E5FF]/70 transition-colors">
            <Search className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search modules, tasks, memories, agents..."
              aria-label="Search Command Center"
              className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-[#040B17] border border-cyan-400/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] overflow-hidden z-50">
              {searchResults.map((res, idx) => (
                <button
                  key={`${res.category}-${idx}`}
                  type="button"
                  onClick={() => {
                    res.action();
                    setSearchQuery('');
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-cyan-400/10 border-b border-slate-800/60 last:border-none flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="text-xs text-slate-100 truncate">{res.label}</span>
                  <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 shrink-0">
                    {res.category}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {canInstallPwa && onInstallPwa && (
            <button
              type="button"
              data-testid="pwa-install-btn"
              onClick={onInstallPwa}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00E5FF]/15 border border-[#00E5FF]/55 font-mono-hud text-[10px] font-bold text-[#00E5FF] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>INSTALL APP</span>
            </button>
          )}

          {mediaPlayingTitle && (
            <button
              type="button"
              onClick={() => onNavigate('media_control')}
              title={`Open Media Control — ${mediaPlayingTitle}`}
              className="hidden md:flex items-center gap-1.5 max-w-[160px] px-2.5 py-1 rounded-lg bg-cyan-500/12 border border-cyan-400/40 hover:border-cyan-300 font-mono-hud text-[10px] text-cyan-200 cursor-pointer"
            >
              <MediaEqualizer
                isPlaying={isMediaPlaying}
                reducedMotion={reducedMotion}
                barCount={3}
                className="h-3"
              />
              <span className="truncate">{mediaPlayingTitle}</span>
            </button>
          )}

          {isWakeWordActive && (
            <span
              data-testid="header-wake-word-pill"
              title={`Wake-word active — say "${wakeWordLegacyJarvis ? 'Hey AM or Hey JARVIS' : 'Hey AM'}"`}
              className="hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/12 border border-emerald-400/45 font-mono-hud text-[9px] font-bold text-emerald-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span>{wakeWordLegacyJarvis ? 'HEY AM + JARVIS' : 'HEY AM'}</span>
            </span>
          )}

          {reactorState && reactorState !== 'STANDBY' && (
            <span className="hidden 2xl:inline-flex items-center px-2 py-1 rounded-lg bg-sky-500/12 border border-sky-400/40 font-mono-hud text-[9px] font-bold text-sky-200">
              {reactorState}
            </span>
          )}

          <button
            type="button"
            data-testid="header-ultron-btn"
            onClick={() => onNavigate('ultron')}
            title="Launch ULTRON Holographic AI Assistant"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/12 border border-amber-400/45 hover:border-amber-300 font-mono-hud text-[10px] font-bold text-amber-200 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>ULTRON</span>
          </button>

          <span
            data-testid="header-ai-state-pill"
            title={stateDetail}
            className={`hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border font-mono-hud text-[9px] font-bold tracking-wider ${
              aiState === 'speaking'
                ? 'bg-emerald-500/15 border-emerald-400/55 text-emerald-300'
                : aiState === 'listening'
                  ? 'bg-cyan-500/15 border-cyan-400/55 text-cyan-200'
                  : aiState === 'thinking'
                    ? 'bg-sky-500/15 border-sky-400/55 text-sky-200'
                    : 'bg-[#071326] border-slate-800 text-slate-300'
            }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: themePreset.primaryHex }}
            />
            <span>{stateLabel}</span>
          </span>

          <GlobalAudioVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            reducedMotion={reducedMotion}
            onStop={onStopAudio}
          />

          <button
            type="button"
            onClick={onToggleLayoutMode}
            title="Cycle Command Center Dashboard Layout"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-[#071326] hover:border-cyan-400/50 font-mono-hud text-[10px] text-cyan-200 cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>{layoutLabel}</span>
          </button>

          {onSelectHudThemePreset && (
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#071326] border border-slate-800 hover:border-cyan-400/50">
              <Palette className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
              <select
                data-testid="header-theme-preset-select"
                aria-label="Select HUD Theme Preset"
                value={hudThemePreset}
                onChange={(e) => onSelectHudThemePreset(e.target.value as HudThemePresetId)}
                className="bg-transparent font-mono-hud text-[10px] text-cyan-200 focus:outline-none cursor-pointer"
              >
                {HUD_THEME_PRESET_LIST.map((preset) => (
                  <option
                    key={preset.id}
                    value={preset.id}
                    className="bg-[#070D18] text-slate-100"
                  >
                    {preset.shortLabel}
                  </option>
                ))}
              </select>
            </div>
          )}

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch HUD theme (current: ${themeMode})`}
              title={`HUD Theme: ${resolvedTheme === 'light' ? 'Ceramic Cobalt Light' : 'Obsidian Cyan Dark'}`}
              className="p-2 rounded-lg bg-[#071326] border border-slate-800 hover:border-cyan-400/50 text-cyan-300 cursor-pointer"
            >
              {resolvedTheme === 'light' ? (
                <Moon className="w-4 h-4 text-sky-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-300" />
              )}
            </button>
          )}

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifs((v) => !v)}
              aria-label="Open notifications"
              className="relative p-2 rounded-lg bg-[#071326] border border-slate-800 hover:border-cyan-400/50 text-slate-200 cursor-pointer"
            >
              <Bell className="w-4 h-4 text-cyan-300" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#00E5FF] text-[#02050B] font-mono-hud text-[9px] font-bold flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#040B17] border border-cyan-400/45 shadow-[0_12px_36px_rgba(0,0,0,0.85)] p-3 space-y-2 z-50">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-mono-hud text-[11px] font-bold text-cyan-300">
                    SYSTEM NOTIFICATIONS ({notificationCount})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNotifs(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {notificationCount === 0 ? (
                  <p className="text-xs text-slate-400 py-2">All queues clear, Sir.</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {pendingTasks.slice(0, 4).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setShowNotifs(false);
                          onNavigate('productivity');
                        }}
                        className="w-full text-left p-2 rounded-lg bg-[#071326] hover:bg-cyan-500/10 border border-slate-800 cursor-pointer"
                      >
                        <p className="text-xs font-medium text-slate-100 truncate">{t.title}</p>
                        <p className="font-mono-hud text-[10px] text-amber-300">
                          {t.priority} • {t.dueTime}
                        </p>
                      </button>
                    ))}
                    {alertLogs.map((log) => (
                      <button
                        key={log.id}
                        type="button"
                        onClick={() => {
                          setShowNotifs(false);
                          onNavigate('security');
                        }}
                        className="w-full text-left p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 cursor-pointer"
                      >
                        <p className="text-xs text-rose-200 line-clamp-2">{log.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Language Selector */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#071326] border border-slate-800">
            <Globe className="w-3.5 h-3.5 text-[#00E5FF]" />
            <select
              aria-label="Select AM AI language"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
              className="bg-transparent font-mono-hud text-[10px] text-cyan-200 focus:outline-none cursor-pointer"
            >
              {Object.values(JARVIS_LANGUAGES).map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#070D18] text-slate-100">
                  {lang.shortCode}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            aria-label="Open System Settings"
            className="p-2 rounded-lg bg-[#071326] border border-slate-800 hover:border-cyan-400/50 text-cyan-300 cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            title="AM AI Operator Profile & Security"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#00E5FF]/15 to-[#2F8BFF]/12 border border-cyan-400/35 hover:border-cyan-300 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="hidden sm:inline font-mono-hud text-[10px] font-bold text-slate-100">
              AM
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

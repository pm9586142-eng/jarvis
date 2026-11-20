import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Clock,
  Globe,
  LayoutGrid,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { AGENT_LIST, JARVIS_LANGUAGES } from '../data/agents';
import {
  BrowserTelemetry,
  ChatSession,
  ConnectionState,
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
  resolvedTheme?: 'dark' | 'light';
  tasks?: TaskItem[];
  memories?: MemoryItem[];
  sessions?: ChatSession[];
  securityLogs?: SecurityLogItem[];
  onStopAudio?: () => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onToggleLayoutMode: () => void;
  onToggleTheme?: () => void;
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
  securityReport,
  language,
  reducedMotion,
  isListening,
  isSpeaking,
  audioLevel,
  layoutMode,
  themeMode = 'dark',
  resolvedTheme = 'dark',
  tasks = [],
  memories = [],
  sessions = [],
  securityLogs = [],
  onStopAudio,
  onLanguageChange,
  onToggleLayoutMode,
  onToggleTheme,
  onRetryConnection,
  onNavigate,
  onSelectSession,
  onOpenMenu,
  mediaPlayingTitle = null,
  isMediaPlaying = false,
  isWakeWordActive = false,
  reactorState,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isOptimal =
    connectionState === 'online' && (securityReport ? securityReport.defconLevel > 1 : true);

  const systemStatusMeta = (() => {
    if (securityReport?.defconLevel === 1) {
      return {
        label: 'SYSTEM STATUS: LOCKDOWN',
        badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/45',
      };
    }
    switch (connectionState) {
      case 'online':
        return {
          label: 'SYSTEM STATUS: OPTIMAL',
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45',
        };
      case 'connecting':
        return {
          label: 'SYSTEM STATUS: SYNCING',
          badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/45',
        };
      case 'key_missing':
        return {
          label: 'SYSTEM STATUS: KEY REQUIRED',
          badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/45',
        };
      default:
        return {
          label: 'SYSTEM STATUS: OFFLINE',
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
      { label: 'Command Center', screen: 'dashboard' },
      { label: 'Neural Chat / AI Core', screen: 'chat' },
      { label: 'Media & Web Control (YouTube, Music, Websites)', screen: 'media_control' },
      { label: 'Voice Matrix', screen: 'voice' },
      { label: 'Research Studio (Web Search, Docs, Reports)', screen: 'research' },
      { label: 'Smart Automation & Quick Commands', screen: 'automation' },
      { label: 'Agents & Workflows', screen: 'multi_agent' },
      { label: 'Tasks, Notes & Calendar', screen: 'productivity' },
      { label: 'Memory Vault', screen: 'memory' },
      { label: 'Usage & Insights', screen: 'insights' },
      { label: 'Tools & Skills (Plugins)', screen: 'plugins' },
      { label: 'Security Audit', screen: 'security' },
      { label: 'System Monitor & CLI', screen: 'telemetry' },
      { label: 'Smart Home', screen: 'smart_home' },
      { label: 'Vision Scanner', screen: 'vision' },
      { label: 'Lyria Music Core', screen: 'music_studio' },
      { label: 'Settings', screen: 'settings' },
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
    layoutMode === 'command' ? 'GRID' : layoutMode === 'compact' ? 'COMPACT' : 'FOCUS';

  return (
    <header className="sticky top-0 z-30 border-b border-cyan-500/20 bg-[#02040A]/92 backdrop-blur-md px-3 sm:px-5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Drawer Trigger + Status + Live Date/Time */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 rounded-lg border border-slate-800 bg-[#0D1527] text-cyan-300 hover:border-cyan-400 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onRetryConnection}
            title="Click to re-verify backend and Gemini connection"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono-hud text-[10px] sm:text-[11px] font-semibold tracking-wider cursor-pointer transition-opacity hover:opacity-90 ${systemStatusMeta.badgeClass}`}
          >
            {connectionState === 'offline' ? (
              <WifiOff className="w-3.5 h-3.5" />
            ) : connectionState === 'connecting' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{isOptimal ? 'SYSTEM STATUS: OPTIMAL' : systemStatusMeta.label}</span>
          </button>

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#091122] border border-slate-800 font-mono-hud text-[11px] text-cyan-200">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{dateStr}</span>
            <span className="text-slate-500">•</span>
            <span className="font-bold text-slate-100">{timeStr}</span>
          </div>

          <div className="hidden 2xl:block min-w-0 pl-1">
            <p className="font-display text-xs tracking-wider text-slate-200 truncate">{title}</p>
            <p className="font-mono-hud text-[10px] text-slate-400 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Center: Interactive Command Center Search Bar */}
        <div className="relative flex-1 max-w-md min-w-[160px] order-last sm:order-none w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#070E1D] border border-slate-800 focus-within:border-cyan-400/60 transition-colors">
            <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
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
            <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-[#060C18] border border-cyan-400/35 shadow-[0_12px_36px_rgba(0,0,0,0.7)] overflow-hidden z-50">
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

        {/* Right Controls: Visualizer, Clock(md), Layout, Notifications, Language, Settings, Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {mediaPlayingTitle && (
            <button
              type="button"
              onClick={() => onNavigate('media_control')}
              title={`Open Media Control — ${mediaPlayingTitle}`}
              className="hidden md:flex items-center gap-1.5 max-w-[170px] px-2.5 py-1 rounded-lg bg-cyan-500/12 border border-cyan-400/40 hover:border-cyan-300 font-mono-hud text-[10px] text-cyan-200 cursor-pointer"
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
              title='Wake-word monitoring active — say "Hey JARVIS"'
              className="hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/12 border border-emerald-400/45 font-mono-hud text-[9px] font-bold text-emerald-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span>HEY JARVIS</span>
            </span>
          )}

          {reactorState && reactorState !== 'STANDBY' && (
            <span className="hidden 2xl:inline-flex items-center px-2 py-1 rounded-lg bg-sky-500/12 border border-sky-400/40 font-mono-hud text-[9px] font-bold text-sky-200">
              {reactorState}
            </span>
          )}

          <GlobalAudioVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            reducedMotion={reducedMotion}
            onStop={onStopAudio}
          />

          <div className="hidden md:flex xl:hidden items-center gap-1 px-2 py-1 rounded-lg bg-[#091122] border border-slate-800 font-mono-hud text-[10px] text-slate-200">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>{timeStr}</span>
          </div>

          <button
            type="button"
            onClick={onToggleLayoutMode}
            title="Cycle Command Center Dashboard Layout"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-[#0B1325] hover:border-cyan-400/50 font-mono-hud text-[10px] text-cyan-200 cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
            <span>{layoutLabel}</span>
          </button>

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch HUD theme (current: ${themeMode})`}
              title={`HUD Theme: ${resolvedTheme === 'light' ? 'Ceramic Cobalt Light' : 'Obsidian Cyan Dark'} (${themeMode}) — Click to switch`}
              className="p-2 rounded-lg bg-[#0B1325] border border-slate-800 hover:border-cyan-400/50 text-cyan-300 cursor-pointer"
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
              className="relative p-2 rounded-lg bg-[#0B1325] border border-slate-800 hover:border-cyan-400/50 text-slate-200 cursor-pointer"
            >
              <Bell className="w-4 h-4 text-cyan-300" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-cyan-400 text-[#02040A] font-mono-hud text-[9px] font-bold flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#060C18] border border-cyan-400/40 shadow-[0_12px_36px_rgba(0,0,0,0.75)] p-3 space-y-2 z-50">
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
                        className="w-full text-left p-2 rounded-lg bg-[#0D1527] hover:bg-cyan-500/10 border border-slate-800 cursor-pointer"
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
          <div className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#0B1325] border border-slate-800">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <select
              aria-label="Select JARVIS language"
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

          {/* Settings */}
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            aria-label="Open System Settings"
            className="p-2 rounded-lg bg-[#0B1325] border border-slate-800 hover:border-cyan-400/50 text-cyan-300 cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Operator Profile */}
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            title="Operator Profile & Security"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/15 to-sky-500/10 border border-cyan-400/35 hover:border-cyan-300 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden sm:inline font-mono-hud text-[10px] font-bold text-slate-100">
              SIR
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

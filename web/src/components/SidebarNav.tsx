import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  Camera,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  Gamepad2,
  Home,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Mic,
  Music2,
  Settings,
  ShieldAlert,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
import { ScreenId } from '../types/jarvis';

export type NavCommandAction =
  | { id: 'command_center'; screen: 'dashboard' }
  | { id: 'ai_core'; screen: 'chat' }
  | { id: 'agents'; screen: 'multi_agent' }
  | { id: 'tasks'; screen: 'productivity'; productivityFilter: 'PENDING' }
  | { id: 'calendar'; screen: 'productivity'; productivityFilter: 'ALL' }
  | { id: 'memory'; screen: 'memory' }
  | { id: 'conversations'; screen: 'chat'; openSessionsDrawer: true }
  | { id: 'knowledge_base'; screen: 'insights' }
  | { id: 'tools_skills'; screen: 'plugins' }
  | { id: 'workflows'; screen: 'multi_agent' };

interface PrimaryNavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: NavCommandAction;
  matchesScreen: ScreenId;
}

const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  {
    key: 'command_center',
    label: 'Command Center',
    icon: LayoutDashboard,
    action: { id: 'command_center', screen: 'dashboard' },
    matchesScreen: 'dashboard',
  },
  {
    key: 'ai_core',
    label: 'AI Core',
    icon: Cpu,
    action: { id: 'ai_core', screen: 'chat' },
    matchesScreen: 'chat',
  },
  {
    key: 'agents',
    label: 'Agents',
    icon: Bot,
    action: { id: 'agents', screen: 'multi_agent' },
    matchesScreen: 'multi_agent',
  },
  {
    key: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    action: { id: 'tasks', screen: 'productivity', productivityFilter: 'PENDING' },
    matchesScreen: 'productivity',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    action: { id: 'calendar', screen: 'productivity', productivityFilter: 'ALL' },
    matchesScreen: 'productivity',
  },
  {
    key: 'memory',
    label: 'Memory',
    icon: Database,
    action: { id: 'memory', screen: 'memory' },
    matchesScreen: 'memory',
  },
  {
    key: 'conversations',
    label: 'Conversations',
    icon: MessagesSquare,
    action: { id: 'conversations', screen: 'chat', openSessionsDrawer: true },
    matchesScreen: 'chat',
  },
  {
    key: 'knowledge_base',
    label: 'Knowledge Base',
    icon: BookOpen,
    action: { id: 'knowledge_base', screen: 'insights' },
    matchesScreen: 'insights',
  },
  {
    key: 'tools_skills',
    label: 'Tools & Skills',
    icon: Wrench,
    action: { id: 'tools_skills', screen: 'plugins' },
    matchesScreen: 'plugins',
  },
  {
    key: 'workflows',
    label: 'Workflows',
    icon: Workflow,
    action: { id: 'workflows', screen: 'multi_agent' },
    matchesScreen: 'multi_agent',
  },
];

interface SecondaryNavItem {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SUBSYSTEM_ITEMS: SecondaryNavItem[] = [
  { id: 'voice', label: 'Voice Matrix', icon: Mic },
  { id: 'insights', label: 'Usage & Insights', icon: BarChart3 },
  { id: 'security', label: 'Security Audit', icon: ShieldAlert },
  { id: 'telemetry', label: 'System Monitor & CLI', icon: Activity },
  { id: 'smart_home', label: 'Smart Home', icon: Home },
  { id: 'vision', label: 'Vision Scanner', icon: Camera },
  { id: 'music_studio', label: 'Lyria Music Core', icon: Music2 },
  { id: 'orbital_game', label: 'Orbital Aegis 3D', icon: Gamepad2 },
  { id: 'settings', label: 'System Settings', icon: Settings },
];

interface SidebarNavProps {
  activeScreen: ScreenId;
  activeNavKey?: string;
  isOpenMobile: boolean;
  onSelect: (screen: ScreenId, action?: NavCommandAction, navKey?: string) => void;
  onCloseMobile: () => void;
  onLockScreen: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeScreen,
  activeNavKey,
  isOpenMobile,
  onSelect,
  onCloseMobile,
  onLockScreen,
}) => {
  const [subsystemsOpen, setSubsystemsOpen] = useState(true);

  const navContent = (
    <div className="h-full flex flex-col bg-[#030712]/95 border-r border-cyan-500/20 w-64 shadow-[4px_0_30px_rgba(0,240,255,0.06)]">
      {/* Top Brand Logo + Command Center Title */}
      <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-gradient-to-r from-cyan-500/10 via-transparent to-transparent">
        <button
          type="button"
          onClick={() => {
            onSelect('dashboard', { id: 'command_center', screen: 'dashboard' }, 'command_center');
            onCloseMobile();
          }}
          className="flex items-center gap-3 text-left cursor-pointer group"
        >
          <div className="relative w-10 h-10 rounded-full border border-cyan-400/60 bg-cyan-500/10 flex items-center justify-center shadow-[0_0_16px_rgba(0,240,255,0.35)]">
            <div className="w-6 h-6 rounded-full border-2 border-cyan-300/80 border-t-transparent animate-spin" />
            <div className="absolute w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#00F0FF]" />
          </div>
          <div>
            <span className="font-display text-sm font-bold tracking-[0.22em] text-slate-100 group-hover:text-cyan-300 transition-colors">
              J·A·R·V·I·S
            </span>
            <p className="font-mono-hud text-[9px] text-cyan-400 tracking-[0.18em] mt-0.5">
              COMMAND CENTER
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="px-3 py-1 font-mono-hud text-[10px] tracking-[0.18em] text-slate-500">
          CORE MODULES
        </p>
        {PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeNavKey
            ? activeNavKey === item.key
            : activeScreen === item.matchesScreen &&
              item.key !== 'conversations' &&
              item.key !== 'calendar' &&
              item.key !== 'workflows';
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onSelect(item.action.screen, item.action, item.key);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all cursor-pointer ${
                active
                  ? 'bg-cyan-400/15 text-cyan-200 border border-cyan-400/45 shadow-[0_0_16px_rgba(0,240,255,0.16)]'
                  : 'text-slate-300 hover:text-cyan-200 hover:bg-slate-800/45 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-300' : 'text-slate-400'}`} />
              <span className="font-medium truncate">{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#00F0FF]" />
              )}
            </button>
          );
        })}

        {/* Preserved Subsystems */}
        <div className="pt-3 mt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setSubsystemsOpen((v) => !v)}
            className="w-full px-3 py-1.5 flex items-center justify-between font-mono-hud text-[10px] tracking-[0.16em] text-slate-400 hover:text-cyan-300 cursor-pointer"
          >
            <span>SUBSYSTEMS</span>
            {subsystemsOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
          {subsystemsOpen && (
            <div className="space-y-1 mt-1">
              {SUBSYSTEM_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeScreen === item.id && !PRIMARY_NAV_ITEMS.some((p) => p.key === activeNavKey && p.matchesScreen === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id, undefined, item.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                      active
                        ? 'bg-sky-400/15 text-cyan-200 border border-cyan-400/35'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-cyan-300' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom Gate Button */}
      <div className="p-3 border-t border-cyan-500/20 space-y-2">
        <button
          type="button"
          onClick={() => {
            onSelect('chat', { id: 'ai_core', screen: 'chat' }, 'ai_core');
            onCloseMobile();
          }}
          className="w-full py-2 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/35 text-xs font-mono-hud text-cyan-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>OPEN NEURAL CHAT</span>
        </button>
        <button
          type="button"
          onClick={onLockScreen}
          className="w-full py-2 px-3 rounded-lg border border-slate-700 hover:border-cyan-500/40 bg-[#0D1527] text-[11px] font-mono-hud text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
        >
          BIOMETRIC LOCK GATE
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{navContent}</aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
};

import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  Camera,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  Database,
  Gamepad2,
  Globe,
  Home,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Music2,
  Settings,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Wrench,
  X,
  Youtube,
  Zap,
} from 'lucide-react';
import { ScreenId } from '../types/jarvis';
import { AMReactor } from './AMReactor';

export type NavCommandAction =
  | { id: 'home'; screen: 'dashboard' }
  | { id: 'ai_chat'; screen: 'chat' }
  | { id: 'voice_assistant'; screen: 'voice' }
  | { id: 'youtube'; screen: 'media_control'; section: 'youtube' }
  | { id: 'browser'; screen: 'media_control'; section: 'browser' }
  | { id: 'memory_vault'; screen: 'memory' }
  | { id: 'tasks'; screen: 'productivity'; productivityFilter: 'PENDING'; productivityTab: 'tasks' }
  | { id: 'notes'; screen: 'productivity'; productivityFilter: 'ALL'; productivityTab: 'notes' }
  | { id: 'settings'; screen: 'settings' }
  | { id: string; screen: ScreenId; openSessionsDrawer?: boolean };

interface CoreNavItem {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  action: NavCommandAction;
}

/**
 * Confirmed 9 Core Navigation Items:
 * Home, AI Chat, Voice Assistant, YouTube, Browser, Memory Vault, Tasks, Notes, Settings
 */
const CORE_NAV_ITEMS: CoreNavItem[] = [
  {
    key: 'home',
    label: 'Home',
    shortLabel: 'Home',
    icon: LayoutDashboard,
    action: { id: 'home', screen: 'dashboard' },
  },
  {
    key: 'ai_chat',
    label: 'AI Chat',
    shortLabel: 'Chat',
    icon: MessageSquare,
    action: { id: 'ai_chat', screen: 'chat' },
  },
  {
    key: 'voice_assistant',
    label: 'Voice Assistant',
    shortLabel: 'Voice',
    icon: Mic,
    action: { id: 'voice_assistant', screen: 'voice' },
  },
  {
    key: 'youtube',
    label: 'YouTube',
    shortLabel: 'YouTube',
    icon: Youtube,
    action: { id: 'youtube', screen: 'media_control', section: 'youtube' },
  },
  {
    key: 'browser',
    label: 'Browser',
    shortLabel: 'Browser',
    icon: Globe,
    action: { id: 'browser', screen: 'media_control', section: 'browser' },
  },
  {
    key: 'memory_vault',
    label: 'Memory Vault',
    shortLabel: 'Memory',
    icon: Database,
    action: { id: 'memory_vault', screen: 'memory' },
  },
  {
    key: 'tasks',
    label: 'Tasks',
    shortLabel: 'Tasks',
    icon: CheckSquare,
    action: { id: 'tasks', screen: 'productivity', productivityFilter: 'PENDING', productivityTab: 'tasks' },
  },
  {
    key: 'notes',
    label: 'Notes',
    shortLabel: 'Notes',
    icon: StickyNote,
    action: { id: 'notes', screen: 'productivity', productivityFilter: 'ALL', productivityTab: 'notes' },
  },
  {
    key: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    icon: Settings,
    action: { id: 'settings', screen: 'settings' },
  },
];

interface SubsystemNavItem {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SUBSYSTEM_ITEMS: SubsystemNavItem[] = [
  { id: 'openjarvis', label: 'OpenJarvis Core', icon: Cpu },
  { id: 'ultron', label: 'ULTRON Hologram AI', icon: Sparkles },
  { id: 'brain_center', label: 'Multi-AI Brain', icon: Brain },
  { id: 'multi_agent', label: 'Agents & Workflows', icon: Bot },
  { id: 'research', label: 'Research Studio', icon: Compass },
  { id: 'automation', label: 'Smart Automation', icon: Zap },
  { id: 'security', label: 'Security Audit', icon: ShieldAlert },
  { id: 'telemetry', label: 'Telemetry & CLI', icon: Activity },
  { id: 'plugins', label: 'Plugins & Tools', icon: Wrench },
  { id: 'insights', label: 'Usage & Insights', icon: BarChart3 },
  { id: 'smart_home', label: 'Smart Home', icon: Home },
  { id: 'vision', label: 'Vision Scanner', icon: Camera },
  { id: 'music_studio', label: 'Lyria Music Core', icon: Music2 },
  { id: 'orbital_game', label: 'Orbital Aegis 3D', icon: Gamepad2 },
];

interface SidebarNavProps {
  activeScreen: ScreenId;
  activeNavKey?: string;
  isOpenMobile: boolean;
  reducedMotion?: boolean;
  onSelect: (screen: ScreenId, action?: NavCommandAction, navKey?: string) => void;
  onCloseMobile: () => void;
  onLockScreen: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeScreen,
  activeNavKey,
  isOpenMobile,
  reducedMotion = false,
  onSelect,
  onCloseMobile,
  onLockScreen,
}) => {
  const [subsystemsOpen, setSubsystemsOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const isCoreActive = (item: CoreNavItem) => {
    if (activeNavKey) {
      if (activeNavKey === item.key) return true;
      if (item.key === 'home' && activeNavKey === 'command_center') return true;
      if (item.key === 'ai_chat' && activeNavKey === 'ai_core') return true;
      if (item.key === 'voice_assistant' && activeNavKey === 'voice') return true;
      if (item.key === 'memory_vault' && activeNavKey === 'memory') return true;
      return false;
    }
    return activeScreen === item.action.screen && item.key !== 'browser' && item.key !== 'notes';
  };

  const renderSidebarBody = (collapsed: boolean) => (
    <div
      className={`h-full flex flex-col bg-[#02050B]/96 border-r border-cyan-500/25 shadow-[4px_0_28px_rgba(0,229,255,0.08)] transition-all duration-200 ${
        collapsed ? 'w-[74px]' : 'w-60'
      }`}
    >
      {/* Top Brand Logo + Miniature AM Reactor */}
      <div className="px-3 py-3 border-b border-cyan-500/20 flex items-center justify-between gap-2 bg-gradient-to-r from-[#00E5FF]/10 via-transparent to-transparent">
        <button
          type="button"
          onClick={() => {
            onSelect('dashboard', { id: 'home', screen: 'dashboard' }, 'home');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left cursor-pointer group min-w-0"
          title="AM AI – Cosmic Intelligence Command Center"
        >
          <AMReactor size="xs" reducedMotion={reducedMotion} interactive={false} />
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-display text-sm font-black tracking-[0.2em] text-slate-100 group-hover:text-[#00E5FF] transition-colors">
                AM <span className="text-[#00E5FF]">AI</span>
              </span>
              <p className="font-mono-hud text-[9px] text-cyan-300/85 tracking-[0.16em] truncate">
                COSMIC INTEL
              </p>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setDesktopCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand Navigation' : 'Compact Rail Mode'}
          className="hidden lg:inline-flex items-center justify-center w-7 h-7 rounded-lg border border-cyan-500/25 bg-[#071326] text-cyan-300 hover:border-cyan-400 cursor-pointer shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
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

      {/* 9 Core Navigation Items + Collapsible Subsystems Drawer */}
      <nav aria-label="Primary AM AI navigation" className="flex-1 overflow-y-auto p-2.5 space-y-1">
        {!collapsed && (
          <p className="px-2.5 py-1 font-mono-hud text-[9px] tracking-[0.2em] text-slate-500 uppercase">
            CORE COMMANDS (9)
          </p>
        )}

        {CORE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isCoreActive(item);
          return (
            <button
              key={item.key}
              type="button"
              data-testid={`nav-core-${item.key}`}
              onClick={() => {
                onSelect(item.action.screen, item.action, item.key);
                onCloseMobile();
              }}
              title={item.label}
              className={`w-full min-h-[44px] flex items-center ${
                collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
              } py-2 rounded-xl text-[13px] transition-all cursor-pointer ${
                active
                  ? 'bg-[#00E5FF]/15 text-cyan-100 border border-[#00E5FF]/55 shadow-[0_0_16px_rgba(0,229,255,0.18)]'
                  : 'text-slate-300 hover:text-cyan-200 hover:bg-[#071326]/90 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#00E5FF]' : 'text-slate-400'}`} />
              {!collapsed && <span className="font-medium truncate">{item.label}</span>}
              {!collapsed && active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
              )}
            </button>
          );
        })}

        {/* Collapsible Subsystems Drawer */}
        <div className="pt-2.5 mt-2 border-t border-cyan-500/15">
          <button
            type="button"
            data-testid="nav-subsystems-toggle"
            onClick={() => setSubsystemsOpen((v) => !v)}
            className={`w-full min-h-[40px] ${
              collapsed ? 'justify-center px-1' : 'justify-between px-2.5'
            } py-1.5 flex items-center font-mono-hud text-[10px] tracking-[0.16em] text-cyan-300/85 hover:text-[#00E5FF] cursor-pointer`}
            title="Toggle Subsystems Drawer"
          >
            {collapsed ? (
              <Brain className="w-4 h-4" />
            ) : (
              <>
                <span>SUBSYSTEMS ({SUBSYSTEM_ITEMS.length})</span>
                {subsystemsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </>
            )}
          </button>

          {subsystemsOpen && (
            <div className="space-y-1 mt-1">
              {SUBSYSTEM_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`nav-sub-${item.id}`}
                    onClick={() => {
                      onSelect(item.id, undefined, item.id);
                      onCloseMobile();
                    }}
                    title={item.label}
                    className={`w-full min-h-[38px] flex items-center ${
                      collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                    } py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                      active
                        ? 'bg-[#2F8BFF]/20 text-cyan-100 border border-[#2F8BFF]/45'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-[#071326]/70 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#00E5FF]' : 'text-slate-400'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom Gate Actions */}
      <div className="p-2.5 border-t border-cyan-500/20 space-y-1.5">
        <button
          type="button"
          data-testid="nav-quick-openjarvis"
          onClick={() => {
            onSelect('openjarvis', undefined, 'openjarvis');
            onCloseMobile();
          }}
          title="Open OpenJarvis Core (10 Assistants, Hybrid RAG, Engines & Learning)"
          className={`w-full min-h-[40px] py-2 px-2.5 rounded-lg border text-xs font-mono-hud flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeScreen === 'openjarvis'
              ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-100'
              : 'bg-[#071326] hover:bg-emerald-500/12 border-emerald-500/35 text-emerald-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          {!collapsed && <span>OPENJARVIS CORE</span>}
        </button>

        <button
          type="button"
          data-testid="nav-quick-ultron"
          onClick={() => {
            onSelect('ultron', undefined, 'ultron');
            onCloseMobile();
          }}
          title="Open ULTRON 3D Holographic AI"
          className={`w-full min-h-[40px] py-2 px-2.5 rounded-lg border text-xs font-mono-hud flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeScreen === 'ultron'
              ? 'bg-amber-500/20 border-amber-400/70 text-amber-100'
              : 'bg-[#071326] hover:bg-amber-500/12 border-amber-500/35 text-amber-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          {!collapsed && <span>ULTRON 3D AI</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            onSelect('chat', { id: 'ai_chat', screen: 'chat' }, 'ai_chat');
            onCloseMobile();
          }}
          title="Open AI Chat"
          className="w-full min-h-[40px] py-2 px-2.5 rounded-lg bg-[#00E5FF]/12 hover:bg-[#00E5FF]/22 border border-[#00E5FF]/40 text-xs font-mono-hud text-cyan-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && <span>NEURAL CHAT</span>}
        </button>

        <button
          type="button"
          onClick={onLockScreen}
          title="Lock & Opening Gate"
          className="w-full min-h-[40px] py-2 px-2.5 rounded-lg border border-slate-700 hover:border-cyan-500/45 bg-[#071326] text-[10px] font-mono-hud text-slate-300 hover:text-cyan-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {collapsed ? <LayoutDashboard className="w-3.5 h-3.5" /> : <span>LOCK GATE</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 z-20">
        {renderSidebarBody(desktopCollapsed)}
      </aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{renderSidebarBody(false)}</div>
        </div>
      )}

      {/* Mobile Sticky Quick Nav Bar (48dp compliant touch targets) */}
      <nav
        aria-label="Mobile quick dock"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#02050B]/95 border-t border-cyan-500/30 backdrop-blur-md px-1 py-1 flex items-center justify-around"
      >
        {[
          CORE_NAV_ITEMS[0],
          CORE_NAV_ITEMS[1],
          CORE_NAV_ITEMS[2],
          CORE_NAV_ITEMS[3],
          CORE_NAV_ITEMS[6],
        ].map((item) => {
          const Icon = item.icon;
          const active = isCoreActive(item);
          return (
            <button
              key={`mob-${item.key}`}
              type="button"
              onClick={() => onSelect(item.action.screen, item.action, item.key)}
              className={`min-h-[48px] min-w-[56px] px-2 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                active ? 'text-[#00E5FF] bg-[#00E5FF]/12' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-mono-hud text-[9px] font-bold">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

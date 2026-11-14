import React from 'react';
import {
  Activity,
  Bot,
  CalendarCheck,
  Camera,
  Database,
  Home,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Puzzle,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react';
import { ScreenId } from '../types/jarvis';

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
  { id: 'chat', label: 'Neural Chat', icon: MessageSquare },
  { id: 'voice', label: 'Voice Matrix', icon: Mic },
  { id: 'multi_agent', label: 'Multi-Agent Hub', icon: Bot },
  { id: 'security', label: 'Security Audit', icon: ShieldAlert },
  { id: 'telemetry', label: 'Telemetry & CLI', icon: Activity },
  { id: 'plugins', label: 'Plugin Matrix', icon: Puzzle },
  { id: 'memory', label: 'Memory Vault', icon: Database },
  { id: 'productivity', label: 'Executive Planner', icon: CalendarCheck },
  { id: 'smart_home', label: 'Smart Home', icon: Home },
  { id: 'vision', label: 'Vision Scanner', icon: Camera },
  { id: 'settings', label: 'System Settings', icon: Settings },
];

interface SidebarNavProps {
  activeScreen: ScreenId;
  isOpenMobile: boolean;
  onSelect: (screen: ScreenId) => void;
  onCloseMobile: () => void;
  onLockScreen: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeScreen,
  isOpenMobile,
  onSelect,
  onCloseMobile,
  onLockScreen,
}) => {
  const navContent = (
    <div className="h-full flex flex-col bg-[#040812] border-r border-slate-800/90 w-64">
      <div className="p-4 border-b border-slate-800/90 flex items-center justify-between">
        <div>
          <span className="font-display text-base font-semibold tracking-[0.2em] text-slate-100">
            J·A·R·V·I·S
          </span>
          <p className="font-mono-hud text-[10px] text-cyan-400 tracking-wider mt-0.5">
            COSMIC OS v2050
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                active
                  ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/40 shadow-[0_0_16px_rgba(0,240,255,0.12)]'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-cyan-300' : 'text-slate-400'}`} />
              <span className="font-medium truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800/90">
        <button
          type="button"
          onClick={onLockScreen}
          className="w-full py-2 px-3 rounded-lg border border-slate-700 hover:border-cyan-500/40 bg-[#0D1527] text-xs font-mono-hud text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
        >
          RETURN TO BIOMETRIC GATE
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{navContent}</aside>

      {/* Mobile slide-over drawer */}
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

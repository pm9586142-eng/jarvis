import React from 'react';
import {
  Activity,
  Bot,
  CalendarCheck,
  Camera,
  Database,
  Gamepad2,
  Home,
  MessageSquare,
  Mic,
  Music2,
  Puzzle,
  Shield,
  Terminal,
} from 'lucide-react';
import { AGENT_LIST } from '../data/agents';
import {
  AgentId,
  BrowserTelemetry,
  ConnectionState,
  ScreenId,
  SecurityReport,
} from '../types/jarvis';
import { QuantumCoreCanvas } from '../components/QuantumCoreCanvas';

interface DashboardViewProps {
  telemetry: BrowserTelemetry;
  securityReport: SecurityReport;
  connectionState: ConnectionState;
  isListening: boolean;
  audioLevel: number;
  reducedMotion: boolean;
  onNavigate: (screen: ScreenId) => void;
  onSelectAgentAndChat: (agentId: AgentId) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  telemetry,
  securityReport,
  connectionState,
  isListening,
  audioLevel,
  reducedMotion,
  onNavigate,
  onSelectAgentAndChat,
}) => {
  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? 'Good morning, Sir.'
      : hour >= 12 && hour < 17
        ? 'Good afternoon, Sir.'
        : 'Good evening, Sir.';

  const modules: Array<{
    id: ScreenId;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }> = [
    { id: 'chat', title: 'Neural Chat', desc: 'Gemini 2.5 real-time streaming', icon: MessageSquare, accent: 'text-cyan-300' },
    { id: 'voice', title: 'Voice Matrix', desc: 'Web Speech STT & TTS HUD', icon: Mic, accent: 'text-violet-300' },
    { id: 'multi_agent', title: 'Multi-Agent Hub', desc: 'Specialized agent delegation', icon: Bot, accent: 'text-amber-300' },
    { id: 'security', title: 'Security Audit', desc: 'DEFCON & vulnerability scan', icon: Shield, accent: 'text-emerald-300' },
    { id: 'telemetry', title: 'Telemetry & CLI', desc: 'Browser metrics & Stark CLI', icon: Terminal, accent: 'text-sky-300' },
    { id: 'plugins', title: 'Plugin Matrix', desc: 'Trello Kanban & extensions', icon: Puzzle, accent: 'text-violet-300' },
    { id: 'memory', title: 'Memory Vault', desc: 'Persistent long-term knowledge', icon: Database, accent: 'text-cyan-300' },
    { id: 'productivity', title: 'Executive Planner', desc: 'Tasks, schedules & briefings', icon: CalendarCheck, accent: 'text-amber-300' },
    { id: 'smart_home', title: 'Stark Smart Home', desc: 'Environment bridge & scenes', icon: Home, accent: 'text-emerald-300' },
    { id: 'vision', title: 'Vision Scanner', desc: 'Live webcam & Gemini Vision', icon: Camera, accent: 'text-sky-300' },
    { id: 'orbital_game', title: 'Orbital Aegis 3D', desc: 'Three.js 3D space combat arena', icon: Gamepad2, accent: 'text-cyan-300' },
    { id: 'music_studio', title: 'Lyria Music Core', desc: 'Lyria 3 AI clip & track composer', icon: Music2, accent: 'text-violet-300' },
  ];

  return (
    <div className="space-y-6">
      {/* Quantum Intelligence Core Hero Panel */}
      <div className="glass-panel-glow rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-6 space-y-3">
            <p className="font-mono-hud text-xs text-violet-300 italic">
              Beyond the stars, intelligence awakens.
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-slate-100">
              {greeting}
            </h1>
            <p className="font-mono-hud text-xs text-cyan-300">
              {connectionState === 'online'
                ? 'Gemini Neural Link Active. All systems operational.'
                : connectionState === 'key_missing'
                  ? 'Backend Online — Set GEMINI_API_KEY on server to unlock live Gemini responses.'
                  : connectionState === 'connecting'
                    ? 'Connecting to JARVIS backend server...'
                    : 'Backend unreachable. Offline local tools & memory remain available.'}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('chat')}
                className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>OPEN NEURAL CHAT</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('voice')}
                className={`px-4 py-2.5 rounded-xl border font-display text-xs font-semibold tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
                  isListening
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                    : 'bg-[#0D1527] border-cyan-400/50 text-cyan-200 hover:border-cyan-300'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>{isListening ? 'LISTENING...' : 'ACTIVATE VOICE MATRIX'}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('orbital_game')}
                className="px-4 py-2.5 rounded-xl bg-[#0D1527] border border-violet-400/50 hover:border-cyan-400 text-violet-200 hover:text-cyan-200 font-display text-xs font-semibold tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>PLAY ORBITAL AEGIS 3D</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-6 h-[240px] sm:h-[260px]">
            <QuantumCoreCanvas audioPulse={audioLevel} nodeCount={52} reducedMotion={reducedMotion} />
          </div>
        </div>
      </div>

      {/* Real Browser Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-3.5">
          <p className="font-mono-hud text-[10px] text-slate-400">CONNECTION</p>
          <p className={`font-mono-hud text-base font-bold mt-1 ${telemetry.online ? 'text-emerald-400' : 'text-rose-400'}`}>
            {telemetry.online ? 'ONLINE' : 'OFFLINE'}
          </p>
          <p className="text-[11px] text-slate-300 truncate">{telemetry.networkType}</p>
        </div>

        <div className="glass-panel rounded-xl p-3.5">
          <p className="font-mono-hud text-[10px] text-slate-400">BATTERY API</p>
          <p className="font-mono-hud text-base font-bold text-cyan-300 mt-1">
            {telemetry.batteryPercent !== null ? `${telemetry.batteryPercent}%` : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-300 truncate">
            {telemetry.batteryPercent !== null ? (telemetry.isCharging ? 'Charging' : 'On Battery') : 'Desktop / Restricted'}
          </p>
        </div>

        <div className="glass-panel rounded-xl p-3.5">
          <p className="font-mono-hud text-[10px] text-slate-400">JS HEAP / CORES</p>
          <p className="font-mono-hud text-base font-bold text-amber-300 mt-1">
            {telemetry.heapUsedMb !== null ? `${telemetry.heapUsedMb} MB` : `${telemetry.cpuCores} CORES`}
          </p>
          <p className="text-[11px] text-slate-300 truncate">
            {telemetry.deviceMemoryGb !== null ? `${telemetry.deviceMemoryGb} GB Device RAM` : telemetry.platform}
          </p>
        </div>

        <div className="glass-panel rounded-xl p-3.5">
          <p className="font-mono-hud text-[10px] text-slate-400">VIEWPORT</p>
          <p className="font-mono-hud text-base font-bold text-sky-300 mt-1">{telemetry.viewport}</p>
          <p className="text-[11px] text-slate-300 truncate">Uptime: {telemetry.uptimeMinutes}m</p>
        </div>
      </div>

      {/* Stark Defense Matrix Strip */}
      <button
        type="button"
        onClick={() => onNavigate('security')}
        className={`w-full text-left glass-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors hover:border-cyan-400/50 ${
          securityReport.defconLevel === 1 ? 'border-rose-500/60' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              securityReport.defconLevel === 1 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">STARK DEFENSE MATRIX</p>
            <p
              className={`font-mono-hud text-xs ${
                securityReport.defconLevel === 1 ? 'text-rose-400' : 'text-cyan-300'
              }`}
            >
              {securityReport.threatStatus}
            </p>
          </div>
        </div>
        <span className="font-mono-hud text-xs font-bold text-emerald-400">
          SCORE: {securityReport.score}/100
        </span>
      </button>

      {/* Specialized Neural Agents */}
      <div>
        <h3 className="font-mono-hud text-xs font-semibold text-slate-400 tracking-widest mb-3">
          SPECIALIZED NEURAL NODES
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {AGENT_LIST.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelectAgentAndChat(agent.id)}
              className="glass-panel rounded-xl p-3 text-left hover:border-cyan-400/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: agent.accentColor }}
                />
                <span className="font-mono-hud text-xs font-bold text-slate-100">{agent.codename}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{agent.designation}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cosmic Modules Grid */}
      <div>
        <h3 className="font-mono-hud text-xs font-semibold text-slate-400 tracking-widest mb-3">
          COSMIC MODULES
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onNavigate(mod.id)}
                className="glass-panel rounded-xl p-4 flex items-center gap-3.5 text-left hover:border-cyan-400/50 transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center shrink-0 group-hover:bg-cyan-400/15 transition-colors">
                  <Icon className={`w-5 h-5 ${mod.accent}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">{mod.title}</p>
                  <p className="text-xs text-slate-400 truncate">{mod.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

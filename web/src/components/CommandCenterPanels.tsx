import React from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  Circle,
  Cpu,
  Database,
  Globe,
  HardDrive,
  MemoryStick,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react';
import {
  AgentCollaborationLog,
  BrowserTelemetry,
  ChatSession,
  ConnectionState,
  MemoryItem,
  ScreenId,
  SecurityLogItem,
  TaskItem,
} from '../types/jarvis';

export const SystemMonitorPanel: React.FC<{
  telemetry: BrowserTelemetry;
  onOpenTelemetry: () => void;
}> = ({ telemetry, onOpenTelemetry }) => {
  const ramPercent =
    telemetry.heapUsedMb !== null && telemetry.heapLimitMb && telemetry.heapLimitMb > 0
      ? Math.min(100, Math.round((telemetry.heapUsedMb / telemetry.heapLimitMb) * 100))
      : null;

  const storagePercent =
    telemetry.storageUsedMb != null &&
    telemetry.storageQuotaMb != null &&
    telemetry.storageQuotaMb > 0
      ? Math.min(100, Math.round((telemetry.storageUsedMb / telemetry.storageQuotaMb) * 100))
      : null;

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-3 border border-cyan-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-300" />
          <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            SYSTEM MONITOR
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenTelemetry}
          className="font-mono-hud text-[10px] text-sky-300 hover:text-cyan-200 cursor-pointer"
        >
          CLI →
        </button>
      </div>

      {/* CPU */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            CPU Load
          </span>
          <span className="font-mono-hud text-slate-300">
            {telemetry.cpuCores} Cores • Unavailable in Browser
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800/90 overflow-hidden">
          <div className="h-full w-1/4 bg-slate-600/70 rounded-full" />
        </div>
        <p className="font-mono-hud text-[9px] text-slate-500">
          Browser sandbox blocks OS-wide CPU % telemetry.
        </p>
      </div>

      {/* RAM / JS Heap */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
            <MemoryStick className="w-3.5 h-3.5 text-sky-400" />
            RAM / JS Heap
          </span>
          <span className="font-mono-hud text-cyan-200">
            {telemetry.heapUsedMb !== null
              ? `${telemetry.heapUsedMb} / ${telemetry.heapLimitMb} MB`
              : telemetry.deviceMemoryGb !== null
                ? `${telemetry.deviceMemoryGb} GB Device`
                : 'Unavailable'}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800/90 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-sky-500 rounded-full transition-all"
            style={{ width: `${ramPercent !== null ? Math.max(8, ramPercent) : 12}%` }}
          />
        </div>
      </div>

      {/* Storage */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            Storage Usage
          </span>
          <span className="font-mono-hud text-emerald-300">
            {telemetry.storageUsedMb != null
              ? `${telemetry.storageUsedMb} MB used${
                  telemetry.storageQuotaMb ? ` / ${telemetry.storageQuotaMb} MB` : ''
                }`
              : 'Browser Restricted'}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800/90 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all"
            style={{ width: `${storagePercent !== null ? Math.max(6, storagePercent) : 8}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export const MemoryInsightsPanel: React.FC<{
  memories: MemoryItem[];
  sessions: ChatSession[];
  toolCallCount: number;
  onViewMemoryMap: () => void;
}> = ({ memories, sessions, toolCallCount, onViewMemoryMap }) => {
  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);
  const countsByCategory = [
    { key: 'PREF', count: memories.filter((m) => m.category === 'PREFERENCE').length },
    { key: 'PROJ', count: memories.filter((m) => m.category === 'PROJECT').length },
    { key: 'INST', count: memories.filter((m) => m.category === 'INSTRUCTION').length },
    { key: 'CMD', count: memories.filter((m) => m.category === 'COMMAND').length },
    { key: 'FACT', count: memories.filter((m) => m.category === 'FACT').length },
  ];
  const maxBar = Math.max(1, ...countsByCategory.map((c) => c.count));

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-3 border border-cyan-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-300" />
          <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            MEMORY INSIGHTS
          </h3>
        </div>
        <button
          type="button"
          onClick={onViewMemoryMap}
          className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/40 hover:bg-cyan-500/25 font-mono-hud text-[10px] text-cyan-200 cursor-pointer"
        >
          View Memory Map
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#040916] border border-slate-800 p-2.5 text-center">
          <p className="font-mono-hud text-lg font-bold text-cyan-300">{memories.length}</p>
          <p className="font-mono-hud text-[9px] text-slate-400">MEMORIES</p>
        </div>
        <div className="rounded-xl bg-[#040916] border border-slate-800 p-2.5 text-center">
          <p className="font-mono-hud text-lg font-bold text-sky-300">{sessions.length}</p>
          <p className="font-mono-hud text-[9px] text-slate-400">{totalMessages} MSGS</p>
        </div>
        <div className="rounded-xl bg-[#040916] border border-slate-800 p-2.5 text-center">
          <p className="font-mono-hud text-lg font-bold text-emerald-300">{toolCallCount}</p>
          <p className="font-mono-hud text-[9px] text-slate-400">TOOL CALLS</p>
        </div>
      </div>

      {/* Real SVG Memory Distribution Graph */}
      <div className="rounded-xl bg-[#040916] border border-slate-800/90 p-2.5">
        <p className="font-mono-hud text-[9px] text-slate-400 mb-2">MEMORY ACTIVITY GRAPH</p>
        <svg viewBox="0 0 220 56" className="w-full h-14" aria-label="Memory category activity graph">
          {countsByCategory.map((item, idx) => {
            const barH = Math.max(4, Math.round((item.count / maxBar) * 34));
            const x = 10 + idx * 42;
            const y = 38 - barH;
            return (
              <g key={item.key}>
                <rect
                  x={x}
                  y={y}
                  width="24"
                  height={barH}
                  rx="4"
                  fill={item.count > 0 ? '#00F0FF' : '#1E293B'}
                  fillOpacity={item.count > 0 ? 0.85 : 0.7}
                />
                <text
                  x={x + 12}
                  y="52"
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {item.key}({item.count})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const LlmStatusPanel: React.FC<{
  connectionState: ConnectionState;
  onConfigureSettings: () => void;
}> = ({ connectionState, onConfigureSettings }) => {
  const geminiBadge = (() => {
    switch (connectionState) {
      case 'online':
        return { text: 'CONNECTED', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40' };
      case 'connecting':
        return { text: 'CHECKING', cls: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/40' };
      case 'key_missing':
        return { text: 'KEY MISSING', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/40' };
      default:
        return { text: 'OFFLINE', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/40' };
    }
  })();

  const providers: Array<{ name: string; status: string; cls: string }> = [
    { name: 'Gemini', status: geminiBadge.text, cls: geminiBadge.cls },
    { name: 'OpenAI', status: 'NOT CONFIGURED', cls: 'text-slate-400 bg-slate-800/70 border-slate-700' },
    { name: 'Claude', status: 'NOT CONFIGURED', cls: 'text-slate-400 bg-slate-800/70 border-slate-700' },
    { name: 'Groq', status: 'NOT CONFIGURED', cls: 'text-slate-400 bg-slate-800/70 border-slate-700' },
    { name: 'OpenRouter', status: 'NOT CONFIGURED', cls: 'text-slate-400 bg-slate-800/70 border-slate-700' },
    { name: 'Ollama', status: 'NOT CONFIGURED', cls: 'text-slate-400 bg-slate-800/70 border-slate-700' },
    { name: 'Claude Code', status: 'NOT CONFIGURED', cls: 'text-slate-400 bg-slate-800/70 border-slate-700' },
    { name: 'Cursor', status: 'NOT CONFIGURED', cls: 'text-slate-400 bg-slate-800/70 border-slate-700' },
    { name: 'Copilot', status: 'NOT CONFIGURED', cls: 'text-slate-400 bg-slate-800/70 border-slate-700' },
  ];

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-2.5 border border-cyan-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-300" />
          <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            LLM STATUS
          </h3>
        </div>
        <button
          type="button"
          onClick={onConfigureSettings}
          className="font-mono-hud text-[10px] text-sky-300 hover:text-cyan-200 cursor-pointer"
        >
          Configure →
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-2 gap-1.5">
        {providers.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#040916] border border-slate-800/80"
          >
            <span className="text-[11px] font-medium text-slate-200 truncate">{p.name}</span>
            <span className={`px-1.5 py-0.5 rounded border font-mono-hud text-[9px] shrink-0 ${p.cls}`}>
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const LiveIntelligenceFeedPanel: React.FC<{
  sessions: ChatSession[];
  tasks: TaskItem[];
  securityLogs: SecurityLogItem[];
  collaborationLogs: AgentCollaborationLog[];
  onNavigate: (screen: ScreenId) => void;
}> = ({ sessions, tasks, securityLogs, collaborationLogs, onNavigate }) => {
  const feedItems: Array<{
    id: string;
    label: string;
    detail: string;
    ts: number;
    kind: 'AI' | 'TASK' | 'ALERT' | 'AGENT';
    screen: ScreenId;
  }> = [];

  for (const s of sessions.slice(0, 3)) {
    const last = s.messages[s.messages.length - 1];
    if (last) {
      feedItems.push({
        id: `msg_${last.id}`,
        label: `${last.agentCodename} • ${last.role === 'user' ? 'Operator Prompt' : 'AI Reply'}`,
        detail: last.text.slice(0, 90),
        ts: last.timestamp,
        kind: 'AI',
        screen: 'chat',
      });
    }
  }
  for (const t of tasks.slice(0, 4)) {
    feedItems.push({
      id: `tsk_${t.id}`,
      label: t.isCompleted ? 'Mission Completed' : `Pending Task (${t.priority})`,
      detail: `${t.title} — ${t.dueTime}`,
      ts: t.createdAt,
      kind: 'TASK',
      screen: 'productivity',
    });
  }
  for (const log of securityLogs.slice(0, 3)) {
    feedItems.push({
      id: `sec_${log.id}`,
      label: `${log.sourceAgent} • ${log.eventType}`,
      detail: log.description,
      ts: log.timestamp,
      kind: 'ALERT',
      screen: 'security',
    });
  }
  for (const c of collaborationLogs.slice(0, 3)) {
    feedItems.push({
      id: `col_${c.id}`,
      label: `${c.fromCodename} → ${c.toCodename}`,
      detail: `${c.action}: ${c.detail}`,
      ts: c.timestamp,
      kind: 'AGENT',
      screen: 'multi_agent',
    });
  }

  feedItems.sort((a, b) => b.ts - a.ts);
  const visible = feedItems.slice(0, 6);

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-2.5 border border-cyan-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-300" />
          <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            LIVE INTELLIGENCE FEED
          </h3>
        </div>
        <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
          REALTIME
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-slate-400 py-3">
          No telemetry events yet. Send a chat or add a task to populate the feed.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.screen)}
              className="w-full text-left p-2 rounded-xl bg-[#040916] hover:bg-cyan-500/10 border border-slate-800/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-hud text-[10px] font-semibold text-cyan-200 truncate flex items-center gap-1.5">
                  {item.kind === 'ALERT' ? (
                    <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
                  ) : item.kind === 'AGENT' ? (
                    <Bot className="w-3 h-3 text-sky-300 shrink-0" />
                  ) : item.kind === 'TASK' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Terminal className="w-3 h-3 text-cyan-400 shrink-0" />
                  )}
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="font-mono-hud text-[9px] text-slate-500 shrink-0">
                  {new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">{item.detail}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const MissionTimelinePanel: React.FC<{
  tasks: TaskItem[];
  onToggleTask: (id: string) => void;
  onOpenCalendar: () => void;
}> = ({ tasks, onToggleTask, onOpenCalendar }) => {
  const ordered = [...tasks]
    .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted) || b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-2.5 border border-cyan-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-300" />
          <h3 className="font-mono-hud text-xs font-bold text-amber-300 tracking-wider">
            MISSION TIMELINE
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenCalendar}
          className="font-mono-hud text-[10px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
        >
          Planner →
        </button>
      </div>

      {ordered.length === 0 ? (
        <div className="py-3 text-center space-y-1.5">
          <p className="text-xs text-slate-400">No upcoming or pending missions scheduled.</p>
          <button
            type="button"
            onClick={onOpenCalendar}
            className="px-3 py-1 rounded-lg bg-[#0B1426] border border-cyan-400/40 font-mono-hud text-[10px] text-cyan-200 cursor-pointer"
          >
            Schedule Mission
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {ordered.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onToggleTask(task.id)}
              className="w-full text-left p-2 rounded-xl bg-[#040916] hover:border-cyan-400/40 border border-slate-800/80 flex items-start gap-2.5 cursor-pointer transition-colors"
            >
              {task.isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-medium truncate ${
                    task.isCompleted ? 'text-slate-500 line-through' : 'text-slate-100'
                  }`}
                >
                  {task.title}
                </p>
                <p className="font-mono-hud text-[10px] text-slate-400">
                  {task.dueTime} • {task.priority} • {task.category}
                </p>
              </div>
              <Wrench className="w-3 h-3 text-slate-600 shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

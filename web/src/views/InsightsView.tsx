import React, { useMemo } from 'react';
import { BarChart3, Bot, CheckCircle2, Database, MessageSquare, Mic, Sparkles } from 'lucide-react';
import {
  BackendHealth,
  ChatSession,
  ConnectionState,
  MemoryItem,
  TaskItem,
} from '../types/jarvis';

interface InsightsViewProps {
  sessions: ChatSession[];
  memories: MemoryItem[];
  tasks: TaskItem[];
  connectionState: ConnectionState;
  backendHealth: BackendHealth | null;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  sessions,
  memories,
  tasks,
  connectionState,
  backendHealth,
}) => {
  const stats = useMemo(() => {
    const allMessages = sessions.flatMap((s) => s.messages);
    const totalMessages = allMessages.length;
    const userMessages = allMessages.filter((m) => m.role === 'user').length;
    const aiMessages = allMessages.filter((m) => m.role === 'jarvis').length;
    const voiceMessages = allMessages.filter((m) => Boolean(m.isVoice)).length;
    const textMessages = Math.max(0, totalMessages - voiceMessages);

    // 7-day rolling bucket counts
    const now = new Date();
    const days: Array<{ label: string; key: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      days.push({ label, key, count: 0 });
    }
    const dayMap = new Map(days.map((d) => [d.key, d]));
    for (const msg of allMessages) {
      const d = new Date(msg.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const bucket = dayMap.get(key);
      if (bucket) bucket.count += 1;
    }

    // Agent distribution across AI replies
    const agentCounts = new Map<string, number>();
    for (const msg of allMessages) {
      if (msg.role !== 'jarvis') continue;
      const name = (msg.agentCodename || 'JARVIS').trim();
      agentCounts.set(name, (agentCounts.get(name) || 0) + 1);
    }
    const agentBreakdown = Array.from(agentCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const completedTasks = tasks.filter((t) => t.isCompleted).length;
    const totalTasks = tasks.length;
    const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalMessages,
      userMessages,
      aiMessages,
      voiceMessages,
      textMessages,
      days,
      maxDayCount: Math.max(1, ...days.map((d) => d.count)),
      agentBreakdown,
      maxAgentCount: Math.max(1, ...agentBreakdown.map((a) => a.count)),
      completedTasks,
      totalTasks,
      taskRate,
    };
  }, [sessions, tasks]);

  const voiceRatio =
    stats.totalMessages > 0 ? Math.round((stats.voiceMessages / stats.totalMessages) * 100) : 0;
  const textRatio = stats.totalMessages > 0 ? 100 - voiceRatio : 0;

  const ringRadius = 36;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - stats.taskRate / 100);

  return (
    <div className="space-y-6">
      {/* Top KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono-hud text-[10px]">TOTAL MESSAGES</span>
            <MessageSquare className="w-4 h-4 text-cyan-300" />
          </div>
          <p className="font-display text-2xl font-bold text-slate-100 mt-2">{stats.totalMessages}</p>
          <p className="font-mono-hud text-[11px] text-slate-400 mt-1">
            {stats.userMessages} user • {stats.aiMessages} JARVIS
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono-hud text-[10px]">CHAT SESSIONS</span>
            <Sparkles className="w-4 h-4 text-violet-300" />
          </div>
          <p className="font-display text-2xl font-bold text-violet-300 mt-2">{sessions.length}</p>
          <p className="font-mono-hud text-[11px] text-slate-400 mt-1">
            Model: {backendHealth?.model || 'gemini-2.5-flash'}
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono-hud text-[10px]">MEMORY VAULT</span>
            <Database className="w-4 h-4 text-emerald-300" />
          </div>
          <p className="font-display text-2xl font-bold text-emerald-300 mt-2">{memories.length}</p>
          <p className="font-mono-hud text-[11px] text-slate-400 mt-1">Long-term facts stored</p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono-hud text-[10px]">TASK COMPLETION</span>
            <CheckCircle2 className="w-4 h-4 text-amber-300" />
          </div>
          <p className="font-display text-2xl font-bold text-amber-300 mt-2">{stats.taskRate}%</p>
          <p className="font-mono-hud text-[11px] text-slate-400 mt-1">
            {stats.completedTasks}/{stats.totalTasks} objectives complete
          </p>
        </div>
      </div>

      {/* 7-Day Activity Bar Chart (SVG) */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-300" />
            <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
              7-DAY NEURAL MESSAGE ACTIVITY
            </h3>
          </div>
          <span className="font-mono-hud text-[11px] text-slate-400">
            Link: {connectionState.toUpperCase()}
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox="0 0 420 155"
            className="w-full min-w-[320px] h-44"
            role="img"
            aria-label="7-day neural message activity bar chart"
          >
            <defs>
              <linearGradient id="jarvisBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.25" />
              </linearGradient>
            </defs>
            {/* Baseline */}
            <line x1="16" y1="122" x2="404" y2="122" stroke="#1E293B" strokeWidth="1.5" />
            {stats.days.map((day, idx) => {
              const slotWidth = 388 / 7;
              const barWidth = 32;
              const x = 16 + idx * slotWidth + (slotWidth - barWidth) / 2;
              const barHeight =
                day.count > 0 ? Math.max(8, Math.round((day.count / stats.maxDayCount) * 88)) : 3;
              const y = 122 - barHeight;
              return (
                <g key={day.key}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="6"
                    fill={day.count > 0 ? 'url(#jarvisBarGrad)' : '#1E293B'}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={Math.max(14, y - 6)}
                    textAnchor="middle"
                    fill="#CBD5E1"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {day.count}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y="142"
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {day.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Agent Distribution & Task/Voice Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent Usage Breakdown (SVG horizontal bars) */}
        <div className="glass-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-300" />
            <h3 className="font-mono-hud text-xs font-bold text-violet-300 tracking-wider">
              AGENT DISTRIBUTION
            </h3>
          </div>

          {stats.agentBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 font-mono-hud py-6 text-center">
              No AI responses recorded yet. Start a Neural Chat to populate agent analytics.
            </p>
          ) : (
            <svg
              viewBox={`0 0 360 ${Math.max(80, stats.agentBreakdown.length * 36)}`}
              className="w-full h-auto"
              role="img"
              aria-label="Agent usage breakdown chart"
            >
              {stats.agentBreakdown.map((agent, idx) => {
                const y = idx * 36 + 8;
                const fillW = Math.max(8, Math.round((agent.count / stats.maxAgentCount) * 190));
                return (
                  <g key={agent.name}>
                    <text x="4" y={y + 15} fill="#E2E8F0" fontSize="11" fontFamily="monospace">
                      {agent.name.slice(0, 14)}
                    </text>
                    <rect x="115" y={y + 4} width="190" height="14" rx="7" fill="#0F172A" />
                    <rect x="115" y={y + 4} width={fillW} height="14" rx="7" fill="#00F0FF" />
                    <text x="318" y={y + 15} fill="#7DD3FC" fontSize="11" fontFamily="monospace">
                      {agent.count}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Voice vs Text & Task Completion Ring (SVG) */}
        <div className="glass-panel rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-emerald-300" />
            <h3 className="font-mono-hud text-xs font-bold text-emerald-300 tracking-wider">
              MODALITY SPLIT & TASK EFFICIENCY
            </h3>
          </div>

          <div className="flex items-center gap-6">
            <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Task completion ring">
              <circle cx="48" cy="48" r={ringRadius} fill="none" stroke="#1E293B" strokeWidth="8" />
              <circle
                cx="48"
                cy="48"
                r={ringRadius}
                fill="none"
                stroke="#10B981"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 48 48)"
              />
              <text
                x="48"
                y="52"
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize="14"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {stats.taskRate}%
              </text>
            </svg>

            <div className="flex-1 space-y-3">
              <div>
                <div className="flex justify-between font-mono-hud text-[11px] text-slate-300 mb-1">
                  <span>VOICE ({stats.voiceMessages})</span>
                  <span>TEXT ({stats.textMessages})</span>
                </div>
                <svg viewBox="0 0 240 14" className="w-full h-3.5" role="img" aria-label="Voice vs Text split">
                  <rect x="0" y="0" width="240" height="14" rx="7" fill="#1E293B" />
                  <rect
                    x="0"
                    y="0"
                    width={Math.round((voiceRatio / 100) * 240)}
                    height="14"
                    rx="7"
                    fill="#A78BFA"
                  />
                </svg>
                <p className="font-mono-hud text-[10px] text-slate-400 mt-1">
                  {voiceRatio}% Voice • {textRatio}% Text
                </p>
              </div>
              <p className="text-xs text-slate-300">
                {stats.completedTasks} of {stats.totalTasks} scheduled tasks and reminders completed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

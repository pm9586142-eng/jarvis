import React, { useState } from 'react';
import { ArrowRight, GitBranch, Play } from 'lucide-react';
import { AGENT_LIST, routeIntentToAgent } from '../data/agents';
import { AgentCollaborationLog, AgentId } from '../types/jarvis';

interface MultiAgentViewProps {
  collaborationLogs: AgentCollaborationLog[];
  onEngageAgent: (agentId: AgentId) => void;
  onDispatchDirective: (directive: string) => void;
}

export const MultiAgentView: React.FC<MultiAgentViewProps> = ({
  collaborationLogs,
  onEngageAgent,
  onDispatchDirective,
}) => {
  const [directive, setDirective] = useState(
    'Coordinate research briefing, generate TypeScript telemetry hook, and verify security posture'
  );
  const predictedAgent = routeIntentToAgent(directive);

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-5">
        <p className="font-mono-hud text-xs font-bold text-cyan-300">NEURAL AGENT ORCHESTRATION</p>
        <p className="text-sm text-slate-300 mt-1.5">
          JARVIS operates as a multi-agent system powered by Gemini. Directives are classified by intent and routed to specialized agents with memory and telemetry context.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {AGENT_LIST.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => onEngageAgent(agent.id)}
            className="glass-panel rounded-2xl p-4 text-left hover:border-cyan-400/50 transition-all cursor-pointer flex items-start justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: agent.accentColor }} />
                <span className="font-display text-sm font-bold text-slate-100">{agent.codename}</span>
                <span className="font-mono-hud text-[10px] text-emerald-400">• ONLINE</span>
              </div>
              <p className="font-mono-hud text-xs" style={{ color: agent.accentColor }}>
                {agent.designation}
              </p>
              <p className="text-xs text-slate-400">{agent.specialization}</p>
            </div>
            <Play className="w-4 h-4 shrink-0 mt-1" style={{ color: agent.accentColor }} />
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono-hud text-xs font-bold text-cyan-300">DELEGATE DIRECTIVE</p>
          <span className="font-mono-hud text-[11px] text-amber-300">
            Auto-Routed Target: {predictedAgent.replace('_RESEARCH', '').replace('_ENGINEER', '').replace('_COORDINATOR', '').replace('_DIAGNOSTICS', '').replace('_PRIME', '')}
          </span>
        </div>

        <textarea
          rows={2}
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
        />

        <button
          type="button"
          onClick={() => directive.trim() && onDispatchDirective(directive.trim())}
          className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
        >
          <GitBranch className="w-4 h-4" />
          <span>DISPATCH TO AGENT MESH</span>
        </button>
      </div>

      <div className="space-y-2.5">
        <h3 className="font-mono-hud text-xs font-semibold text-slate-400 tracking-widest">
          INTER-AGENT COLLABORATION LOGS
        </h3>
        {collaborationLogs.map((log) => (
          <div key={log.id} className="glass-panel rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between font-mono-hud text-[11px]">
              <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                {log.fromCodename} <ArrowRight className="w-3 h-3" /> {log.toCodename}
                <span className="text-slate-200 font-normal">• {log.action}</span>
              </span>
              <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="text-xs text-slate-400">{log.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

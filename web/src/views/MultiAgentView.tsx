import React, { useState } from 'react';
import { ArrowRight, Edit3, GitBranch, Play, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { AGENT_LIST, routeIntentToAgent } from '../data/agents';
import { AgentCollaborationLog, AgentId, CustomAgent } from '../types/jarvis';

const CUSTOM_COLOR_PALETTE = ['#00F0FF', '#A78BFA', '#10B981', '#FBBF24', '#F43F5E', '#38BDF8'];

interface MultiAgentViewProps {
  collaborationLogs: AgentCollaborationLog[];
  customAgents: CustomAgent[];
  onEngageAgent: (agentId: AgentId) => void;
  onEngageCustomAgent: (customAgentId: string) => void;
  onSaveCustomAgent: (agent: Omit<CustomAgent, 'createdAt'>) => void;
  onDeleteCustomAgent: (id: string) => void;
  onDispatchDirective: (directive: string) => void;
}

export const MultiAgentView: React.FC<MultiAgentViewProps> = ({
  collaborationLogs,
  customAgents,
  onEngageAgent,
  onEngageCustomAgent,
  onSaveCustomAgent,
  onDeleteCustomAgent,
  onDispatchDirective,
}) => {
  const [directive, setDirective] = useState(
    'Coordinate research briefing, generate TypeScript telemetry hook, and verify security posture'
  );
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [codenameDraft, setCodenameDraft] = useState('');
  const [promptDraft, setPromptDraft] = useState('');
  const [keywordsDraft, setKeywordsDraft] = useState('');
  const [colorDraft, setColorDraft] = useState(CUSTOM_COLOR_PALETTE[0]);

  const predictedAgent = routeIntentToAgent(directive);

  const openNewBuilder = () => {
    setEditingId(null);
    setNameDraft('');
    setCodenameDraft('');
    setPromptDraft('You are a specialized Stark Lab agent. Respond concisely and address the owner as Sir.');
    setKeywordsDraft('');
    setColorDraft(CUSTOM_COLOR_PALETTE[0]);
    setShowBuilder(true);
  };

  const openEditBuilder = (agent: CustomAgent) => {
    setEditingId(agent.id);
    setNameDraft(agent.name);
    setCodenameDraft(agent.codename);
    setPromptDraft(agent.systemPrompt);
    setKeywordsDraft(agent.keywords.join(', '));
    setColorDraft(agent.accentColor);
    setShowBuilder(true);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameDraft.trim();
    const cleanCodename = (codenameDraft.trim() || cleanName).toUpperCase().slice(0, 18);
    const cleanPrompt = promptDraft.trim();
    if (!cleanName || !cleanPrompt) return;

    const keywords = keywordsDraft
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    onSaveCustomAgent({
      id: editingId || `custom_${Date.now()}`,
      name: cleanName,
      codename: cleanCodename,
      systemPrompt: cleanPrompt,
      accentColor: colorDraft,
      keywords,
    });
    setShowBuilder(false);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono-hud text-xs font-bold text-cyan-300">NEURAL AGENT ORCHESTRATION</p>
          <p className="text-sm text-slate-300 mt-1.5 max-w-2xl">
            JARVIS operates as a multi-agent mesh powered by Gemini. Create custom agents with keyword triggers and specialized system prompts.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewBuilder}
          className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>CREATE CUSTOM AGENT</span>
        </button>
      </div>

      {showBuilder && (
        <form onSubmit={handleSaveCustom} className="glass-panel-glow rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <h3 className="font-mono-hud text-xs font-bold text-cyan-300">
                {editingId ? 'EDIT CUSTOM AGENT' : 'NEW CUSTOM AGENT'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowBuilder(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-hud text-[11px] text-slate-400 mb-1">DISPLAY NAME</label>
              <input
                type="text"
                required
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="e.g. Stark Legal Counsel"
                className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono-hud text-[11px] text-slate-400 mb-1">CODENAME</label>
              <input
                type="text"
                value={codenameDraft}
                onChange={(e) => setCodenameDraft(e.target.value)}
                placeholder="e.g. ATHENA"
                className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono-hud text-[11px] text-slate-400 mb-1">
              AUTO-ROUTE KEYWORDS (COMMA SEPARATED)
            </label>
            <input
              type="text"
              value={keywordsDraft}
              onChange={(e) => setKeywordsDraft(e.target.value)}
              placeholder="e.g. contract, patent, license, nda"
              className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono-hud text-[11px] text-slate-400 mb-1">SYSTEM PROMPT</label>
            <textarea
              rows={3}
              required
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono-hud text-[11px] text-slate-400">ACCENT:</span>
              {CUSTOM_COLOR_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColorDraft(hex)}
                  aria-label={`Select color ${hex}`}
                  className={`w-6 h-6 rounded-full cursor-pointer border-2 ${
                    colorDraft === hex ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wider cursor-pointer"
            >
              {editingId ? 'UPDATE AGENT' : 'SAVE CUSTOM AGENT'}
            </button>
          </div>
        </form>
      )}

      {customAgents.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono-hud text-xs font-semibold text-cyan-300 tracking-widest">
            CUSTOM NEURAL AGENTS ({customAgents.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customAgents.map((agent) => (
              <div
                key={agent.id}
                className="glass-panel rounded-2xl p-4 flex items-start justify-between gap-3 border border-cyan-500/30"
              >
                <button
                  type="button"
                  onClick={() => onEngageCustomAgent(agent.id)}
                  className="text-left flex-1 space-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: agent.accentColor }} />
                    <span className="font-display text-sm font-bold text-slate-100">{agent.codename}</span>
                    <span className="font-mono-hud text-[10px] text-cyan-300">• CUSTOM</span>
                  </div>
                  <p className="font-mono-hud text-xs" style={{ color: agent.accentColor }}>
                    {agent.name}
                  </p>
                  <p className="text-xs text-slate-400 line-clamp-2">{agent.systemPrompt}</p>
                  {agent.keywords.length > 0 && (
                    <p className="font-mono-hud text-[10px] text-slate-400">
                      Triggers: {agent.keywords.join(', ')}
                    </p>
                  )}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditBuilder(agent)}
                    aria-label={`Edit ${agent.codename}`}
                    className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCustomAgent(agent.id)}
                    aria-label={`Delete ${agent.codename}`}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

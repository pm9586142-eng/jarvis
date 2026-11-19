import React, { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  GitBranch,
  Play,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  BrainAgentInfo,
  BrainProviderInfo,
  BrainTaskRun,
} from '../../types/jarvis';

interface AgentsTabProps {
  agents: BrainAgentInfo[];
  providers: BrainProviderInfo[];
  onUpdateAgent: (
    agentId: string,
    patch: Partial<Pick<BrainAgentInfo, 'enabled' | 'instructions' | 'preferredProvider' | 'preferredModel'>>
  ) => Promise<void>;
  onDispatchAgentTest: (agentId: string, samplePrompt: string) => void;
}

export const BrainAgentsTab: React.FC<AgentsTabProps> = ({
  agents,
  providers,
  onUpdateAgent,
  onDispatchAgentTest,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [providerDraft, setProviderDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const freeProviders = providers.filter((p) => p.eligibleForZeroCost);

  const beginEdit = (agent: BrainAgentInfo) => {
    setEditingId(agent.id);
    setInstructionsDraft(agent.instructions);
    setProviderDraft(agent.preferredProvider || '');
    setModelDraft(agent.preferredModel || '');
  };

  const handleSave = async (agentId: string) => {
    setSavingId(agentId);
    try {
      await onUpdateAgent(agentId, {
        instructions: instructionsDraft.trim(),
        preferredProvider: providerDraft || null,
        preferredModel: modelDraft || null,
      });
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
          SPECIALIST AI AGENT ROSTER ({agents.length} SPECIALISTS • SELECTIVE ACTIVATION)
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Only agents directly relevant to each prompt are activated to preserve speed and free quotas. Customize any specialist&apos;s instructions or $0 model override below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {agents.map((ag) => {
          const isEditing = editingId === ag.id;
          const selectedProvObj = freeProviders.find((p) => p.id === providerDraft);
          return (
            <div
              key={ag.id}
              data-testid={`brain-agent-card-${ag.id}`}
              className={`rounded-2xl bg-[#040812] border p-4 space-y-3 flex flex-col justify-between ${
                ag.enabled ? 'border-slate-800 hover:border-cyan-500/40' : 'border-slate-900 opacity-65'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-cyan-300 shrink-0" />
                      <h4 className="font-mono-hud text-xs font-bold text-slate-100 truncate">
                        {ag.name}
                      </h4>
                    </div>
                    <p className="font-mono-hud text-[10px] text-cyan-400 mt-0.5">
                      {ag.codename} • DOMAIN: {ag.domain.toUpperCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onUpdateAgent(ag.id, { enabled: !ag.enabled })}
                    className={`px-2 py-0.5 rounded-md border font-mono-hud text-[9px] font-bold cursor-pointer shrink-0 ${
                      ag.enabled
                        ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    {ag.enabled ? 'ACTIVE' : 'PAUSED'}
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{ag.role}</p>

                {isEditing ? (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <textarea
                      rows={3}
                      value={instructionsDraft}
                      onChange={(e) => setInstructionsDraft(e.target.value)}
                      className="w-full bg-[#0D1527] border border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-100 focus:border-cyan-400 focus:outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={providerDraft}
                        onChange={(e) => {
                          setProviderDraft(e.target.value);
                          setModelDraft('');
                        }}
                        className="bg-[#0D1527] border border-slate-700 rounded-lg px-2 py-1 font-mono-hud text-[10px] text-cyan-200"
                      >
                        <option value="">Auto Provider</option>
                        {freeProviders.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={modelDraft}
                        onChange={(e) => setModelDraft(e.target.value)}
                        className="bg-[#0D1527] border border-slate-700 rounded-lg px-2 py-1 font-mono-hud text-[10px] text-cyan-200"
                      >
                        <option value="">Auto Free Model</option>
                        {(selectedProvObj ? selectedProvObj.models : []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="font-mono-hud text-[10px] text-slate-400 line-clamp-2 bg-[#0D1527]/70 rounded-lg px-2.5 py-1.5 border border-slate-800/80">
                    {ag.preferredProvider
                      ? `Override: ${ag.preferredProvider}${ag.preferredModel ? ` / ${ag.preferredModel}` : ''}`
                      : 'Model: Intelligent $0 Router (Domain-Optimal)'}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 font-mono-hud text-[10px] text-slate-300 cursor-pointer"
                    >
                      CANCEL
                    </button>
                    <button
                      type="button"
                      disabled={savingId === ag.id}
                      onClick={() => void handleSave(ag.id)}
                      className="px-3 py-1 rounded-lg bg-cyan-400 text-[#02040A] font-mono-hud text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      <span>{savingId === ag.id ? 'SAVING...' : 'SAVE'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => beginEdit(ag)}
                      className="px-2.5 py-1 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 font-mono-hud text-[10px] text-slate-200 cursor-pointer"
                    >
                      CONFIGURE
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onDispatchAgentTest(
                          ag.id,
                          `Briefly demonstrate your ${ag.name} capability with 3 actionable insights.`
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/50 hover:bg-cyan-500/25 font-mono-hud text-[10px] font-bold text-cyan-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>TEST AGENT</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface CollaborationTabProps {
  collaborations: BrainTaskRun[];
  onRunDemoCollaboration: (prompt: string) => void;
}

export const BrainCollaborationTab: React.FC<CollaborationTabProps> = ({
  collaborations,
  onRunDemoCollaboration,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-mono-hud text-xs font-bold text-violet-300 tracking-wider">
            MULTI-AI COLLABORATION & SELF-VERIFICATION MONITOR
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Complex multi-domain tasks automatically split into parallel specialist subtasks, run contradiction checks, and synthesize a verified consensus answer.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onRunDemoCollaboration(
              'Design a secure Node.js + TypeScript API rate limiter, analyze security vulnerabilities, and write unit test cases to verify edge cases.'
            )
          }
          className="px-3.5 py-2 rounded-xl bg-violet-500/20 border border-violet-400/60 hover:bg-violet-500/30 font-mono-hud text-[11px] font-bold text-violet-200 flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>RUN SAMPLE MULTI-AGENT COLLABORATION</span>
        </button>
      </div>

      {collaborations.length === 0 ? (
        <div className="rounded-2xl bg-[#040812] border border-slate-800 p-8 text-center space-y-2">
          <GitBranch className="w-7 h-7 text-violet-300/70 mx-auto" />
          <p className="font-mono-hud text-xs text-slate-300">
            No multi-agent collaboration runs recorded in this server session yet.
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Switch to the Coordinator tab or send a complex architecture / coding + security + testing prompt in Neural Chat to observe live parallel specialist orchestration.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {collaborations.map((run) => (
            <div
              key={run.id}
              className="rounded-2xl bg-[#040812] border border-violet-500/30 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono-hud text-xs font-bold text-slate-100">
                    {run.promptPreview}
                  </p>
                  <p className="font-mono-hud text-[10px] text-slate-400 mt-0.5">
                    {new Date(run.startedAt).toLocaleTimeString()} • {run.durationMs ?? 0}ms • SYNTHESIS: {run.provider || '—'} ({run.model || '—'})
                  </p>
                </div>
                <div className="flex items-center gap-1.5 font-mono-hud text-[10px]">
                  {run.confidenceScore !== null && (
                    <span
                      className={`px-2 py-0.5 rounded-lg border font-bold flex items-center gap-1 ${
                        run.confidenceLevel === 'HIGH'
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                          : run.confidenceLevel === 'MEDIUM'
                            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                            : 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      CONFIDENCE {run.confidenceScore}% ({run.confidenceLevel})
                    </span>
                  )}
                  {run.contradictionsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/50 text-amber-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {run.contradictionsCount} CONFLICT{run.contradictionsCount === 1 ? '' : 'S'} RECONCILED
                    </span>
                  )}
                </div>
              </div>

              {Array.isArray(run.subtasks) && run.subtasks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {run.subtasks.map((st) => (
                    <div
                      key={st.subtaskId}
                      className="rounded-xl bg-[#0D1527] border border-slate-800 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1 font-mono-hud text-[10px]">
                        <span className="font-bold text-cyan-200 truncate">{st.agentName}</span>
                        <span
                          className={
                            st.status === 'fulfilled' ? 'text-emerald-300' : 'text-rose-300'
                          }
                        >
                          {st.status === 'fulfilled' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </div>
                      <p className="font-mono-hud text-[9px] text-slate-400 truncate">
                        {st.providerLabel || st.provider || '—'} • {st.model || '—'} • {st.latencyMs}ms
                        {st.retried ? ' (RETRIED)' : ''}
                      </p>
                      <p className="text-[11px] text-slate-300 line-clamp-3">{st.preview}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

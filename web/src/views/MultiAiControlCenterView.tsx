import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  Brain,
  Cpu,
  Database,
  GitBranch,
  History,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { MarkdownMessage } from '../components/MarkdownMessage';
import {
  BrainStreamProgressEvent,
  exportSharedMemories,
  fetchBrainStatus,
  importSharedMemories,
  registerCustomBrainProvider,
  resetBrainCooldowns,
  runBrainCoordinationStream,
  testBrainProvider,
  updateBrainAgent,
  updateBrainProvider,
  updateBrainRouterPolicy,
} from '../services/api';
import { triggerFileDownload } from '../services/backup';
import {
  BrainControlTabId,
  BrainStatusSnapshot,
  ChatBrainMeta,
  MemoryItem,
} from '../types/jarvis';
import { BrainAgentsTab, BrainCollaborationTab } from './brain/BrainAgentsCollabTabs';
import {
  BrainErrorsTab,
  BrainHealthAuditTab,
  BrainSharedMemoryTab,
  BrainTasksHistoryTab,
  BrainUsageTab,
} from './brain/BrainObservabilityTabs';
import { BrainModelsRouterTab, BrainProvidersTab } from './brain/BrainProvidersModelsTabs';

const CONTROL_TABS: Array<{
  id: BrainControlTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'control_center', label: 'Coordinator', icon: Brain },
  { id: 'providers', label: 'Providers (11+)', icon: Server },
  { id: 'models_router', label: 'Models & Router', icon: Cpu },
  { id: 'agents', label: '14 Specialists', icon: Bot },
  { id: 'collaboration', label: 'Collaboration', icon: GitBranch },
  { id: 'shared_memory', label: 'Shared Memory', icon: Database },
  { id: 'usage', label: 'API Usage', icon: BarChart3 },
  { id: 'errors', label: 'Error Monitor', icon: AlertCircle },
  { id: 'tasks', label: 'Task History', icon: History },
  { id: 'health_audit', label: 'Health & Audit', icon: Activity },
];

interface MultiAiControlCenterViewProps {
  memories: MemoryItem[];
  onRefreshMemoriesFromServer?: () => Promise<void>;
  onSpeakText?: (text: string) => void;
}

export const MultiAiControlCenterView: React.FC<MultiAiControlCenterViewProps> = ({
  memories,
  onRefreshMemoriesFromServer,
  onSpeakText,
}) => {
  const [activeTab, setActiveTab] = useState<BrainControlTabId>('control_center');
  const [status, setStatus] = useState<BrainStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

  // Coordinator Live Dispatch Console state
  const [prompt, setPrompt] = useState('');
  const [dispatchCollabMode, setDispatchCollabMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [dispatchAgentId, setDispatchAgentId] = useState<string>('');
  const [dispatchProviderId, setDispatchProviderId] = useState<string>('');
  const [runningDispatch, setRunningDispatch] = useState(false);
  const [progressSteps, setProgressSteps] = useState<BrainStreamProgressEvent[]>([]);
  const [dispatchAnswer, setDispatchAnswer] = useState('');
  const [dispatchMeta, setDispatchMeta] = useState<ChatBrainMeta | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const snap = await fetchBrainStatus();
      setStatus(snap);
      setDispatchCollabMode(snap.coordinator.collaborationMode);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach Multi-AI Brain API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const executeCoordination = async (
    textToRun: string,
    overrides?: { collaborationMode?: 'auto' | 'on' | 'off'; agentId?: string }
  ) => {
    const clean = textToRun.trim();
    if (!clean || runningDispatch) return;
    setRunningDispatch(true);
    setProgressSteps([]);
    setDispatchAnswer('');
    setDispatchMeta(null);
    setDispatchError(null);
    setActiveTab('control_center');

    try {
      await runBrainCoordinationStream({
        prompt: clean,
        collaborationMode: overrides?.collaborationMode ?? dispatchCollabMode,
        agentId: overrides?.agentId ?? (dispatchAgentId || null),
        provider: dispatchProviderId || null,
        onProgress: (ev) => setProgressSteps((prev) => [...prev, ev]),
        onMeta: (m) => setDispatchMeta(m),
        onText: (txt) => setDispatchAnswer(txt),
        onComplete: (txt) => {
          setDispatchAnswer(txt);
          void loadStatus();
        },
        onError: (msg) => {
          setDispatchError(msg);
          void loadStatus();
        },
      });
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Coordination failed.');
    } finally {
      setRunningDispatch(false);
    }
  };

  const handleSubmitDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    void executeCoordination(prompt);
  };

  const configuredCount = status
    ? status.providers.filter((p) => p.configured && p.eligibleForZeroCost).length
    : 0;
  const connectedCount = status
    ? status.providers.filter((p) => p.connectionState === 'CONNECTED').length
    : 0;

  return (
    <div className="space-y-5" data-testid="multi-ai-control-center">
      {/* Top Executive KPI Banner */}
      <div className="glass-panel-glow rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-400/15 border border-cyan-400/50 flex items-center justify-center">
              <Brain className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold tracking-[0.16em] text-slate-100">
                MULTI-AI BRAIN CONTROL CENTER
              </h2>
              <p className="font-mono-hud text-[11px] text-slate-400">
                Chief Coordinator • 11+ Free Providers • 14 Specialist Agents • Peer Verification
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/50 font-mono-hud text-[10px] font-bold text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>STRICT $0 VERIFIED-FREE POLICY</span>
            </span>
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 font-mono-hud text-[11px] text-cyan-200 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>REFRESH</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 font-mono-hud text-xs">
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[9px] text-slate-400">FREE PROVIDERS</p>
            <p className="text-sm font-bold text-cyan-300 mt-0.5">
              {configuredCount} SET / {status?.providers.length ?? 11}
            </p>
            <p className="text-[9px] text-emerald-300">{connectedCount} probed live</p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[9px] text-slate-400">SPECIALIST AGENTS</p>
            <p className="text-sm font-bold text-slate-100 mt-0.5">
              {status?.agents.filter((a) => a.enabled).length ?? 14} / {status?.agents.length ?? 14}
            </p>
            <p className="text-[9px] text-slate-400">Selective activation</p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[9px] text-slate-400">COLLABORATION</p>
            <p className="text-sm font-bold text-violet-300 mt-0.5 uppercase">
              {status?.coordinator.collaborationMode ?? 'AUTO'}
            </p>
            <p className="text-[9px] text-slate-400">Max {status?.coordinator.maxAgents ?? 3} parallel</p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[9px] text-slate-400">SHARED MEMORIES</p>
            <p className="text-sm font-bold text-emerald-300 mt-0.5">{memories.length}</p>
            <p className="text-[9px] text-slate-400">7 Brain categories</p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3 col-span-2 md:col-span-1">
            <p className="text-[9px] text-slate-400">BRAIN HEALTH</p>
            <p className="text-sm font-bold text-emerald-300 mt-0.5 uppercase">
              {status?.systemHealth.status ?? (loading ? 'SYNCING' : 'OFFLINE')}
            </p>
            <p className="text-[9px] text-slate-400">
              {status?.usage.totals.fallbackSwitches ?? 0} failovers
            </p>
          </div>
        </div>

        {/* Unified 10-Tab Hub Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CONTROL_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`brain-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-xl border font-mono-hud text-[11px] whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all ${
                  active
                    ? 'bg-cyan-400/20 border-cyan-400 text-cyan-100 font-bold shadow-[0_0_12px_rgba(0,240,255,0.18)]'
                    : 'bg-[#040812] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="glass-panel rounded-2xl p-4 border border-rose-500/40 bg-rose-500/10 font-mono-hud text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => void loadStatus()}
            className="px-3 py-1 rounded-lg border border-rose-400/50 hover:bg-rose-500/20 cursor-pointer"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Active Tab Content */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5">
        {activeTab === 'control_center' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                CHIEF AI COORDINATOR — DIRECT & MULTI-AGENT DISPATCH CONSOLE
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Auto mode routes everyday questions directly to the best single specialist and automatically triggers parallel multi-agent collaboration + peer verification on complex tasks.
              </p>
            </div>

            <form onSubmit={handleSubmitDispatch} className="space-y-3">
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask JARVIS Chief Coordinator anything — e.g., 'Design a secure JWT refresh token architecture, check for security vulnerabilities, and provide unit tests'..."
                className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={dispatchCollabMode}
                    onChange={(e) => setDispatchCollabMode(e.target.value as 'auto' | 'on' | 'off')}
                    aria-label="Collaboration mode"
                    className="bg-[#0D1527] border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-hud text-[11px] text-violet-200"
                  >
                    <option value="auto">COLLAB: SMART AUTO</option>
                    <option value="on">COLLAB: FORCE MULTI-AGENT</option>
                    <option value="off">COLLAB: FAST DIRECT</option>
                  </select>

                  <select
                    value={dispatchAgentId}
                    onChange={(e) => setDispatchAgentId(e.target.value)}
                    aria-label="Specialist agent override"
                    className="bg-[#0D1527] border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-hud text-[11px] text-cyan-200"
                  >
                    <option value="">AGENT: AUTO-SELECT (14)</option>
                    {(status?.agents || []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={dispatchProviderId}
                    onChange={(e) => setDispatchProviderId(e.target.value)}
                    aria-label="Free provider override"
                    className="bg-[#0D1527] border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-hud text-[11px] text-emerald-200"
                  >
                    <option value="">PROVIDER: AUTO $0 CHAIN</option>
                    {(status?.providers || [])
                      .filter((p) => p.eligibleForZeroCost)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} {p.configured ? '✓' : '(not set)'}
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={runningDispatch || !prompt.trim()}
                  className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer"
                >
                  {runningDispatch ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{runningDispatch ? 'ORCHESTRATING...' : 'DISPATCH TO BRAIN'}</span>
                </button>
              </div>
            </form>

            {progressSteps.length > 0 && (
              <div className="rounded-xl bg-[#040812] border border-cyan-500/30 p-3 space-y-1.5 font-mono-hud text-[11px]">
                <p className="text-[10px] font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>LIVE ORCHESTRATION TELEMETRY</span>
                </p>
                {progressSteps.map((step, i) => (
                  <p key={i} className="text-slate-300">
                    • [{String(step.stage).toUpperCase()}]{' '}
                    {step.reason
                      ? String(step.reason)
                      : step.agentName
                        ? `${String(step.agentName)} ${step.status ? `→ ${String(step.status)} (${String(step.provider || '')})` : 'started'}`
                        : step.confidenceScore !== undefined
                          ? `Verification confidence ${String(step.confidenceScore)}% (${String(step.confidenceLevel)})`
                          : 'Completed stage'}
                  </p>
                ))}
              </div>
            )}

            {dispatchError && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3.5 font-mono-hud text-xs text-rose-200">
                {dispatchError}
              </div>
            )}

            {dispatchMeta && (
              <div className="rounded-xl bg-[#040812] border border-violet-500/35 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono-hud text-[10px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 font-bold uppercase">
                      {dispatchMeta.brainMode || 'DIRECT'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300">
                      {dispatchMeta.providerLabel} • {dispatchMeta.model}
                    </span>
                    {dispatchMeta.verification && (
                      <span className="px-2 py-0.5 rounded bg-violet-500/15 border border-violet-400/40 text-violet-200 font-bold">
                        CONFIDENCE {dispatchMeta.verification.confidenceScore}% ({dispatchMeta.verification.confidenceLevel})
                      </span>
                    )}
                  </div>
                  {onSpeakText && dispatchAnswer && (
                    <button
                      type="button"
                      onClick={() => onSpeakText(dispatchAnswer)}
                      className="px-2.5 py-1 rounded-lg bg-[#0D1527] border border-cyan-400/50 text-cyan-200 cursor-pointer"
                    >
                      SPEAK ANSWER
                    </button>
                  )}
                </div>

                {dispatchAnswer && (
                  <div className="prose prose-invert prose-sm max-w-none pt-2 border-t border-slate-800">
                    <MarkdownMessage content={dispatchAnswer} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'providers' && status && (
          <BrainProvidersTab
            providers={status.providers}
            testingProviderId={testingProviderId}
            onTestProvider={async (id) => {
              setTestingProviderId(id);
              try {
                await testBrainProvider(id);
                await loadStatus();
              } finally {
                setTestingProviderId(null);
              }
            }}
            onToggleProvider={async (id, enabled) => {
              await updateBrainProvider(id, { enabled });
              await loadStatus();
            }}
            onResetCooldowns={async (id) => {
              await resetBrainCooldowns(id);
              await loadStatus();
            }}
            onRegisterCustom={async (payload) => {
              const res = await registerCustomBrainProvider(payload);
              if (res.ok) await loadStatus();
              return res;
            }}
          />
        )}

        {activeTab === 'models_router' && status && (
          <BrainModelsRouterTab
            providers={status.providers}
            router={status.router}
            coordinator={status.coordinator}
            onUpdatePolicy={async (patch) => {
              await updateBrainRouterPolicy(patch);
              await loadStatus();
            }}
          />
        )}

        {activeTab === 'agents' && status && (
          <BrainAgentsTab
            agents={status.agents}
            providers={status.providers}
            onUpdateAgent={async (id, patch) => {
              await updateBrainAgent(id, patch);
              await loadStatus();
            }}
            onDispatchAgentTest={(agentId, samplePrompt) => {
              setPrompt(samplePrompt);
              setDispatchAgentId(agentId);
              void executeCoordination(samplePrompt, { agentId, collaborationMode: 'off' });
            }}
          />
        )}

        {activeTab === 'collaboration' && status && (
          <BrainCollaborationTab
            collaborations={status.recentCollaborations}
            onRunDemoCollaboration={(sample) => {
              setPrompt(sample);
              setDispatchCollabMode('on');
              void executeCoordination(sample, { collaborationMode: 'on' });
            }}
          />
        )}

        {activeTab === 'shared_memory' && (
          <BrainSharedMemoryTab
            memories={memories}
            onExportMemories={async () => {
              const payload = await exportSharedMemories();
              triggerFileDownload(
                JSON.stringify(payload, null, 2),
                `jarvis-shared-memory-${new Date().toISOString().slice(0, 10)}.json`,
                'application/json;charset=utf-8'
              );
            }}
            onImportMemories={async (rawJson) => {
              try {
                const parsed = JSON.parse(rawJson);
                const list = Array.isArray(parsed)
                  ? parsed
                  : Array.isArray(parsed?.memories)
                    ? parsed.memories
                    : null;
                if (!list) {
                  return { ok: false, message: 'Invalid backup JSON: expected a memories array.' };
                }
                const res = await importSharedMemories(list);
                if (!res.ok) {
                  return { ok: false, message: res.error || 'Import failed.' };
                }
                await onRefreshMemoriesFromServer?.();
                return {
                  ok: true,
                  message: `Imported shared memory backup: +${res.added} added, ${res.updated} updated, ${res.skipped} skipped (duplicates/secrets filtered).`,
                };
              } catch {
                return { ok: false, message: 'Could not parse JSON backup file.' };
              }
            }}
          />
        )}

        {activeTab === 'usage' && status && <BrainUsageTab usage={status.usage} />}
        {activeTab === 'errors' && status && <BrainErrorsTab errors={status.recentErrors} />}
        {activeTab === 'tasks' && status && <BrainTasksHistoryTab tasks={status.recentTasks} />}
        {activeTab === 'health_audit' && status && (
          <BrainHealthAuditTab health={status.systemHealth} auditLogs={status.auditLogs} />
        )}
      </div>
    </div>
  );
};

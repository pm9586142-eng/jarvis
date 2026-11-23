import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  Globe,
  HardDrive,
  Layers,
  Network,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  Trash2,
  Volume2,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  OpenJarvisAgentRunResponse,
  OpenJarvisDocumentItem,
  OpenJarvisResearchReport,
  OpenJarvisSearchResultItem,
  OpenJarvisStatusSnapshot,
  OpenJarvisTabId,
} from '../types/openjarvis';
import {
  configureOpenJarvisEngine,
  createOpenJarvisWorkflow,
  deleteOpenJarvisDocument,
  deleteOpenJarvisWorkflow,
  discoverOpenJarvisEngines,
  discoverOpenJarvisMcpTools,
  executeOpenJarvisTool,
  fetchOpenJarvisStatus,
  indexOpenJarvisDocument,
  invokeOpenJarvisMcpTool,
  listOpenJarvisDocuments,
  markOpenJarvisNotificationsRead,
  probeOpenJarvisEngine,
  rateOpenJarvisTrace,
  registerOpenJarvisMcpServer,
  runOpenJarvisAgent,
  runOpenJarvisBenchmark,
  runOpenJarvisDeepResearch,
  runOpenJarvisWorkflowNow,
  searchOpenJarvisHybridMemory,
  updateOpenJarvisLearningPolicy,
} from '../services/openjarvisApi';

interface OpenJarvisWorkspaceViewProps {
  onSpeakText?: (text: string) => void;
  initialPrompt?: string;
}

const TABS: Array<{ id: OpenJarvisTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'agents', label: '10 Agents & Orchestrator', icon: Bot },
  { id: 'intelligence', label: 'Intelligence & Engines', icon: Cpu },
  { id: 'memory', label: 'Hybrid RAG & Tools', icon: Database },
  { id: 'research', label: 'Deep Research', icon: Globe },
  { id: 'automation', label: 'Monitors & MCP', icon: Clock },
  { id: 'learning', label: 'Learning & Traces', icon: Activity },
];

export const OpenJarvisWorkspaceView: React.FC<OpenJarvisWorkspaceViewProps> = ({
  onSpeakText,
  initialPrompt = '',
}) => {
  const [activeTab, setActiveTab] = useState<OpenJarvisTabId>('agents');
  const [status, setStatus] = useState<OpenJarvisStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab 1: Agents runner
  const [assistantMode, setAssistantMode] = useState<string>('auto');
  const [agentId, setAgentId] = useState<string>('auto');
  const [engineId, setEngineId] = useState<string>('auto');
  const [promptInput, setPromptInput] = useState<string>(initialPrompt);
  const [runningAgent, setRunningAgent] = useState(false);
  const [agentOutcome, setAgentOutcome] = useState<OpenJarvisAgentRunResponse | null>(null);
  const [pendingConfirmToken, setPendingConfirmToken] = useState<string | null>(null);

  // Tab 2: Engines config inputs
  const [engineUrlDrafts, setEngineUrlDrafts] = useState<Record<string, string>>({});
  const [probingEngine, setProbingEngine] = useState<string | null>(null);

  // Tab 3: Hybrid Memory & Sandbox Tools
  const [docTitle, setDocTitle] = useState('');
  const [docText, setDocText] = useState('');
  const [docs, setDocs] = useState<OpenJarvisDocumentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'bm25' | 'vector' | 'colbert'>('hybrid');
  const [searchResults, setSearchResults] = useState<OpenJarvisSearchResultItem[]>([]);
  const [toolId, setToolId] = useState('calculator');
  const [toolArgInput, setToolArgInput] = useState('sqrt(144) + 25 * 4');
  const [toolOutput, setToolOutput] = useState<string | null>(null);

  // Tab 4: Deep Research
  const [researchTopic, setResearchTopic] = useState('');
  const [runningResearch, setRunningResearch] = useState(false);
  const [activeReport, setActiveReport] = useState<{
    report: OpenJarvisResearchReport;
    steps: Array<{ phase: string; detail: string }>;
    citations: Array<{ kind: string; title: string; uri?: string; score?: number }>;
  } | null>(null);
  const [researchHistory, setResearchHistory] = useState<OpenJarvisResearchReport[]>([]);

  // Tab 5: Automation & MCP
  const [wfName, setWfName] = useState('');
  const [wfKind, setWfKind] = useState<'monitor_operative' | 'scheduled_workflow' | 'research_watch'>('monitor_operative');
  const [wfInterval, setWfInterval] = useState(30);
  const [wfPrompt, setWfPrompt] = useState('');
  const [wfConfirmToken, setWfConfirmToken] = useState<string | null>(null);
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpAllowlist, setMcpAllowlist] = useState('');
  const [mcpMessage, setMcpMessage] = useState<string | null>(null);

  // Tab 6: Benchmarks
  const [runningBench, setRunningBench] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [snap, docPayload] = await Promise.all([
        fetchOpenJarvisStatus(),
        listOpenJarvisDocuments(),
      ]);
      setStatus(snap);
      setDocs(docPayload.documents || []);
      setResearchHistory(docPayload.researchHistory || []);
      setEngineUrlDrafts((prev) => {
        const next = { ...prev };
        for (const e of snap.engines) {
          if (next[e.id] === undefined) next[e.id] = e.baseUrl || e.defaultUrl;
        }
        return next;
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach OpenJarvis backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleRunAgent = async (confirmTokenOverride?: string) => {
    if (!promptInput.trim()) return;
    setRunningAgent(true);
    setErrorMsg(null);
    try {
      const res = await runOpenJarvisAgent({
        prompt: promptInput.trim(),
        agentId,
        assistantMode,
        engineId,
        confirmToken: confirmTokenOverride || null,
      });
      setAgentOutcome(res);
      if (res.requiresConfirmation && res.confirmationToken) {
        setPendingConfirmToken(res.confirmationToken);
      } else {
        setPendingConfirmToken(null);
        void loadAll();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Agent execution error');
    } finally {
      setRunningAgent(false);
    }
  };

  const handleEngineProbe = async (id: string) => {
    setProbingEngine(id);
    try {
      await probeOpenJarvisEngine(id);
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Engine probe failed');
    } finally {
      setProbingEngine(null);
    }
  };

  const handleEngineSave = async (id: string, makeDefault = false) => {
    setErrorMsg(null);
    try {
      await configureOpenJarvisEngine(id, {
        baseUrl: engineUrlDrafts[id] || '',
        makeDefault,
      });
      await probeOpenJarvisEngine(id);
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Engine configuration rejected');
    }
  };

  const handleIndexDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docText.trim()) return;
    try {
      await indexOpenJarvisDocument({ title: docTitle.trim(), text: docText.trim() });
      setDocTitle('');
      setDocText('');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Indexing failed');
    }
  };

  const handleHybridSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await searchOpenJarvisHybridMemory({ query: searchQuery.trim(), mode: searchMode, limit: 8 });
      setSearchResults(res.results || []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Hybrid search failed');
    }
  };

  const handleToolRun = async () => {
    setToolOutput(null);
    try {
      const args: Record<string, unknown> =
        toolId === 'calculator'
          ? { expression: toolArgInput }
          : toolId === 'think'
            ? { thought: toolArgInput }
            : toolId === 'web_search'
              ? { query: toolArgInput }
              : toolId === 'file_list'
                ? { subdir: toolArgInput || '.' }
                : toolId === 'file_read'
                  ? { path: toolArgInput || 'README.md' }
                  : toolId === 'document_retrieve'
                    ? { query: toolArgInput, mode: 'hybrid' }
                    : toolId === 'sandbox_js_eval'
                      ? { code: toolArgInput }
                      : { query: toolArgInput };
      const res = await executeOpenJarvisTool(toolId, args);
      setToolOutput(String(res.text || JSON.stringify(res, null, 2)));
    } catch (err) {
      setToolOutput(`Blocked / Error: ${err instanceof Error ? err.message : 'Execution failed'}`);
    }
  };

  const handleDeepResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchTopic.trim()) return;
    setRunningResearch(true);
    setErrorMsg(null);
    try {
      const res = await runOpenJarvisDeepResearch({
        query: researchTopic.trim(),
        engineId: engineId === 'auto' ? undefined : engineId,
      });
      setActiveReport({
        report: res.report,
        steps: res.steps || [],
        citations: res.citations || [],
      });
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Deep Research failed');
    } finally {
      setRunningResearch(false);
    }
  };

  const handleCreateWorkflow = async (confirmTok?: string) => {
    if (!wfName.trim()) return;
    try {
      const res = await createOpenJarvisWorkflow({
        name: wfName.trim(),
        kind: wfKind,
        scheduleIntervalMinutes: wfInterval,
        prompt: wfPrompt.trim(),
        confirmToken: confirmTok || null,
      });
      if (res.requiresConfirmation && typeof res.confirmationToken === 'string') {
        setWfConfirmToken(res.confirmationToken);
      } else {
        setWfConfirmToken(null);
        setWfName('');
        setWfPrompt('');
        await loadAll();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Workflow creation failed');
    }
  };

  const handleRegisterMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMcpMessage(null);
    try {
      const allowed = mcpAllowlist
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await registerOpenJarvisMcpServer({
        name: mcpName.trim(),
        url: mcpUrl.trim(),
        allowedTools: allowed,
      });
      if (!res.ok) {
        setMcpMessage(String(res.error || 'Rejected MCP registration'));
        return;
      }
      setMcpName('');
      setMcpUrl('');
      setMcpAllowlist('');
      setMcpMessage('MCP server registered securely.');
      await loadAll();
    } catch (err) {
      setMcpMessage(err instanceof Error ? err.message : 'MCP registration failed');
    }
  };

  if (loading && !status) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-8 text-center font-mono-hud text-xs text-cyan-300">
          Initializing OpenJarvis Architecture (Intelligence • Engines • Agents • Hybrid RAG • Learning)...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 pb-24">
      {/* Top Status Banner */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#071326] via-[#050E1E] to-[#08172F] p-4 sm:p-5 shadow-[0_0_30px_rgba(0,229,255,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-[#00E5FF]" />
              <h2 className="font-display text-base sm:text-lg font-bold tracking-wider text-slate-100">
                OPENJARVIS CORE EXTENSION
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-hud bg-emerald-500/15 border border-emerald-400/40 text-emerald-300">
                AM AI API UNCHANGED
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              5 Pillars Active • {status?.assistantModes.length || 10} Unified Assistants •{' '}
              {status?.engines.length || 6} Engines • BM25 + Vector + ColBERT Hybrid Memory
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#040B16] border border-cyan-500/25 font-mono-hud text-[11px] text-cyan-200">
              Runtime: {status?.hardware.runtimeMode || 'node'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#040B16] border border-cyan-500/25 font-mono-hud text-[11px] text-cyan-200">
              Python Service: {status?.pythonService.connected ? 'CONNECTED' : 'STANDBY'}
            </span>
            <button
              type="button"
              onClick={() => void loadAll()}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-xs font-mono-hud flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Tab Strip */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono-hud flex items-center gap-2 border transition-all cursor-pointer ${
                active
                  ? 'bg-[#00E5FF]/15 border-[#00E5FF]/60 text-cyan-100 shadow-[0_0_16px_rgba(0,229,255,0.2)]'
                  : 'bg-[#071326]/70 border-cyan-500/20 text-slate-300 hover:border-cyan-400/40'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-[#00E5FF]' : 'text-slate-400'}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: UNIFIED 10 AGENTS & ORCHESTRATOR */}
      {activeTab === 'agents' && status && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3">
              <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> 10 Unified Assistant Modes
              </h3>
              <div className="grid grid-cols-1 gap-1.5 max-h-[340px] overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setAssistantMode('auto')}
                  className={`text-left px-3 py-2 rounded-xl border text-xs cursor-pointer ${
                    assistantMode === 'auto'
                      ? 'bg-[#00E5FF]/15 border-[#00E5FF]/60 text-cyan-100'
                      : 'bg-[#040B16]/70 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold">Auto Mode Classifier</div>
                  <div className="text-[11px] text-slate-400">Routes prompt to optimal mode & OpenJarvis agent</div>
                </button>
                {status.assistantModes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAssistantMode(m.id)}
                    className={`text-left px-3 py-2 rounded-xl border text-xs cursor-pointer ${
                      assistantMode === m.id
                        ? 'bg-[#00E5FF]/15 border-[#00E5FF]/60 text-cyan-100'
                        : 'bg-[#040B16]/70 border-slate-800 text-slate-300 hover:border-cyan-500/30'
                    }`}
                  >
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-2">{m.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-2.5">
              <label className="block font-mono-hud text-[11px] text-cyan-300 uppercase">
                OpenJarvis Agent Architecture
              </label>
              <select
                aria-label="OpenJarvis Agent"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#040B16] border border-cyan-500/30 text-xs text-slate-100"
              >
                <option value="auto">Auto (Matched by Assistant Mode)</option>
                {status.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.availability !== 'available' ? '(Optional External Runtime)' : ''}
                  </option>
                ))}
              </select>

              <label className="block font-mono-hud text-[11px] text-cyan-300 uppercase pt-1">
                Inference Engine
              </label>
              <select
                aria-label="Inference Engine"
                value={engineId}
                onChange={(e) => setEngineId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#040B16] border border-cyan-500/30 text-xs text-slate-100"
              >
                <option value="auto">Auto (Learning Policy UCB1)</option>
                {status.engines.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name} [{eng.status}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Task & Multi-Agent Execution Console
                </h3>
                <span className="text-[11px] font-mono-hud text-slate-400">
                  Zero-Trust Guard & Secret Redaction Active
                </span>
              </div>

              <textarea
                rows={4}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Ask any Assistant Mode (English, Hindi, or Hinglish)... e.g., 'Calculate sqrt(625) + 48 and search our hybrid memory for architecture notes'"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#040B16] border border-cyan-500/30 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00E5FF]"
              />

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={runningAgent || !promptInput.trim()}
                  onClick={() => void handleRunAgent()}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 disabled:opacity-50 border border-[#00E5FF]/60 text-cyan-100 font-mono-hud text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  {runningAgent ? 'Running Agent...' : 'Execute OpenJarvis Agent'}
                </button>
              </div>

              {pendingConfirmToken && (
                <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/50 space-y-2">
                  <div className="text-xs font-semibold text-amber-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Explicit User Confirmation Required
                  </div>
                  <p className="text-xs text-amber-100/90">
                    Reasons: {(agentOutcome?.reasons || []).map((r) => r.label).join(', ') || 'Sensitive operation'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRunAgent(pendingConfirmToken)}
                    className="min-h-[40px] px-4 py-1.5 rounded-lg bg-amber-500/30 border border-amber-300 text-xs font-mono-hud text-amber-100 cursor-pointer"
                  >
                    Approve & Run Task
                  </button>
                </div>
              )}
            </div>

            {agentOutcome && (
              <div className="rounded-2xl border border-cyan-500/30 bg-[#040B16]/95 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono-hud">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-200">
                      {agentOutcome.assistantName || agentOutcome.assistantMode}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-200">
                      {agentOutcome.agentName || agentOutcome.agentId}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-200">
                      {agentOutcome.engineId || 'engine'} • {agentOutcome.modelUsed || 'model'}
                    </span>
                    {agentOutcome.latencyMs && (
                      <span className="text-slate-400">{agentOutcome.latencyMs}ms</span>
                    )}
                  </div>
                  {agentOutcome.answer && onSpeakText && (
                    <button
                      type="button"
                      onClick={() => onSpeakText(agentOutcome.answer || '')}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 text-xs font-mono-hud flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Speak
                    </button>
                  )}
                </div>

                {agentOutcome.ok ? (
                  <div className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {agentOutcome.answer}
                  </div>
                ) : (
                  <div className="text-xs text-amber-200">{agentOutcome.error}</div>
                )}

                {(agentOutcome.steps?.length || 0) > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <div className="font-mono-hud text-[10px] uppercase text-slate-400">Execution Trace Steps</div>
                    <div className="flex flex-wrap gap-1.5">
                      {agentOutcome.steps?.map((s, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 rounded-lg bg-[#071326] border border-cyan-500/20 text-[11px] text-slate-300"
                        >
                          <strong className="text-cyan-300">{s.phase}:</strong> {s.detail}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INTELLIGENCE CATALOG & 6 ENGINES */}
      {activeTab === 'intelligence' && status && (
        <div className="space-y-5">
          {/* Hardware Card */}
          <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4">
            <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4" /> Host Hardware & Intelligence-Per-Watt Advisor
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#040B16] border border-slate-800">
                <div className="text-slate-400">CPU / Arch</div>
                <div className="font-semibold text-slate-100 mt-0.5">
                  {status.hardware.cpuCores} Cores • {status.hardware.arch}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#040B16] border border-slate-800">
                <div className="text-slate-400">System RAM</div>
                <div className="font-semibold text-slate-100 mt-0.5">
                  {status.hardware.freeRamGb}GB Free / {status.hardware.totalRamGb}GB
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#040B16] border border-slate-800">
                <div className="text-slate-400">GPU VRAM</div>
                <div className="font-semibold text-slate-100 mt-0.5">
                  {status.hardware.gpu.detected
                    ? `${status.hardware.gpu.name} (${status.hardware.gpu.vramTotalGb}GB)`
                    : 'Not Detected'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#040B16] border border-slate-800">
                <div className="text-slate-400">Runtime Scope</div>
                <div className="font-semibold text-cyan-200 mt-0.5">{status.hardware.runtimeMode}</div>
              </div>
            </div>
          </div>

          {/* 6 Engines */}
          <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <Server className="w-4 h-4" /> Local & Cloud Inference Engines
              </h3>
              <button
                type="button"
                onClick={() => void discoverOpenJarvisEngines(true).then(() => loadAll())}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono-hud text-cyan-200 cursor-pointer"
              >
                Discover All Engines
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {status.engines.map((eng) => (
                <div key={eng.id} className="p-3.5 rounded-xl bg-[#040B16] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-100">
                      {eng.name}{' '}
                      {eng.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 ml-1">
                          DEFAULT
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-[10px] font-mono-hud px-2 py-0.5 rounded-full ${
                        eng.status === 'connected'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-700/60 text-slate-300'
                      }`}
                    >
                      {eng.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{eng.lastMessage}</p>
                  {eng.id !== 'amai_cloud' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={engineUrlDrafts[eng.id] || ''}
                        onChange={(e) =>
                          setEngineUrlDrafts((prev) => ({ ...prev, [eng.id]: e.target.value }))
                        }
                        placeholder={eng.defaultUrl}
                        className="flex-1 min-h-[38px] px-2.5 py-1 rounded-lg bg-[#071326] border border-slate-700 text-xs text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => void handleEngineSave(eng.id, false)}
                        className="min-h-[38px] px-3 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono-hud text-cyan-200 cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={probingEngine === eng.id}
                      onClick={() => void handleEngineProbe(eng.id)}
                      className="min-h-[36px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono-hud text-slate-200 cursor-pointer"
                    >
                      {probingEngine === eng.id ? 'Probing...' : 'Health Probe'}
                    </button>
                    {!eng.isDefault && eng.configured && (
                      <button
                        type="button"
                        onClick={() => void handleEngineSave(eng.id, true)}
                        className="min-h-[36px] px-2.5 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-[11px] font-mono-hud text-indigo-200 cursor-pointer"
                      >
                        Set OpenJarvis Default
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Catalog */}
          <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3">
            <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300">
              OpenJarvis Built-in Model Catalog ({status.models.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {status.models.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-[#040B16] border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">{m.name}</span>
                    <span
                      className={`text-[10px] font-mono-hud px-2 py-0.5 rounded ${
                        m.recommended
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {m.fitStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{m.fitReason}</div>
                  <div className="text-[10px] font-mono-hud text-cyan-300/80">
                    Engines: {m.engines.join(', ')} • ~{m.wattsEstimate}W
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HYBRID MEMORY & SAFE TOOLS */}
      {activeTab === 'memory' && status && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3">
              <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <Search className="w-4 h-4" /> Hybrid Retrieval (BM25 + Vector + ColBERT MaxSim)
              </h3>
              <form onSubmit={handleHybridSearch} className="space-y-2.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search indexed documents & AM AI memory vault..."
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#040B16] border border-cyan-500/30 text-xs text-slate-100"
                  />
                  <select
                    aria-label="Retrieval Mode"
                    value={searchMode}
                    onChange={(e) => setSearchMode(e.target.value as 'hybrid' | 'bm25' | 'vector' | 'colbert')}
                    className="min-h-[42px] px-2.5 rounded-xl bg-[#040B16] border border-cyan-500/30 text-xs text-cyan-200"
                  >
                    <option value="hybrid">Hybrid RRF</option>
                    <option value="bm25">Okapi BM25</option>
                    <option value="vector">Dense Vector</option>
                    <option value="colbert">ColBERT MaxSim</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 rounded-xl bg-[#00E5FF]/20 border border-[#00E5FF]/50 text-xs font-mono-hud text-cyan-100 cursor-pointer"
                >
                  Run Hybrid Search
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono-hud">
                {Object.entries(status.memoryStats.backends).map(([k, avail]) => (
                  <span
                    key={k}
                    className={`px-2 py-0.5 rounded border ${
                      avail
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400'
                    }`}
                  >
                    {k}: {avail ? 'READY' : 'PYTHON OPTIONAL'}
                  </span>
                ))}
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {searchResults.map((r) => (
                  <div key={r.id} className="p-2.5 rounded-xl bg-[#040B16] border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between gap-2 font-semibold text-cyan-200">
                      <span>{r.title}</span>
                      <span className="font-mono-hud">score={r.score}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{r.text}</p>
                    <div className="text-[10px] font-mono-hud text-slate-400">
                      BM25: {r.scores.bm25} | Vector: {r.scores.vector} | ColBERT: {r.scores.colbert}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3">
              <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Index Document or Knowledge Chunk
              </h3>
              <form onSubmit={handleIndexDoc} className="space-y-2">
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Document Title"
                  className="w-full min-h-[40px] px-3 rounded-xl bg-[#040B16] border border-slate-700 text-xs text-slate-100"
                />
                <textarea
                  rows={3}
                  value={docText}
                  onChange={(e) => setDocText(e.target.value)}
                  placeholder="Paste text, notes, or technical reference to chunk and index..."
                  className="w-full px-3 py-2 rounded-xl bg-[#040B16] border border-slate-700 text-xs text-slate-100"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-4 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-xs font-mono-hud text-cyan-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Index into Hybrid Store
                </button>
              </form>

              {docs.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#040B16] border border-slate-800 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 truncate">{d.title}</div>
                        <div className="text-[10px] text-slate-400">{d.chunkCount} chunk(s) • {d.wordCount} words</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteOpenJarvisDocument(d.id).then(() => loadAll())}
                        aria-label={`Delete ${d.title}`}
                        className="p-2 text-slate-400 hover:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3 h-fit">
            <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Confined OpenJarvis Tool Sandbox
            </h3>
            <select
              aria-label="OpenJarvis Tool"
              value={toolId}
              onChange={(e) => {
                const next = e.target.value;
                setToolId(next);
                setToolArgInput(
                  next === 'calculator'
                    ? 'sqrt(144) + 25 * 4'
                    : next === 'file_list'
                      ? '.'
                      : next === 'file_read'
                        ? 'README.md'
                        : next === 'sandbox_js_eval'
                          ? '[1, 2, 3, 4, 5].reduce((a, b) => a + b, 0)'
                          : 'OpenJarvis hybrid memory'
                );
              }}
              className="w-full min-h-[42px] px-3 rounded-xl bg-[#040B16] border border-cyan-500/30 text-xs text-slate-100"
            >
              {status.tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.id})
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              value={toolArgInput}
              onChange={(e) => setToolArgInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#040B16] border border-slate-700 font-mono-hud text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => void handleToolRun()}
              className="min-h-[42px] px-4 rounded-xl bg-[#00E5FF]/20 border border-[#00E5FF]/50 text-xs font-mono-hud text-cyan-100 cursor-pointer"
            >
              Run Confined Tool
            </button>
            {toolOutput && (
              <pre className="p-3 rounded-xl bg-[#040B16] border border-slate-800 text-[11px] text-emerald-200 whitespace-pre-wrap overflow-x-auto">
                {toolOutput}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DEEP RESEARCH STUDIO */}
      {activeTab === 'research' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-4">
            <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <FlaskConical className="w-4 h-4" /> Deep Research Multi-Source Synthesis
            </h3>
            <form onSubmit={handleDeepResearch} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={researchTopic}
                onChange={(e) => setResearchTopic(e.target.value)}
                placeholder="Enter complex research topic (combines local Hybrid RAG + Tavily web grounding)..."
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#040B16] border border-cyan-500/30 text-sm text-slate-100"
              />
              <button
                type="submit"
                disabled={runningResearch || !researchTopic.trim()}
                className="min-h-[44px] px-5 rounded-xl bg-[#00E5FF]/20 border border-[#00E5FF]/60 text-xs font-mono-hud text-cyan-100 cursor-pointer disabled:opacity-50"
              >
                {runningResearch ? 'Synthesizing...' : 'Run Deep Research'}
              </button>
            </form>

            {activeReport && (
              <div className="p-4 rounded-xl bg-[#040B16] border border-cyan-500/25 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm text-cyan-200">{activeReport.report.query}</h4>
                  {onSpeakText && (
                    <button
                      type="button"
                      onClick={() => onSpeakText(activeReport.report.summary.slice(0, 800))}
                      className="min-h-[34px] px-2.5 rounded-lg bg-cyan-500/15 text-xs text-cyan-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Read Brief
                    </button>
                  )}
                </div>
                <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {activeReport.report.summary}
                </div>
                {activeReport.citations.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <div className="text-[10px] font-mono-hud text-slate-400 uppercase">Citations Used</div>
                    {activeReport.citations.map((c, idx) => (
                      <div key={idx} className="text-xs text-cyan-300">
                        [{c.kind}] {c.title} {c.uri ? `— ${c.uri}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3">
            <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300">
              Saved Research Briefs ({researchHistory.length})
            </h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {researchHistory.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveReport({ report: r, steps: [], citations: r.citations || [] })}
                  className="w-full text-left p-3 rounded-xl bg-[#040B16] border border-slate-800 hover:border-cyan-400/40 cursor-pointer"
                >
                  <div className="text-xs font-semibold text-cyan-200 truncate">{r.query}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-2 mt-1">{r.summary}</div>
                </button>
              ))}
              {researchHistory.length === 0 && (
                <p className="text-xs text-slate-400">Run Deep Research to build your cited knowledge archive.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUTOMATION, MONITOR OPERATIVE & MCP */}
      {activeTab === 'automation' && status && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3">
            <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Monitor Operatives & Scheduled Workflows
            </h3>
            <div className="text-[11px] text-slate-400">
              Scheduler mode: <span className="text-cyan-200">{status.automation.scheduler.runtimeMode}</span>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={wfName}
                onChange={(e) => setWfName(e.target.value)}
                placeholder="Workflow Name"
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#040B16] border border-slate-700 text-xs text-slate-100"
              />
              <div className="flex gap-2">
                <select
                  aria-label="Workflow Kind"
                  value={wfKind}
                  onChange={(e) => setWfKind(e.target.value as 'monitor_operative' | 'scheduled_workflow' | 'research_watch')}
                  className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#040B16] border border-slate-700 text-xs text-slate-100"
                >
                  <option value="monitor_operative">Monitor Operative</option>
                  <option value="research_watch">Research Watch</option>
                  <option value="scheduled_workflow">Scheduled Operative</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={wfInterval}
                  onChange={(e) => setWfInterval(Number(e.target.value) || 30)}
                  aria-label="Interval minutes"
                  className="w-24 min-h-[40px] px-2.5 rounded-xl bg-[#040B16] border border-slate-700 text-xs text-slate-100"
                />
              </div>
              <input
                type="text"
                value={wfPrompt}
                onChange={(e) => setWfPrompt(e.target.value)}
                placeholder="Workflow task or query..."
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#040B16] border border-slate-700 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={() => void handleCreateWorkflow()}
                className="min-h-[40px] px-4 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-xs font-mono-hud text-cyan-100 cursor-pointer"
              >
                Create Workflow
              </button>
              {wfConfirmToken && (
                <button
                  type="button"
                  onClick={() => void handleCreateWorkflow(wfConfirmToken)}
                  className="ml-2 min-h-[40px] px-4 rounded-xl bg-amber-500/25 border border-amber-400 text-xs font-mono-hud text-amber-100 cursor-pointer"
                >
                  Confirm Sensitive Workflow
                </button>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {status.automation.workflows.map((wf) => (
                <div key={wf.id} className="p-3 rounded-xl bg-[#040B16] border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">{wf.name}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void runOpenJarvisWorkflowNow(wf.id).then(() => loadAll())}
                        className="min-h-[32px] px-2.5 rounded-lg bg-cyan-500/15 text-[11px] font-mono-hud text-cyan-200 cursor-pointer"
                      >
                        Run Now
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteOpenJarvisWorkflow(wf.id).then(() => loadAll())}
                        aria-label={`Delete ${wf.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {wf.kind} • every {wf.scheduleIntervalMinutes}m • runs: {wf.runCount} • {wf.lastSummary}
                  </div>
                </div>
              ))}
            </div>

            {status.automation.notifications.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-mono-hud text-[10px] text-cyan-300 uppercase">Monitor Notifications</span>
                  <button
                    type="button"
                    onClick={() => void markOpenJarvisNotificationsRead().then(() => loadAll())}
                    className="text-[11px] text-cyan-300 underline cursor-pointer"
                  >
                    Mark Read
                  </button>
                </div>
                {status.automation.notifications.slice(0, 6).map((n) => (
                  <div key={n.id} className="p-2 rounded-lg bg-[#040B16] border border-slate-800 text-[11px]">
                    <div className="font-semibold text-slate-200">{n.title}</div>
                    <div className="text-slate-400">{n.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-3 h-fit">
            <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <Network className="w-4 h-4" /> MCP External Tool Servers (JSON-RPC + SSRF Guard)
            </h3>
            <form onSubmit={handleRegisterMcp} className="space-y-2">
              <input
                type="text"
                value={mcpName}
                onChange={(e) => setMcpName(e.target.value)}
                placeholder="MCP Server Name (e.g. GitHub Tools)"
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#040B16] border border-slate-700 text-xs text-slate-100"
              />
              <input
                type="text"
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
                placeholder="https://your-mcp-server.example/rpc"
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#040B16] border border-slate-700 text-xs text-slate-100"
              />
              <input
                type="text"
                value={mcpAllowlist}
                onChange={(e) => setMcpAllowlist(e.target.value)}
                placeholder="Tool allowlist (comma separated)"
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#040B16] border border-slate-700 text-xs text-slate-100"
              />
              <button
                type="submit"
                className="min-h-[40px] px-4 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-xs font-mono-hud text-cyan-100 cursor-pointer"
              >
                Register MCP Server
              </button>
              {mcpMessage && <div className="text-xs text-cyan-200">{mcpMessage}</div>}
            </form>

            <div className="space-y-2 pt-2">
              {status.mcpServers.map((s) => (
                <div key={s.id} className="p-3 rounded-xl bg-[#040B16] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-100">{s.name}</span>
                    <span className="font-mono-hud text-[10px] text-cyan-300">{s.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{s.lastMessage}</div>
                  <button
                    type="button"
                    onClick={() => void discoverOpenJarvisMcpTools(s.id).then(() => loadAll())}
                    className="min-h-[34px] px-3 rounded-lg bg-slate-800 text-[11px] font-mono-hud text-slate-200 cursor-pointer"
                  >
                    Discover Tools
                  </button>
                  {s.discoveredTools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {s.discoveredTools.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() =>
                            void invokeOpenJarvisMcpTool(s.id, t.name, true).then((r) =>
                              setMcpMessage(JSON.stringify(r))
                            )
                          }
                          className="px-2 py-1 rounded bg-cyan-500/15 border border-cyan-400/30 text-[11px] text-cyan-200 cursor-pointer"
                        >
                          Run {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {status.mcpServers.length === 0 && (
                <p className="text-xs text-slate-400">No external MCP tool servers registered yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: LEARNING TRACES, TELEMETRY & BENCHMARKS */}
      {activeTab === 'learning' && status && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[#071326]/90 border border-cyan-500/25">
              <div className="text-xs text-slate-400">Recorded Traces</div>
              <div className="text-xl font-bold text-slate-100 mt-1">{status.learning.summary.totalTraces}</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#071326]/90 border border-cyan-500/25">
              <div className="text-xs text-slate-400">Success Rate</div>
              <div className="text-xl font-bold text-emerald-300 mt-1">{status.learning.summary.successRate}%</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#071326]/90 border border-cyan-500/25">
              <div className="text-xs text-slate-400">Avg Latency</div>
              <div className="text-xl font-bold text-cyan-200 mt-1">{status.learning.summary.avgLatencyMs}ms</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#071326]/90 border border-cyan-500/25">
              <div className="text-xs text-slate-400">Est. Local Energy</div>
              <div className="text-xl font-bold text-amber-300 mt-1">
                {status.learning.summary.totalEstimatedJoules} J
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-hud text-xs text-cyan-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Adaptive Routing Policy:
              </span>
              {(['adaptive_ucb1', 'prefer_local', 'cloud_first'] as const).map((strat) => (
                <button
                  key={strat}
                  type="button"
                  onClick={() =>
                    void updateOpenJarvisLearningPolicy({
                      strategy: strat,
                      preferLocalWhenHealthy: strat === 'prefer_local',
                    }).then(() => loadAll())
                  }
                  className={`min-h-[36px] px-3 rounded-lg border text-xs font-mono-hud cursor-pointer ${
                    status.learning.policy.strategy === strat
                      ? 'bg-[#00E5FF]/20 border-[#00E5FF] text-cyan-100'
                      : 'bg-[#040B16] border-slate-700 text-slate-300'
                  }`}
                >
                  {strat}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={runningBench}
              onClick={() => {
                setRunningBench(true);
                void runOpenJarvisBenchmark(engineId === 'auto' ? 'amai_cloud' : engineId, 'native_react')
                  .then(() => loadAll())
                  .finally(() => setRunningBench(false));
              }}
              className="min-h-[40px] px-4 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-xs font-mono-hud text-emerald-200 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {runningBench ? 'Benchmarking...' : 'Run Live ReAct Benchmark'}
            </button>
          </div>

          <div className="rounded-2xl border border-cyan-500/25 bg-[#071326]/90 p-4 space-y-2.5">
            <h3 className="font-mono-hud text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <Brain className="w-4 h-4" /> Recent Execution Traces
            </h3>
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {status.learning.recentTraces.map((tr) => (
                <div key={tr.id} className="p-3 rounded-xl bg-[#040B16] border border-slate-800 space-y-1 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 font-mono-hud">
                      <span className={tr.ok ? 'text-emerald-300' : 'text-rose-300'}>
                        {tr.ok ? 'OK' : 'FAIL'}
                      </span>
                      <span className="text-cyan-200">{tr.agentId}</span>
                      <span className="text-slate-400">{tr.engineId} • {tr.modelUsed}</span>
                      <span className="text-slate-400">{tr.latencyMs}ms</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => void rateOpenJarvisTrace(tr.id, star).then(() => loadAll())}
                          aria-label={`Rate trace ${star} stars`}
                          className={`p-1 cursor-pointer ${
                            (tr.userRating || 0) >= star ? 'text-amber-400' : 'text-slate-600'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-slate-300">{tr.promptPreview}</div>
                  {tr.answerPreview && <div className="text-[11px] text-slate-400">{tr.answerPreview}</div>}
                </div>
              ))}
              {status.learning.recentTraces.length === 0 && (
                <p className="text-xs text-slate-400">Execute any OpenJarvis agent or benchmark to record telemetry traces.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

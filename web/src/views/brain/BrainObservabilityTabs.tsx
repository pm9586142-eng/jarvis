import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  Download,
  History,
  Search,
  Shield,
  Upload,
} from 'lucide-react';
import {
  BrainAuditEntry,
  BrainErrorEvent,
  BrainSystemHealth,
  BrainTaskRun,
  BrainUsageSnapshot,
  MemoryItem,
} from '../../types/jarvis';
import { getCanonicalBrainMemoryCategory } from '../../services/memoryDedupe.js';

const SEVEN_CATEGORIES = [
  'ALL',
  'USER_PREFERENCES',
  'IMPORTANT_INSTRUCTIONS',
  'PROJECT_CONTEXT',
  'CONVERSATION_SUMMARIES',
  'LONG_TERM_KNOWLEDGE',
  'TASK_HISTORY',
  'AGENT_EXECUTION_HISTORY',
] as const;

interface SharedMemoryTabProps {
  memories: MemoryItem[];
  onExportMemories: () => Promise<void>;
  onImportMemories: (rawJson: string) => Promise<{ ok: boolean; message: string }>;
}

export const BrainSharedMemoryTab: React.FC<SharedMemoryTabProps> = ({
  memories,
  onExportMemories,
  onImportMemories,
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      const canonical = getCanonicalBrainMemoryCategory(m.category);
      if (selectedCat !== 'ALL' && canonical !== selectedCat) return false;
      if (!q) return true;
      return (
        m.key.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        canonical.toLowerCase().includes(q)
      );
    });
  }, [memories, selectedCat, query]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await onImportMemories(text);
      setNotice(res.message);
      window.setTimeout(() => setNotice(null), 4000);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            SHARED MULTI-AI MEMORY STORE (7 CATEGORIES • SECRET-FILTERED)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Shared across all 14 specialists and 11+ providers with deduplication, importance scoring, secret blocking, and JSON backups.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onExportMemories()}
            className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-cyan-500/40 hover:border-cyan-300 font-mono-hud text-[11px] text-cyan-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT JSON</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-emerald-500/40 hover:border-emerald-300 font-mono-hud text-[11px] text-emerald-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>IMPORT BACKUP</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl px-3.5 py-2 border border-emerald-400/50 bg-emerald-500/15 font-mono-hud text-xs text-emerald-200">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {SEVEN_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCat(cat)}
            className={`px-2.5 py-1 rounded-lg border font-mono-hud text-[10px] cursor-pointer ${
              selectedCat === cat
                ? 'bg-cyan-400/20 border-cyan-400 text-cyan-100 font-bold'
                : 'bg-[#040812] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shared memories across all 7 categories..."
          className="w-full bg-[#040812] border border-slate-800 focus:border-cyan-400 rounded-xl pl-9 pr-3 py-2 font-mono-hud text-xs text-slate-100 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="md:col-span-2 rounded-xl bg-[#040812] border border-slate-800 p-6 text-center font-mono-hud text-xs text-slate-400">
            No memories matched this filter.
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="rounded-xl bg-[#040812] border border-slate-800 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-hud text-xs font-bold text-cyan-200 truncate">{m.key}</span>
                <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-400/40 text-violet-200 shrink-0">
                  {getCanonicalBrainMemoryCategory(m.category)}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{m.content}</p>
              <p className="font-mono-hud text-[9px] text-slate-500">
                Importance {m.importance}/5 • Updated {new Date(m.updatedAt || m.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const BrainUsageTab: React.FC<{ usage: BrainUsageSnapshot }> = ({ usage }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-hud">
      <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
        <p className="text-[10px] text-slate-400">TOTAL REQUESTS</p>
        <p className="text-lg font-bold text-cyan-300 mt-1">{usage.totals.requests}</p>
        <p className="text-[10px] text-emerald-300">{usage.totals.successes} succeeded</p>
      </div>
      <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
        <p className="text-[10px] text-slate-400">EST. TOKENS</p>
        <p className="text-lg font-bold text-slate-100 mt-1">
          {(usage.totals.inputTokens + usage.totals.outputTokens).toLocaleString()}
        </p>
        <p className="text-[10px] text-slate-400">
          In {usage.totals.inputTokens.toLocaleString()} / Out {usage.totals.outputTokens.toLocaleString()}
        </p>
      </div>
      <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
        <p className="text-[10px] text-slate-400">429 & FALLBACKS</p>
        <p className="text-lg font-bold text-amber-300 mt-1">{usage.totals.fallbackSwitches}</p>
        <p className="text-[10px] text-slate-400">{usage.totals.rateLimits} rate limits handled</p>
      </div>
      <div className="rounded-xl bg-[#040812] border border-emerald-500/40 p-3">
        <p className="text-[10px] text-emerald-300">ESTIMATED API COST</p>
        <p className="text-lg font-bold text-emerald-300 mt-1">$0.00</p>
        <p className="text-[10px] text-emerald-400/80">Strict $0 Policy Enforced</p>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl bg-[#040812] border border-slate-800 p-4 space-y-2.5">
        <div className="flex items-center gap-2 font-mono-hud text-xs font-bold text-cyan-300">
          <BarChart3 className="w-4 h-4" />
          <span>PROVIDER METRICS</span>
        </div>
        {usage.providers.length === 0 ? (
          <p className="font-mono-hud text-xs text-slate-400 py-4">No Brain requests recorded yet in this session.</p>
        ) : (
          <div className="space-y-2">
            {usage.providers.map((p) => (
              <div
                key={p.providerId}
                className="rounded-xl bg-[#0D1527] border border-slate-800 px-3 py-2 flex items-center justify-between font-mono-hud text-[11px]"
              >
                <div>
                  <span className="font-bold text-slate-100 uppercase">{p.providerId}</span>
                  <span className="text-slate-400 ml-2">{p.avgLatencyMs}ms avg</span>
                </div>
                <div className="text-right text-[10px]">
                  <span className="text-emerald-300">{p.successes} OK</span>
                  {p.failures > 0 && <span className="text-rose-300 ml-2">{p.failures} ERR</span>}
                  {p.rateLimits > 0 && <span className="text-amber-300 ml-2">{p.rateLimits} 429</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-[#040812] border border-slate-800 p-4 space-y-2.5">
        <div className="flex items-center gap-2 font-mono-hud text-xs font-bold text-violet-300">
          <Database className="w-4 h-4" />
          <span>SPECIALIST AGENT INVOCATIONS & FALLBACKS</span>
        </div>
        {usage.agents.length === 0 && usage.recentFallbacks.length === 0 ? (
          <p className="font-mono-hud text-xs text-slate-400 py-4">No specialist runs or provider switches yet.</p>
        ) : (
          <div className="space-y-2">
            {usage.agents.map((a) => (
              <div
                key={a.agentId}
                className="rounded-xl bg-[#0D1527] border border-slate-800 px-3 py-2 flex items-center justify-between font-mono-hud text-[11px]"
              >
                <span className="text-cyan-200 font-bold">{a.agentId}</span>
                <span className="text-slate-300">
                  {a.invocations} run{a.invocations === 1 ? '' : 's'} • {a.avgLatencyMs}ms avg
                </span>
              </div>
            ))}
            {usage.recentFallbacks.slice(0, 5).map((fb) => (
              <div
                key={fb.id}
                className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 font-mono-hud text-[10px] text-amber-200"
              >
                FAILOVER: {fb.fromProvider} → {fb.toProvider} ({fb.toModel}) • {fb.reason}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

export const BrainErrorsTab: React.FC<{ errors: BrainErrorEvent[] }> = ({ errors }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 font-mono-hud text-xs font-bold text-rose-300">
      <AlertCircle className="w-4 h-4" />
      <span>REDACTED ERROR & GUARD MONITOR ({errors.length} EVENTS)</span>
    </div>
    {errors.length === 0 ? (
      <div className="rounded-2xl bg-[#040812] border border-emerald-500/30 p-6 text-center font-mono-hud text-xs text-emerald-300 flex items-center justify-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        <span>Zero runtime errors or blocked incidents recorded in this session.</span>
      </div>
    ) : (
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {errors.map((e) => (
          <div
            key={e.id}
            className="rounded-xl bg-[#040812] border border-rose-500/30 p-3 font-mono-hud text-xs space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-rose-200">
                [{e.category.toUpperCase()}] {e.code} {e.httpStatus ? `(HTTP ${e.httpStatus})` : ''}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-[11px] text-slate-300">{e.message}</p>
            {(e.providerId || e.modelId) && (
              <p className="text-[10px] text-slate-500">
                Provider: {e.providerId || '—'} • Model: {e.modelId || '—'}
              </p>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export const BrainTasksHistoryTab: React.FC<{ tasks: BrainTaskRun[] }> = ({ tasks }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 font-mono-hud text-xs font-bold text-cyan-300">
      <History className="w-4 h-4" />
      <span>TASK EXECUTION HISTORY ({tasks.length} RUNS)</span>
    </div>
    {tasks.length === 0 ? (
      <div className="rounded-2xl bg-[#040812] border border-slate-800 p-6 text-center font-mono-hud text-xs text-slate-400">
        No Multi-AI Brain tasks executed yet. Use the Coordinator tab or Neural Chat to dispatch tasks.
      </div>
    ) : (
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="rounded-xl bg-[#040812] border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2 font-mono-hud text-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="text-slate-100 font-semibold truncate">{t.promptPreview}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {t.type.toUpperCase()} • {t.complexity.toUpperCase()} • AGENTS: {t.agentsUsed.join(', ') || '—'} • {t.provider || '—'} ({t.model || '—'})
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[10px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t.durationMs ?? 0}ms
              </span>
              {t.confidenceScore !== null && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-cyan-200">
                  {t.confidenceScore}%
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded border font-bold ${
                  t.status === 'completed'
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                }`}
              >
                {t.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const BrainHealthAuditTab: React.FC<{
  health: BrainSystemHealth;
  auditLogs: BrainAuditEntry[];
}> = ({ health, auditLogs }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-hud text-xs">
      <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
        <p className="text-[10px] text-slate-400">BRAIN STATUS</p>
        <p
          className={`font-bold text-sm mt-1 uppercase ${
            health.status === 'healthy'
              ? 'text-emerald-300'
              : health.status === 'degraded'
                ? 'text-amber-300'
                : 'text-rose-300'
          }`}
        >
          {health.status}
        </p>
      </div>
      <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
        <p className="text-[10px] text-slate-400">RUNTIME / STORAGE</p>
        <p className="text-slate-100 font-bold mt-1 truncate">{health.runtime}</p>
        <p className="text-[10px] text-slate-400">{health.storageMode}</p>
      </div>
      <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
        <p className="text-[10px] text-slate-400">MEMORY (RSS / HEAP)</p>
        <p className="text-cyan-300 font-bold mt-1">
          {health.memoryMb.rss}MB / {health.memoryMb.heapUsed}MB
        </p>
      </div>
      <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
        <p className="text-[10px] text-slate-400">SECURITY GUARD</p>
        <p className="text-emerald-300 font-bold mt-1">
          {health.securityEvents.critical} CRIT / {health.securityEvents.warnings} WARN
        </p>
      </div>
    </div>

    <div className="rounded-2xl bg-[#040812] border border-slate-800 p-4 space-y-2.5">
      <div className="flex items-center gap-2 font-mono-hud text-xs font-bold text-cyan-300">
        <Shield className="w-4 h-4" />
        <span>REDACTED SECURITY & PROVIDER AUDIT LOG ({auditLogs.length} ENTRIES)</span>
      </div>
      {auditLogs.length === 0 ? (
        <p className="font-mono-hud text-xs text-slate-400 py-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-300" />
          <span>Audit log active — secrets are automatically redacted from all entries.</span>
        </p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {auditLogs.map((a) => (
            <div
              key={a.id}
              className="rounded-lg bg-[#0D1527] border border-slate-800 px-3 py-2 font-mono-hud text-[11px] flex flex-wrap items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <span
                  className={`font-bold mr-2 ${
                    a.severity === 'CRITICAL'
                      ? 'text-rose-300'
                      : a.severity === 'WARNING'
                        ? 'text-amber-300'
                        : 'text-cyan-300'
                  }`}
                >
                  [{a.category}]
                </span>
                <span className="text-slate-100">{a.action}</span>
                <span className="text-slate-400 ml-2">— {a.detail}</span>
              </div>
              <span className="text-[9px] text-slate-500 shrink-0">
                {new Date(a.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

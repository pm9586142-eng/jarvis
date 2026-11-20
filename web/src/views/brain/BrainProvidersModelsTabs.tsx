import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Sliders,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  BrainCoordinatorConfig,
  BrainPolicyPatch,
  BrainProviderInfo,
  BrainRoutingPolicy,
} from '../../types/jarvis';

interface ProvidersTabProps {
  providers: BrainProviderInfo[];
  testingProviderId: string | null;
  onTestProvider: (providerId: string) => Promise<void>;
  onToggleProvider: (providerId: string, enabled: boolean) => Promise<void>;
  onResetCooldowns: (providerId?: string) => Promise<void>;
  onRegisterCustom: (payload: {
    id: string;
    label: string;
    baseUrl: string;
    models: string[];
    verifiedZeroCost: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export const BrainProvidersTab: React.FC<ProvidersTabProps> = ({
  providers,
  testingProviderId,
  onTestProvider,
  onToggleProvider,
  onResetCooldowns,
  onRegisterCustom,
}) => {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customId, setCustomId] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customUrl, setCustomUrl] = useState('http://localhost:1234/v1');
  const [customModels, setCustomModels] = useState('llama-3.2-3b-instruct');
  const [customFreeConfirmed, setCustomFreeConfirmed] = useState(true);
  const [customStatus, setCustomStatus] = useState<string | null>(null);
  const [submittingCustom, setSubmittingCustom] = useState(false);

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomStatus(null);
    setSubmittingCustom(true);
    try {
      const models = customModels
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      const res = await onRegisterCustom({
        id: customId.trim(),
        label: customLabel.trim(),
        baseUrl: customUrl.trim(),
        models,
        verifiedZeroCost: customFreeConfirmed,
      });
      if (!res.ok) {
        setCustomStatus(`Blocked: ${res.error || 'Registration failed.'}`);
      } else {
        setCustomStatus('Registered custom $0 provider. Click Test Connection to probe live reachability.');
        setCustomId('');
        setCustomLabel('');
        setShowCustomForm(false);
      }
    } finally {
      setSubmittingCustom(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            MULTI-PROVIDER INFRASTRUCTURE ({providers.length} REGISTERED • STRICT $0 ENFORCED)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Keys live strictly on the server via environment variables. Click Test Connection to run a real upstream probe — status is never faked.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onResetCooldowns()}
            className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 font-mono-hud text-[11px] text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-300" />
            <span>RESET COOLDOWNS</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCustomForm((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-cyan-400/15 border border-cyan-400/60 hover:bg-cyan-400/25 font-mono-hud text-[11px] font-bold text-cyan-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD CUSTOM FREE ENDPOINT</span>
          </button>
        </div>
      </div>

      {customStatus && (
        <div className="rounded-xl px-3.5 py-2.5 border border-cyan-500/40 bg-cyan-500/10 font-mono-hud text-xs text-cyan-200">
          {customStatus}
        </div>
      )}

      {showCustomForm && (
        <form
          onSubmit={handleAddCustom}
          className="rounded-2xl bg-[#040812] border border-cyan-500/40 p-4 space-y-3"
        >
          <p className="font-mono-hud text-xs font-bold text-cyan-300">
            REGISTER CUSTOM OPENAI-COMPATIBLE $0 / LOCAL PROVIDER (SSRF-PROTECTED)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="Provider ID (e.g. lmstudio_local)"
              className="bg-[#0D1527] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <input
              type="text"
              required
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Display Name (e.g. LM Studio Local)"
              className="bg-[#0D1527] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <input
              type="url"
              required
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="Base URL (https://... or http://localhost:1234/v1)"
              className="bg-[#0D1527] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <input
              type="text"
              required
              value={customModels}
              onChange={(e) => setCustomModels(e.target.value)}
              placeholder="Model IDs comma-separated"
              className="bg-[#0D1527] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <p className="md:col-span-2 font-mono-hud text-[10px] text-slate-400">
              Auth keys are never sent from the browser. For remote HTTPS endpoints, set{' '}
              <span className="text-cyan-300">
                {(customId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_') || 'CUSTOM_ID')}_API_KEY
              </span>{' '}
              in Vercel or server environment variables.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={customFreeConfirmed}
                onChange={(e) => setCustomFreeConfirmed(e.target.checked)}
                className="accent-emerald-400"
              />
              <span>Confirm this endpoint is strictly $0 / local (required under Strict $0 Policy)</span>
            </label>
            <button
              type="submit"
              disabled={submittingCustom}
              className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {submittingCustom ? 'REGISTERING...' : 'REGISTER PROVIDER'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {providers.map((p) => {
          const isTesting = testingProviderId === p.id;
          const isBlockedPaid = !p.eligibleForZeroCost || p.status === 'blocked_paid';
          const stateColors: Record<string, string> = {
            CONNECTED: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300',
            UNTESTED: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200',
            UNCONFIGURED: 'bg-slate-800/70 border-slate-700 text-slate-400',
            BLOCKED_PAID_POLICY: 'bg-rose-500/15 border-rose-400/50 text-rose-200',
            AUTH_ERROR: 'bg-rose-500/15 border-rose-400/50 text-rose-200',
            RATE_LIMITED: 'bg-amber-500/15 border-amber-400/50 text-amber-200',
            UNREACHABLE: 'bg-amber-500/15 border-amber-400/50 text-amber-200',
          };
          const badgeClass = stateColors[p.connectionState] || stateColors.UNCONFIGURED;

          return (
            <div
              key={p.id}
              data-testid={`brain-provider-card-${p.id}`}
              className={`rounded-2xl bg-[#040812] border p-4 space-y-3 ${
                isBlockedPaid
                  ? 'border-rose-500/35'
                  : p.connectionState === 'CONNECTED'
                    ? 'border-emerald-500/40'
                    : p.configured
                      ? 'border-cyan-500/30'
                      : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-300 shrink-0" />
                    <h4 className="font-mono-hud text-xs font-bold text-slate-100 truncate">
                      {p.label}
                    </h4>
                    <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                      P{p.priority}
                    </span>
                  </div>
                  <p className="font-mono-hud text-[10px] text-slate-400 mt-1">
                    ENV: {p.envVars.join(' + ')} • {p.models.length} model{p.models.length === 1 ? '' : 's'}
                    {p.supportsVision ? ' • VISION' : ''}
                  </p>
                </div>

                <span className={`font-mono-hud text-[9px] font-bold px-2 py-1 rounded-lg border shrink-0 ${badgeClass}`}>
                  {p.connectionState}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 font-mono-hud text-[9px]">
                {isBlockedPaid ? (
                  <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-400/40 text-rose-200 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    PAID-ONLY • BLOCKED AT $0
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {p.requiresLiveZeroPricing ? '$0 LIVE PRICING VERIFIED' : `$0 ${p.billingTier.replace(/_/g, ' ').toUpperCase()}`}
                  </span>
                )}
                {p.cooldownRemainingSeconds > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200">
                    COOLDOWN {p.cooldownRemainingSeconds}S
                  </span>
                )}
                {p.lastProbeLatencyMs !== null && (
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    {p.lastProbeLatencyMs}ms
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">{p.freeQuotaNote}</p>

              <p className="font-mono-hud text-[10px] text-slate-400 bg-[#0D1527]/75 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
                {p.lastProbeMessage}
              </p>

              <div className="flex flex-wrap gap-1">
                {p.models.slice(0, 4).map((m) => (
                  <span
                    key={m.id}
                    className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-[#0D1527] border border-slate-800 text-slate-300"
                  >
                    {m.id}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={() => void onTestProvider(p.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-cyan-500/40 hover:border-cyan-300 disabled:opacity-50 font-mono-hud text-[10px] font-bold text-cyan-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {isTesting ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : p.connectionState === 'CONNECTED' ? (
                    <Wifi className="w-3 h-3 text-emerald-300" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{isTesting ? 'PROBING...' : 'TEST CONNECTION'}</span>
                </button>

                <button
                  type="button"
                  disabled={isBlockedPaid}
                  onClick={() => void onToggleProvider(p.id, !p.enabled)}
                  className={`px-3 py-1.5 rounded-lg border font-mono-hud text-[10px] font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    p.enabled && !isBlockedPaid
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {isBlockedPaid ? 'BLOCKED ($0)' : p.enabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ModelsRouterTabProps {
  providers: BrainProviderInfo[];
  router: BrainRoutingPolicy;
  coordinator: BrainCoordinatorConfig;
  onUpdatePolicy: (patch: BrainPolicyPatch) => Promise<void>;
}

export const BrainModelsRouterTab: React.FC<ModelsRouterTabProps> = ({
  providers,
  router,
  coordinator,
  onUpdatePolicy,
}) => {
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const freeProviders = providers.filter((p) => p.eligibleForZeroCost);
  const freeModels = freeProviders.flatMap((p) =>
    p.models.filter((m) => m.freeVerified).map((m) => ({ providerId: p.id, providerLabel: p.label, ...m }))
  );

  const applyPatch = async (patch: BrainPolicyPatch, msg: string) => {
    setSaving(true);
    setSavedMsg(null);
    try {
      await onUpdatePolicy(patch);
      setSavedMsg(msg);
      window.setTimeout(() => setSavedMsg(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {savedMsg && (
        <div className="rounded-xl px-3.5 py-2 border border-emerald-400/50 bg-emerald-500/15 font-mono-hud text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#040812] border border-slate-800 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-300" />
            <h4 className="font-mono-hud text-xs font-bold text-cyan-300">
              INTELLIGENT ROUTING STRATEGY
            </h4>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'auto', label: 'AUTO FAILOVER', desc: 'Priority free chain' },
                { id: 'task_based', label: 'TASK-BASED', desc: 'Domain affinity' },
                { id: 'manual', label: 'MANUAL PIN', desc: 'Preferred free model' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={saving}
                onClick={() => void applyPatch({ mode: opt.id }, `Routing mode switched to ${opt.label}.`)}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  router.mode === opt.id
                    ? 'bg-cyan-400/20 border-cyan-400 text-cyan-100'
                    : 'bg-[#0D1527] border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <p className="font-mono-hud text-[10px] font-bold">{opt.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="font-mono-hud text-[10px] text-slate-400">MANUAL PREFERRED PROVIDER ($0 ONLY)</span>
              <select
                value={router.manualProvider || ''}
                onChange={(e) =>
                  void applyPatch(
                    { manualProvider: e.target.value || null },
                    e.target.value ? `Preferred provider set to ${e.target.value}.` : 'Cleared preferred provider.'
                  )
                }
                className="w-full bg-[#0D1527] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
              >
                <option value="">Auto (Fallback Chain)</option>
                {freeProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} {p.configured ? '✓' : '(Key not set)'}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="font-mono-hud text-[10px] text-slate-400">MANUAL PREFERRED FREE MODEL</span>
              <select
                value={router.manualModel || ''}
                onChange={(e) =>
                  void applyPatch(
                    { manualModel: e.target.value || null },
                    e.target.value ? `Pinned free model ${e.target.value}.` : 'Cleared pinned model.'
                  )
                }
                className="w-full bg-[#0D1527] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
              >
                <option value="">Auto-Select Best Free Model</option>
                {freeModels.map((m) => (
                  <option key={`${m.providerId}-${m.id}`} value={m.id}>
                    [{m.providerId}] {m.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-2xl bg-[#040812] border border-slate-800 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-300" />
            <h4 className="font-mono-hud text-xs font-bold text-violet-300">
              COLLABORATION & VERIFICATION BUDGETS
            </h4>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'auto', label: 'SMART AUTO', desc: 'Complex tasks only' },
                { id: 'on', label: 'ALWAYS COLLAB', desc: 'Multi-agent peer check' },
                { id: 'off', label: 'FAST DIRECT', desc: 'Single specialist' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={saving}
                onClick={() =>
                  void applyPatch(
                    { collaborationMode: opt.id },
                    `Collaboration mode updated to ${opt.label}.`
                  )
                }
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  coordinator.collaborationMode === opt.id
                    ? 'bg-violet-500/20 border-violet-400 text-violet-100'
                    : 'bg-[#0D1527] border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <p className="font-mono-hud text-[10px] font-bold">{opt.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono-hud text-xs">
            <label className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>MAX PARALLEL AGENTS</span>
                <span className="text-cyan-300">{coordinator.maxAgents}</span>
              </div>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={coordinator.maxAgents}
                onChange={(e) =>
                  void applyPatch({ maxAgents: Number(e.target.value) }, `Max parallel agents set to ${e.target.value}.`)
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>TOKEN BUDGET / RUN</span>
                <span className="text-cyan-300">{coordinator.tokenBudget}</span>
              </div>
              <input
                type="range"
                min={2000}
                max={16000}
                step={500}
                value={coordinator.tokenBudget}
                onChange={(e) =>
                  void applyPatch({ tokenBudget: Number(e.target.value) }, `Token budget set to ${e.target.value}.`)
                }
                className="w-full accent-violet-400 cursor-pointer"
              />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#0D1527] border border-slate-800 px-3 py-2">
            <span className="font-mono-hud text-[11px] text-slate-200">
              Self-Verification & Contradiction Check
            </span>
            <button
              type="button"
              onClick={() =>
                void applyPatch(
                  { selfVerificationEnabled: !coordinator.selfVerificationEnabled },
                  `Self-verification ${!coordinator.selfVerificationEnabled ? 'enabled' : 'paused'}.`
                )
              }
              className={`px-3 py-1 rounded-lg border font-mono-hud text-[10px] font-bold cursor-pointer ${
                coordinator.selfVerificationEnabled
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {coordinator.selfVerificationEnabled ? 'ACTIVE' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Verified-Free Model Catalog */}
      <div className="rounded-2xl bg-[#040812] border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-300" />
            <h4 className="font-mono-hud text-xs font-bold text-emerald-300">
              VERIFIED $0 FREE-MODEL CATALOG ({freeModels.length} APPROVED MODELS)
            </h4>
          </div>
          <span className="font-mono-hud text-[10px] text-slate-400">
            FALLBACK CHAIN: {router.fallbackOrder.slice(0, 6).join(' → ')}...
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {freeModels.map((m) => (
            <div
              key={`${m.providerId}-${m.id}`}
              className="rounded-xl bg-[#0D1527] border border-slate-800 px-3 py-2 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-mono-hud text-[11px] font-semibold text-slate-100 truncate">{m.id}</p>
                <p className="font-mono-hud text-[9px] text-slate-400 truncate">
                  {m.providerLabel} • {m.domains.slice(0, 3).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {m.vision && (
                  <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-400/40 text-violet-200">
                    VL
                  </span>
                )}
                {m.cooldownRemainingSeconds > 0 ? (
                  <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200">
                    {m.cooldownRemainingSeconds}s
                  </span>
                ) : (
                  <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300">
                    $0
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {providers.some((p) => !p.eligibleForZeroCost) && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 flex items-center gap-2 font-mono-hud text-[10px] text-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Paid-only models (e.g., DeepSeek Direct API) are strictly excluded from routing under your $0 Verified-Free policy.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

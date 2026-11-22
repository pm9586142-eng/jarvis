import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  HardDrive,
  Laptop,
  Loader2,
  Mic,
  RefreshCw,
  Server,
  ShieldAlert,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { OllamaStatusResult, sharedLocalAiManager } from '../services/offline/localAiManager';
import { PC_LOCAL_MODEL_CATALOG } from '../services/offline/localModelCatalog';
import {
  AiRoutingMode,
  JarvisSettings,
  LocalModelCatalogEntry,
  LocalModelRuntimeState,
  WebGpuHardwareCapabilities,
} from '../types/jarvis';

interface LocalModelManagerPanelProps {
  settings: JarvisSettings;
  onUpdateSettings: (next: JarvisSettings) => void;
  onSystemEvent?: (
    category: 'LOCAL_AI' | 'ERROR',
    title: string,
    detail: string,
    severity?: 'info' | 'success' | 'warn' | 'error'
  ) => void;
}

export const LocalModelManagerPanel: React.FC<LocalModelManagerPanelProps> = ({
  settings,
  onUpdateSettings,
  onSystemEvent,
}) => {
  const [modelStates, setModelStates] = useState<LocalModelRuntimeState[]>(() =>
    sharedLocalAiManager.getStates()
  );
  const [caps, setCaps] = useState<WebGpuHardwareCapabilities | null>(() =>
    sharedLocalAiManager.getCachedCapabilities()
  );
  const [checkingCaps, setCheckingCaps] = useState(false);
  const [pendingConfirmModel, setPendingConfirmModel] = useState<LocalModelCatalogEntry | null>(
    null
  );
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatusResult | null>(null);
  const [probingOllama, setProbingOllama] = useState(false);

  useEffect(() => {
    const unsub = sharedLocalAiManager.subscribe(() => {
      setModelStates(sharedLocalAiManager.getStates());
    });
    void (async () => {
      setCheckingCaps(true);
      try {
        const nextCaps = await sharedLocalAiManager.refreshCapabilities();
        setCaps(nextCaps);
      } finally {
        setCheckingCaps(false);
      }
    })();
    return unsub;
  }, []);

  const refreshCaps = async () => {
    setCheckingCaps(true);
    try {
      const nextCaps = await sharedLocalAiManager.refreshCapabilities();
      setCaps(nextCaps);
    } finally {
      setCheckingCaps(false);
    }
  };

  const handleConfirmDownload = async () => {
    if (!pendingConfirmModel) return;
    const target = pendingConfirmModel;
    setPendingConfirmModel(null);
    onUpdateSettings({
      ...settings,
      selectedLocalModelId: target.id,
    });
    onSystemEvent?.(
      'LOCAL_AI',
      `Local Model Install Started: ${target.displayName}`,
      `Downloading ~${target.approxSizeMb} MB quantized (${target.quantization}) package to IndexedDB/Cache storage.`,
      'info'
    );
    try {
      await sharedLocalAiManager.downloadAndLoadModel(target.id);
    } catch (err) {
      onSystemEvent?.(
        'ERROR',
        `Local Model Install Failed`,
        err instanceof Error ? err.message : 'Unable to initialize Transformers.js worker.',
        'error'
      );
    }
  };

  const handleProbeOllama = async (enabledOverride?: boolean) => {
    const enabled = enabledOverride ?? Boolean(settings.ollamaEnabled);
    setProbingOllama(true);
    try {
      const res = await sharedLocalAiManager.probeOllama(
        enabled,
        settings.ollamaEndpoint || 'http://127.0.0.1:11434'
      );
      setOllamaStatus(res);
    } finally {
      setProbingOllama(false);
    }
  };

  const routingOptions: Array<{ id: AiRoutingMode; title: string; desc: string }> = [
    {
      id: 'hybrid',
      title: 'Hybrid (Cloud First → Local Fallback)',
      desc: 'Default: uses free Cloud AI online, automatically falls back to Local PC AI or Offline Command Engine.',
    },
    {
      id: 'online_only',
      title: 'Online Only',
      desc: 'Requires live internet & Cloud AI backend; never uses local weights.',
    },
    {
      id: 'local_only',
      title: 'Local Only (Privacy / Offline)',
      desc: 'Routes prompts strictly to your downloaded browser model or opt-in Ollama.',
    },
    {
      id: 'offline_command',
      title: 'Offline Command Engine Only',
      desc: 'Zero LLM latency — runs deterministic tasks, notes, memory, protocols, and app navigation.',
    },
  ];

  const activeRouting = settings.routingMode || 'hybrid';

  return (
    <section
      data-testid="local-model-manager-panel"
      className="glass-panel rounded-2xl p-5 space-y-5 border border-cyan-500/30"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Laptop className="w-4 h-4 text-[#00E5FF]" />
          <div>
            <h3 className="font-mono-hud text-xs font-bold text-[#00E5FF] tracking-wider uppercase">
              WINDOWS PC LOCAL AI & OFFLINE MODEL MANAGER
            </h3>
            <p className="text-xs text-slate-400">
              Browser-native WebGPU / WASM inference via Transformers.js, plus optional localhost Ollama adapter
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshCaps()}
          disabled={checkingCaps}
          className="px-3 py-1.5 rounded-lg bg-[#071326] border border-cyan-500/40 hover:border-cyan-300 font-mono-hud text-[11px] text-cyan-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checkingCaps ? 'animate-spin' : ''}`} />
          <span>RE-SCAN HARDWARE</span>
        </button>
      </div>

      {/* Real Hardware & Offline Voice Capabilities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 font-mono-hud text-xs">
        <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
          <p className="text-[10px] text-slate-400">BROWSER ACCELERATION</p>
          <p
            className={`font-bold mt-1 ${
              caps?.webGpuAvailable
                ? 'text-emerald-400'
                : caps?.wasmAvailable
                  ? 'text-cyan-300'
                  : 'text-rose-300'
            }`}
          >
            {caps?.webGpuAvailable
              ? 'WebGPU Ready (WASM fallback)'
              : caps?.wasmAvailable
                ? 'WASM / CPU Ready'
                : 'Unsupported Browser'}
          </p>
        </div>

        <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
          <p className="text-[10px] text-slate-400">SYSTEM RAM / CORES</p>
          <p className="font-bold text-slate-100 mt-1">
            {caps?.deviceMemoryGb != null ? `~${caps.deviceMemoryGb} GB` : 'Browser Masked'} •{' '}
            {caps?.cpuCores || navigator.hardwareConcurrency || 4} Cores
          </p>
        </div>

        <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
          <p className="text-[10px] text-slate-400">FREE BROWSER STORAGE</p>
          <p className="font-bold text-cyan-200 mt-1">
            {caps?.storageFreeMb != null
              ? `${caps.storageFreeMb.toLocaleString()} MB free`
              : 'Estimate Unavailable'}
          </p>
        </div>

        <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
          <p className="text-[10px] text-slate-400">LOCAL OFFLINE TTS / STT</p>
          <p className="font-bold text-amber-200 mt-1">
            {caps ? `${caps.localTtsVoicesCount} Local Voices` : 'Checking...'}
          </p>
        </div>
      </div>

      {/* Honest Browser Offline Voice Caveat */}
      <div className="rounded-xl bg-[#040812] border border-amber-400/35 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-100/90">
        <Mic className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-mono-hud text-[10px] font-bold text-amber-300 uppercase">
            HONEST PC VOICE ENGINE STATUS
          </p>
          <p className="text-slate-300">
            {caps?.speechRecognitionOfflineCaveat ||
              'SpeechSynthesis uses installed OS offline voices; Chrome/Edge Web SpeechRecognition requires internet.'}
          </p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
            <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
            <span>
              Installed local SpeechSynthesis voices detected: {caps?.localTtsVoicesCount ?? 0} (full typed chat & commands always work offline).
            </span>
          </p>
        </div>
      </div>

      {/* AI Routing Mode Selector */}
      <div className="space-y-2">
        <p className="font-mono-hud text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          AI PROVIDER ROUTING MODE
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {routingOptions.map((opt) => {
            const active = activeRouting === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`routing-mode-${opt.id}`}
                onClick={() => onUpdateSettings({ ...settings, routingMode: opt.id })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-cyan-500/15 border-cyan-400 text-cyan-100'
                    : 'bg-[#040812] border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <p className="font-mono-hud text-xs font-bold">{opt.title}</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Downloadable Quantized Browser Models */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono-hud text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            QUANTIZED LOCAL PC MODELS (NO SILENT DOWNLOADS — EXPLICIT CONSENT)
          </p>
          <label className="flex items-center gap-2 font-mono-hud text-[10px] text-slate-300">
            <span>IDLE UNLOAD:</span>
            <select
              value={settings.autoUnloadLocalModelMinutes ?? 15}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  autoUnloadLocalModelMinutes: Number(e.target.value),
                })
              }
              aria-label="Auto unload idle local model timer"
              className="bg-[#040812] border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-cyan-200"
            >
              <option value={5}>5 min</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={0}>Keep loaded</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {PC_LOCAL_MODEL_CATALOG.map((model) => {
            const st = modelStates.find((m) => m.modelId === model.id) || {
              modelId: model.id,
              status: 'not_installed' as const,
              progressPercent: 0,
              loadedInMemory: false,
              backendUsed: null,
              updatedAt: 0,
            };
            const isDefault = (settings.selectedLocalModelId || 'smollm2-135m') === model.id;
            const lowRamWarning =
              caps?.deviceMemoryGb != null && caps.deviceMemoryGb < model.minRamGb;
            const lowDiskWarning =
              caps?.storageFreeMb != null && caps.storageFreeMb < model.approxSizeMb * 1.4;

            return (
              <div
                key={model.id}
                data-testid={`local-model-card-${model.id}`}
                className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
                  isDefault
                    ? 'bg-[#071326]/90 border-cyan-400/55'
                    : 'bg-[#040812]/95 border-slate-800'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-100">{model.displayName}</p>
                      <p className="font-mono-hud text-[10px] text-cyan-300 mt-0.5">
                        ~{model.approxSizeMb} MB • {model.quantization.toUpperCase()} • {model.minRamGb}+ GB RAM
                      </p>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded border font-mono-hud text-[9px] font-bold shrink-0 ${
                        st.status === 'ready'
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                          : st.status === 'downloading' || st.status === 'loading'
                            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                            : st.status === 'failed'
                              ? 'bg-rose-500/15 border-rose-400/50 text-rose-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      {st.status === 'ready'
                        ? st.loadedInMemory
                          ? `LOADED (${st.backendUsed?.toUpperCase() || 'CPU'})`
                          : 'INSTALLED'
                        : st.status === 'downloading'
                          ? `${st.progressPercent}%`
                          : st.status === 'failed'
                            ? 'ERROR'
                            : 'NOT INSTALLED'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">{model.summary}</p>

                  {(lowRamWarning || lowDiskWarning) && (
                    <p className="flex items-center gap-1.5 font-mono-hud text-[10px] text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {lowDiskWarning
                          ? 'Low free browser quota for this package.'
                          : `Recommended ${model.minRamGb} GB+ RAM; performance may be slower.`}
                      </span>
                    </p>
                  )}

                  {st.errorMessage && (
                    <p className="text-[10px] text-rose-300 font-mono-hud">{st.errorMessage}</p>
                  )}

                  {(st.status === 'downloading' || st.status === 'loading') && (
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-[#00E5FF] transition-all"
                          style={{ width: `${Math.max(4, st.progressPercent)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                  {st.status === 'not_installed' || st.status === 'failed' ? (
                    <button
                      type="button"
                      data-testid={`download-local-model-${model.id}`}
                      onClick={() => setPendingConfirmModel(model)}
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-[#00E5FF] hover:brightness-110 text-[#02050B] font-mono-hud text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>DOWNLOAD</span>
                    </button>
                  ) : st.status === 'downloading' || st.status === 'loading' ? (
                    <button
                      type="button"
                      onClick={() => sharedLocalAiManager.cancelOrUnload(model.id)}
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 font-mono-hud text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>CANCEL</span>
                    </button>
                  ) : (
                    <>
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({ ...settings, selectedLocalModelId: model.id })
                          }
                          className="flex-1 min-h-[36px] px-2.5 py-1 rounded-lg bg-[#091326] border border-cyan-400/45 text-cyan-200 font-mono-hud text-[10px] font-bold cursor-pointer"
                        >
                          SET DEFAULT
                        </button>
                      )}
                      {isDefault && (
                        <span className="flex-1 min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/45 text-emerald-300 font-mono-hud text-[10px] font-bold inline-flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          DEFAULT
                        </span>
                      )}
                      {st.loadedInMemory && (
                        <button
                          type="button"
                          onClick={() => sharedLocalAiManager.cancelOrUnload(model.id)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/45 text-amber-200 font-mono-hud text-[10px] font-bold cursor-pointer"
                        >
                          UNLOAD
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void sharedLocalAiManager.deleteCachedModel(model.id)}
                        aria-label={`Delete cached ${model.displayName}`}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-400/45 text-rose-200 font-mono-hud text-[10px] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional Opt-In Localhost Ollama Adapter */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-sky-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Optional Localhost Ollama Adapter (Opt-In Only)
              </p>
              <p className="text-xs text-slate-400">
                Connects only when explicitly enabled. Never required or assumed on HTTPS origins.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(settings.ollamaEnabled)}
            data-testid="settings-ollama-toggle"
            onClick={() => {
              const next = !settings.ollamaEnabled;
              onUpdateSettings({ ...settings, ollamaEnabled: next });
              if (next) {
                void handleProbeOllama(true);
              } else {
                setOllamaStatus(null);
              }
            }}
            className={`px-3.5 py-1.5 rounded-lg border font-mono-hud text-xs font-bold cursor-pointer ${
              settings.ollamaEnabled
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-[#040812] border-slate-700 text-slate-400'
            }`}
          >
            {settings.ollamaEnabled ? 'ENABLED' : 'OFF (OPT-IN)'}
          </button>
        </div>

        {settings.ollamaEnabled && (
          <div className="rounded-xl bg-[#040812] border border-cyan-500/30 p-3.5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <label className="block space-y-1">
                <span className="font-mono-hud text-[10px] text-slate-400">OLLAMA ENDPOINT</span>
                <input
                  type="text"
                  value={settings.ollamaEndpoint || 'http://127.0.0.1:11434'}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, ollamaEndpoint: e.target.value })
                  }
                  className="w-full bg-[#071326] border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-hud text-xs text-slate-100"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-mono-hud text-[10px] text-slate-400">OLLAMA MODEL TAG</span>
                <input
                  type="text"
                  value={settings.ollamaModel || 'llama3.2:1b'}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, ollamaModel: e.target.value })
                  }
                  className="w-full bg-[#071326] border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-hud text-xs text-slate-100"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void handleProbeOllama(true)}
                  disabled={probingOllama}
                  className="w-full min-h-[34px] px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/50 font-mono-hud text-xs text-cyan-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {probingOllama ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5" />
                  )}
                  <span>TEST OLLAMA CONNECTION</span>
                </button>
              </div>
            </div>

            {ollamaStatus && (
              <div
                className={`rounded-lg px-3 py-2 font-mono-hud text-[11px] border ${
                  ollamaStatus.reachable
                    ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200'
                    : 'bg-amber-500/10 border-amber-400/40 text-amber-200'
                }`}
              >
                {ollamaStatus.reachable
                  ? `Connected to Ollama (${ollamaStatus.models.length} models: ${ollamaStatus.models.slice(0, 5).join(', ') || 'none pulled yet'}).`
                  : ollamaStatus.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Explicit User Consent Dialog Before Downloading Large Browser Weights */}
      {pendingConfirmModel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow rounded-2xl max-w-md w-full p-5 space-y-4 border border-cyan-400/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300">
                <ShieldAlert className="w-5 h-5" />
                <h4 className="font-display text-sm font-bold tracking-wider">
                  CONFIRM LOCAL MODEL DOWNLOAD
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirmModel(null)}
                aria-label="Cancel download confirmation"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Download <strong className="text-white">{pendingConfirmModel.displayName}</strong> for offline PC execution?
              </p>
              <div className="rounded-xl bg-[#040812] border border-slate-800 p-3 font-mono-hud text-[11px] space-y-1">
                <p className="flex items-center gap-1.5 text-cyan-200">
                  <HardDrive className="w-3.5 h-3.5" />
                  Approximate Download Size: ~{pendingConfirmModel.approxSizeMb} MB
                </p>
                <p className="text-slate-400">
                  Recommended RAM: {pendingConfirmModel.minRamGb}+ GB • Accelerator:{' '}
                  {caps?.webGpuAvailable ? 'WebGPU' : 'WASM/CPU'}
                </p>
                <p className="text-slate-400">
                  Source: HuggingFace ({pendingConfirmModel.huggingfaceId})
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingConfirmModel(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 font-mono-hud text-xs text-slate-300 cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                data-testid="confirm-local-model-download-btn"
                onClick={() => void handleConfirmDownload()}
                className="px-4 py-2 rounded-xl bg-[#00E5FF] text-[#02050B] font-display text-xs font-bold cursor-pointer"
              >
                CONFIRM & DOWNLOAD
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

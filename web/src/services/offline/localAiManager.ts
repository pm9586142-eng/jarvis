import {
  ActiveEngineAttribution,
  LocalModelCatalogEntry,
  LocalModelRuntimeState,
  WebGpuHardwareCapabilities,
} from '../../types/jarvis';
import { detectWebHardwareCapabilities } from './hardwareCheck';
import { amIndexedDbStore } from './indexedDbStore';
import { findLocalModelById, PC_LOCAL_MODEL_CATALOG } from './localModelCatalog';

export interface OllamaStatusResult {
  enabled: boolean;
  reachable: boolean;
  endpoint: string;
  models: string[];
  error?: string;
}

export class LocalAiManager {
  private worker: Worker | null = null;
  private modelStates = new Map<string, LocalModelRuntimeState>();
  private listeners = new Set<() => void>();
  private activeRequestId: string | null = null;
  private idleUnloadTimer: number | null = null;
  private pendingGenerateResolve: ((text: string) => void) | null = null;
  private pendingGenerateReject: ((err: Error) => void) | null = null;
  private lastCaps: WebGpuHardwareCapabilities | null = null;

  constructor() {
    for (const model of PC_LOCAL_MODEL_CATALOG) {
      this.modelStates.set(model.id, {
        modelId: model.id,
        status: 'not_installed',
        progressPercent: 0,
        loadedInMemory: false,
        backendUsed: null,
        errorMessage: null,
        updatedAt: Date.now(),
      });
    }
    void this.hydratePersistedStates();
  }

  private async hydratePersistedStates(): Promise<void> {
    const saved = await amIndexedDbStore.getLocalModels();
    let changed = false;
    for (const entry of saved) {
      const existing = this.modelStates.get(entry.modelId);
      if (existing) {
        this.modelStates.set(entry.modelId, {
          ...entry,
          // Weights are never loaded in memory at cold page start until explicitly loaded
          loadedInMemory: false,
          status: entry.status === 'downloading' || entry.status === 'loading' ? 'not_installed' : entry.status,
        });
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private persistStates(): void {
    void amIndexedDbStore.saveLocalModels(Array.from(this.modelStates.values()));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }

  getStates(): LocalModelRuntimeState[] {
    return Array.from(this.modelStates.values());
  }

  getModelState(modelId: string): LocalModelRuntimeState | undefined {
    return this.modelStates.get(modelId);
  }

  hasAnyInstalledModel(): boolean {
    for (const st of this.modelStates.values()) {
      if (st.status === 'ready') return true;
    }
    return false;
  }

  getLoadedModelId(): string | null {
    for (const st of this.modelStates.values()) {
      if (st.loadedInMemory && st.status === 'ready') return st.modelId;
    }
    return null;
  }

  async refreshCapabilities(): Promise<WebGpuHardwareCapabilities> {
    this.lastCaps = await detectWebHardwareCapabilities();
    return this.lastCaps;
  }

  getCachedCapabilities(): WebGpuHardwareCapabilities | null {
    return this.lastCaps;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./localInference.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<{
      type: string;
      requestId?: string;
      modelId?: string;
      status?: string;
      progress?: number;
      device?: 'webgpu' | 'wasm';
      text?: string;
      error?: string;
    }>) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'progress' && data.modelId) {
        const cur = this.modelStates.get(data.modelId);
        if (cur) {
          this.modelStates.set(data.modelId, {
            ...cur,
            status: 'downloading',
            progressPercent: typeof data.progress === 'number' ? Math.max(cur.progressPercent, data.progress) : cur.progressPercent,
            errorMessage: null,
            updatedAt: Date.now(),
          });
          this.emit();
        }
        return;
      }

      if (data.type === 'loaded' && data.modelId) {
        for (const [id, st] of this.modelStates.entries()) {
          if (id === data.modelId) {
            this.modelStates.set(id, {
              ...st,
              status: 'ready',
              progressPercent: 100,
              loadedInMemory: true,
              backendUsed: data.device || 'wasm',
              errorMessage: null,
              updatedAt: Date.now(),
            });
          } else if (st.loadedInMemory) {
            this.modelStates.set(id, { ...st, loadedInMemory: false });
          }
        }
        this.persistStates();
        this.emit();
        return;
      }

      if (data.type === 'cancelled' && data.modelId) {
        const cur = this.modelStates.get(data.modelId);
        if (cur) {
          this.modelStates.set(data.modelId, {
            ...cur,
            status: 'not_installed',
            progressPercent: 0,
            loadedInMemory: false,
            errorMessage: 'Download cancelled by operator.',
            updatedAt: Date.now(),
          });
          this.persistStates();
          this.emit();
        }
        return;
      }

      if (data.type === 'unloaded') {
        for (const [id, st] of this.modelStates.entries()) {
          if (st.loadedInMemory) {
            this.modelStates.set(id, { ...st, loadedInMemory: false, updatedAt: Date.now() });
          }
        }
        this.persistStates();
        this.emit();
        return;
      }

      if (data.type === 'generated') {
        const resolve = this.pendingGenerateResolve;
        this.pendingGenerateResolve = null;
        this.pendingGenerateReject = null;
        resolve?.(data.text || '');
        return;
      }

      if (data.type === 'error') {
        if (data.modelId) {
          const cur = this.modelStates.get(data.modelId);
          if (cur) {
            this.modelStates.set(data.modelId, {
              ...cur,
              status: 'failed',
              loadedInMemory: false,
              errorMessage: data.error || 'Model load error.',
              updatedAt: Date.now(),
            });
            this.persistStates();
            this.emit();
          }
        }
        const reject = this.pendingGenerateReject;
        this.pendingGenerateResolve = null;
        this.pendingGenerateReject = null;
        reject?.(new Error(data.error || 'Local browser inference error.'));
      }
    };
    this.worker = worker;
    return worker;
  }

  /**
   * Explicitly installs/loads a quantized model ONLY after user confirmation.
   * Uses WebGPU when available, falling back automatically to WASM/CPU.
   */
  async downloadAndLoadModel(modelId: string): Promise<void> {
    const model: LocalModelCatalogEntry | undefined = findLocalModelById(modelId);
    if (!model) throw new Error('Unknown local model ID.');
    const caps = this.lastCaps || (await this.refreshCapabilities());
    const preferredDevice: 'webgpu' | 'wasm' = caps.webGpuAvailable ? 'webgpu' : 'wasm';

    const reqId = `load_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.activeRequestId = reqId;
    this.modelStates.set(model.id, {
      modelId: model.id,
      status: 'downloading',
      progressPercent: 1,
      loadedInMemory: false,
      backendUsed: preferredDevice,
      errorMessage: null,
      updatedAt: Date.now(),
    });
    this.emit();

    const worker = this.ensureWorker();
    worker.postMessage({
      type: 'load',
      requestId: reqId,
      modelId: model.id,
      huggingfaceId: model.huggingfaceId,
      device: preferredDevice,
      dtype: model.quantization,
    });
  }

  cancelOrUnload(modelId?: string): void {
    const reqId = `unload_${Date.now()}`;
    if (this.worker) {
      this.worker.postMessage({ type: 'unload', requestId: reqId });
    }
    if (modelId) {
      const st = this.modelStates.get(modelId);
      if (st) {
        this.modelStates.set(modelId, {
          ...st,
          loadedInMemory: false,
          status: st.status === 'downloading' ? 'not_installed' : st.status,
          progressPercent: st.status === 'downloading' ? 0 : st.progressPercent,
          updatedAt: Date.now(),
        });
      }
    }
    this.persistStates();
    this.emit();
  }

  async deleteCachedModel(modelId: string): Promise<void> {
    const entry = findLocalModelById(modelId);
    this.cancelOrUnload(modelId);
    if (typeof caches !== 'undefined' && entry) {
      try {
        const names = await caches.keys();
        for (const name of names) {
          if (name.includes('transformers')) {
            const cache = await caches.open(name);
            const requests = await cache.keys();
            for (const req of requests) {
              if (req.url.includes(entry.huggingfaceId)) {
                await cache.delete(req);
              }
            }
          }
        }
      } catch {
        // Ignore Cache API cleanup failures
      }
    }
    this.modelStates.set(modelId, {
      modelId,
      status: 'not_installed',
      progressPercent: 0,
      loadedInMemory: false,
      backendUsed: null,
      errorMessage: null,
      updatedAt: Date.now(),
    });
    this.persistStates();
    this.emit();
  }

  async generateLocalReply(params: {
    modelId: string;
    systemInstruction: string;
    prompt: string;
    autoUnloadMinutes?: number;
  }): Promise<{ text: string; engineAttribution: ActiveEngineAttribution; modelLabel: string }> {
    const state = this.modelStates.get(params.modelId);
    const catalog = findLocalModelById(params.modelId);
    if (!state || state.status !== 'ready') {
      throw new Error('Selected local PC model is not installed yet. Download it in Settings > Local AI.');
    }

    if (!state.loadedInMemory) {
      await this.downloadAndLoadModel(params.modelId);
      // Wait briefly up to 20s for cached load into RAM
      const started = Date.now();
      while (Date.now() - started < 20_000) {
        const latest = this.modelStates.get(params.modelId);
        if (latest?.loadedInMemory && latest.status === 'ready') break;
        if (latest?.status === 'failed') {
          throw new Error(latest.errorMessage || 'Failed to load cached local model.');
        }
        await new Promise((r) => window.setTimeout(r, 150));
      }
    }

    const latestAfterLoad = this.modelStates.get(params.modelId);
    if (!latestAfterLoad?.loadedInMemory) {
      throw new Error('Local PC model is still loading into memory; please retry in a moment.');
    }

    this.scheduleIdleUnload(params.autoUnloadMinutes ?? 15);

    const reqId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const text = await new Promise<string>((resolve, reject) => {
      this.pendingGenerateResolve = resolve;
      this.pendingGenerateReject = reject;
      const worker = this.ensureWorker();
      worker.postMessage({
        type: 'generate',
        requestId: reqId,
        messages: [
          {
            role: 'system',
            content:
              params.systemInstruction ||
              'You are AM AI, a concise, helpful, polite offline assistant. Address the user as Sir.',
          },
          { role: 'user', content: params.prompt },
        ],
        maxNewTokens: 220,
        temperature: 0.4,
      });
    });

    return {
      text,
      engineAttribution: 'Local PC AI',
      modelLabel: `${catalog?.displayName || params.modelId} (${latestAfterLoad.backendUsed?.toUpperCase() || 'WASM'})`,
    };
  }

  private scheduleIdleUnload(minutes: number): void {
    if (this.idleUnloadTimer !== null) {
      window.clearTimeout(this.idleUnloadTimer);
      this.idleUnloadTimer = null;
    }
    if (minutes <= 0) return;
    this.idleUnloadTimer = window.setTimeout(() => {
      this.cancelOrUnload();
    }, minutes * 60 * 1000);
  }

  /**
   * Optional localhost Ollama adapter — ONLY probed or called when user explicitly enables it in Settings.
   */
  async probeOllama(enabled: boolean, endpoint = 'http://127.0.0.1:11434'): Promise<OllamaStatusResult> {
    if (!enabled) {
      return {
        enabled: false,
        reachable: false,
        endpoint,
        models: [],
      };
    }
    const cleanBase = String(endpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(`${cleanBase}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        return {
          enabled: true,
          reachable: false,
          endpoint: cleanBase,
          models: [],
          error: `Ollama returned HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as { models?: Array<{ name?: string }> };
      const models = Array.isArray(data.models)
        ? data.models.map((m) => String(m.name || '')).filter(Boolean)
        : [];
      return {
        enabled: true,
        reachable: true,
        endpoint: cleanBase,
        models,
      };
    } catch (err) {
      return {
        enabled: true,
        reachable: false,
        endpoint: cleanBase,
        models: [],
        error:
          err instanceof Error
            ? `Unable to reach local Ollama (${err.message}). On HTTPS deployments, browsers may block localhost unless permitted.`
            : 'Ollama unreachable.',
      };
    } finally {
      window.clearTimeout(timer);
    }
  }

  async generateWithOllama(params: {
    enabled: boolean;
    endpoint: string;
    model: string;
    systemInstruction: string;
    prompt: string;
  }): Promise<{ text: string; engineAttribution: ActiveEngineAttribution; modelLabel: string }> {
    if (!params.enabled) {
      throw new Error('Ollama adapter is disabled in Settings.');
    }
    const cleanBase = String(params.endpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model || 'llama3.2:1b',
        stream: false,
        messages: [
          { role: 'system', content: params.systemInstruction },
          { role: 'user', content: params.prompt },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama generation failed (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const text = String(data?.message?.content || '').trim();
    if (!text) {
      throw new Error('Ollama returned an empty response.');
    }
    return {
      text,
      engineAttribution: 'Ollama (Opt-In)',
      modelLabel: `Ollama • ${params.model}`,
    };
  }
}

export const sharedLocalAiManager = new LocalAiManager();

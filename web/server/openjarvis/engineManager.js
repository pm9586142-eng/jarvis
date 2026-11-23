import { redactSecrets, validateCustomProviderUrl } from '../brain/securityGuard.js';

const PROBE_TIMEOUT_MS = 3500;
const INFERENCE_TIMEOUT_MS = 45000;

export const BUILTIN_OPENJARVIS_ENGINES = Object.freeze([
  {
    id: 'amai_cloud',
    name: 'AM AI Cloud Inference Adapter',
    kind: 'cloud_bridge',
    protocol: 'amai-adapter',
    envUrlVar: null,
    defaultUrl: 'internal://am-ai-free-providers',
    description:
      'Independent adapter reusing AM AI’s existing Gemini / Groq / OpenRouter free-tier inference without modifying existing endpoints or keys.',
    supportedOnServerless: true,
    supportedOnPc: true,
    supportedOnAndroidRemote: true,
  },
  {
    id: 'ollama',
    name: 'Ollama Local Engine',
    kind: 'local_runtime',
    protocol: 'ollama',
    envUrlVar: 'OLLAMA_BASE_URL',
    defaultUrl: 'http://127.0.0.1:11434',
    description: 'OpenJarvis local Ollama runtime (`ollama serve`) for zero-cost offline PC inference.',
    supportedOnServerless: false,
    supportedOnPc: true,
    supportedOnAndroidRemote: true,
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp Server Engine',
    kind: 'local_runtime',
    protocol: 'openai-compatible',
    envUrlVar: 'LLAMACPP_BASE_URL',
    defaultUrl: 'http://127.0.0.1:8081',
    description: 'Lightweight GGUF CPU/GPU server (`llama-server` / `llama-cpp-python`).',
    supportedOnServerless: false,
    supportedOnPc: true,
    supportedOnAndroidRemote: true,
  },
  {
    id: 'vllm',
    name: 'vLLM High-Throughput Engine',
    kind: 'local_runtime',
    protocol: 'openai-compatible',
    envUrlVar: 'VLLM_BASE_URL',
    defaultUrl: 'http://127.0.0.1:8000',
    description: 'PagedAttention GPU inference server (`vllm serve`) via OpenAI-compatible API.',
    supportedOnServerless: false,
    supportedOnPc: true,
    supportedOnAndroidRemote: true,
  },
  {
    id: 'sglang',
    name: 'SGLang Structured Engine',
    kind: 'local_runtime',
    protocol: 'openai-compatible',
    envUrlVar: 'SGLANG_BASE_URL',
    defaultUrl: 'http://127.0.0.1:30000',
    description: 'Fast RadixAttention structured-generation runtime (`sglang.launch_server`).',
    supportedOnServerless: false,
    supportedOnPc: true,
    supportedOnAndroidRemote: true,
  },
  {
    id: 'openjarvis_python',
    name: 'OpenJarvis Standalone Python Service',
    kind: 'python_service',
    protocol: 'openjarvis-http',
    envUrlVar: 'OPENJARVIS_SERVICE_URL',
    defaultUrl: 'http://127.0.0.1:8100',
    description:
      'Standalone FastAPI/OpenJarvis microservice providing Python FAISS, ColBERT, SQLite FTS5, RLM REPL, and local GPU engines.',
    supportedOnServerless: false,
    supportedOnPc: true,
    supportedOnAndroidRemote: true,
  },
]);

export function validateEngineEndpoint(rawUrl) {
  const cleaned = String(rawUrl || '').trim();
  if (!cleaned) return { valid: false, reason: 'Engine URL cannot be empty.' };
  return validateCustomProviderUrl(cleaned);
}

/**
 * Manages independent OpenJarvis engine discovery, health probing, configuration,
 * and inference routing while keeping AM AI's existing inference pipeline intact.
 */
export function createOpenJarvisEngineManager({
  env = process.env,
  fetchImpl = globalThis.fetch,
  amAiInferenceAdapter,
  nowFn = () => Date.now(),
} = {}) {
  const engines = new Map();
  let defaultEngineId = String(env.OPENJARVIS_DEFAULT_ENGINE || 'amai_cloud').trim().toLowerCase() || 'amai_cloud';

  for (const def of BUILTIN_OPENJARVIS_ENGINES) {
    const rawEnvUrl = def.envUrlVar ? String(env[def.envUrlVar] || '').trim() : '';
    const isCloud = def.id === 'amai_cloud';
    const hasConfiguredUrl = Boolean(rawEnvUrl && !/^unset$|^none$/i.test(rawEnvUrl));
    const urlCheck = hasConfiguredUrl ? validateEngineEndpoint(rawEnvUrl) : { valid: false };

    engines.set(def.id, {
      ...def,
      baseUrl: isCloud ? def.defaultUrl : urlCheck.valid ? urlCheck.normalizedUrl : '',
      configured: isCloud || Boolean(urlCheck.valid),
      enabled: isCloud || Boolean(urlCheck.valid),
      status: isCloud ? 'connected' : urlCheck.valid ? 'untested' : 'unconfigured',
      latencyMs: null,
      lastCheckedAt: null,
      lastMessage: isCloud
        ? 'Connected via internal AM AI cloud adapter (existing providers preserved).'
        : urlCheck.valid
          ? `Configured at ${urlCheck.normalizedUrl}; run Health Probe to verify live server.`
          : `Set ${def.envUrlVar} or configure URL in Engine Monitor to enable.`,
      discoveredModels: [],
      apiKey: def.id === 'openjarvis_python' ? String(env.OPENJARVIS_AUTH_TOKEN || '').trim() : '',
    });
  }

  if (!engines.has(defaultEngineId)) {
    defaultEngineId = 'amai_cloud';
  }

  function serializeEngine(e) {
    return {
      id: e.id,
      name: e.name,
      kind: e.kind,
      protocol: e.protocol,
      envUrlVar: e.envUrlVar,
      baseUrl: e.baseUrl || '',
      defaultUrl: e.defaultUrl,
      description: e.description,
      configured: Boolean(e.configured),
      enabled: Boolean(e.enabled),
      status: e.status,
      latencyMs: e.latencyMs,
      lastCheckedAt: e.lastCheckedAt,
      lastMessage: e.lastMessage,
      discoveredModels: [...e.discoveredModels],
      isDefault: e.id === defaultEngineId,
      supportedOnServerless: e.supportedOnServerless,
      supportedOnPc: e.supportedOnPc,
      supportedOnAndroidRemote: e.supportedOnAndroidRemote,
    };
  }

  async function probeEngine(engineId) {
    const e = engines.get(engineId);
    if (!e) {
      return { ok: false, engineId, status: 'unknown', message: `Unknown OpenJarvis engine "${engineId}".` };
    }

    if (e.id === 'amai_cloud') {
      const started = nowFn();
      const info = amAiInferenceAdapter?.getHealthSummary?.() || { available: false, models: [] };
      const latencyMs = Math.max(1, nowFn() - started);
      e.lastCheckedAt = nowFn();
      e.latencyMs = latencyMs;
      e.status = info.available ? 'connected' : 'unconfigured';
      e.discoveredModels = Array.isArray(info.models) ? info.models : [];
      e.lastMessage = info.available
        ? `AM AI Cloud Adapter ready (${e.discoveredModels.length} free model(s), provider: ${info.activeProvider || 'gemini'}).`
        : 'AM AI Cloud Adapter reachable, but no free AI provider API key is currently configured on the server.';
      return {
        ok: Boolean(info.available),
        engineId: e.id,
        status: e.status,
        latencyMs,
        models: e.discoveredModels,
        message: e.lastMessage,
        engine: serializeEngine(e),
      };
    }

    if (!e.configured || !e.baseUrl) {
      e.status = 'unconfigured';
      e.lastCheckedAt = nowFn();
      e.lastMessage = `Not configured. Provide a valid URL (e.g., ${e.defaultUrl}) to connect.`;
      return {
        ok: false,
        engineId: e.id,
        status: e.status,
        latencyMs: 0,
        models: [],
        message: e.lastMessage,
        engine: serializeEngine(e),
      };
    }

    const urlCheck = validateEngineEndpoint(e.baseUrl);
    if (!urlCheck.valid) {
      e.status = 'blocked';
      e.lastMessage = urlCheck.reason;
      return {
        ok: false,
        engineId: e.id,
        status: 'blocked',
        latencyMs: 0,
        models: [],
        message: urlCheck.reason,
        engine: serializeEngine(e),
      };
    }

    if (process.env.VERCEL && urlCheck.isLocal) {
      e.status = 'local_only_unavailable_in_vercel';
      e.lastCheckedAt = nowFn();
      e.latencyMs = 0;
      e.lastMessage =
        'Loopback localhost URLs cannot be reached from Vercel serverless functions. Deploy the Python/local engine on a public HTTPS endpoint or run AM AI locally on your PC.';
      return {
        ok: false,
        engineId: e.id,
        status: e.status,
        latencyMs: 0,
        models: [],
        message: e.lastMessage,
        engine: serializeEngine(e),
      };
    }

    const started = nowFn();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const base = e.baseUrl.replace(/\/+$/, '');
      const probePath =
        e.protocol === 'ollama'
          ? `${base}/api/tags`
          : e.protocol === 'openjarvis-http'
            ? `${base}/health`
            : `${base}/v1/models`;

      const headers = { Accept: 'application/json' };
      if (e.apiKey) headers.Authorization = `Bearer ${e.apiKey}`;

      const resp = await fetchImpl(probePath, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      const latencyMs = Math.max(1, nowFn() - started);
      const rawText = await resp.text().catch(() => '');
      e.lastCheckedAt = nowFn();
      e.latencyMs = latencyMs;

      if (!resp.ok) {
        e.status = resp.status === 401 || resp.status === 403 ? 'auth_error' : 'unreachable';
        e.lastMessage = redactSecrets(`${e.name} returned HTTP ${resp.status}.`);
        return {
          ok: false,
          engineId: e.id,
          status: e.status,
          latencyMs,
          models: [],
          message: e.lastMessage,
          engine: serializeEngine(e),
        };
      }

      let models = [];
      let extraMeta = null;
      try {
        const parsed = JSON.parse(rawText);
        extraMeta = parsed;
        if (Array.isArray(parsed?.models)) {
          models = parsed.models
            .map((m) => (typeof m === 'string' ? m : m?.name || m?.id || m?.model))
            .filter(Boolean);
        } else if (Array.isArray(parsed?.data)) {
          models = parsed.data.map((m) => m?.id || m?.name).filter(Boolean);
        }
      } catch {
        // Text health endpoint
      }

      e.status = 'connected';
      e.discoveredModels = models;
      e.lastMessage = `Connected live in ${latencyMs}ms (${models.length} model(s) discovered).`;
      return {
        ok: true,
        engineId: e.id,
        status: 'connected',
        latencyMs,
        models,
        meta: extraMeta,
        message: e.lastMessage,
        engine: serializeEngine(e),
      };
    } catch (err) {
      const latencyMs = Math.max(1, nowFn() - started);
      e.lastCheckedAt = nowFn();
      e.latencyMs = latencyMs;
      e.status = 'unreachable';
      e.lastMessage =
        err?.name === 'AbortError'
          ? `Probe timed out after ${PROBE_TIMEOUT_MS}ms.`
          : redactSecrets(`Unable to reach ${e.name}: ${err?.message || 'connection refused'}`);
      return {
        ok: false,
        engineId: e.id,
        status: 'unreachable',
        latencyMs,
        models: [],
        message: e.lastMessage,
        engine: serializeEngine(e),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function discoverAll({ includeUnconfigured = false } = {}) {
    const targets = Array.from(engines.values()).filter(
      (e) => includeUnconfigured || e.configured
    );
    const probes = await Promise.all(targets.map((e) => probeEngine(e.id)));
    return {
      engines: Array.from(engines.values()).map(serializeEngine),
      probes,
      defaultEngineId,
      discoveredModels: Array.from(
        new Set(probes.flatMap((p) => (Array.isArray(p.models) ? p.models : [])))
      ),
    };
  }

  function configureEngine(engineId, { baseUrl, enabled, apiKey, makeDefault } = {}) {
    const e = engines.get(engineId);
    if (!e) return { ok: false, error: `Unknown engine "${engineId}".` };

    if (baseUrl !== undefined && e.id !== 'amai_cloud') {
      const cleaned = String(baseUrl || '').trim();
      if (!cleaned) {
        e.baseUrl = '';
        e.configured = false;
        e.status = 'unconfigured';
        e.discoveredModels = [];
        e.lastMessage = 'Cleared engine URL.';
      } else {
        const checked = validateEngineEndpoint(cleaned);
        if (!checked.valid) {
          return { ok: false, code: 'SSRF_OR_INVALID_URL', error: checked.reason };
        }
        e.baseUrl = checked.normalizedUrl;
        e.configured = true;
        e.enabled = true;
        e.status = 'untested';
        e.lastMessage = `Configured at ${e.baseUrl}; run probe to test live status.`;
      }
    }

    if (typeof enabled === 'boolean') {
      e.enabled = e.id === 'amai_cloud' ? true : enabled;
    }
    if (typeof apiKey === 'string') {
      e.apiKey = apiKey.trim();
    }
    if (makeDefault === true) {
      if (!e.configured && e.id !== 'amai_cloud') {
        return { ok: false, error: `Configure ${e.name} before setting it as OpenJarvis default.` };
      }
      defaultEngineId = e.id;
    }

    return { ok: true, defaultEngineId, engine: serializeEngine(e) };
  }

  async function invokeCompletion({
    engineId = null,
    modelId = null,
    prompt,
    systemInstruction = '',
    history = [],
    temperature = 0.35,
    maxTokens = 2048,
    responseJson = false,
    allowCloudFallback = true,
  }) {
    const targetId = (engineId && engines.has(engineId) ? engineId : defaultEngineId) || 'amai_cloud';
    const engine = engines.get(targetId);

    const runCloudAdapter = async (fallbackReason = null) => {
      if (!amAiInferenceAdapter || typeof amAiInferenceAdapter.generate !== 'function') {
        throw Object.assign(new Error('AM AI Cloud Inference Adapter is unavailable.'), {
          code: 'ADAPTER_UNAVAILABLE',
          httpStatus: 503,
        });
      }
      const res = await amAiInferenceAdapter.generate({
        prompt,
        systemInstruction,
        history,
        temperature,
        maxTokens,
        responseJson,
      });
      return {
        ...res,
        engineId: 'amai_cloud',
        engineName: 'AM AI Cloud Inference Adapter',
        fallbackFromEngine: fallbackReason ? targetId : null,
        fallbackReason,
      };
    };

    if (!engine || targetId === 'amai_cloud') {
      return runCloudAdapter(null);
    }

    if (!engine.configured || !engine.enabled || !engine.baseUrl) {
      if (allowCloudFallback) {
        return runCloudAdapter(`${engine.name} is unconfigured.`);
      }
      throw Object.assign(new Error(`${engine.name} is not configured.`), {
        code: 'ENGINE_UNCONFIGURED',
        httpStatus: 424,
      });
    }

    const urlCheck = validateEngineEndpoint(engine.baseUrl);
    if (!urlCheck.valid) {
      throw Object.assign(new Error(urlCheck.reason), { code: 'SSRF_BLOCKED', httpStatus: 400 });
    }
    if (process.env.VERCEL && urlCheck.isLocal) {
      if (allowCloudFallback) {
        return runCloudAdapter('Loopback local engine unreachable inside Vercel serverless.');
      }
      throw Object.assign(new Error(`${engine.name} loopback host is unreachable from Vercel.`), {
        code: 'LOCAL_ENGINE_UNREACHABLE_SERVERLESS',
        httpStatus: 503,
      });
    }

    const started = nowFn();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

    try {
      const messages = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      for (const h of Array.isArray(history) ? history.slice(-10) : []) {
        if (h?.text) {
          messages.push({
            role: h.role === 'model' || h.role === 'jarvis' || h.role === 'assistant' ? 'assistant' : 'user',
            content: String(h.text),
          });
        }
      }
      messages.push({ role: 'user', content: String(prompt || '') });

      const chosenModel =
        modelId ||
        engine.discoveredModels[0] ||
        (engine.id === 'ollama' ? 'qwen2.5:1.5b' : 'local-model');

      const base = engine.baseUrl.replace(/\/+$/, '');
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (engine.apiKey) headers.Authorization = `Bearer ${engine.apiKey}`;

      let endpoint = `${base}/v1/chat/completions`;
      let payload = {
        model: chosenModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };
      if (responseJson && engine.id !== 'ollama') {
        payload.response_format = { type: 'json_object' };
      }

      if (engine.protocol === 'ollama') {
        endpoint = `${base}/api/chat`;
        payload = {
          model: chosenModel,
          messages,
          stream: false,
          options: { temperature, num_predict: maxTokens },
        };
      } else if (engine.protocol === 'openjarvis-http') {
        endpoint = `${base}/v1/generate`;
        payload = {
          prompt,
          system_instruction: systemInstruction,
          history,
          model: modelId || null,
          temperature,
          max_tokens: maxTokens,
        };
      }

      const resp = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const rawText = await resp.text().catch(() => '');
      const latencyMs = Math.max(1, nowFn() - started);

      if (!resp.ok) {
        throw new Error(`${engine.name} HTTP ${resp.status}: ${rawText.slice(0, 180)}`);
      }

      const parsed = JSON.parse(rawText);
      const replyText =
        parsed?.text ||
        parsed?.message?.content ||
        parsed?.choices?.[0]?.message?.content ||
        '';
      if (!String(replyText).trim()) {
        throw new Error(`${engine.name} returned empty completion.`);
      }

      engine.status = 'connected';
      engine.latencyMs = latencyMs;
      engine.lastCheckedAt = nowFn();

      return {
        text: String(replyText).trim(),
        provider: engine.id,
        providerLabel: engine.name,
        modelUsed: parsed?.model || chosenModel,
        fallbackUsed: false,
        engineId: engine.id,
        engineName: engine.name,
        latencyMs,
      };
    } catch (err) {
      if (allowCloudFallback) {
        return runCloudAdapter(redactSecrets(err?.message || 'Local engine error'));
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    listEngines: () => Array.from(engines.values()).map(serializeEngine),
    getEngine: (id) => (engines.has(id) ? serializeEngine(engines.get(id)) : null),
    getDefaultEngineId: () => defaultEngineId,
    probeEngine,
    discoverAll,
    configureEngine,
    invokeCompletion,
  };
}

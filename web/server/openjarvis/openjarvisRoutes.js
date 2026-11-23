import express from 'express';
import {
  inspectHostHardware,
  OPENJARVIS_BUILTIN_MODELS,
  recommendModelsForHardware,
} from './intelligenceCatalog.js';
import { redactSecrets } from '../brain/securityGuard.js';

/**
 * Isolated Express Router for ALL OpenJarvis capabilities (`/api/openjarvis/*`).
 * Keeps all existing AM AI API routes (`/api/chat`, `/api/chat/stream`, etc.) completely untouched.
 */
export function createOpenJarvisRouter({
  intelligenceHostInspector = inspectHostHardware,
  engineManager,
  agentSystem,
  toolRegistry,
  hybridMemoryEngine,
  mcpManager,
  learningEngine,
  automationEngine,
  auditLogger = null,
  getRequestNamespace = () => 'default',
  fetchImpl = globalThis.fetch,
}) {
  const router = express.Router();

  async function tryFetchPythonServiceMeta() {
    const pyEngine = engineManager.getEngine('openjarvis_python');
    if (!pyEngine || !pyEngine.configured || !pyEngine.baseUrl) return null;
    if (process.env.VERCEL && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(pyEngine.baseUrl)) {
      return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    try {
      const resp = await fetchImpl(`${pyEngine.baseUrl.replace(/\/+$/, '')}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!resp.ok) return null;
      return await resp.json().catch(() => null);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // Unified OpenJarvis workspace status snapshot
  router.get('/status', async (req, res) => {
    const namespace = getRequestNamespace(req);
    const pythonMeta = await tryFetchPythonServiceMeta();
    const hardware = intelligenceHostInspector({
      pythonHardwareInfo: pythonMeta?.hardware || null,
    });
    const models = recommendModelsForHardware(hardware);
    const engines = engineManager.listEngines();
    const memStats = hybridMemoryEngine.getStats(namespace);
    const perf = learningEngine.analyzePerformance();

    return res.status(200).json({
      ok: true,
      integrationLayer: 'openjarvis-extension-v1',
      existingAiApiPreserved: true,
      namespace,
      hardware,
      pythonService: {
        connected: Boolean(pythonMeta?.status === 'ok'),
        capabilities: pythonMeta?.capabilities || null,
        url: engineManager.getEngine('openjarvis_python')?.baseUrl || '',
      },
      modelsCount: models.length,
      models,
      engines,
      defaultEngineId: engineManager.getDefaultEngineId(),
      agents: agentSystem.listAgents(),
      assistantModes: agentSystem.listAssistantModes(),
      tools: toolRegistry.listTools(),
      mcpServers: mcpManager.listServers(),
      memoryStats: {
        ...memStats,
        backends: {
          bm25: true,
          vectorCosine: true,
          colbertMaxSim: true,
          hybridRrf: true,
          sqliteFts5: Boolean(pythonMeta?.capabilities?.sqliteFts5),
          faiss: Boolean(pythonMeta?.capabilities?.faiss),
          pythonColbert: Boolean(pythonMeta?.capabilities?.colbert),
        },
      },
      learning: {
        policy: learningEngine.getPolicy(),
        summary: perf,
        recentTraces: learningEngine.listTraces(20),
        benchmarks: learningEngine.listBenchmarks(10),
      },
      automation: {
        scheduler: automationEngine.getSchedulerInfo(),
        workflows: automationEngine.listWorkflows(),
        notifications: automationEngine.listNotifications(25),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // --- Pillar A: Intelligence ---
  router.get('/intelligence/models', async (req, res) => {
    const capability = String(req.query?.capability || 'all');
    const engine = String(req.query?.engine || 'all');
    const pythonMeta = await tryFetchPythonServiceMeta();
    const hardware = intelligenceHostInspector({ pythonHardwareInfo: pythonMeta?.hardware || null });
    const recommendations = recommendModelsForHardware(hardware, { capability, engine });
    return res.status(200).json({
      ok: true,
      hardware,
      builtinCount: OPENJARVIS_BUILTIN_MODELS.length,
      models: recommendations,
    });
  });

  // --- Pillar B: Engines ---
  router.get('/engines', (_req, res) => {
    return res.status(200).json({
      ok: true,
      defaultEngineId: engineManager.getDefaultEngineId(),
      engines: engineManager.listEngines(),
    });
  });

  router.post('/engines/discover', async (req, res) => {
    const includeUnconfigured = Boolean(req.body?.includeUnconfigured);
    const discovery = await engineManager.discoverAll({ includeUnconfigured });
    return res.status(200).json({ ok: true, ...discovery });
  });

  router.post('/engines/:id/probe', async (req, res) => {
    const id = String(req.params.id || '').trim().toLowerCase();
    const outcome = await engineManager.probeEngine(id);
    const status = outcome.status === 'unknown' ? 404 : 200;
    return res.status(status).json(outcome);
  });

  router.post('/engines/:id/config', (req, res) => {
    const id = String(req.params.id || '').trim().toLowerCase();
    const result = engineManager.configureEngine(id, req.body || {});
    if (!result.ok) {
      return res.status(result.code === 'SSRF_OR_INVALID_URL' ? 400 : 400).json(result);
    }
    auditLogger?.record({
      category: 'OPENJARVIS_ENGINE',
      severity: 'INFO',
      action: `Configured engine ${id}`,
      detail: `URL set: ${result.engine.baseUrl || '(cleared)'}, default=${result.engine.isDefault}`,
    });
    return res.status(200).json(result);
  });

  // --- Pillar C: Agents & 10 Unified Assistant Modes ---
  router.get('/agents', (_req, res) => {
    return res.status(200).json({
      ok: true,
      agents: agentSystem.listAgents(),
      assistantModes: agentSystem.listAssistantModes(),
    });
  });

  router.post('/agents/run', async (req, res) => {
    const namespace = getRequestNamespace(req);
    const body = req.body || {};
    const outcome = await agentSystem.runAgent({
      prompt: body.prompt || body.message || '',
      agentId: body.agentId || 'auto',
      assistantMode: body.assistantMode || 'auto',
      engineId: body.engineId || null,
      modelId: body.modelId || null,
      history: Array.isArray(body.history) ? body.history : [],
      namespace,
      confirmToken: body.confirmToken || null,
      confirmedSensitiveAction: Boolean(body.confirmedSensitiveAction),
    });
    if (outcome.requiresConfirmation) {
      return res.status(409).json(outcome);
    }
    if (!outcome.ok) {
      const status =
        outcome.code === 'SECURITY_BLOCKED'
          ? 403
          : outcome.code === 'OPTIONAL_DEPENDENCY_UNAVAILABLE'
            ? 422
            : 400;
      return res.status(status).json(outcome);
    }
    return res.status(200).json(outcome);
  });

  // --- Pillar D: Tools, Hybrid Memory (BM25 + Vector + ColBERT), Docs & Research ---
  router.get('/tools', (_req, res) => {
    return res.status(200).json({
      ok: true,
      workspaceRootName: 'openjarvis_workspace',
      tools: toolRegistry.listTools(),
    });
  });

  router.post('/tools/execute', async (req, res) => {
    const namespace = getRequestNamespace(req);
    const toolId = String(req.body?.toolId || '').trim();
    const args = req.body?.args && typeof req.body.args === 'object' ? { ...req.body.args, namespace } : { namespace };
    if (!toolId || !toolRegistry.hasTool(toolId)) {
      return res.status(404).json({ ok: false, error: `Tool "${toolId}" not found.` });
    }
    try {
      const result = await toolRegistry.executeTool(toolId, args);
      if (result?.requiresConfirmation) {
        return res.status(409).json(result);
      }
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ ok: false, error: redactSecrets(err?.message || 'Tool execution failed.') });
    }
  });

  router.get('/memory/stats', (req, res) => {
    const namespace = getRequestNamespace(req);
    return res.status(200).json({
      ok: true,
      namespace,
      stats: hybridMemoryEngine.getStats(namespace),
    });
  });

  router.get('/memory/documents', (req, res) => {
    const namespace = getRequestNamespace(req);
    return res.status(200).json({
      ok: true,
      documents: hybridMemoryEngine.listDocuments(namespace),
      researchHistory: hybridMemoryEngine.listResearchHistory(namespace),
    });
  });

  router.post('/memory/documents', (req, res) => {
    const namespace = getRequestNamespace(req);
    const outcome = hybridMemoryEngine.indexDocument({
      title: req.body?.title || 'Untitled Note',
      text: req.body?.text || '',
      sourceType: req.body?.sourceType || 'document',
      sourceUri: req.body?.sourceUri || '',
      tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
      namespace,
    });
    if (!outcome.ok) {
      return res.status(400).json(outcome);
    }
    return res.status(201).json(outcome);
  });

  router.delete('/memory/documents/:id', (req, res) => {
    const namespace = getRequestNamespace(req);
    const result = hybridMemoryEngine.deleteDocument(req.params.id, namespace);
    return res.status(result.found ? 200 : 404).json(result);
  });

  router.post('/memory/search', (req, res) => {
    const namespace = getRequestNamespace(req);
    const query = String(req.body?.query || '').trim();
    const mode = String(req.body?.mode || 'hybrid').toLowerCase();
    const limit = Number(req.body?.limit) || 8;
    const includeMemories = req.body?.includeMemories !== false;
    const includeDocuments = req.body?.includeDocuments !== false;
    const search = hybridMemoryEngine.hybridSearch({
      query,
      mode,
      limit,
      includeMemories,
      includeDocuments,
      namespace,
    });
    return res.status(200).json({ ok: true, ...search });
  });

  router.post('/research/deep', async (req, res) => {
    const namespace = getRequestNamespace(req);
    const query = String(req.body?.query || req.body?.topic || '').trim();
    const outcome = await agentSystem.runDeepResearch({
      query,
      engineId: req.body?.engineId || null,
      modelId: req.body?.modelId || null,
      namespace,
    });
    if (!outcome.ok) {
      return res.status(outcome.code === 'SECURITY_BLOCKED' ? 403 : 400).json(outcome);
    }
    return res.status(200).json(outcome);
  });

  router.get('/research/history', (req, res) => {
    const namespace = getRequestNamespace(req);
    return res.status(200).json({
      ok: true,
      history: hybridMemoryEngine.listResearchHistory(namespace),
    });
  });

  // --- MCP Integrations ---
  router.get('/mcp/servers', (_req, res) => {
    return res.status(200).json({ ok: true, servers: mcpManager.listServers() });
  });

  router.post('/mcp/servers', (req, res) => {
    const outcome = mcpManager.registerServer(req.body || {});
    return res.status(outcome.ok ? 201 : 400).json(outcome);
  });

  router.delete('/mcp/servers/:id', (req, res) => {
    const resDel = mcpManager.removeServer(req.params.id);
    return res.status(resDel.found ? 200 : 404).json(resDel);
  });

  router.post('/mcp/servers/:id/discover', async (req, res) => {
    const outcome = await mcpManager.discoverTools(req.params.id);
    return res.status(200).json(outcome);
  });

  router.post('/mcp/servers/:id/invoke', async (req, res) => {
    const outcome = await mcpManager.invokeTool(req.params.id, req.body || {});
    if (outcome.requiresConfirmation) return res.status(409).json(outcome);
    return res.status(outcome.ok ? 200 : 400).json(outcome);
  });

  // --- Pillar E: Learning, Traces, Routing Policy & Benchmarks ---
  router.get('/learning/summary', (_req, res) => {
    return res.status(200).json({
      ok: true,
      policy: learningEngine.getPolicy(),
      summary: learningEngine.analyzePerformance(),
      benchmarks: learningEngine.listBenchmarks(12),
    });
  });

  router.get('/learning/traces', (req, res) => {
    const limit = Number(req.query?.limit) || 40;
    return res.status(200).json({
      ok: true,
      traces: learningEngine.listTraces(limit),
    });
  });

  router.post('/learning/traces/:id/rate', (req, res) => {
    const outcome = learningEngine.rateTrace(req.params.id, req.body || {});
    return res.status(outcome.found ? 200 : 404).json(outcome);
  });

  router.patch('/learning/policy', (req, res) => {
    const policy = learningEngine.updatePolicy(req.body || {});
    return res.status(200).json({ ok: true, policy });
  });

  router.post('/learning/benchmark', async (req, res) => {
    const started = Date.now();
    const prompt = String(
      req.body?.prompt ||
        'Compute sqrt(144) + 25 and explain Intelligence-Per-Watt in two concise sentences.'
    ).trim();
    const engineId = req.body?.engineId || 'amai_cloud';
    const agentId = req.body?.agentId || 'native_react';

    const runRes = await agentSystem.runAgent({
      prompt,
      agentId,
      assistantMode: 'coding_assistant',
      engineId,
      namespace: getRequestNamespace(req),
    });

    const entry = {
      id: `bench_${Date.now()}`,
      timestamp: Date.now(),
      engineId: runRes.engineId || engineId,
      agentId,
      modelUsed: runRes.modelUsed || 'unknown',
      ok: Boolean(runRes.ok),
      latencyMs: runRes.latencyMs || Date.now() - started,
      outputChars: String(runRes.answer || '').length,
      tokensPerSecEstimate:
        runRes.latencyMs > 0
          ? Number(((Math.ceil(String(runRes.answer || '').length / 4) / runRes.latencyMs) * 1000).toFixed(1))
          : 0,
    };
    learningEngine.recordBenchmark(entry);
    return res.status(200).json({ ok: true, benchmark: entry, run: runRes });
  });

  // --- Automation & MonitorOperative ---
  router.get('/automation/workflows', (_req, res) => {
    return res.status(200).json({
      ok: true,
      scheduler: automationEngine.getSchedulerInfo(),
      workflows: automationEngine.listWorkflows(),
    });
  });

  router.post('/automation/workflows', (req, res) => {
    const outcome = automationEngine.createWorkflow(req.body || {});
    if (outcome.requiresConfirmation) return res.status(409).json(outcome);
    return res.status(outcome.ok ? 201 : 400).json(outcome);
  });

  router.post('/automation/workflows/:id/run', async (req, res) => {
    const namespace = getRequestNamespace(req);
    const outcome = await automationEngine.runWorkflowNow(req.params.id, { namespace });
    return res.status(outcome.found ? 200 : 404).json(outcome);
  });

  router.patch('/automation/workflows/:id', (req, res) => {
    const outcome = automationEngine.toggleWorkflow(req.params.id, req.body?.enabled);
    return res.status(outcome.found ? 200 : 404).json(outcome);
  });

  router.delete('/automation/workflows/:id', (req, res) => {
    const outcome = automationEngine.deleteWorkflow(req.params.id);
    return res.status(outcome.found ? 200 : 404).json(outcome);
  });

  router.get('/automation/notifications', (_req, res) => {
    return res.status(200).json({
      ok: true,
      notifications: automationEngine.listNotifications(35),
    });
  });

  router.post('/automation/notifications/read', (_req, res) => {
    automationEngine.markAllNotificationsRead();
    return res.status(200).json({ ok: true });
  });

  return router;
}

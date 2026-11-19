import express from 'express';
import { redactSecrets } from './securityGuard.js';

/**
 * Modular Express Router for the JARVIS Multi-AI Brain Control Plane (/api/brain/*)
 * plus Shared Memory Backup Export/Import (/api/memories/export & /api/memories/import).
 * Preserves 100% compatibility with all existing JARVIS endpoints and Vercel serverless runtime.
 */
export function createBrainRouter({
  providerManager,
  intelligentRouter,
  specialistAgentManager,
  verificationEngine,
  chiefCoordinator,
  usageMonitor,
  auditLogger,
  memoryStore,
  getRequestNamespace,
} = {}) {
  const router = express.Router();

  // Complete unified Multi-AI Brain status snapshot (feeds the 10-tab Control Center)
  router.get('/status', (req, res) => {
    const providers = providerManager.listProviders();
    const usage = usageMonitor.getUsageSnapshot();
    const auditSummary = auditLogger.getSummary();
    const health = usageMonitor.getSystemHealth({
      providersSummary: providers,
      auditSummary,
    });

    return res.status(200).json({
      strictZeroCostEnforced: true,
      coordinator: chiefCoordinator.getCoordinatorConfig(),
      router: intelligentRouter.getPolicy(),
      providers,
      agents: specialistAgentManager.listAgents(),
      usage,
      recentErrors: usageMonitor.getErrors(40),
      recentTasks: usageMonitor.getTasks(35),
      recentCollaborations: usageMonitor.getCollaborations(20),
      auditLogs: auditLogger.list(40),
      systemHealth: health,
      namespace: getRequestNamespace(req),
      timestamp: new Date().toISOString(),
    });
  });

  // --- Phase 2: Providers ---
  router.get('/providers', (_req, res) => {
    return res.status(200).json({
      strictZeroCostEnforced: true,
      providers: providerManager.listProviders(),
    });
  });

  router.post('/providers/:id/test', async (req, res) => {
    const providerId = String(req.params.id || '').trim().toLowerCase();
    const result = await providerManager.testProviderConnection(providerId);
    const status = result.connectionState === 'UNKNOWN_PROVIDER' ? 404 : 200;
    return res.status(status).json({
      ...result,
      provider: providerManager.getProvider(providerId),
    });
  });

  router.patch('/providers/:id', (req, res) => {
    const providerId = String(req.params.id || '').trim().toLowerCase();
    const outcome = providerManager.setProviderConfig(providerId, req.body || {});
    if (!outcome.ok) {
      const status = outcome.code === 'PAID_PROVIDER_BLOCKED' ? 403 : 400;
      return res.status(status).json({ code: outcome.code || 'INVALID_REQUEST', error: outcome.error });
    }
    return res.status(200).json({ ok: true, provider: outcome.provider });
  });

  router.post('/providers/custom', (req, res) => {
    const outcome = providerManager.registerCustomProvider(req.body || {});
    if (!outcome.ok) {
      const status = outcome.code === 'PAID_PROVIDER_BLOCKED' ? 403 : 400;
      return res.status(status).json({ code: outcome.code || 'INVALID_REQUEST', error: outcome.error });
    }
    return res.status(201).json({ ok: true, provider: outcome.provider });
  });

  router.post('/providers/reset-cooldowns', (req, res) => {
    const targetId = req.body?.providerId ? String(req.body.providerId).trim().toLowerCase() : null;
    const ok = providerManager.resetCooldowns(targetId);
    if (!ok) {
      return res.status(404).json({ code: 'NOT_FOUND', error: `Unknown provider "${targetId}".` });
    }
    auditLogger.record({
      category: 'PROVIDER_REGISTRY',
      severity: 'INFO',
      action: targetId ? `Reset cooldown for ${targetId}` : 'Reset all provider cooldowns',
      detail: 'Cooldown timers cleared by operator.',
    });
    return res.status(200).json({ ok: true, providers: providerManager.listProviders() });
  });

  // --- Phase 3: Intelligent Router & Coordinator Policy ---
  router.get('/router', (_req, res) => {
    return res.status(200).json({
      router: intelligentRouter.getPolicy(),
      coordinator: chiefCoordinator.getCoordinatorConfig(),
    });
  });

  router.patch('/router', (req, res) => {
    const body = req.body || {};
    const routerOutcome = intelligentRouter.updatePolicy(body);
    if (!routerOutcome.ok) {
      const status = routerOutcome.code === 'PAID_PROVIDER_BLOCKED' ? 403 : 400;
      return res.status(status).json({ code: routerOutcome.code || 'INVALID_REQUEST', error: routerOutcome.error });
    }
    const coord = chiefCoordinator.updateCoordinatorConfig(body);
    return res.status(200).json({ ok: true, router: routerOutcome.policy, coordinator: coord });
  });

  // --- Phase 4: 14 Specialist Agents ---
  router.get('/agents', (_req, res) => {
    return res.status(200).json({ agents: specialistAgentManager.listAgents() });
  });

  router.patch('/agents/:id', (req, res) => {
    const agentId = String(req.params.id || '').trim().toLowerCase();
    const outcome = specialistAgentManager.updateAgent(agentId, req.body || {}, providerManager);
    if (!outcome.ok) {
      const status = outcome.code === 'PAID_PROVIDER_BLOCKED' ? 403 : 400;
      return res.status(status).json({ code: outcome.code || 'INVALID_REQUEST', error: outcome.error });
    }
    return res.status(200).json({ ok: true, agent: outcome.agent });
  });

  // --- Phases 1, 5, 7: Chief AI Coordinator Execution (JSON & SSE Streaming) ---
  router.post('/coordinate', async (req, res) => {
    const body = req.body || {};
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ code: 'INVALID_REQUEST', error: 'Prompt is required.' });
    }
    if (prompt.length > 32000) {
      return res.status(400).json({ code: 'PROMPT_TOO_LONG', error: 'Prompt exceeds 32,000 character limit.' });
    }

    try {
      const result = await chiefCoordinator.coordinate({
        prompt,
        history: Array.isArray(body.history) ? body.history : [],
        languageInstruction: String(body.languageInstruction || '').slice(0, 600),
        namespace: getRequestNamespace(req),
        memoryEnabled: body.memoryEnabled !== false,
        temporaryChat: Boolean(body.temporaryChat),
        collaborationMode: body.collaborationMode || null,
        explicitAgentId: body.agentId || null,
        preferredProvider: body.provider || null,
        preferredModel: body.model || null,
        imageBase64: body.imageBase64 || null,
        imageMimeType: body.imageMimeType || null,
        documentText: body.documentText || '',
        isVoice: Boolean(body.isVoice),
        confirmedSensitiveAction: Boolean(body.confirmedSensitiveAction),
      });
      return res.status(200).json(result);
    } catch (err) {
      const httpStatus = Number(err?.httpStatus) || 500;
      return res.status(httpStatus).json({
        code: err?.code || 'COORDINATION_ERROR',
        error: redactSecrets(err?.message || 'Coordination request failed.'),
        attemptedProviders: err?.attemptedProviders || [],
      });
    }
  });

  router.post('/coordinate/stream', async (req, res) => {
    const body = req.body || {};
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ code: 'INVALID_REQUEST', error: 'Prompt is required.' });
    }
    if (prompt.length > 32000) {
      return res.status(400).json({ code: 'PROMPT_TOO_LONG', error: 'Prompt exceeds 32,000 character limit.' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const writeEvent = (payload) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const result = await chiefCoordinator.coordinate({
        prompt,
        history: Array.isArray(body.history) ? body.history : [],
        languageInstruction: String(body.languageInstruction || '').slice(0, 600),
        namespace: getRequestNamespace(req),
        memoryEnabled: body.memoryEnabled !== false,
        temporaryChat: Boolean(body.temporaryChat),
        collaborationMode: body.collaborationMode || null,
        explicitAgentId: body.agentId || null,
        preferredProvider: body.provider || null,
        preferredModel: body.model || null,
        imageBase64: body.imageBase64 || null,
        imageMimeType: body.imageMimeType || null,
        documentText: body.documentText || '',
        isVoice: Boolean(body.isVoice),
        confirmedSensitiveAction: Boolean(body.confirmedSensitiveAction),
        emitProgress: (progress) => writeEvent({ progress }),
      });

      writeEvent({
        meta: {
          mode: result.mode,
          domain: result.domain,
          complexity: result.complexity,
          complexityReason: result.complexityReason,
          provider: result.provider,
          providerLabel: result.providerLabel,
          model: result.modelUsed,
          fallbackUsed: Boolean(result.fallbackUsed),
          agentsUsed: result.agentsUsed,
          subtasks: result.subtasks,
          verification: result.verification,
          selfCorrected: Boolean(result.selfCorrected),
          sensitiveActionWarning: result.sensitiveActionWarning,
          taskId: result.taskId,
        },
      });
      writeEvent({ text: result.text });
      writeEvent({ done: true });
      res.end();
    } catch (err) {
      writeEvent({
        error: redactSecrets(err?.message || 'Coordination stream failed.'),
        code: err?.code || 'COORDINATION_ERROR',
        attemptedProviders: err?.attemptedProviders || [],
      });
      writeEvent({ done: true });
      res.end();
    }
  });

  // --- Phase 7: Standalone Self-Verification Endpoint ---
  router.post('/verify', (req, res) => {
    const body = req.body || {};
    const report = verificationEngine.verifyResponse({
      prompt: String(body.prompt || ''),
      answer: String(body.answer || ''),
      agentResults: Array.isArray(body.agentResults) ? body.agentResults : [],
      toolOutputs: Array.isArray(body.toolOutputs) ? body.toolOutputs : [],
    });
    return res.status(200).json(report);
  });

  // --- Phase 8 & 9: Observability Endpoints ---
  router.get('/usage', (_req, res) => {
    return res.status(200).json(usageMonitor.getUsageSnapshot());
  });

  router.get('/errors', (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const category = String(req.query.category || 'all');
    return res.status(200).json({ errors: usageMonitor.getErrors(limit, category) });
  });

  router.get('/tasks', (req, res) => {
    const limit = Number(req.query.limit) || 40;
    const type = String(req.query.type || 'all');
    return res.status(200).json({ tasks: usageMonitor.getTasks(limit, type) });
  });

  router.get('/audit', (req, res) => {
    const limit = Number(req.query.limit) || 60;
    const category = String(req.query.category || 'ALL');
    return res.status(200).json({
      summary: auditLogger.getSummary(),
      logs: auditLogger.list(limit, category),
    });
  });

  router.get('/health', (_req, res) => {
    const providers = providerManager.listProviders();
    return res.status(200).json(
      usageMonitor.getSystemHealth({
        providersSummary: providers,
        auditSummary: auditLogger.getSummary(),
      })
    );
  });

  // --- Phase 6: Shared Memory Backup Export & Validated Import ---
  router.get('/memory/export', (req, res) => {
    const namespace = getRequestNamespace(req);
    const memories = memoryStore.getAll({ namespace });
    return res.status(200).json({
      version: 'jarvis-shared-memory-v2',
      exportedAt: new Date().toISOString(),
      namespace,
      count: memories.length,
      memories,
    });
  });

  router.post('/memory/import', (req, res) => {
    const namespace = getRequestNamespace(req);
    const incoming = Array.isArray(req.body?.memories) ? req.body.memories : null;
    if (!incoming) {
      return res.status(400).json({ code: 'INVALID_REQUEST', error: 'Request must include a memories array.' });
    }
    const result = memoryStore.mergeBatch(incoming.slice(0, 500), namespace);
    auditLogger.record({
      category: 'SHARED_MEMORY',
      severity: 'INFO',
      action: 'Imported shared memory backup',
      detail: `Added ${result.added}, updated ${result.updated}, skipped ${result.skipped} (secrets/duplicates auto-filtered).`,
    });
    return res.status(200).json({ ok: true, ...result });
  });

  return router;
}

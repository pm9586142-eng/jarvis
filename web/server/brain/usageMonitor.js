import crypto from 'crypto';
import { redactSecrets } from './securityGuard.js';

export function estimateTokens(text) {
  const str = String(text || '');
  if (!str) return 0;
  return Math.max(1, Math.ceil(str.length / 4));
}

/**
 * Centralized Usage Monitoring + Task Execution Manager (Phases 1.8, 1.9, 8.7-8.10).
 * Tracks real per-provider/model API calls, estimated token counts, rate limits,
 * fallback transitions, redacted errors, and end-to-end Coordinator task history.
 */
export function createUsageMonitor({ maxErrors = 120, maxFallbacks = 100, maxTasks = 100 } = {}) {
  const startedAt = Date.now();
  const providerStats = new Map();
  const modelStats = new Map();
  const agentStats = new Map();
  const errorLog = [];
  const fallbackLog = [];
  const taskHistory = [];

  function ensureProviderBucket(providerId) {
    const id = String(providerId || 'unknown');
    if (!providerStats.has(id)) {
      providerStats.set(id, {
        providerId: id,
        requests: 0,
        successes: 0,
        failures: 0,
        rateLimits429: 0,
        timeouts: 0,
        fallbacksFrom: 0,
        fallbacksTo: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        totalLatencyMs: 0,
        avgLatencyMs: 0,
        lastUsedAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
      });
    }
    return providerStats.get(id);
  }

  function ensureModelBucket(providerId, modelId) {
    const key = `${providerId}:${modelId}`;
    if (!modelStats.has(key)) {
      modelStats.set(key, {
        providerId,
        modelId,
        requests: 0,
        successes: 0,
        failures: 0,
        rateLimits429: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        avgLatencyMs: 0,
        totalLatencyMs: 0,
        lastUsedAt: null,
      });
    }
    return modelStats.get(key);
  }

  function ensureAgentBucket(agentId) {
    if (!agentStats.has(agentId)) {
      agentStats.set(agentId, {
        agentId,
        invocations: 0,
        successes: 0,
        failures: 0,
        avgLatencyMs: 0,
        totalLatencyMs: 0,
        lastUsedAt: null,
      });
    }
    return agentStats.get(agentId);
  }

  return {
    recordRequest({
      providerId,
      modelId = '',
      ok = true,
      latencyMs = 0,
      inputTokens = 0,
      outputTokens = 0,
      httpStatus = 200,
      errorCode = null,
      errorMessage = '',
    }) {
      const now = Date.now();
      const safeLatency = Math.max(0, Math.round(Number(latencyMs) || 0));
      const inTok = Math.max(0, Math.round(Number(inputTokens) || 0));
      const outTok = Math.max(0, Math.round(Number(outputTokens) || 0));

      const p = ensureProviderBucket(providerId);
      p.requests += 1;
      p.lastUsedAt = now;
      p.estimatedInputTokens += inTok;
      p.estimatedOutputTokens += outTok;
      p.totalLatencyMs += safeLatency;
      p.avgLatencyMs = Math.round(p.totalLatencyMs / p.requests);

      if (ok) {
        p.successes += 1;
      } else {
        p.failures += 1;
        p.lastErrorAt = now;
        p.lastErrorCode = errorCode || `HTTP_${httpStatus}`;
        if (httpStatus === 429 || /429|RATE_LIMIT|QUOTA/i.test(String(errorCode || ''))) {
          p.rateLimits429 += 1;
        }
        if (/TIMEOUT|ABORT/i.test(String(errorCode || ''))) {
          p.timeouts += 1;
        }
      }

      if (modelId) {
        const m = ensureModelBucket(providerId, modelId);
        m.requests += 1;
        m.lastUsedAt = now;
        m.estimatedInputTokens += inTok;
        m.estimatedOutputTokens += outTok;
        m.totalLatencyMs += safeLatency;
        m.avgLatencyMs = Math.round(m.totalLatencyMs / m.requests);
        if (ok) m.successes += 1;
        else {
          m.failures += 1;
          if (httpStatus === 429 || /429|RATE_LIMIT|QUOTA/i.test(String(errorCode || ''))) {
            m.rateLimits429 += 1;
          }
        }
      }

      if (!ok) {
        this.recordError({
          category:
            httpStatus === 429 || /QUOTA|RATE_LIMIT/i.test(String(errorCode || ''))
              ? 'rate_limit'
              : /TIMEOUT|ABORT/i.test(String(errorCode || ''))
                ? 'timeout'
                : httpStatus === 401 || httpStatus === 403
                  ? 'auth'
                  : /PAID|BILLING/i.test(String(errorCode || ''))
                    ? 'paid_blocked'
                    : 'provider_error',
          providerId,
          modelId,
          code: errorCode || `HTTP_${httpStatus}`,
          httpStatus,
          message: errorMessage || `Provider ${providerId} failed (${httpStatus})`,
        });
      }
    },

    recordFallback({ fromProvider, fromModel = '', toProvider, toModel = '', reason = '' }) {
      const fromBucket = ensureProviderBucket(fromProvider);
      const toBucket = ensureProviderBucket(toProvider);
      fromBucket.fallbacksFrom += 1;
      toBucket.fallbacksTo += 1;

      const event = {
        id: `fb_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        timestamp: Date.now(),
        fromProvider,
        fromModel,
        toProvider,
        toModel,
        reason: redactSecrets(String(reason || 'Automatic failover')).slice(0, 220),
      };
      fallbackLog.unshift(event);
      if (fallbackLog.length > maxFallbacks) fallbackLog.length = maxFallbacks;
      return event;
    },

    recordError({
      category = 'provider_error',
      providerId = null,
      modelId = null,
      agentId = null,
      code = 'ERROR',
      httpStatus = null,
      message = '',
    }) {
      const entry = {
        id: `err_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        timestamp: Date.now(),
        category,
        providerId,
        modelId,
        agentId,
        code: String(code || 'ERROR').slice(0, 64),
        httpStatus: httpStatus ?? null,
        message: redactSecrets(String(message || 'Unknown error')).slice(0, 360),
      };
      errorLog.unshift(entry);
      if (errorLog.length > maxErrors) errorLog.length = maxErrors;
      return entry;
    },

    recordAgentInvocation({ agentId, ok = true, latencyMs = 0 }) {
      const bucket = ensureAgentBucket(agentId);
      const safeLatency = Math.max(0, Math.round(Number(latencyMs) || 0));
      bucket.invocations += 1;
      if (ok) bucket.successes += 1;
      else bucket.failures += 1;
      bucket.totalLatencyMs += safeLatency;
      bucket.avgLatencyMs = Math.round(bucket.totalLatencyMs / bucket.invocations);
      bucket.lastUsedAt = Date.now();
    },

    startTask({
      type = 'direct',
      prompt = '',
      complexity = 'simple',
      requestedAgents = [],
      routingMode = 'auto',
    }) {
      const task = {
        id: `task_run_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        type,
        promptPreview: redactSecrets(String(prompt || '').trim()).slice(0, 180),
        complexity,
        routingMode,
        agentsUsed: [...requestedAgents],
        provider: null,
        model: null,
        fallbackUsed: false,
        status: 'running',
        confidenceScore: null,
        confidenceLevel: null,
        contradictionsCount: 0,
        subtasks: [],
        verification: null,
        estimatedTokens: estimateTokens(prompt),
        startedAt: Date.now(),
        completedAt: null,
        durationMs: 0,
        error: null,
      };
      taskHistory.unshift(task);
      if (taskHistory.length > maxTasks) taskHistory.length = maxTasks;
      return task;
    },

    completeTask(taskId, patch = {}) {
      const task = taskHistory.find((t) => t.id === taskId);
      if (!task) return null;
      const now = Date.now();
      Object.assign(task, patch, {
        completedAt: now,
        durationMs: Math.max(1, now - task.startedAt),
      });
      if (task.error) {
        task.error = redactSecrets(String(task.error)).slice(0, 300);
      }
      return task;
    },

    getUsageSnapshot() {
      const providers = Array.from(providerStats.values());
      const models = Array.from(modelStats.values()).sort((a, b) => b.requests - a.requests);
      const agents = Array.from(agentStats.values()).sort((a, b) => b.invocations - a.invocations);

      let totalRequests = 0;
      let totalSuccesses = 0;
      let totalFailures = 0;
      let totalRateLimits = 0;
      let totalEstimatedTokens = 0;
      for (const p of providers) {
        totalRequests += p.requests;
        totalSuccesses += p.successes;
        totalFailures += p.failures;
        totalRateLimits += p.rateLimits429;
        totalEstimatedTokens += p.estimatedInputTokens + p.estimatedOutputTokens;
      }

      return {
        startedAt,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        totals: {
          requests: totalRequests,
          successes: totalSuccesses,
          failures: totalFailures,
          rateLimits429: totalRateLimits,
          fallbacks: fallbackLog.length,
          estimatedTokens: totalEstimatedTokens,
          estimatedCostUsd: 0,
        },
        providers,
        models,
        agents,
        recentFallbacks: fallbackLog.slice(0, 30),
      };
    },

    getErrors(limit = 50, category = 'all') {
      const cat = String(category || 'all').toLowerCase();
      return errorLog
        .filter((e) => cat === 'all' || e.category === cat)
        .slice(0, Math.max(1, Math.min(maxErrors, limit)));
    },

    getTasks(limit = 40, type = 'all') {
      const filterType = String(type || 'all').toLowerCase();
      return taskHistory
        .filter((t) => filterType === 'all' || t.type === filterType)
        .slice(0, Math.max(1, Math.min(maxTasks, limit)));
    },

    getCollaborations(limit = 25) {
      return taskHistory
        .filter((t) => t.type === 'collaboration')
        .slice(0, Math.max(1, Math.min(maxTasks, limit)));
    },

    getSystemHealth({ providersSummary = [], storageMode = 'persistent-disk', auditSummary = {} } = {}) {
      const connectedCount = providersSummary.filter((p) => p.connectionState === 'CONNECTED').length;
      const configuredCount = providersSummary.filter((p) => p.configured && p.eligibleForZeroCost).length;
      const rateLimitedCount = providersSummary.filter((p) => p.status === 'cooldown' || p.status === 'exhausted').length;
      const isVercel = Boolean(process.env.VERCEL);

      let overall = 'healthy';
      if (configuredCount === 0) overall = 'needs_configuration';
      else if (rateLimitedCount >= configuredCount && configuredCount > 0) overall = 'degraded_rate_limited';
      else if (errorLog.slice(0, 5).filter((e) => Date.now() - e.timestamp < 120_000).length >= 4) {
        overall = 'degraded_errors';
      }

      const mem = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage() : null;

      return {
        overall,
        runtime: isVercel ? 'vercel-serverless' : 'node-express',
        serverlessBudgetMs: isVercel ? 24000 : 55000,
        storageMode: isVercel ? 'ephemeral-serverless-tmp' : storageMode,
        strictZeroCostEnforced: true,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        configuredFreeProviders: configuredCount,
        verifiedConnectedProviders: connectedCount,
        rateLimitedProviders: rateLimitedCount,
        activeTasksCount: taskHistory.filter((t) => t.status === 'running').length,
        recentErrorsCount: errorLog.filter((e) => Date.now() - e.timestamp < 300_000).length,
        memoryMb: mem ? Math.round(mem.rss / (1024 * 1024)) : null,
        auditSummary,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

import crypto from 'crypto';
import { assessSensitiveAction } from '../brain/securityGuard.js';

/**
 * OpenJarvis Automation, Scheduled Workflows & MonitorOperative Engine.
 * Supports scheduled monitoring workflows, background health checks (in non-serverless mode),
 * confirmation tokens for sensitive operations, task history, and notifications.
 */
export function createOpenJarvisAutomationEngine({
  engineManager,
  hybridMemoryEngine,
  learningEngine,
  agentRunnerProvider = null,
  auditLogger = null,
  nowFn = () => Date.now(),
} = {}) {
  const workflows = new Map();
  const notifications = [];
  const confirmationTokens = new Map();
  let intervalHandle = null;

  function addNotification({ workflowId, title, detail, severity = 'info' }) {
    const note = {
      id: `notif_${nowFn()}_${crypto.randomBytes(3).toString('hex')}`,
      workflowId,
      title: String(title || 'OpenJarvis Monitor'),
      detail: String(detail || '').slice(0, 500),
      severity,
      timestamp: nowFn(),
      read: false,
    };
    notifications.unshift(note);
    if (notifications.length > 80) notifications.length = 80;
    return note;
  }

  function issueConfirmationToken({ actionType, summary, payload = {} }) {
    const token = `confirm_${crypto.randomBytes(8).toString('hex')}`;
    confirmationTokens.set(token, {
      token,
      actionType,
      summary,
      payload,
      createdAt: nowFn(),
      expiresAt: nowFn() + 10 * 60 * 1000,
    });
    return token;
  }

  function verifyConfirmationToken(token) {
    const item = confirmationTokens.get(token);
    if (!item) return { valid: false, reason: 'Confirmation token not found or already used.' };
    if (nowFn() > item.expiresAt) {
      confirmationTokens.delete(token);
      return { valid: false, reason: 'Confirmation token expired.' };
    }
    confirmationTokens.delete(token);
    return { valid: true, item };
  }

  function createWorkflow({
    name,
    kind = 'monitor_operative',
    scheduleIntervalMinutes = 30,
    agentId = 'monitor_operative',
    prompt = '',
    steps = [],
    confirmToken = null,
  } = {}) {
    const cleanName = String(name || '').trim().slice(0, 120);
    if (!cleanName) return { ok: false, error: 'Workflow name is required.' };

    const combinedText = `${cleanName} ${prompt} ${JSON.stringify(steps)}`;
    const sensitivity = assessSensitiveAction(combinedText);
    if (sensitivity.requiresConfirmation) {
      if (!confirmToken) {
        const token = issueConfirmationToken({
          actionType: 'CREATE_SENSITIVE_WORKFLOW',
          summary: cleanName,
          payload: { reasons: sensitivity.reasons },
        });
        return {
          ok: false,
          requiresConfirmation: true,
          confirmationToken: token,
          reasons: sensitivity.reasons,
          error: 'Sensitive automation step detected. Explicit user confirmation required before activation.',
        };
      }
      const verified = verifyConfirmationToken(confirmToken);
      if (!verified.valid) {
        return { ok: false, code: 'INVALID_CONFIRMATION_TOKEN', error: verified.reason };
      }
    }

    const id = `wf_${nowFn()}_${crypto.randomBytes(3).toString('hex')}`;
    const intervalMin = Math.max(1, Math.min(1440, Math.round(Number(scheduleIntervalMinutes) || 30)));

    const wf = {
      id,
      name: cleanName,
      kind: ['monitor_operative', 'scheduled_workflow', 'research_watch'].includes(kind)
        ? kind
        : 'monitor_operative',
      agentId: String(agentId || 'monitor_operative'),
      prompt: String(prompt || '').trim().slice(0, 2000),
      steps: Array.isArray(steps) ? steps.slice(0, 8) : [],
      scheduleIntervalMinutes: intervalMin,
      enabled: true,
      sensitiveApproved: sensitivity.requiresConfirmation,
      createdAt: nowFn(),
      lastRunAt: null,
      nextRunAt: nowFn() + intervalMin * 60 * 1000,
      runCount: 0,
      lastStatus: 'idle',
      lastSummary: 'Awaiting first execution tick.',
      history: [],
    };
    workflows.set(id, wf);
    auditLogger?.record({
      category: 'OPENJARVIS_AUTOMATION',
      severity: 'INFO',
      action: `Created workflow "${wf.name}"`,
      detail: `Kind: ${wf.kind}, interval: ${intervalMin}m`,
    });
    return { ok: true, workflow: wf };
  }

  async function runWorkflowNow(workflowId, { namespace = 'default' } = {}) {
    const wf = workflows.get(workflowId);
    if (!wf) return { ok: false, found: false, error: `Workflow "${workflowId}" not found.` };

    const started = nowFn();
    let resultSummary = '';
    let status = 'completed';

    try {
      if (wf.kind === 'monitor_operative') {
        const discovery = await engineManager.discoverAll({ includeUnconfigured: false });
        const perf = learningEngine.analyzePerformance();
        const unhealthy = discovery.probes.filter((p) => !p.ok);
        resultSummary = `Checked ${discovery.probes.length} active engine(s); ${
          unhealthy.length
        } unhealthy (${unhealthy.map((u) => u.engineId).join(', ') || 'none'}). Avg latency: ${
          perf.avgLatencyMs
        }ms.`;
        if (unhealthy.length > 0) {
          addNotification({
            workflowId: wf.id,
            title: `Monitor Alert: ${wf.name}`,
            detail: resultSummary,
            severity: 'warning',
          });
        } else {
          addNotification({
            workflowId: wf.id,
            title: `Monitor OK: ${wf.name}`,
            detail: resultSummary,
            severity: 'info',
          });
        }
      } else if (wf.kind === 'research_watch' && wf.prompt) {
        const hits = hybridMemoryEngine.hybridSearch({
          query: wf.prompt,
          mode: 'hybrid',
          limit: 4,
          namespace,
        });
        resultSummary = `Research watch scanned ${hits.totalCorpusItems} corpus items; top match score=${
          hits.results[0]?.score ?? 0
        }.`;
        addNotification({
          workflowId: wf.id,
          title: `Research Watch: ${wf.name}`,
          detail: resultSummary,
          severity: 'info',
        });
      } else if (typeof agentRunnerProvider === 'function' && wf.prompt) {
        const runRes = await agentRunnerProvider({
          prompt: wf.prompt,
          agentId: wf.agentId || 'operative',
          namespace,
          confirmedSensitiveAction: wf.sensitiveApproved,
        });
        resultSummary = String(runRes?.answer || 'Workflow tick finished.').slice(0, 400);
        addNotification({
          workflowId: wf.id,
          title: `Workflow Completed: ${wf.name}`,
          detail: resultSummary,
          severity: 'info',
        });
      } else {
        resultSummary = `Executed ${wf.steps.length || 1} workflow check(s) on schedule.`;
      }
    } catch (err) {
      status = 'failed';
      resultSummary = err?.message || 'Workflow execution failed.';
      addNotification({
        workflowId: wf.id,
        title: `Workflow Failed: ${wf.name}`,
        detail: resultSummary,
        severity: 'error',
      });
    }

    const durationMs = Math.max(1, nowFn() - started);
    wf.lastRunAt = nowFn();
    wf.nextRunAt = nowFn() + wf.scheduleIntervalMinutes * 60 * 1000;
    wf.runCount += 1;
    wf.lastStatus = status;
    wf.lastSummary = resultSummary;
    wf.history = [
      {
        runAt: wf.lastRunAt,
        durationMs,
        status,
        summary: resultSummary,
      },
      ...wf.history,
    ].slice(0, 20);

    return { ok: status === 'completed', found: true, workflow: wf };
  }

  function startBackgroundTicker() {
    if (process.env.VERCEL || process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT || intervalHandle) return;
    intervalHandle = setInterval(() => {
      const now = nowFn();
      for (const wf of workflows.values()) {
        if (wf.enabled && wf.nextRunAt <= now) {
          void runWorkflowNow(wf.id);
        }
      }
    }, 60_000);
    intervalHandle.unref?.();
  }

  function stopBackgroundTicker() {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  // Seed one default non-destructive MonitorOperative watch so Task Monitor has live context
  createWorkflow({
    name: 'OpenJarvis Engine & Quota Sentinel',
    kind: 'monitor_operative',
    scheduleIntervalMinutes: 15,
    agentId: 'monitor_operative',
    prompt: 'Monitor OpenJarvis engine reachability, local model readiness, and average inference latency.',
  });

  startBackgroundTicker();

  return {
    listWorkflows: () => Array.from(workflows.values()),
    listNotifications: (limit = 30) => notifications.slice(0, limit),
    markAllNotificationsRead: () => {
      for (const n of notifications) n.read = true;
    },
    createWorkflow,
    toggleWorkflow(id, enabled) {
      const wf = workflows.get(id);
      if (!wf) return { ok: false, found: false };
      wf.enabled = Boolean(enabled);
      return { ok: true, found: true, workflow: wf };
    },
    deleteWorkflow(id) {
      const existed = workflows.delete(id);
      return { ok: existed, found: existed };
    },
    runWorkflowNow,
    issueConfirmationToken,
    verifyConfirmationToken,
    stopBackgroundTicker,
    getSchedulerInfo: () => ({
      backgroundTickerActive: Boolean(intervalHandle),
      runtimeMode: process.env.VERCEL ? 'serverless_manual_or_cron_trigger' : 'persistent_node_interval',
    }),
  };
}

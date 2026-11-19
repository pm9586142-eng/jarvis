import { retrieveRelevantMemories } from '../../src/services/memoryDedupe.js';
import {
  assessSensitiveAction,
  detectPromptInjection,
  redactSecrets,
  sanitizeModelOutput,
  wrapUntrustedContext,
} from './securityGuard.js';
import { classifyTaskDomain } from './intelligentRouter.js';

/**
 * Evaluates prompt complexity to implement the confirmed
 * "Smart auto-trigger on complex tasks only" collaboration policy.
 */
export function analyzeTaskComplexity(
  prompt,
  { relevantAgents = [], collaborationMode = 'auto', hasDocument = false, hasImage = false } = {}
) {
  const mode = String(collaborationMode || 'auto').toLowerCase();
  if (mode === 'off') {
    return { complexity: 'simple', shouldCollaborate: false, score: 0, reason: 'Manual direct mode selected.' };
  }
  if (mode === 'on') {
    return {
      complexity: 'complex',
      shouldCollaborate: true,
      score: 10,
      reason: 'Multi-AI collaboration explicitly enabled by user.',
    };
  }

  const text = String(prompt || '').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  let score = 0;
  const signals = [];

  if (words >= 28) {
    score += 2;
    signals.push('multi-clause prompt length');
  }
  if (relevantAgents.length >= 2) {
    score += 3;
    signals.push(`${relevantAgents.length} distinct specialist domains matched`);
  }
  if (/\b(compare|trade-?off|architecture|end-to-end|full[- ]stack|security\s+audit|debug\s+and\s+fix|implement\s+and\s+test|design\s+and\s+build|collaborate|multi-agent|verify\s+and)\b/i.test(text)) {
    score += 3;
    signals.push('multi-discipline analysis/build keywords');
  }
  if (/\b(?:and\s+also|plus|as\s+well\s+as|step\s+1|phase\s+1)\b/i.test(text) && words >= 16) {
    score += 1.5;
    signals.push('multi-step conjunction');
  }
  if (hasDocument && /\b(compare|audit|security|verify|extract\s+and)\b/i.test(text)) {
    score += 2;
    signals.push('complex document intelligence');
  }
  if (hasImage && /\b(code|debug|security|architecture)\b/i.test(text)) {
    score += 2;
    signals.push('multimodal technical analysis');
  }

  const complexity = score >= 5 ? 'complex' : score >= 2.5 ? 'moderate' : 'simple';
  return {
    complexity,
    shouldCollaborate: complexity === 'complex' && relevantAgents.length >= 2,
    score,
    reason:
      complexity === 'complex' && relevantAgents.length >= 2
        ? `Auto-triggered multi-agent collaboration (${signals.join('; ')}).`
        : 'Focused task — routed directly to single specialist for speed and quota efficiency.',
  };
}

/**
 * Phase 1.1 — Chief AI Coordinator.
 * Central brain orchestrating all 9 components:
 *  1. Chief Coordinator
 *  2. AI Provider Manager
 *  3. Intelligent AI Router
 *  4. Specialist Agent Manager (14 agents)
 *  5. Shared Memory Manager (7 categories)
 *  6. AI Collaboration Engine
 *  7. Verification Engine
 *  8. Task Execution Manager
 *  9. Usage Monitoring System
 */
export function createChiefCoordinator({
  providerManager,
  intelligentRouter,
  specialistAgentManager,
  collaborationEngine,
  verificationEngine,
  usageMonitor,
  memoryStore,
  auditLogger,
} = {}) {
  const config = {
    collaborationMode: 'auto', // 'auto' | 'on' | 'off'
    maxAgents: 3, // configurable cap 1..4
    tokenBudget: 7500, // per-run token budget cap
    requestBudgetPerHour: 120,
    selfVerificationEnabled: true,
    recordExecutionMemories: true,
    serverlessDeadlineMs: process.env.VERCEL ? 23000 : 52000,
  };

  function getCoordinatorConfig() {
    return { ...config };
  }

  function updateCoordinatorConfig(patch = {}) {
    if (patch.collaborationMode && ['auto', 'on', 'off'].includes(String(patch.collaborationMode))) {
      config.collaborationMode = String(patch.collaborationMode);
    }
    if (Number.isFinite(Number(patch.maxAgents))) {
      config.maxAgents = Math.max(1, Math.min(4, Math.round(Number(patch.maxAgents))));
    }
    if (Number.isFinite(Number(patch.tokenBudget))) {
      config.tokenBudget = Math.max(1200, Math.min(24000, Math.round(Number(patch.tokenBudget))));
    }
    if (Number.isFinite(Number(patch.requestBudgetPerHour))) {
      config.requestBudgetPerHour = Math.max(10, Math.min(1000, Math.round(Number(patch.requestBudgetPerHour))));
    }
    if (typeof patch.selfVerificationEnabled === 'boolean') {
      config.selfVerificationEnabled = patch.selfVerificationEnabled;
    }
    if (typeof patch.recordExecutionMemories === 'boolean') {
      config.recordExecutionMemories = patch.recordExecutionMemories;
    }
    return getCoordinatorConfig();
  }

  async function coordinate({
    prompt,
    history = [],
    languageInstruction = '',
    namespace = 'default',
    memoryEnabled = true,
    temporaryChat = false,
    collaborationMode = null,
    explicitAgentId = null,
    preferredProvider = null,
    preferredModel = null,
    imageBase64 = null,
    imageMimeType = null,
    documentText = '',
    isVoice = false,
    confirmedSensitiveAction = false,
    emitProgress = () => {},
  }) {
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      throw Object.assign(new Error('Prompt cannot be empty.'), { code: 'INVALID_REQUEST', httpStatus: 400 });
    }

    // 1. Security Guard — Prompt Injection & Sensitive Action Screening
    const injection = detectPromptInjection(cleanPrompt);
    if (injection.flagged) {
      auditLogger?.record({
        category: 'SECURITY_GUARD',
        severity: injection.blockExecution ? 'CRITICAL' : 'WARNING',
        action: injection.blockExecution ? 'Blocked dangerous prompt injection' : 'Isolated prompt injection phrasing',
        detail: `${injection.matchedPatterns.map((m) => m.id).join(', ')}`,
      });
      if (injection.blockExecution) {
        usageMonitor?.recordError({
          category: 'injection_blocked',
          code: 'PROMPT_INJECTION_BLOCKED',
          httpStatus: 400,
          message: injection.reason,
        });
        throw Object.assign(new Error(injection.reason), {
          code: 'PROMPT_INJECTION_BLOCKED',
          httpStatus: 400,
        });
      }
    }

    const sensitive = assessSensitiveAction(cleanPrompt);

    // 2. Shared Memory Retrieval (Context-Aware & Importance-Ranked)
    let memoryContext = '';
    let usedMemoriesCount = 0;
    if (memoryEnabled && memoryStore) {
      const allMemories = memoryStore.getAll({ namespace });
      const top = retrieveRelevantMemories(cleanPrompt, allMemories, 6);
      usedMemoriesCount = top.length;
      if (top.length > 0) {
        memoryContext = top
          .map((m) => `- [${m.category}] ${m.key}: ${m.content}`)
          .join('\n');
      }
    }

    // 3. Domain & Specialist Selection (Selective activation only)
    const effectiveMode = collaborationMode || config.collaborationMode;
    const hasImage = Boolean(imageBase64 && imageMimeType);
    const hasDocument = Boolean(documentText && String(documentText).trim());
    const domain = classifyTaskDomain(cleanPrompt, { hasImage, hasDocument, isVoice });

    const relevantAgents = specialistAgentManager.selectRelevantAgents(cleanPrompt, {
      maxAgents: config.maxAgents,
      hasImage,
      hasDocument,
      isVoice,
      explicitAgentId,
    });

    const complexityPlan = analyzeTaskComplexity(cleanPrompt, {
      relevantAgents,
      collaborationMode: effectiveMode,
      hasDocument,
      hasImage,
    });

    const effectivePrompt = hasDocument
      ? `${cleanPrompt}\n\n${wrapUntrustedContext('ATTACHED_DOCUMENT', documentText, 16000)}`
      : injection.flagged
        ? wrapUntrustedContext('USER_INPUT', cleanPrompt, 12000)
        : cleanPrompt;

    const taskRecord = usageMonitor?.startTask({
      type: complexityPlan.shouldCollaborate ? 'collaboration' : explicitAgentId ? 'specialist' : 'direct',
      prompt: cleanPrompt,
      complexity: complexityPlan.complexity,
      requestedAgents: relevantAgents.map((a) => a.id),
      routingMode: intelligentRouter.getPolicy().mode,
    });

    const deadlineAtMs = Date.now() + config.serverlessDeadlineMs;

    emitProgress({
      stage: 'coordinate',
      taskId: taskRecord?.id || null,
      domain,
      complexity: complexityPlan.complexity,
      collaborative: complexityPlan.shouldCollaborate,
      reason: complexityPlan.reason,
      selectedAgents: relevantAgents.map((a) => ({ id: a.id, name: a.name, codename: a.codename })),
      memoriesRetrieved: usedMemoriesCount,
    });

    try {
      let finalResult;

      if (complexityPlan.shouldCollaborate && !explicitAgentId) {
        // Multi-Agent Collaboration + Peer Verification Workflow
        const collab = await collaborationEngine.runCollaboration({
          prompt: effectivePrompt,
          history,
          memoryContext,
          languageInstruction,
          selectedAgents: relevantAgents,
          imageBase64,
          imageMimeType,
          maxAgents: config.maxAgents,
          tokenBudget: config.tokenBudget,
          deadlineAtMs,
          emitProgress,
        });

        finalResult = {
          taskId: taskRecord?.id || null,
          mode: 'collaboration',
          domain,
          complexity: complexityPlan.complexity,
          complexityReason: complexityPlan.reason,
          text: collab.text,
          provider: collab.provider,
          providerLabel: collab.providerLabel,
          modelUsed: collab.modelUsed,
          agentsUsed: collab.subtasks.map((s) => s.agentId),
          subtasks: collab.subtasks,
          verification: collab.verification,
          selfCorrected: collab.selfCorrected,
          sensitiveActionWarning: sensitive.requiresConfirmation && !confirmedSensitiveAction ? sensitive.reasons : [],
          memoriesRetrieved: usedMemoriesCount,
          estimatedTokens: collab.estimatedTokens,
        };
      } else {
        // Direct Specialist Execution (Fast & Quota-Efficient)
        const primaryAgent = relevantAgents[0];
        let exec;
        if (preferredProvider || preferredModel) {
          // Honor explicit provider/model request with specialist prompt
          const sys = [
            primaryAgent.instructions,
            languageInstruction,
            memoryContext ? `Relevant Shared Memory:\n${memoryContext}` : '',
          ]
            .filter(Boolean)
            .join('\n\n');
          const routed = await intelligentRouter.executeCompletion({
            prompt: effectivePrompt,
            systemInstruction: sys,
            history: history.slice(-10),
            domain: primaryAgent.domain,
            requireVision: Boolean(primaryAgent.requiresVision && hasImage),
            imageBase64,
            imageMimeType,
            preferredProvider,
            preferredModel,
            maxTokens: primaryAgent.maxTokens,
            deadlineAtMs,
          });
          exec = {
            agentId: primaryAgent.id,
            agentName: primaryAgent.name,
            codename: primaryAgent.codename,
            domain: primaryAgent.domain,
            output: sanitizeModelOutput(routed.text),
            provider: routed.provider,
            providerLabel: routed.providerLabel,
            modelUsed: routed.modelUsed,
            fallbackUsed: routed.fallbackUsed,
            latencyMs: routed.latencyMs,
          };
        } else {
          exec = await specialistAgentManager.executeAgent(primaryAgent.id, {
            prompt: effectivePrompt,
            history: history.slice(-10),
            memoryContext,
            languageInstruction,
            imageBase64,
            imageMimeType,
            deadlineAtMs,
          });
        }

        const verification = config.selfVerificationEnabled
          ? verificationEngine.verifyResponse({
              prompt: cleanPrompt,
              answer: exec.output,
              agentResults: [{ ...exec, status: 'fulfilled' }],
            })
          : null;

        finalResult = {
          taskId: taskRecord?.id || null,
          mode: explicitAgentId ? 'specialist' : 'direct',
          domain,
          complexity: complexityPlan.complexity,
          complexityReason: complexityPlan.reason,
          text: exec.output,
          provider: exec.provider,
          providerLabel: exec.providerLabel,
          modelUsed: exec.modelUsed,
          fallbackUsed: Boolean(exec.fallbackUsed),
          agentsUsed: [exec.agentId],
          subtasks: [
            {
              subtaskId: `direct_${exec.agentId}`,
              agentId: exec.agentId,
              agentName: exec.agentName,
              domain: exec.domain,
              status: 'fulfilled',
              provider: exec.provider,
              providerLabel: exec.providerLabel,
              model: exec.modelUsed,
              latencyMs: exec.latencyMs,
              retried: false,
              preview: exec.output.slice(0, 260),
            },
          ],
          verification,
          selfCorrected: false,
          sensitiveActionWarning: sensitive.requiresConfirmation && !confirmedSensitiveAction ? sensitive.reasons : [],
          memoriesRetrieved: usedMemoriesCount,
        };
      }

      usageMonitor?.completeTask(taskRecord?.id, {
        status: 'completed',
        provider: finalResult.provider,
        model: finalResult.modelUsed,
        fallbackUsed: Boolean(finalResult.fallbackUsed),
        agentsUsed: finalResult.agentsUsed,
        confidenceScore: finalResult.verification?.confidenceScore ?? null,
        confidenceLevel: finalResult.verification?.confidenceLevel ?? null,
        contradictionsCount: finalResult.verification?.contradictions?.length || 0,
        subtasks: finalResult.subtasks,
        verification: finalResult.verification,
      });

      // Record significant multi-agent runs into Shared Memory (AGENT_EXECUTION_HISTORY)
      if (
        config.recordExecutionMemories &&
        memoryEnabled &&
        !temporaryChat &&
        memoryStore &&
        finalResult.mode === 'collaboration'
      ) {
        memoryStore.saveOrMerge(
          {
            key: `Collab: ${cleanPrompt.slice(0, 42)}`,
            category: 'AGENT_EXECUTION_HISTORY',
            content: `Agents [${finalResult.agentsUsed.join(', ')}] resolved via ${finalResult.providerLabel} (${finalResult.modelUsed}) — confidence ${finalResult.verification?.confidenceScore ?? 85}%.`,
            importance: 3,
          },
          namespace
        );
      }

      return finalResult;
    } catch (err) {
      usageMonitor?.completeTask(taskRecord?.id, {
        status: 'failed',
        error: redactSecrets(err?.message || 'Coordination failed'),
      });
      throw err;
    }
  }

  return {
    getCoordinatorConfig,
    updateCoordinatorConfig,
    analyzeTaskComplexity,
    coordinate,
  };
}

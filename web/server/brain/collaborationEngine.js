import { redactSecrets, sanitizeModelOutput, wrapUntrustedContext } from './securityGuard.js';
import { estimateTokens } from './usageMonitor.js';

/**
 * Phase 5 — Multi-AI Collaboration Engine.
 * Decomposes complex tasks into focused subtasks for relevant specialists, executes
 * independent subtasks in parallel within serverless deadline & token budgets, performs
 * bounded safe retries on alternate providers, checks contradictions via Verification Engine,
 * and synthesizes one unified consensus answer.
 */
export function createCollaborationEngine({
  specialistAgentManager,
  intelligentRouter,
  verificationEngine,
  usageMonitor = null,
} = {}) {
  function buildSubtasks(prompt, selectedAgents) {
    return selectedAgents.map((agent, index) => ({
      id: `sub_${index + 1}_${agent.id}`,
      agentId: agent.id,
      agentName: agent.name,
      codename: agent.codename,
      domain: agent.domain,
      instruction: `Focus strictly on your ${agent.name} responsibility (${agent.role}) for the user's request. Keep output concise, structured, and high-signal so it can be cross-checked with peer specialists.`,
    }));
  }

  function buildFallbackUnifiedAnswer(agentResults, verification) {
    const fulfilled = agentResults.filter((r) => r.status === 'fulfilled');
    if (fulfilled.length === 0) return '';
    if (fulfilled.length === 1) return fulfilled[0].output;

    const sections = fulfilled.map(
      (r) => `### ${r.agentName} (${r.providerLabel} • \`${r.modelUsed}\`)\n${r.output}`
    );

    if (verification?.contradictions?.length > 0) {
      sections.push(
        `### Verification & Conflict Notes\n${verification.contradictions.map((c) => `- **${c.severity.toUpperCase()}**: ${c.summary}`).join('\n')}`
      );
    }
    return sections.join('\n\n---\n\n');
  }

  async function runCollaboration({
    prompt,
    history = [],
    memoryContext = '',
    languageInstruction = '',
    selectedAgents = [],
    imageBase64 = null,
    imageMimeType = null,
    maxAgents = 3,
    tokenBudget = 8000,
    deadlineAtMs = null,
    emitProgress = () => {},
  }) {
    const activeAgents = selectedAgents.slice(0, Math.max(1, Math.min(4, maxAgents)));
    const subtasks = buildSubtasks(prompt, activeAgents);

    emitProgress({
      stage: 'plan',
      subtasks: subtasks.map((s) => ({
        id: s.id,
        agentId: s.agentId,
        agentName: s.agentName,
        domain: s.domain,
      })),
    });

    const perAgentTokenCap = Math.max(400, Math.floor((tokenBudget * 0.65) / Math.max(1, subtasks.length)));
    const subtaskDeadline = deadlineAtMs ? Math.max(Date.now() + 4000, deadlineAtMs - 6500) : null;

    // Run independent specialist subtasks in parallel
    const rawSettled = await Promise.allSettled(
      subtasks.map(async (subtask) => {
        emitProgress({
          stage: 'agent_start',
          subtaskId: subtask.id,
          agentId: subtask.agentId,
          agentName: subtask.agentName,
        });

        try {
          const res = await specialistAgentManager.executeAgent(subtask.agentId, {
            prompt,
            subtaskInstruction: `${subtask.instruction}\nKeep response under ~${perAgentTokenCap} tokens.`,
            history: history.slice(-6),
            memoryContext,
            languageInstruction,
            imageBase64,
            imageMimeType,
            deadlineAtMs: subtaskDeadline,
          });
          emitProgress({
            stage: 'agent_done',
            subtaskId: subtask.id,
            agentId: subtask.agentId,
            agentName: subtask.agentName,
            status: 'fulfilled',
            provider: res.provider,
            model: res.modelUsed,
            latencyMs: res.latencyMs,
          });
          return { ...res, subtaskId: subtask.id, status: 'fulfilled', retried: false };
        } catch (firstErr) {
          // Bounded safe retry on an alternate free provider if deadline allows
          const canRetry = !subtaskDeadline || Date.now() < subtaskDeadline - 2500;
          if (canRetry) {
            try {
              const retryRes = await specialistAgentManager.executeAgent(subtask.agentId, {
                prompt,
                subtaskInstruction: `${subtask.instruction}\nConcise backup pass.`,
                history: history.slice(-4),
                memoryContext,
                languageInstruction,
                deadlineAtMs: subtaskDeadline,
                excludeProviders: firstErr?.attemptedProviders ? [firstErr.attemptedProviders[0]] : [],
              });
              emitProgress({
                stage: 'agent_done',
                subtaskId: subtask.id,
                agentId: subtask.agentId,
                agentName: subtask.agentName,
                status: 'fulfilled',
                provider: retryRes.provider,
                model: retryRes.modelUsed,
                latencyMs: retryRes.latencyMs,
                retried: true,
              });
              return { ...retryRes, subtaskId: subtask.id, status: 'fulfilled', retried: true };
            } catch (retryErr) {
              const reason = redactSecrets(retryErr?.message || firstErr?.message || 'Agent subtask failed');
              emitProgress({
                stage: 'agent_done',
                subtaskId: subtask.id,
                agentId: subtask.agentId,
                agentName: subtask.agentName,
                status: 'rejected',
                error: reason,
              });
              return {
                subtaskId: subtask.id,
                agentId: subtask.agentId,
                agentName: subtask.agentName,
                domain: subtask.domain,
                status: 'rejected',
                error: reason,
                output: '',
              };
            }
          }

          const reason = redactSecrets(firstErr?.message || 'Subtask deadline exceeded');
          emitProgress({
            stage: 'agent_done',
            subtaskId: subtask.id,
            agentId: subtask.agentId,
            agentName: subtask.agentName,
            status: 'rejected',
            error: reason,
          });
          return {
            subtaskId: subtask.id,
            agentId: subtask.agentId,
            agentName: subtask.agentName,
            domain: subtask.domain,
            status: 'rejected',
            error: reason,
            output: '',
          };
        }
      })
    );

    const agentResults = rawSettled.map((entry, idx) =>
      entry.status === 'fulfilled'
        ? entry.value
        : {
            subtaskId: subtasks[idx].id,
            agentId: subtasks[idx].agentId,
            agentName: subtasks[idx].agentName,
            domain: subtasks[idx].domain,
            status: 'rejected',
            error: redactSecrets(entry.reason?.message || 'Subtask failed'),
            output: '',
          }
    );

    const fulfilled = agentResults.filter((r) => r.status === 'fulfilled');
    if (fulfilled.length === 0) {
      const err = new Error(
        'All specialist agents in this collaboration run failed because free providers were unavailable or rate-limited. No paid fallback was attempted.'
      );
      err.code = 'ALL_FREE_PROVIDERS_EXHAUSTED';
      err.httpStatus = 429;
      err.agentResults = agentResults;
      throw err;
    }

    // Preliminary verification across peer specialist outputs
    const preliminaryVerification = verificationEngine.verifyResponse({
      prompt,
      answer: fulfilled.map((f) => f.output).join('\n\n'),
      agentResults,
    });

    emitProgress({
      stage: 'verify',
      contradictionsCount: preliminaryVerification.contradictions.length,
      confidenceScore: preliminaryVerification.confidenceScore,
      confidenceLevel: preliminaryVerification.confidenceLevel,
    });

    // Consensus & conflict-resolution synthesis pass (bounded by remaining serverless budget)
    let unifiedAnswer = '';
    let synthesisProvider = fulfilled[0].provider;
    let synthesisProviderLabel = fulfilled[0].providerLabel;
    let synthesisModel = fulfilled[0].modelUsed;
    let synthesisUsedModel = false;

    const enoughTimeForSynthesis = !deadlineAtMs || Date.now() < deadlineAtMs - 3000;
    if (fulfilled.length >= 2 && enoughTimeForSynthesis) {
      const peerDossier = fulfilled
        .map(
          (f) =>
            `[${f.agentName} | ${f.providerLabel} (${f.modelUsed})]\n${wrapUntrustedContext(f.agentId, f.output, 3500)}`
        )
        .join('\n\n');

      const contradictionNote =
        preliminaryVerification.contradictions.length > 0
          ? `Contradictions detected between specialists:\n${preliminaryVerification.contradictions.map((c) => `- ${c.summary}`).join('\n')}\nYou MUST explicitly reconcile these conflicts and favor the safer, verifiable answer.`
          : 'No major contradictions detected across specialists; synthesize their complementary insights cleanly without repetition.';

      const synthesisPrompt = [
        `Original User Request:\n${prompt}`,
        '',
        `Specialist Reports:\n${peerDossier}`,
        '',
        contradictionNote,
        '',
        'Produce ONE cohesive, authoritative, well-structured final response for the user. Eliminate redundancy, resolve any conflicts transparently, preserve accurate code blocks, and match the user’s language.',
      ].join('\n');

      try {
        const synth = await intelligentRouter.executeCompletion({
          prompt: synthesisPrompt,
          systemInstruction: [
            'You are the JARVIS Chief AI Coordinator synthesizing verified peer specialist outputs into one final response.',
            languageInstruction || '',
          ]
            .filter(Boolean)
            .join('\n'),
          domain: 'reasoning',
          temperature: 0.3,
          maxTokens: Math.min(2600, Math.max(900, Math.floor(tokenBudget * 0.45))),
          deadlineAtMs,
        });
        unifiedAnswer = sanitizeModelOutput(synth.text);
        synthesisProvider = synth.provider;
        synthesisProviderLabel = synth.providerLabel;
        synthesisModel = synth.modelUsed;
        synthesisUsedModel = true;
      } catch {
        unifiedAnswer = buildFallbackUnifiedAnswer(agentResults, preliminaryVerification);
      }
    } else {
      unifiedAnswer = buildFallbackUnifiedAnswer(agentResults, preliminaryVerification);
    }

    // Final self-verification pass on the unified answer
    let finalVerification = verificationEngine.verifyResponse({
      prompt,
      answer: unifiedAnswer,
      agentResults,
    });

    // Optional single bounded self-correction retry if confidence is low & budget remains
    let selfCorrected = false;
    if (
      finalVerification.retryRecommended &&
      (!deadlineAtMs || Date.now() < deadlineAtMs - 3500)
    ) {
      try {
        const fixNotes = [
          ...finalVerification.codeIssues.map((i) => i.detail),
          ...finalVerification.missingInfo,
          ...finalVerification.contradictions.map((c) => c.summary),
        ];
        const correction = await intelligentRouter.executeCompletion({
          prompt: `Review and improve this draft response to resolve the following verification notes:\n${fixNotes.map((n) => `- ${n}`).join('\n')}\n\nOriginal Request:\n${prompt}\n\nDraft Response:\n${unifiedAnswer}`,
          systemInstruction: 'You are the JARVIS Self-Correction Verifier. Fix the specific issues cleanly without removing accurate details.',
          domain: 'reasoning',
          temperature: 0.25,
          maxTokens: 2200,
          deadlineAtMs,
        });
        const repaired = sanitizeModelOutput(correction.text);
        if (repaired.length >= 20) {
          unifiedAnswer = repaired;
          selfCorrected = true;
          finalVerification = verificationEngine.verifyResponse({
            prompt,
            answer: unifiedAnswer,
            agentResults,
          });
        }
      } catch {
        // Keep best available verified response
      }
    }

    const totalEstimatedTokens =
      estimateTokens(prompt) +
      fulfilled.reduce((acc, f) => acc + estimateTokens(f.output), 0) +
      estimateTokens(unifiedAnswer);

    return {
      text: unifiedAnswer,
      provider: synthesisProvider,
      providerLabel: synthesisProviderLabel,
      modelUsed: synthesisModel,
      synthesisUsedModel,
      selfCorrected,
      subtasks: agentResults.map((r) => ({
        subtaskId: r.subtaskId,
        agentId: r.agentId,
        agentName: r.agentName,
        domain: r.domain,
        status: r.status,
        provider: r.provider || null,
        providerLabel: r.providerLabel || null,
        model: r.modelUsed || null,
        latencyMs: r.latencyMs || 0,
        retried: Boolean(r.retried),
        preview: String(r.output || r.error || '').slice(0, 260),
      })),
      verification: finalVerification,
      estimatedTokens: totalEstimatedTokens,
      usageRecorded: Boolean(usageMonitor),
    };
  }

  return {
    runCollaboration,
  };
}

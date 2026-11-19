import { assessSensitiveAction, redactSecrets, sanitizeModelOutput } from './securityGuard.js';

/**
 * Phase 4 — Complete 14 Specialist AI Agents Roster.
 * Each specialist has a clear role, task-specific instructions, domain routing affinity,
 * configurable model/provider override, input/output validators, and relevance triggers.
 */
export const SPECIALIST_AGENT_DEFINITIONS = Object.freeze([
  {
    id: 'research',
    name: 'Research Agent',
    codename: 'VERONICA-RESEARCH',
    domain: 'research',
    accentColor: '#38BDF8',
    role: 'Evidence-grounded research, comparative synthesis, and citation discipline.',
    instructions:
      'Act as JARVIS Research Agent. Separate verified facts from uncertain claims explicitly. Structure findings with concise executive takeaways, comparisons, and transparent confidence boundaries. Never fabricate URLs or live data.',
    triggers: ['research', 'compare', 'latest', 'benchmark', 'sources', 'market', 'study', 'survey', 'facts', 'evidence', 'literature'],
    requiresVision: false,
    maxTokens: 2048,
  },
  {
    id: 'coding',
    name: 'Coding Agent',
    codename: 'DUM-E-CODE',
    domain: 'coding',
    accentColor: '#10B981',
    role: 'Clean, modular, production-ready code architecture and implementation.',
    instructions:
      'Act as JARVIS Coding Agent. Write clean, typed, idiomatic, secure, production-ready code without placeholder stubs. Explain architectural choices briefly and highlight edge cases.',
    triggers: ['code', 'implement', 'function', 'component', 'typescript', 'javascript', 'python', 'kotlin', 'react', 'api', 'refactor', 'sql', 'algorithm'],
    requiresVision: false,
    maxTokens: 2800,
  },
  {
    id: 'reasoning',
    name: 'Reasoning Agent',
    codename: 'MINERVA-LOGIC',
    domain: 'reasoning',
    accentColor: '#A78BFA',
    role: 'First-principles analysis, trade-off evaluation, and structured problem solving.',
    instructions:
      'Act as JARVIS Reasoning Agent. Break complex problems down from first principles, examine assumptions, weigh trade-offs explicitly, and deliver a clear logical conclusion.',
    triggers: ['analyze', 'trade-off', 'tradeoff', 'why', 'compare options', 'architecture', 'evaluate', 'strategy', 'logic', 'pros and cons', 'first principles'],
    requiresVision: false,
    maxTokens: 2200,
  },
  {
    id: 'mathematics',
    name: 'Mathematics Agent',
    codename: 'EULER-MATH',
    domain: 'mathematics',
    accentColor: '#F59E0B',
    role: 'Step-by-step mathematical derivations, calculations, proofs, and sanity checks.',
    instructions:
      'Act as JARVIS Mathematics Agent. Show every algebraic or numerical step clearly, double-check arithmetic/units at the end, and state the final numeric or symbolic result prominently.',
    triggers: ['math', 'calculate', 'equation', 'integral', 'derivative', 'matrix', 'probability', 'statistics', 'proof', 'formula', 'algebra', 'solve'],
    requiresVision: false,
    maxTokens: 2048,
  },
  {
    id: 'writing',
    name: 'Writing Agent',
    codename: 'CALLIOPE-WRITE',
    domain: 'writing',
    accentColor: '#EC4899',
    role: 'Polished technical, executive, and bilingual Hindi/English/Hinglish prose.',
    instructions:
      'Act as JARVIS Writing Agent. Produce clear, human-sounding, well-structured writing tailored to the user’s language (English, Hindi, or Hinglish) and tone without filler clichés.',
    triggers: ['write', 'draft', 'email', 'blog', 'essay', 'rewrite', 'polish', 'documentation', 'readme', 'summary', 'copywriting', 'announcement'],
    requiresVision: false,
    maxTokens: 2200,
  },
  {
    id: 'vision',
    name: 'Vision Agent',
    codename: 'ARGUS-VISION',
    domain: 'vision',
    accentColor: '#06B6D4',
    role: 'Multimodal image, diagram, UI screenshot, and OCR text analysis.',
    instructions:
      'Act as JARVIS Vision Agent. Describe observable visual contents accurately, extract visible text verbatim where relevant, explain diagrams/UI bugs clearly, and never hallucinate unreadable details.',
    triggers: ['image', 'screenshot', 'diagram', 'photo', 'ocr', 'visual', 'picture', 'chart', 'scan'],
    requiresVision: true,
    maxTokens: 2048,
  },
  {
    id: 'document_analysis',
    name: 'Document Analysis Agent',
    codename: 'ARCHIVE-DOC',
    domain: 'document_analysis',
    accentColor: '#6366F1',
    role: 'PDF, DOCX, and TXT synthesis, structured extraction, and document Q&A.',
    instructions:
      'Act as JARVIS Document Analysis Agent. Ground answers strictly in the supplied document text, extract key entities/deadlines/action items, and note explicitly when a detail is absent from the document.',
    triggers: ['document', 'pdf', 'docx', 'contract', 'report', 'extract', 'clause', 'transcript', 'uploaded file'],
    requiresVision: false,
    maxTokens: 2400,
  },
  {
    id: 'security',
    name: 'Security Agent',
    codename: 'AEGIS-SEC',
    domain: 'security',
    accentColor: '#F43F5E',
    role: 'Security review, threat modeling, secret hygiene, and prompt-injection defense.',
    instructions:
      'Act as JARVIS Security Agent. Identify concrete vulnerabilities (OWASP, auth flaws, secret exposure, SSRF, XSS, SQLi, prompt injection), rate severity honestly, and recommend minimal defensive fixes.',
    triggers: ['security', 'vulnerability', 'audit', 'owasp', 'xss', 'csrf', 'ssrf', 'injection', 'auth', 'token', 'encrypt', 'privacy', 'api key', 'secret'],
    requiresVision: false,
    maxTokens: 2200,
  },
  {
    id: 'debugging',
    name: 'Debugging Agent',
    codename: 'HOMER-DEBUG',
    domain: 'debugging',
    accentColor: '#FB923C',
    role: 'Root-cause isolation, stack trace triage, and minimal regression-safe fixes.',
    instructions:
      'Act as JARVIS Debugging Agent. Identify the root cause before proposing a fix, explain why the failure occurs, provide a minimal verified patch, and list how to confirm the fix.',
    triggers: ['debug', 'bug', 'error', 'exception', 'stack trace', 'crash', 'failing', 'broken', 'fix', '429', '500', 'timeout', 'undefined'],
    requiresVision: false,
    maxTokens: 2400,
  },
  {
    id: 'testing',
    name: 'Testing Agent',
    codename: 'SENTINEL-QA',
    domain: 'testing',
    accentColor: '#22C55E',
    role: 'Unit/integration test generation, edge-case coverage, and acceptance validation.',
    instructions:
      'Act as JARVIS Testing Agent. Design thorough, deterministic tests covering happy paths, boundary conditions, failure/rate-limit modes, and regression prevention. Never claim tests passed unless actually executed.',
    triggers: ['test', 'unit test', 'integration test', 'qa', 'edge case', 'assert', 'coverage', 'mock', 'regression', 'verify'],
    requiresVision: false,
    maxTokens: 2400,
  },
  {
    id: 'voice',
    name: 'Voice Agent',
    codename: 'ARIA-VOICE',
    domain: 'voice',
    accentColor: '#E879F9',
    role: 'Natural, concise, conversational spoken-response crafting for Hindi & English TTS.',
    instructions:
      'Act as JARVIS Voice Agent. Write smooth, warm, natural spoken sentences free of raw Markdown tables, URLs, or noisy symbols so text-to-speech sounds effortless in Hindi, English, or Hinglish.',
    triggers: ['speak', 'say aloud', 'voice', 'pronounce', 'spoken', 'read aloud', 'audio briefing'],
    requiresVision: false,
    maxTokens: 1200,
  },
  {
    id: 'memory',
    name: 'Memory Agent',
    codename: 'MNEMOSYNE-MEM',
    domain: 'memory',
    accentColor: '#2DD4BF',
    role: 'Long-term memory consolidation, preference alignment, and historical recall.',
    instructions:
      'Act as JARVIS Memory Agent. Organize durable preferences, instructions, and project context cleanly without duplicates. Strictly refuse storing passwords, API keys, tokens, or payment secrets.',
    triggers: ['remember', 'memory', 'recall', 'history', 'preference', 'past conversation', 'context', 'backup'],
    requiresVision: false,
    maxTokens: 1500,
  },
  {
    id: 'planning',
    name: 'Planning Agent',
    codename: 'FRIDAY-PLAN',
    domain: 'planning',
    accentColor: '#60A5FA',
    role: 'Phased project roadmaps, task breakdowns, milestones, and dependency sequencing.',
    instructions:
      'Act as JARVIS Planning Agent. Break goals into realistic, sequenced phases with clear deliverables, dependencies, risks, and quick wins.',
    triggers: ['plan', 'roadmap', 'milestone', 'schedule', 'sprint', 'breakdown', 'tasks', 'timeline', 'project', 'steps'],
    requiresVision: false,
    maxTokens: 2200,
  },
  {
    id: 'automation',
    name: 'Automation Agent',
    codename: 'ULTRON-GUARD-AUTO',
    domain: 'automation',
    accentColor: '#FBBF24',
    role: 'Safe workflow automation, quick commands, and explicit user-confirmation gating.',
    instructions:
      'Act as JARVIS Automation Agent. Design safe, repeatable automation workflows. Explicitly pause and request user confirmation before any sensitive action (deleting data, sending external messages, modifying production, or spending money). Never pretend unavailable OS permissions exist.',
    triggers: ['automate', 'automation', 'workflow', 'reminder', 'trigger', 'shortcut', 'open website', 'schedule task', 'batch'],
    requiresVision: false,
    maxTokens: 1800,
  },
]);

/**
 * Specialist Agent Manager (Phase 4).
 * Manages all 14 specialist agents, per-agent configuration, input/output validation,
 * and relevance-based selective activation.
 */
export function createSpecialistAgentManager({ intelligentRouter, usageMonitor = null } = {}) {
  const agents = new Map();

  for (const def of SPECIALIST_AGENT_DEFINITIONS) {
    agents.set(def.id, {
      ...def,
      enabled: true,
      preferredProvider: null,
      preferredModel: null,
      invocations: 0,
      lastUsedAt: null,
    });
  }

  function validateAgentInput(agent, prompt, context = {}) {
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      return { valid: false, error: `${agent.name} requires a non-empty prompt.` };
    }
    if (cleanPrompt.length > 32000) {
      return { valid: false, error: `${agent.name} input exceeds maximum allowed length.` };
    }
    if (agent.requiresVision && !context.imageBase64) {
      return {
        valid: true,
        warning: 'Vision Agent invoked without an attached image; responding in text advisory mode.',
      };
    }
    return { valid: true };
  }

  function validateAgentOutput(agent, rawOutput) {
    const cleaned = sanitizeModelOutput(rawOutput);
    const warnings = [];
    if (!cleaned || cleaned.length < 4) {
      return { valid: false, output: '', warnings: ['Empty or trivial specialist output.'] };
    }

    // Check unclosed markdown code fence on code-heavy specialists
    const fenceCount = (cleaned.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) {
      warnings.push('Unclosed Markdown code fence detected and auto-closed.');
    }

    let finalOutput = fenceCount % 2 !== 0 ? `${cleaned}\n\`\`\`` : cleaned;

    if (agent.id === 'automation') {
      const sensitive = assessSensitiveAction(finalOutput);
      if (sensitive.requiresConfirmation && !/confirm|approval|authorize/i.test(finalOutput)) {
        finalOutput +=
          '\n\n> **Confirmation Required:** This workflow touches sensitive actions and will not execute without your explicit confirmation.';
        warnings.push('Appended mandatory confirmation notice for sensitive automation.');
      }
    }

    return { valid: true, output: finalOutput, warnings };
  }

  /**
   * Selects ONLY relevant specialists for the prompt — never activates all 14 blindly.
   */
  function selectRelevantAgents(
    prompt,
    { maxAgents = 3, hasImage = false, hasDocument = false, isVoice = false, explicitAgentId = null } = {}
  ) {
    if (explicitAgentId && agents.has(explicitAgentId)) {
      const target = agents.get(explicitAgentId);
      if (target.enabled) return [target];
    }

    const text = String(prompt || '').toLowerCase();
    const scored = [];

    for (const agent of agents.values()) {
      if (!agent.enabled) continue;
      let score = 0;

      if (hasImage && agent.id === 'vision') score += 10;
      if (hasDocument && agent.id === 'document_analysis') score += 10;
      if (isVoice && agent.id === 'voice') score += 3;

      for (const trigger of agent.triggers) {
        const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
          score += trigger.includes(' ') ? 3.5 : 2.2;
        }
      }

      // Skip vision agent unless image or explicit vision keywords present
      if (agent.id === 'vision' && !hasImage && score < 2.2) continue;

      if (score > 0) {
        scored.push({ agent, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      const fallback = isVoice ? agents.get('voice') : agents.get('reasoning');
      return fallback && fallback.enabled ? [fallback] : [Array.from(agents.values())[0]];
    }

    const cap = Math.max(1, Math.min(4, Math.round(maxAgents)));
    // Keep only agents with meaningful relevance relative to top match
    const topScore = scored[0].score;
    const relevant = scored.filter((s, idx) => idx === 0 || s.score >= Math.max(2.2, topScore * 0.45));
    return relevant.slice(0, cap).map((s) => s.agent);
  }

  async function executeAgent(
    agentId,
    {
      prompt,
      subtaskInstruction = '',
      history = [],
      memoryContext = '',
      languageInstruction = '',
      imageBase64 = null,
      imageMimeType = null,
      deadlineAtMs = null,
      excludeProviders = [],
    }
  ) {
    const agent = agents.get(agentId);
    if (!agent || !agent.enabled) {
      throw new Error(`Specialist agent "${agentId}" is unavailable or disabled.`);
    }

    const inputCheck = validateAgentInput(agent, prompt, { imageBase64 });
    if (!inputCheck.valid) {
      const err = new Error(inputCheck.error);
      err.code = 'AGENT_INPUT_INVALID';
      err.httpStatus = 400;
      throw err;
    }

    const systemParts = [
      agent.instructions,
      `Role: ${agent.role}`,
      languageInstruction || '',
      memoryContext ? `Relevant Shared Memory Context:\n${memoryContext}` : '',
      subtaskInstruction ? `Assigned Subtask Scope:\n${subtaskInstruction}` : '',
    ].filter(Boolean);

    const started = Date.now();
    try {
      const result = await intelligentRouter.executeCompletion({
        prompt,
        systemInstruction: systemParts.join('\n\n'),
        history,
        domain: agent.domain,
        requireVision: Boolean(agent.requiresVision && imageBase64),
        imageBase64: agent.requiresVision ? imageBase64 : null,
        imageMimeType: agent.requiresVision ? imageMimeType : null,
        preferredProvider: agent.preferredProvider,
        preferredModel: agent.preferredModel,
        maxTokens: agent.maxTokens,
        deadlineAtMs,
        excludeProviders,
      });

      const validation = validateAgentOutput(agent, result.text);
      const latencyMs = Math.max(1, Date.now() - started);
      agent.invocations += 1;
      agent.lastUsedAt = Date.now();
      usageMonitor?.recordAgentInvocation({ agentId: agent.id, ok: validation.valid, latencyMs });

      if (!validation.valid) {
        throw Object.assign(new Error(`${agent.name} produced invalid output.`), {
          code: 'AGENT_OUTPUT_INVALID',
          httpStatus: 502,
        });
      }

      return {
        agentId: agent.id,
        agentName: agent.name,
        codename: agent.codename,
        domain: agent.domain,
        output: validation.output,
        warnings: [...(inputCheck.warning ? [inputCheck.warning] : []), ...validation.warnings],
        provider: result.provider,
        providerLabel: result.providerLabel,
        modelUsed: result.modelUsed,
        fallbackUsed: result.fallbackUsed,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Math.max(1, Date.now() - started);
      usageMonitor?.recordAgentInvocation({ agentId: agent.id, ok: false, latencyMs });
      usageMonitor?.recordError({
        category: 'provider_error',
        agentId: agent.id,
        code: err?.code || 'AGENT_EXECUTION_ERROR',
        httpStatus: err?.httpStatus || 500,
        message: redactSecrets(`${agent.name} failed: ${err?.message || 'error'}`),
      });
      throw err;
    }
  }

  return {
    listAgents() {
      return Array.from(agents.values()).map((a) => ({
        id: a.id,
        name: a.name,
        codename: a.codename,
        domain: a.domain,
        accentColor: a.accentColor,
        role: a.role,
        instructions: a.instructions,
        triggers: [...a.triggers],
        requiresVision: a.requiresVision,
        maxTokens: a.maxTokens,
        enabled: a.enabled,
        preferredProvider: a.preferredProvider,
        preferredModel: a.preferredModel,
        invocations: a.invocations,
        lastUsedAt: a.lastUsedAt,
      }));
    },

    getAgent(id) {
      const a = agents.get(id);
      if (!a) return null;
      return { ...a, triggers: [...a.triggers] };
    },

    updateAgent(id, patch = {}, providerManager = null) {
      const agent = agents.get(id);
      if (!agent) return { ok: false, error: `Unknown specialist agent "${id}".` };

      if (typeof patch.enabled === 'boolean') agent.enabled = patch.enabled;
      if (typeof patch.instructions === 'string' && patch.instructions.trim()) {
        agent.instructions = patch.instructions.trim().slice(0, 1500);
      }
      if (patch.preferredProvider !== undefined) {
        if (!patch.preferredProvider) {
          agent.preferredProvider = null;
        } else if (providerManager) {
          const p = providerManager.getProvider(String(patch.preferredProvider));
          if (!p) return { ok: false, error: `Unknown provider "${patch.preferredProvider}".` };
          if (!p.eligibleForZeroCost) {
            return {
              ok: false,
              code: 'PAID_PROVIDER_BLOCKED',
              error: `${p.label} is paid-only and blocked under Strict $0 Policy.`,
            };
          }
          agent.preferredProvider = p.id;
        }
      }
      if (patch.preferredModel !== undefined) {
        if (!patch.preferredModel) {
          agent.preferredModel = null;
        } else if (providerManager) {
          const mId = String(patch.preferredModel).trim();
          const owner = providerManager.listProviders().find((p) => p.models.some((m) => m.id === mId && m.freeVerified));
          if (!owner) {
            return {
              ok: false,
              code: 'PAID_OR_UNKNOWN_MODEL_REJECTED',
              error: `Model "${mId}" is not in the approved $0 verified-free catalog.`,
            };
          }
          agent.preferredModel = mId;
        }
      }

      return { ok: true, agent: this.getAgent(id) };
    },

    selectRelevantAgents,
    validateAgentInput,
    validateAgentOutput,
    executeAgent,
  };
}

import {
  assessSensitiveAction,
  detectPromptInjection,
  redactSecrets,
  sanitizeModelOutput,
  wrapUntrustedContext,
} from '../brain/securityGuard.js';

/**
 * Official OpenJarvis Agent Release Definitions (grounded against open-jarvis/OpenJarvis).
 */
export const OPENJARVIS_AGENTS = Object.freeze([
  {
    id: 'simple',
    name: 'Simple Agent',
    sourceClass: 'openjarvis.agents.SimpleAgent',
    category: 'core',
    availability: 'available',
    description: 'Direct single-pass conversational agent using the selected OpenJarvis inference engine.',
    supportsTools: false,
  },
  {
    id: 'orchestrator',
    name: 'Orchestrator Agent',
    sourceClass: 'openjarvis.agents.OrchestratorAgent',
    category: 'multi_step',
    availability: 'available',
    description: 'Decomposes complex goals into specialist sub-tasks, gathers evidence, and synthesizes one cohesive answer.',
    supportsTools: true,
  },
  {
    id: 'native_react',
    name: 'Native ReAct Agent',
    sourceClass: 'openjarvis.agents.NativeReActAgent',
    category: 'tool_use',
    availability: 'available',
    description: 'Structured Reason + Act loop invoking built-in tools (calculator, think, web_search, files, hybrid retrieval, sandbox).',
    supportsTools: true,
  },
  {
    id: 'rlm',
    name: 'RLM (Recursive Language Model) Agent',
    sourceClass: 'openjarvis.agents.RLMAgent',
    category: 'reasoning',
    availability: 'available',
    description: 'Iterative recursive decomposition with isolated JS sandbox computation and verification.',
    supportsTools: true,
  },
  {
    id: 'operative',
    name: 'Operative Agent',
    sourceClass: 'openjarvis.agents.OperativeAgent',
    category: 'automation',
    availability: 'available',
    description: 'Action-oriented execution planner supporting confined workspace ops and confirmation-gated workflows.',
    supportsTools: true,
  },
  {
    id: 'monitor_operative',
    name: 'Monitor Operative Agent',
    sourceClass: 'openjarvis.agents.MonitorOperativeAgent',
    category: 'monitoring',
    availability: 'available',
    description: 'Probes configured local/cloud engines, inspects trace health metrics, and posts monitor alerts.',
    supportsTools: true,
  },
  {
    id: 'sandboxed',
    name: 'Sandboxed Agent',
    sourceClass: 'openjarvis.agents.SandboxedAgent',
    category: 'isolation',
    availability: 'available',
    description: 'Executes untrusted inspection, math/logic evaluation, and file analysis strictly inside isolated sandboxes.',
    supportsTools: true,
  },
  {
    id: 'openhands',
    name: 'OpenHands Agent',
    sourceClass: 'openjarvis.agents.OpenHandsAgent',
    category: 'external_coding_runtime',
    availability: 'optional_python_runtime',
    description: 'Requires external OpenHands Docker/Python runtime via standalone OpenJarvis Python service.',
    supportsTools: true,
  },
  {
    id: 'native_openhands',
    name: 'Native OpenHands Agent',
    sourceClass: 'openjarvis.agents.NativeOpenHandsAgent',
    category: 'external_coding_runtime',
    availability: 'optional_python_runtime',
    description: 'Requires native OpenHands SDK installed in the local PC Python OpenJarvis environment.',
    supportsTools: true,
  },
  {
    id: 'claude_code',
    name: 'Claude Code Agent',
    sourceClass: 'openjarvis.agents.ClaudeCodeAgent',
    category: 'external_cli_runtime',
    availability: 'optional_cli_license',
    description: 'Optional CLI adapter requiring Anthropic Claude Code CLI + external user license on host PC (never bundled or auto-billed).',
    supportsTools: true,
  },
]);

/**
 * 10 Unified AM AI Assistant Modes integrating OpenJarvis capabilities cleanly.
 */
export const UNIFIED_ASSISTANT_MODES = Object.freeze([
  {
    id: 'personal_assistant',
    name: 'Personal Assistant',
    defaultAgentId: 'simple',
    icon: 'sparkles',
    description: 'Bilingual (English/Hindi/Hinglish) daily aide aware of AM AI personal memories and context.',
  },
  {
    id: 'research_assistant',
    name: 'Research Assistant',
    defaultAgentId: 'native_react',
    icon: 'globe',
    description: 'Combines hybrid document retrieval and live Tavily web grounding for factual answers.',
  },
  {
    id: 'coding_assistant',
    name: 'Coding Assistant',
    defaultAgentId: 'rlm',
    icon: 'code',
    description: 'Recursive debugging, architecture guidance, and isolated JS sandbox verification.',
  },
  {
    id: 'document_assistant',
    name: 'Document Assistant',
    defaultAgentId: 'native_react',
    icon: 'file_text',
    description: 'Searches and synthesizes answers from your indexed PDFs, DOCX, notes, and workspace files.',
  },
  {
    id: 'memory_assistant',
    name: 'Memory Assistant',
    defaultAgentId: 'native_react',
    icon: 'brain',
    description: 'Queries persistent long-term AM AI memories alongside BM25 + Vector + ColBERT hybrid index.',
  },
  {
    id: 'automation_assistant',
    name: 'Automation Assistant',
    defaultAgentId: 'operative',
    icon: 'zap',
    description: 'Plans and triggers repeatable workflows with explicit user confirmation guards.',
  },
  {
    id: 'deep_research_agent',
    name: 'Deep Research Agent',
    defaultAgentId: 'orchestrator',
    icon: 'telescope',
    description: 'Multi-angle knowledge decomposition, cross-source evidence gathering, and cited research brief.',
  },
  {
    id: 'task_monitor_agent',
    name: 'Task Monitor Agent',
    defaultAgentId: 'monitor_operative',
    icon: 'activity',
    description: 'Live audit of engine latency, model availability, workflow runs, and error budgets.',
  },
  {
    id: 'scheduled_operative',
    name: 'Scheduled Operative',
    defaultAgentId: 'operative',
    icon: 'clock',
    description: 'Configures and tests scheduled monitors & recurring OpenJarvis operatives.',
  },
  {
    id: 'multi_agent_orchestrator',
    name: 'Multi-Agent Orchestrator',
    defaultAgentId: 'orchestrator',
    icon: 'network',
    description: 'Coordinates Research, Verification, and Synthesis passes simultaneously for high-stakes tasks.',
  },
]);

export function classifyAssistantMode(prompt) {
  const q = String(prompt || '').toLowerCase();
  if (/\b(deep research|comprehensive report|literature review|thorough analysis|gahan adhyayan)\b/i.test(q)) {
    return 'deep_research_agent';
  }
  if (/\b(monitor|health check|latency|telemetry|engine status|diagnostics|watch)\b/i.test(q)) {
    return 'task_monitor_agent';
  }
  if (/\b(schedule|every \d+ min|recurring|cron|periodic|daily report)\b/i.test(q)) {
    return 'scheduled_operative';
  }
  if (/\b(automat|workflow|pipeline|trigger action)\b/i.test(q)) {
    return 'automation_assistant';
  }
  if (/\b(code|debug|refactor|function|algorithm|typescript|kotlin|python|bug|regex|sandbox)\b/i.test(q)) {
    return 'coding_assistant';
  }
  if (/\b(document|pdf|docx|indexed file|notes|knowledge base|summarize file)\b/i.test(q)) {
    return 'document_assistant';
  }
  if (/\b(remember|memory|recall|what did i save|meri yaad|mere baare mein)\b/i.test(q)) {
    return 'memory_assistant';
  }
  if (/\b(orchestrat|multi[- ]agent|compare|pros and cons|strategy|roadmap)\b/i.test(q)) {
    return 'multi_agent_orchestrator';
  }
  if (/\b(research|search|latest|news|verify|citations|source)\b/i.test(q)) {
    return 'research_assistant';
  }
  return 'personal_assistant';
}

export function createOpenJarvisAgentSystem({
  engineManager,
  toolRegistry,
  hybridMemoryEngine,
  learningEngine,
  automationEngine = null,
  auditLogger = null,
  nowFn = () => Date.now(),
}) {
  function planDeterministicTools({ prompt, agentId, assistantMode, namespace }) {
    const planned = [];
    const q = String(prompt || '').trim();

    // Direct explicit math check
    const mathMatch = q.match(/(?:calculate|compute|eval(?:uate)?|what is|solve)\s+([0-9+\-*/^().%\s,sqrtincoablogpowe]{3,120})/i);
    if (mathMatch && /[0-9]/.test(mathMatch[1]) && /[+\-*/^()]|\b(sqrt|sin|cos|log|pow)\b/i.test(mathMatch[1])) {
      planned.push({ tool: 'calculator', args: { expression: mathMatch[1].trim() } });
    }

    if (
      ['document_assistant', 'memory_assistant', 'research_assistant', 'deep_research_agent'].includes(
        assistantMode
      ) ||
      ['native_react', 'orchestrator'].includes(agentId)
    ) {
      planned.push({ tool: 'document_retrieve', args: { query: q.slice(0, 220), mode: 'hybrid', limit: 6, namespace } });
    }

    if (['research_assistant', 'deep_research_agent'].includes(assistantMode)) {
      planned.push({ tool: 'web_search', args: { query: q.slice(0, 180) } });
    }

    if (agentId === 'sandboxed' || (assistantMode === 'coding_assistant' && /\b(list files|workspace)\b/i.test(q))) {
      planned.push({ tool: 'file_list', args: { subdir: '.' } });
    }

    if (planned.length === 0 && ['native_react', 'rlm'].includes(agentId)) {
      planned.push({
        tool: 'think',
        args: { thought: `Analyzing user request under ${assistantMode}: ${q.slice(0, 180)}` },
      });
    }

    return planned;
  }

  async function runDeepResearch({
    query,
    engineId = null,
    modelId = null,
    namespace = 'default',
  }) {
    const started = nowFn();
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) {
      return { ok: false, error: 'Research topic/query is required.' };
    }

    const inj = detectPromptInjection(cleanQuery);
    if (inj.blockExecution) {
      auditLogger?.record({
        category: 'OPENJARVIS_SECURITY',
        severity: 'CRITICAL',
        action: 'Blocked deep research prompt injection',
        detail: inj.reason,
      });
      return { ok: false, code: 'SECURITY_BLOCKED', error: inj.reason };
    }

    const steps = [];
    const subQueries = [
      cleanQuery,
      `${cleanQuery} architecture key mechanisms`,
      `${cleanQuery} limitations benchmarks best practices`,
    ];

    steps.push({ phase: 'decompose', detail: `Generated ${subQueries.length} research angles.` });

    const localSearch = hybridMemoryEngine.hybridSearch({
      query: cleanQuery,
      mode: 'hybrid',
      limit: 6,
      namespace,
    });
    steps.push({
      phase: 'hybrid_retrieval',
      detail: `Retrieved ${localSearch.results.length} matching item(s) across documents & AM AI memories.`,
    });

    const webRes = await toolRegistry.executeTool('web_search', { query: cleanQuery });
    const webSources = Array.isArray(webRes.sources) ? webRes.sources : [];
    steps.push({
      phase: 'web_grounding',
      detail:
        webSources.length > 0
          ? `Collected ${webSources.length} verified web source(s) via Tavily.`
          : 'No live Tavily key configured; grounded strictly on indexed workspace docs & verified knowledge.',
    });

    const evidenceLines = [];
    for (const r of localSearch.results) {
      evidenceLines.push(`[LOCAL:${r.kind} | ${r.title}] ${r.text}`);
    }
    for (const s of webSources) {
      evidenceLines.push(`[WEB:${s.title} | ${s.uri}] ${s.snippet}`);
    }

    const untrustedBundle = wrapUntrustedContext(
      'RESEARCH_EVIDENCE',
      evidenceLines.join('\n\n') || 'No external sources attached.',
      10000
    );

    const synthesisPrompt = [
      `Research Topic: ${cleanQuery}`,
      `Sub-questions explored:\n- ${subQueries.join('\n- ')}`,
      untrustedBundle,
      'Synthesize an accurate, well-structured Markdown research report with:\n1. Executive Summary\n2. Key Findings & Mechanisms\n3. Practical Comparison / Trade-offs\n4. Grounded Citations / Sources Used.',
    ].join('\n\n');

    const llmRes = await engineManager.invokeCompletion({
      engineId,
      modelId,
      prompt: synthesisPrompt,
      systemInstruction:
        'You are the OpenJarvis Deep Research Agent integrated inside AM AI. Cite only verified sources present in evidence or explicitly distinguish general technical knowledge from retrieved sources. Never invent URLs or API capabilities.',
      temperature: 0.25,
      maxTokens: 2400,
    });

    const cleanSummary = sanitizeModelOutput(llmRes.text);
    const citations = [
      ...localSearch.results.map((r) => ({
        kind: r.kind,
        title: r.title,
        score: r.score,
        uri: r.sourceUri || '',
      })),
      ...webSources.map((s) => ({
        kind: 'web',
        title: s.title,
        uri: s.uri,
        score: 1,
      })),
    ];

    const savedReport = hybridMemoryEngine.saveResearchReport(
      {
        query: cleanQuery,
        summary: cleanSummary,
        citations,
        mode: 'deep_research',
      },
      namespace
    );

    const latencyMs = Math.max(1, nowFn() - started);
    const trace = learningEngine.recordTrace({
      agentId: 'orchestrator',
      assistantMode: 'deep_research_agent',
      engineId: llmRes.engineId,
      modelUsed: llmRes.modelUsed,
      prompt: cleanQuery,
      answer: cleanSummary,
      steps,
      toolCalls: [
        { tool: 'document_retrieve', ok: true },
        { tool: 'web_search', ok: true },
      ],
      latencyMs,
      ok: true,
      namespace,
    });

    return {
      ok: true,
      report: savedReport,
      steps,
      citations,
      engineId: llmRes.engineId,
      modelUsed: llmRes.modelUsed,
      fallbackUsed: Boolean(llmRes.fallbackUsed),
      traceId: trace.id,
      latencyMs,
    };
  }

  async function runAgent({
    prompt,
    agentId = 'auto',
    assistantMode = 'auto',
    engineId = null,
    modelId = null,
    history = [],
    namespace = 'default',
    confirmToken = null,
    confirmedSensitiveAction = false,
  }) {
    const started = nowFn();
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) {
      return { ok: false, error: 'Prompt cannot be empty.' };
    }

    // 1. Prompt Injection Guard
    const injectionCheck = detectPromptInjection(cleanPrompt);
    if (injectionCheck.blockExecution) {
      auditLogger?.record({
        category: 'OPENJARVIS_SECURITY',
        severity: 'CRITICAL',
        action: 'Blocked unsafe OpenJarvis prompt',
        detail: injectionCheck.reason,
      });
      return {
        ok: false,
        code: 'SECURITY_BLOCKED',
        error: injectionCheck.reason,
      };
    }

    // 2. Resolve Assistant Mode & OpenJarvis Agent
    const resolvedMode =
      assistantMode && assistantMode !== 'auto' && UNIFIED_ASSISTANT_MODES.some((m) => m.id === assistantMode)
        ? assistantMode
        : classifyAssistantMode(cleanPrompt);

    const modeDef = UNIFIED_ASSISTANT_MODES.find((m) => m.id === resolvedMode) || UNIFIED_ASSISTANT_MODES[0];
    const resolvedAgentId =
      agentId && agentId !== 'auto' && OPENJARVIS_AGENTS.some((a) => a.id === agentId)
        ? agentId
        : modeDef.defaultAgentId;
    const agentDef = OPENJARVIS_AGENTS.find((a) => a.id === resolvedAgentId) || OPENJARVIS_AGENTS[0];

    // 3. Honest reporting for optional external SDK/CLI agents (OpenHands / Claude Code)
    if (['openhands', 'native_openhands', 'claude_code'].includes(agentDef.id)) {
      const pyEngine = engineManager.getEngine('openjarvis_python');
      const pythonOnline = pyEngine?.status === 'connected';
      if (!pythonOnline) {
        const message =
          agentDef.id === 'claude_code'
            ? 'Claude Code Agent is optional and currently unavailable here: it requires the Anthropic Claude Code CLI installed and authenticated on your local PC (AM AI never bundles paid keys or external CLIs). Switch to Coding Assistant (RLM Agent) or Sandboxed Agent to run immediately using your free AM AI providers.'
            : `${agentDef.name} requires the optional OpenHands runtime connected through the standalone OpenJarvis Python Service (unavailable in standalone Node/Vercel mode). Switch to Coding Assistant (RLM Agent) or Sandboxed Agent for verified isolated execution.`;
        const trace = learningEngine.recordTrace({
          agentId: agentDef.id,
          assistantMode: resolvedMode,
          engineId: 'none',
          modelUsed: 'unconfigured',
          prompt: cleanPrompt,
          answer: message,
          steps: [{ phase: 'capability_check', detail: `${agentDef.name} dependency check returned unavailable.` }],
          latencyMs: Math.max(1, nowFn() - started),
          ok: false,
          errorMessage: message,
          namespace,
        });
        return {
          ok: false,
          code: 'OPTIONAL_DEPENDENCY_UNAVAILABLE',
          agentId: agentDef.id,
          assistantMode: resolvedMode,
          experimentalOrOptional: true,
          error: message,
          traceId: trace.id,
        };
      }
    }

    // 4. Sensitive Action Confirmation Gate
    const sensitivity = assessSensitiveAction(cleanPrompt);
    if (sensitivity.requiresConfirmation && !confirmedSensitiveAction) {
      if (!confirmToken) {
        const token = automationEngine?.issueConfirmationToken?.({
          actionType: 'SENSITIVE_AGENT_TASK',
          summary: cleanPrompt.slice(0, 100),
          payload: { agentId: agentDef.id, reasons: sensitivity.reasons },
        });
        return {
          ok: false,
          requiresConfirmation: true,
          confirmationToken: token || null,
          reasons: sensitivity.reasons,
          error: 'Sensitive operation detected. Please confirm explicitly before execution.',
        };
      }
      const verified = automationEngine?.verifyConfirmationToken?.(confirmToken);
      if (automationEngine && (!verified || !verified.valid)) {
        return {
          ok: false,
          code: 'INVALID_CONFIRMATION_TOKEN',
          error: verified?.reason || 'Invalid or expired confirmation token.',
        };
      }
    }

    // 5. Deep research fast-path delegation
    if (resolvedMode === 'deep_research_agent') {
      const researchOutcome = await runDeepResearch({
        query: cleanPrompt,
        engineId,
        modelId,
        namespace,
      });
      if (!researchOutcome.ok) return researchOutcome;
      return {
        ok: true,
        agentId: agentDef.id,
        agentName: agentDef.name,
        assistantMode: resolvedMode,
        assistantName: modeDef.name,
        answer: researchOutcome.report.summary,
        steps: researchOutcome.steps,
        toolCalls: [
          { tool: 'document_retrieve', ok: true },
          { tool: 'web_search', ok: true },
        ],
        citations: researchOutcome.citations,
        reportId: researchOutcome.report.id,
        engineId: researchOutcome.engineId,
        modelUsed: researchOutcome.modelUsed,
        fallbackUsed: researchOutcome.fallbackUsed,
        traceId: researchOutcome.traceId,
        latencyMs: researchOutcome.latencyMs,
      };
    }

    // 6. Monitor Operative deterministic telemetry execution (works even offline without cloud LLM call if monitoring only)
    const steps = [{ phase: 'route', detail: `Selected ${modeDef.name} -> ${agentDef.name}` }];
    const toolCalls = [];

    if (agentDef.id === 'monitor_operative' || resolvedMode === 'task_monitor_agent') {
      const discovery = await engineManager.discoverAll({ includeUnconfigured: false });
      const perf = learningEngine.analyzePerformance();
      const memStats = hybridMemoryEngine.getStats(namespace);
      steps.push({ phase: 'monitor_probe', detail: `Probed ${discovery.probes.length} active engine(s).` });
      toolCalls.push({ tool: 'engine_discovery', ok: true, summary: `${discovery.probes.length} engine(s) checked` });

      const healthy = discovery.probes.filter((p) => p.ok);
      const degraded = discovery.probes.filter((p) => !p.ok);
      const reportLines = [
        `### OpenJarvis Monitor Operative Report`,
        `- **Active Healthy Engines (${healthy.length})**: ${healthy.map((h) => `${h.engineId} (${h.latencyMs}ms)`).join(', ') || 'None'}`,
        `- **Unreachable / Needs Setup (${degraded.length})**: ${degraded.map((d) => `${d.engineId}: ${d.message}`).join('; ') || 'None'}`,
        `- **Indexed Hybrid Memory**: ${memStats.documentsCount} document(s), ${memStats.chunksCount} chunk(s), ${memStats.memoriesBridgedCount} AM AI memory item(s)`,
        `- **Learning Telemetry**: ${perf.totalTraces} recorded trace(s), ${perf.successRate}% success, avg ${perf.avgLatencyMs}ms latency`,
      ];
      if (perf.recommendations.length > 0) {
        reportLines.push(`- **Routing Insight**: ${perf.recommendations[0]}`);
      }
      const answer = reportLines.join('\n');
      const latencyMs = Math.max(1, nowFn() - started);
      const trace = learningEngine.recordTrace({
        agentId: agentDef.id,
        assistantMode: resolvedMode,
        engineId: 'monitor_operative',
        modelUsed: 'deterministic-telemetry',
        prompt: cleanPrompt,
        answer,
        steps,
        toolCalls,
        latencyMs,
        ok: true,
        namespace,
      });
      return {
        ok: true,
        agentId: agentDef.id,
        agentName: agentDef.name,
        assistantMode: resolvedMode,
        assistantName: modeDef.name,
        answer,
        steps,
        toolCalls,
        engineId: 'monitor_operative',
        modelUsed: 'deterministic-telemetry',
        fallbackUsed: false,
        traceId: trace.id,
        latencyMs,
      };
    }

    // 7. Plan and execute OpenJarvis ReAct / RLM / Orchestrator tools cleanly
    const plannedTools = agentDef.supportsTools
      ? planDeterministicTools({
          prompt: cleanPrompt,
          agentId: agentDef.id,
          assistantMode: resolvedMode,
          namespace,
        })
      : [];

    const toolObservations = [];
    for (const step of plannedTools) {
      try {
        const res = await toolRegistry.executeTool(step.tool, step.args);
        toolCalls.push({ tool: step.tool, ok: Boolean(res?.ok !== false), summary: String(res?.text || '').slice(0, 240) });
        steps.push({ phase: 'tool_act', detail: `Executed ${step.tool}` });
        if (res?.text) {
          toolObservations.push(`[Tool:${step.tool}]\n${res.text}`);
        }
      } catch (err) {
        toolCalls.push({ tool: step.tool, ok: false, summary: redactSecrets(err?.message || 'Tool failed') });
        steps.push({ phase: 'tool_error', detail: `${step.tool}: ${err?.message || 'error'}` });
      }
    }

    // 8. Intelligent historical routing recommendation when engineId omitted/auto
    let chosenEngineId = engineId && engineId !== 'auto' ? engineId : null;
    let routingNote = null;
    if (!chosenEngineId) {
      const configuredIds = engineManager
        .listEngines()
        .filter((e) => e.configured && e.enabled && (e.id === 'amai_cloud' || e.status === 'connected'))
        .map((e) => e.id);
      const decision = learningEngine.recommendRoutingDecision({
        taskDomain: resolvedMode,
        availableEngines: configuredIds.length > 0 ? configuredIds : ['amai_cloud'],
      });
      chosenEngineId = decision.recommendedEngineId;
      routingNote = decision.rationale;
      steps.push({ phase: 'learning_policy', detail: decision.rationale });
    }

    // 9. Construct grounded system instruction & protected context
    const systemInstruction = [
      `You are AM AI running the OpenJarvis "${agentDef.name}" (${agentDef.sourceClass}) in "${modeDef.name}" mode.`,
      'Preserve multilingual support seamlessly (English, Hindi, Hinglish according to the user prompt).',
      'Be accurate, concise, structured, and honest about tool outputs and local vs cloud context.',
      agentDef.id === 'rlm'
        ? 'Use step-by-step recursive decomposition and verify code or math claims cleanly.'
        : agentDef.id === 'orchestrator'
          ? 'Synthesize multi-perspective analysis (Architect + Verifier + Executor) clearly.'
          : '',
    ]
      .filter(Boolean)
      .join(' ');

    const promptParts = [];
    if (injectionCheck.flagged) {
      promptParts.push(wrapUntrustedContext('USER_INPUT', cleanPrompt, 6000));
    } else {
      promptParts.push(cleanPrompt);
    }
    if (toolObservations.length > 0) {
      promptParts.push(wrapUntrustedContext('TOOL_OBSERVATIONS', toolObservations.join('\n\n'), 8000));
    }

    try {
      const llmRes = await engineManager.invokeCompletion({
        engineId: chosenEngineId,
        modelId,
        prompt: promptParts.join('\n\n'),
        systemInstruction,
        history,
        temperature: resolvedMode === 'coding_assistant' ? 0.2 : 0.4,
        maxTokens: 2048,
      });

      const finalAnswer = sanitizeModelOutput(llmRes.text);
      const latencyMs = Math.max(1, nowFn() - started);
      steps.push({ phase: 'complete', detail: `Synthesized via ${llmRes.engineId} (${llmRes.modelUsed || 'auto'}).` });

      const trace = learningEngine.recordTrace({
        agentId: agentDef.id,
        assistantMode: resolvedMode,
        engineId: llmRes.engineId,
        modelUsed: llmRes.modelUsed,
        prompt: cleanPrompt,
        answer: finalAnswer,
        steps,
        toolCalls,
        latencyMs,
        ok: true,
        namespace,
      });

      return {
        ok: true,
        agentId: agentDef.id,
        agentName: agentDef.name,
        assistantMode: resolvedMode,
        assistantName: modeDef.name,
        answer: finalAnswer,
        steps,
        toolCalls,
        routingNote,
        engineId: llmRes.engineId,
        engineName: llmRes.engineName,
        modelUsed: llmRes.modelUsed,
        fallbackUsed: Boolean(llmRes.fallbackUsed),
        fallbackFromEngine: llmRes.fallbackFromEngine || null,
        traceId: trace.id,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Math.max(1, nowFn() - started);
      const safeErr = redactSecrets(err?.message || 'OpenJarvis agent execution failed.');
      const trace = learningEngine.recordTrace({
        agentId: agentDef.id,
        assistantMode: resolvedMode,
        engineId: chosenEngineId || 'amai_cloud',
        modelUsed: modelId || 'unknown',
        prompt: cleanPrompt,
        answer: '',
        steps,
        toolCalls,
        latencyMs,
        ok: false,
        errorMessage: safeErr,
        namespace,
      });
      return {
        ok: false,
        code: err?.code || 'AGENT_EXECUTION_ERROR',
        error: safeErr,
        agentId: agentDef.id,
        assistantMode: resolvedMode,
        steps,
        toolCalls,
        traceId: trace.id,
        latencyMs,
      };
    }
  }

  return {
    listAgents: () => OPENJARVIS_AGENTS,
    listAssistantModes: () => UNIFIED_ASSISTANT_MODES,
    classifyAssistantMode,
    runAgent,
    runDeepResearch,
  };
}

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

/**
 * OpenJarvis Learning Pillar:
 * - Captures detailed execution traces (steps, tools, latency, tokens, energy/Intelligence-Per-Watt est.)
 * - Trace analysis & agent/model performance evaluation
 * - Intelligent UCB1 / EWMA routing policy learning from historical traces
 * - Live reproducible benchmarking across engines/agents
 */
export function createOpenJarvisLearningEngine({
  baseDir = process.cwd(),
  filePath = null,
  nowFn = () => Date.now(),
} = {}) {
  const defaultPath = process.env.VERCEL
    ? path.join(os.tmpdir(), 'openjarvis-learning-traces.json')
    : path.resolve(baseDir, 'data', 'openjarvis-learning-traces.json');
  const resolvedPath = filePath || defaultPath;

  let state = null;

  function load() {
    if (state) return state;
    try {
      if (fs.existsSync(resolvedPath)) {
        const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          state = {
            traces: Array.isArray(parsed.traces) ? parsed.traces : [],
            benchmarks: Array.isArray(parsed.benchmarks) ? parsed.benchmarks : [],
            routingPolicy: parsed.routingPolicy || {
              strategy: 'adaptive_ucb1',
              preferLocalWhenHealthy: false,
              efficiencyWeight: 0.25,
              qualityWeight: 0.5,
              latencyWeight: 0.25,
            },
          };
          return state;
        }
      }
    } catch {
      // ignore corrupt store
    }
    state = {
      traces: [],
      benchmarks: [],
      routingPolicy: {
        strategy: 'adaptive_ucb1',
        preferLocalWhenHealthy: false,
        efficiencyWeight: 0.25,
        qualityWeight: 0.5,
        latencyWeight: 0.25,
      },
    };
    return state;
  }

  function save() {
    const s = load();
    const write = (dest) => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf8');
      fs.renameSync(tmp, dest);
    };
    try {
      write(resolvedPath);
    } catch {
      try {
        write(path.join(os.tmpdir(), 'openjarvis-learning-traces.json'));
      } catch {
        // non-fatal
      }
    }
  }

  function estimateEfficiencyMetrics({ engineId, latencyMs, outputTokens = 0 }) {
    const sec = Math.max(0.05, latencyMs / 1000);
    const isLocal = engineId && engineId !== 'amai_cloud';
    // Conservative watt estimates (0 local watts for cloud inference; ~35-75W local GPU/CPU)
    const estimatedWatts = isLocal ? 42 : 0;
    const estimatedJoules = Number((estimatedWatts * sec).toFixed(2));
    const tokensPerSec = outputTokens > 0 ? Number((outputTokens / sec).toFixed(1)) : 0;
    return {
      isLocalInference: Boolean(isLocal),
      estimatedWatts,
      estimatedJoules,
      tokensPerSec,
      efficiencyNote: isLocal
        ? 'Local hardware watt/joule estimate based on active local engine duration.'
        : 'Zero local GPU watt cost (executed on AM AI free-tier cloud engine).',
    };
  }

  function recordTrace({
    agentId,
    assistantMode,
    engineId,
    modelUsed,
    prompt,
    answer,
    steps = [],
    toolCalls = [],
    latencyMs = 0,
    ok = true,
    errorMessage = null,
    confidenceScore = null,
    namespace = 'default',
  }) {
    const s = load();
    const inputTokens = Math.max(1, Math.ceil(String(prompt || '').length / 4));
    const outputTokens = Math.max(0, Math.ceil(String(answer || '').length / 4));
    const efficiency = estimateEfficiencyMetrics({ engineId, latencyMs, outputTokens });

    const trace = {
      id: `trace_${nowFn()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: nowFn(),
      namespace,
      agentId: String(agentId || 'simple'),
      assistantMode: String(assistantMode || 'personal_assistant'),
      engineId: String(engineId || 'amai_cloud'),
      modelUsed: String(modelUsed || 'unknown'),
      ok: Boolean(ok),
      errorMessage: errorMessage ? String(errorMessage).slice(0, 240) : null,
      latencyMs: Math.max(1, Math.round(latencyMs)),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      stepCount: Array.isArray(steps) ? steps.length : 0,
      toolCallCount: Array.isArray(toolCalls) ? toolCalls.length : 0,
      toolsUsed: Array.isArray(toolCalls) ? toolCalls.map((t) => t.tool).filter(Boolean) : [],
      steps: Array.isArray(steps) ? steps.slice(0, 15) : [],
      promptPreview: String(prompt || '').trim().slice(0, 140),
      answerPreview: String(answer || '').trim().slice(0, 200),
      confidenceScore: typeof confidenceScore === 'number' ? confidenceScore : ok ? 0.85 : 0.15,
      userRating: null,
      efficiency,
    };

    s.traces = [trace, ...s.traces].slice(0, 300);
    save();
    return trace;
  }

  function rateTrace(traceId, { rating, note = '' } = {}) {
    const s = load();
    const target = s.traces.find((t) => t.id === traceId);
    if (!target) return { ok: false, found: false };
    const cleanRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 3)));
    target.userRating = cleanRating;
    target.feedbackNote = String(note || '').slice(0, 240);
    target.confidenceScore = Number((cleanRating / 5).toFixed(2));
    save();
    return { ok: true, found: true, trace: target };
  }

  function analyzePerformance() {
    const s = load();
    const traces = s.traces;
    if (traces.length === 0) {
      return {
        totalTraces: 0,
        successRate: 100,
        avgLatencyMs: 0,
        totalTokens: 0,
        totalEstimatedJoules: 0,
        byAgent: [],
        byModel: [],
        byEngine: [],
        recommendations: ['Run OpenJarvis agents or benchmarks to collect real learning traces.'],
      };
    }

    const successCount = traces.filter((t) => t.ok).length;
    const avgLatencyMs = Math.round(traces.reduce((a, t) => a + t.latencyMs, 0) / traces.length);
    const totalTokens = traces.reduce((a, t) => a + (t.totalTokens || 0), 0);
    const totalEstimatedJoules = Number(
      traces.reduce((a, t) => a + (t.efficiency?.estimatedJoules || 0), 0).toFixed(2)
    );

    const groupBy = (key) => {
      const map = new Map();
      for (const t of traces) {
        const k = String(t[key] || 'unknown');
        const cur = map.get(k) || {
          key: k,
          runs: 0,
          successes: 0,
          totalLatencyMs: 0,
          totalTokens: 0,
          confidenceSum: 0,
        };
        cur.runs += 1;
        if (t.ok) cur.successes += 1;
        cur.totalLatencyMs += t.latencyMs;
        cur.totalTokens += t.totalTokens || 0;
        cur.confidenceSum += Number(t.confidenceScore || 0.7);
        map.set(k, cur);
      }
      return Array.from(map.values())
        .map((g) => ({
          id: g.key,
          runs: g.runs,
          successRate: Math.round((g.successes / g.runs) * 100),
          avgLatencyMs: Math.round(g.totalLatencyMs / g.runs),
          avgTokens: Math.round(g.totalTokens / g.runs),
          avgQualityScore: Number((g.confidenceSum / g.runs).toFixed(2)),
        }))
        .sort((a, b) => b.runs - a.runs);
    };

    const byAgent = groupBy('agentId');
    const byModel = groupBy('modelUsed');
    const byEngine = groupBy('engineId');

    const recommendations = [];
    const fastestModel = [...byModel].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
    const highestQualityAgent = [...byAgent].sort((a, b) => b.avgQualityScore - a.avgQualityScore)[0];
    if (fastestModel) {
      recommendations.push(
        `Fastest observed model: "${fastestModel.id}" averaging ${fastestModel.avgLatencyMs}ms (${fastestModel.successRate}% success).`
      );
    }
    if (highestQualityAgent) {
      recommendations.push(
        `Top quality agent: "${highestQualityAgent.id}" with quality index ${highestQualityAgent.avgQualityScore}.`
      );
    }

    return {
      totalTraces: traces.length,
      successRate: Math.round((successCount / traces.length) * 100),
      avgLatencyMs,
      totalTokens,
      totalEstimatedJoules,
      byAgent,
      byModel,
      byEngine,
      recommendations,
    };
  }

  /**
   * Recommends the best engine/agent from historical execution traces using UCB1 + efficiency policy.
   */
  function recommendRoutingDecision({ taskDomain = 'general', availableEngines = ['amai_cloud'] } = {}) {
    const s = load();
    const policy = s.routingPolicy;
    const totalN = Math.max(1, s.traces.length);

    if (policy.preferLocalWhenHealthy) {
      const localEngine = availableEngines.find((e) => e !== 'amai_cloud');
      if (localEngine) {
        return {
          recommendedEngineId: localEngine,
          strategy: 'prefer_local_policy',
          rationale: `Routing policy prefers local engine "${localEngine}" because it is healthy and reachable.`,
        };
      }
    }

    const scores = availableEngines.map((engId) => {
      const subset = s.traces.filter((t) => t.engineId === engId);
      if (subset.length === 0) {
        // Explore unvisited healthy engines moderately unless serverless prefers amai_cloud
        return {
          engineId: engId,
          score: engId === 'amai_cloud' ? 0.92 : 0.78,
          runs: 0,
        };
      }
      const okRate = subset.filter((t) => t.ok).length / subset.length;
      const avgLat = subset.reduce((a, t) => a + t.latencyMs, 0) / subset.length;
      const latScore = Math.max(0.1, 1 - Math.min(avgLat, 10000) / 10000);
      const exploreBonus = Math.sqrt((0.15 * Math.log(totalN + 1)) / subset.length);
      const combined =
        okRate * policy.qualityWeight +
        latScore * policy.latencyWeight +
        (engId !== 'amai_cloud' ? 1 : 0.7) * policy.efficiencyWeight +
        exploreBonus;
      return { engineId: engId, score: Number(combined.toFixed(4)), runs: subset.length };
    });

    scores.sort((a, b) => b.score - a.score);
    const winner = scores[0] || { engineId: 'amai_cloud', score: 1, runs: 0 };
    return {
      recommendedEngineId: winner.engineId,
      strategy: policy.strategy,
      taskDomain,
      candidates: scores,
      rationale: `Selected "${winner.engineId}" (UCB1/efficiency score ${winner.score} over ${winner.runs} trace(s)).`,
    };
  }

  function updatePolicy(patch = {}) {
    const s = load();
    if (typeof patch.strategy === 'string' && ['adaptive_ucb1', 'prefer_local', 'cloud_first'].includes(patch.strategy)) {
      s.routingPolicy.strategy = patch.strategy;
    }
    if (typeof patch.preferLocalWhenHealthy === 'boolean') {
      s.routingPolicy.preferLocalWhenHealthy = patch.preferLocalWhenHealthy;
    }
    save();
    return s.routingPolicy;
  }

  function recordBenchmark(entry) {
    const s = load();
    s.benchmarks = [entry, ...s.benchmarks].slice(0, 50);
    save();
    return entry;
  }

  return {
    recordTrace,
    rateTrace,
    listTraces: (limit = 50) => load().traces.slice(0, Math.max(1, Math.min(200, limit))),
    getPolicy: () => load().routingPolicy,
    updatePolicy,
    analyzePerformance,
    recommendRoutingDecision,
    recordBenchmark,
    listBenchmarks: (limit = 20) => load().benchmarks.slice(0, limit),
  };
}

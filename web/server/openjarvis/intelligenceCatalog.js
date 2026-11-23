import os from 'os';

/**
 * OpenJarvis Intelligence Pillar — Model Catalog (`BUILTIN_MODELS`), Hardware Inspector,
 * Capability Matrix, and Hardware-Aware Recommendation Engine.
 * Mirrors `openjarvis.intelligence.model_catalog` & hardware advisors cleanly.
 */
export const OPENJARVIS_BUILTIN_MODELS = Object.freeze([
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (AM AI Primary)',
    family: 'Gemini',
    paramsB: 0,
    quantization: 'cloud-managed',
    minRamGb: 0,
    minVramGb: 0,
    contextLength: 1000000,
    engines: ['amai_cloud'],
    capabilities: ['chat', 'reasoning', 'coding', 'vision', 'tool_calling', 'multimodal'],
    efficiencyTier: 'cloud_free_tier',
    tokensPerSecEstimate: 95,
    wattsEstimate: 0,
    costTier: 'free_tier',
    notes: 'AM AI existing primary free-tier cloud engine adapter (preserved unchanged).',
  },
  {
    id: 'qwen2.5:1.5b',
    name: 'Qwen 2.5 1.5B Instruct',
    family: 'Qwen2.5',
    paramsB: 1.5,
    quantization: 'Q4_K_M',
    minRamGb: 4,
    minVramGb: 2,
    contextLength: 32768,
    engines: ['ollama', 'llamacpp', 'vllm', 'sglang'],
    capabilities: ['chat', 'coding', 'tool_calling'],
    efficiencyTier: 'ultra_efficient',
    tokensPerSecEstimate: 65,
    wattsEstimate: 22,
    costTier: 'local_free',
    notes: 'Ideal for CPU-only laptops, edge PCs, and fast ReAct tool turns.',
  },
  {
    id: 'gemma3:4b',
    name: 'Gemma 3 4B Instruct',
    family: 'Gemma3',
    paramsB: 4.0,
    quantization: 'Q4_K_M',
    minRamGb: 8,
    minVramGb: 4,
    contextLength: 128000,
    engines: ['ollama', 'llamacpp', 'vllm', 'sglang'],
    capabilities: ['chat', 'reasoning', 'vision', 'tool_calling'],
    efficiencyTier: 'high_efficiency',
    tokensPerSecEstimate: 48,
    wattsEstimate: 35,
    costTier: 'local_free',
    notes: 'Balanced Intelligence-Per-Watt multimodal local model for 8GB+ machines.',
  },
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B Instruct',
    family: 'Llama3.2',
    paramsB: 3.0,
    quantization: 'Q4_K_M',
    minRamGb: 6,
    minVramGb: 3,
    contextLength: 128000,
    engines: ['ollama', 'llamacpp', 'vllm', 'sglang'],
    capabilities: ['chat', 'writing', 'tool_calling'],
    efficiencyTier: 'high_efficiency',
    tokensPerSecEstimate: 58,
    wattsEstimate: 28,
    costTier: 'local_free',
    notes: 'Fast personal assistant & summarization model.',
  },
  {
    id: 'qwen2.5-coder:7b',
    name: 'Qwen 2.5 Coder 7B',
    family: 'Qwen2.5-Coder',
    paramsB: 7.0,
    quantization: 'Q4_K_M',
    minRamGb: 12,
    minVramGb: 6,
    contextLength: 32768,
    engines: ['ollama', 'llamacpp', 'vllm', 'sglang'],
    capabilities: ['coding', 'debugging', 'tool_calling', 'reasoning'],
    efficiencyTier: 'balanced',
    tokensPerSecEstimate: 38,
    wattsEstimate: 65,
    costTier: 'local_free',
    notes: 'Recommended local coding, refactoring, and sandbox synthesis model.',
  },
  {
    id: 'deepseek-r1:8b',
    name: 'DeepSeek-R1 Distill Llama 8B',
    family: 'DeepSeek-R1',
    paramsB: 8.0,
    quantization: 'Q4_K_M',
    minRamGb: 12,
    minVramGb: 6,
    contextLength: 65536,
    engines: ['ollama', 'llamacpp', 'vllm', 'sglang'],
    capabilities: ['reasoning', 'mathematics', 'coding'],
    efficiencyTier: 'balanced',
    tokensPerSecEstimate: 32,
    wattsEstimate: 72,
    costTier: 'local_free',
    notes: 'Strong local reasoning & step-by-step math chain verification.',
  },
  {
    id: 'nemotron-mini:4b',
    name: 'NVIDIA Nemotron Mini 4B',
    family: 'Nemotron',
    paramsB: 4.0,
    quantization: 'Q4_K_M',
    minRamGb: 8,
    minVramGb: 4,
    contextLength: 4096,
    engines: ['ollama', 'llamacpp'],
    capabilities: ['chat', 'tool_calling', 'rag'],
    efficiencyTier: 'high_efficiency',
    tokensPerSecEstimate: 50,
    wattsEstimate: 34,
    costTier: 'local_free',
    notes: 'Tuned for OpenJarvis local RAG and structured tool execution.',
  },
  {
    id: 'granite3.2:8b',
    name: 'IBM Granite 3.2 8B',
    family: 'Granite',
    paramsB: 8.0,
    quantization: 'Q4_K_M',
    minRamGb: 12,
    minVramGb: 6,
    contextLength: 128000,
    engines: ['ollama', 'vllm'],
    capabilities: ['chat', 'rag', 'tool_calling', 'reasoning'],
    efficiencyTier: 'balanced',
    tokensPerSecEstimate: 35,
    wattsEstimate: 70,
    costTier: 'local_free',
    notes: 'Enterprise-grade local RAG & grounded citation assistant.',
  },
  {
    id: 'qwen2.5:14b',
    name: 'Qwen 2.5 14B Instruct',
    family: 'Qwen2.5',
    paramsB: 14.0,
    quantization: 'Q4_K_M',
    minRamGb: 20,
    minVramGb: 12,
    contextLength: 32768,
    engines: ['ollama', 'llamacpp', 'vllm', 'sglang'],
    capabilities: ['chat', 'reasoning', 'coding', 'tool_calling', 'rag'],
    efficiencyTier: 'workstation',
    tokensPerSecEstimate: 24,
    wattsEstimate: 145,
    costTier: 'local_free',
    notes: 'High-accuracy local orchestration and multi-step research synthesis.',
  },
  {
    id: 'llama3.3:70b',
    name: 'Llama 3.3 70B Instruct',
    family: 'Llama3.3',
    paramsB: 70.0,
    quantization: 'Q4_K_M',
    minRamGb: 64,
    minVramGb: 44,
    contextLength: 128000,
    engines: ['vllm', 'sglang', 'ollama'],
    capabilities: ['chat', 'reasoning', 'coding', 'tool_calling', 'research'],
    efficiencyTier: 'gpu_server',
    tokensPerSecEstimate: 18,
    wattsEstimate: 320,
    costTier: 'local_free',
    notes: 'Requires multi-GPU or high-memory unified workstation.',
  },
]);

export function inspectHostHardware({ pythonHardwareInfo = null } = {}) {
  const totalRamBytes = os.totalmem();
  const freeRamBytes = os.freemem();
  const cpus = os.cpus() || [];
  const totalRamGb = Number((totalRamBytes / (1024 ** 3)).toFixed(2));
  const freeRamGb = Number((freeRamBytes / (1024 ** 3)).toFixed(2));
  const isVercel = Boolean(process.env.VERCEL);

  const gpu = pythonHardwareInfo?.gpu || {
    detected: false,
    name: null,
    vramTotalGb: 0,
    vramFreeGb: 0,
    source: isVercel
      ? 'Serverless container (GPU unavailable in Vercel function)'
      : 'Connect local OpenJarvis Python service for NVIDIA/Metal VRAM telemetry',
  };

  return {
    platform: os.platform(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model || 'Unknown CPU',
    cpuCores: cpus.length || 1,
    totalRamGb,
    freeRamGb,
    isServerless: isVercel,
    runtimeMode: isVercel ? 'vercel-serverless' : 'node-host',
    gpu,
    inspectedAt: new Date().toISOString(),
  };
}

export function recommendModelsForHardware(hardware, { capability = 'all', engine = 'all' } = {}) {
  const capFilter = String(capability || 'all').trim().toLowerCase();
  const engFilter = String(engine || 'all').trim().toLowerCase();
  const availableRam = Number(hardware?.totalRamGb || 0);
  const availableVram = Number(hardware?.gpu?.vramTotalGb || 0);

  return OPENJARVIS_BUILTIN_MODELS.filter((m) => {
    if (capFilter !== 'all' && !m.capabilities.includes(capFilter)) return false;
    if (engFilter !== 'all' && !m.engines.includes(engFilter)) return false;
    return true;
  }).map((model) => {
    if (model.costTier === 'free_tier') {
      return {
        ...model,
        fitStatus: 'optimal',
        recommended: true,
        fitReason: hardware?.isServerless
          ? 'Optimal on serverless/cloud runtime (zero local RAM/VRAM needed).'
          : 'Always ready via AM AI existing free-tier cloud inference adapter.',
      };
    }

    if (hardware?.isServerless) {
      return {
        ...model,
        fitStatus: 'remote_pc_required',
        recommended: false,
        fitReason: `Local model (${model.minRamGb}GB RAM / ${model.minVramGb}GB VRAM) requires local PC host or remote OpenJarvis Python service.`,
      };
    }

    const vramOk = availableVram > 0 ? availableVram >= model.minVramGb : false;
    const ramOk = availableRam >= model.minRamGb;
    const tightRam = availableRam >= model.minRamGb * 0.75;

    let fitStatus = 'insufficient_hardware';
    let recommended = false;
    let fitReason = `Needs ~${model.minRamGb}GB RAM or ${model.minVramGb}GB VRAM (detected ${availableRam}GB RAM, ${availableVram}GB VRAM).`;

    if (vramOk) {
      fitStatus = 'optimal';
      recommended = true;
      fitReason = `Fits GPU VRAM cleanly (${availableVram}GB detected >= ${model.minVramGb}GB required).`;
    } else if (ramOk) {
      fitStatus = availableVram > 0 ? 'cpu_offload' : 'optimal_cpu';
      recommended = model.paramsB <= 8;
      fitReason = `Fits system RAM (${availableRam}GB detected >= ${model.minRamGb}GB required).`;
    } else if (tightRam) {
      fitStatus = 'tight';
      recommended = false;
      fitReason = `Tight memory margin (${availableRam}GB RAM vs ${model.minRamGb}GB target); slower paging likely.`;
    }

    return {
      ...model,
      fitStatus,
      recommended,
      fitReason,
    };
  });
}

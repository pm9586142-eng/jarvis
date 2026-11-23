export {
  getNextUltronShape,
  parseUltronVoiceCommand,
  ULTRON_SHAPE_LABELS,
  ULTRON_SHAPE_ORDER,
} from './ultronCommands.js';
export type { UltronCommandAction } from './ultronCommands.js';

export type LocalVoiceCommand =
  | 'OPEN_SECURITY'
  | 'TOGGLE_LOCKDOWN'
  | 'CHECK_BATTERY'
  | 'STOP'
  | 'NEW_CHAT'
  | 'OPEN_BRAIN_CENTER'
  | 'OPEN_MEDIA_CONTROL'
  | 'CHECK_PROVIDER_HEALTH'
  | 'REPLAY_WELCOME';

export type BrainVoiceAction =
  | { type: 'SWITCH_PROVIDER'; providerId: string }
  | { type: 'SELECT_AGENT'; agentId: string; prompt?: string }
  | { type: 'RUN_COLLABORATION'; prompt: string };

const PROVIDER_VOICE_ALIASES: Record<string, string> = {
  gemini: 'gemini',
  'google gemini': 'gemini',
  groq: 'groq',
  openrouter: 'openrouter',
  'open router': 'openrouter',
  mistral: 'mistral',
  sambanova: 'sambanova',
  'samba nova': 'sambanova',
  nvidia: 'nvidia',
  'nvidia nim': 'nvidia',
  cloudflare: 'cloudflare',
  cohere: 'cohere',
  huggingface: 'huggingface',
  'hugging face': 'huggingface',
  ollama: 'ollama',
  local: 'ollama',
  deepseek: 'deepseek',
  'deep seek': 'deepseek',
};

const SPECIALIST_VOICE_ALIASES: Record<string, string> = {
  research: 'research',
  coding: 'coding',
  coder: 'coding',
  code: 'coding',
  reasoning: 'reasoning',
  math: 'mathematics',
  mathematics: 'mathematics',
  writing: 'writing',
  writer: 'writing',
  vision: 'vision',
  document: 'document_analysis',
  'document analysis': 'document_analysis',
  security: 'security',
  debug: 'debugging',
  debugging: 'debugging',
  testing: 'testing',
  tester: 'testing',
  voice: 'voice',
  memory: 'memory',
  planning: 'planning',
  planner: 'planning',
  automation: 'automation',
};

function normalizeVoiceText(rawText: string): string {
  return String(rawText || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseLocalVoiceCommand(rawText: string): LocalVoiceCommand | null {
  const normalized = normalizeVoiceText(rawText);
  if (!normalized) return null;

  if (
    normalized === 'stop' ||
    normalized === 'stop listening' ||
    normalized === 'stop speaking' ||
    normalized === 'stop voice' ||
    normalized === 'exit voice' ||
    normalized === 'exit hands free' ||
    normalized === 'exit hands-free'
  ) {
    return 'STOP';
  }

  if (
    normalized.includes('open security') ||
    normalized.includes('show security') ||
    normalized.includes('go to security')
  ) {
    return 'OPEN_SECURITY';
  }

  if (
    normalized.includes('toggle lockdown') ||
    normalized.includes('emergency lockdown') ||
    normalized === 'lockdown'
  ) {
    return 'TOGGLE_LOCKDOWN';
  }

  if (
    normalized.includes("what's my battery") ||
    normalized.includes('whats my battery') ||
    normalized.includes('what is my battery') ||
    normalized.includes('battery status') ||
    normalized.includes('battery level')
  ) {
    return 'CHECK_BATTERY';
  }

  if (
    normalized === 'new chat' ||
    normalized.includes('start a new chat') ||
    normalized.includes('start new chat') ||
    normalized.includes('create new chat')
  ) {
    return 'NEW_CHAT';
  }

  if (
    normalized.includes('open brain center') ||
    normalized.includes('open multi ai') ||
    normalized.includes('open control center') ||
    normalized.includes('show brain center')
  ) {
    return 'OPEN_BRAIN_CENTER';
  }

  if (
    normalized.includes('open media control') ||
    normalized.includes('open media player') ||
    normalized.includes('open media hud') ||
    normalized.includes('show media control')
  ) {
    return 'OPEN_MEDIA_CONTROL';
  }

  if (
    normalized.includes('check provider health') ||
    normalized.includes('check ai health') ||
    normalized.includes('system health status') ||
    normalized.includes('provider health')
  ) {
    return 'CHECK_PROVIDER_HEALTH';
  }

  if (
    normalized.includes('replay welcome') ||
    normalized.includes('play welcome') ||
    normalized.includes('welcome greeting')
  ) {
    return 'REPLAY_WELCOME';
  }

  return null;
}

/**
 * Parses Phase 8 voice-controlled Multi-AI Brain directives (provider switching,
 * specialist agent selection, or collaborative multi-agent execution).
 */
export function parseBrainVoiceAction(rawText: string): BrainVoiceAction | null {
  const normalized = normalizeVoiceText(rawText);
  if (!normalized) return null;

  // 1. Switch AI provider: "switch to groq", "use openrouter", "select mistral provider"
  const providerMatch = normalized.match(
    /^(?:please\s+)?(?:switch\s+(?:ai\s+|provider\s+)?to|use|select|activate)\s+([a-z0-9\s-]+?)(?:\s+(?:provider|ai|model))?$/i
  );
  if (providerMatch) {
    const candidate = providerMatch[1].trim();
    const mapped = PROVIDER_VOICE_ALIASES[candidate];
    if (mapped) {
      return { type: 'SWITCH_PROVIDER', providerId: mapped };
    }
  }

  // 2. Select / run specialist agent: "use coding agent", "run security agent on ...", "activate research agent"
  const agentMatch = normalized.match(
    /^(?:please\s+)?(?:use|select|activate|run|ask)\s+(?:the\s+)?([a-z\s]+?)\s+(?:specialist\s+)?agent(?:\s+(?:to|for|on)\s+(.+))?$/i
  );
  if (agentMatch) {
    const alias = agentMatch[1].trim();
    const agentId = SPECIALIST_VOICE_ALIASES[alias];
    if (agentId) {
      return {
        type: 'SELECT_AGENT',
        agentId,
        prompt: agentMatch[2]?.trim() || undefined,
      };
    }
  }

  // 3. Explicit multi-agent collaboration command: "collaborate on ...", "run multi agent on ..."
  const collabMatch = rawText
    .trim()
    .match(/^(?:please\s+)?(?:collaborate|run\s+multi[- ]?agent|multi[- ]?ai\s+collaborate)\s+(?:on|about|to)\s+(.+)$/i);
  if (collabMatch && collabMatch[1].trim()) {
    return {
      type: 'RUN_COLLABORATION',
      prompt: collabMatch[1].trim(),
    };
  }

  return null;
}

export type OpenJarvisVoiceAction =
  | { type: 'OPEN_OPENJARVIS' }
  | { type: 'DEEP_RESEARCH'; query: string }
  | { type: 'HYBRID_SEARCH'; query: string }
  | { type: 'CHECK_ENGINES' }
  | { type: 'RUN_MODE'; assistantMode: string; prompt: string };

/**
 * Parses bilingual (English / Hindi / Hinglish) voice directives for OpenJarvis.
 */
export function parseOpenJarvisVoiceCommand(rawText: string): OpenJarvisVoiceAction | null {
  const cleaned = String(rawText || '').trim();
  const normalized = cleaned
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;

  if (
    /\b(?:open|show|launch|kholo|chalao|dikhao)\s+(?:the\s+)?open\s*jarvis\b/i.test(normalized) ||
    /\bopen\s*jarvis\s+(?:workspace|hub|panel|kholo)\b/i.test(normalized)
  ) {
    return { type: 'OPEN_OPENJARVIS' };
  }

  const researchMatch = cleaned.match(
    /^(?:please\s+)?(?:run\s+)?(?:deep\s+research|gahan\s+(?:research|adhyayan)|research\s+karo)(?:\s+(?:on|about|pe|par))?\s+(.+)$/i
  );
  if (researchMatch && researchMatch[1].trim()) {
    return { type: 'DEEP_RESEARCH', query: researchMatch[1].trim() };
  }

  const memMatch = cleaned.match(
    /^(?:please\s+)?(?:search|find|dhundo|khojo)\s+(?:open\s*jarvis\s+)?(?:hybrid\s+)?(?:memory|documents|notes|knowledge)(?:\s+(?:for|on|mein))?\s+(.+)$/i
  );
  if (memMatch && memMatch[1].trim()) {
    return { type: 'HYBRID_SEARCH', query: memMatch[1].trim() };
  }

  if (
    /\b(?:check|probe|test)\s+(?:open\s*jarvis\s+)?(?:local\s+)?engines\b/i.test(normalized) ||
    /\bollama\s+(?:status|check)\b/i.test(normalized)
  ) {
    return { type: 'CHECK_ENGINES' };
  }

  const modeRunMatch = cleaned.match(
    /^(?:please\s+)?(?:run|use|ask)\s+(?:the\s+)?(personal|research|coding|document|memory|automation|task monitor|scheduled operative|multi agent)\s+(?:assistant|agent|mode)(?:\s+(?:on|for|to))?\s+(.+)$/i
  );
  if (modeRunMatch && modeRunMatch[2].trim()) {
    const modeMap: Record<string, string> = {
      personal: 'personal_assistant',
      research: 'research_assistant',
      coding: 'coding_assistant',
      document: 'document_assistant',
      memory: 'memory_assistant',
      automation: 'automation_assistant',
      'task monitor': 'task_monitor_agent',
      'scheduled operative': 'scheduled_operative',
      'multi agent': 'multi_agent_orchestrator',
    };
    const mapped = modeMap[modeRunMatch[1].toLowerCase()];
    if (mapped) {
      return { type: 'RUN_MODE', assistantMode: mapped, prompt: modeRunMatch[2].trim() };
    }
  }

  return null;
}


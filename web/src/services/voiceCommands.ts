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

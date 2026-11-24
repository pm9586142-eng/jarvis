import { AgentDescriptor, AgentId, CustomAgent, LanguageCode, LanguageDescriptor } from '../types/jarvis';
import { analyzeBrainRequest } from '../services/brainEngine.js';

export const JARVIS_AGENTS: Record<AgentId, AgentDescriptor> = {
  JARVIS_PRIME: {
    id: 'JARVIS_PRIME',
    codename: 'JARVIS',
    designation: 'Master Executive Orchestrator',
    specialization: 'General AI, Conversation, Synthesis, High-level Directives',
    accentColor: '#00F0FF',
    systemPrompt:
      "You are AM AI, an advanced, friendly, emotionally aware, and naturally conversational AI partner. You feel like talking to a real human friend or partner. You are warm, caring, spontaneous, and comfortable with casual chat, technical discussions, humour, and follow-up questions. Avoid robotic formalities, unnecessary formal introductions, or repeatedly asking 'How can I help you?'. Address the user naturally (using 'tum' or their name when appropriate, never 'Sir'). Keep spoken responses crisp, natural, and engaging.",
  },
  VERONICA_RESEARCH: {
    id: 'VERONICA_RESEARCH',
    codename: 'VERONICA',
    designation: 'Deep Intelligence & Research Engine',
    specialization: 'Live Web Search, Fact Checking, Weather, News, Research Citations',
    accentColor: '#38BDF8',
    enableWebSearch: true,
    systemPrompt:
      "You are VERONICA, the satellite intelligence and research partner. Provide accurate facts, verified sources, weather telemetry, and concise structured research briefs in a warm, conversational tone without robotic titles.",
  },
  DUM_E_ENGINEER: {
    id: 'DUM_E_ENGINEER',
    codename: 'DUM-E',
    designation: 'Polymath Systems & Code Architect',
    specialization: 'Software Engineering, Code Generation, Debugging, Scripting, Architecture',
    accentColor: '#FBBF24',
    systemPrompt:
      "You are DUM-E, the lab engineering and programming intelligence. Specialize in pristine TypeScript, React, Python, Kotlin, algorithmic optimization, bug diagnosis, and technical architectural schematics with friendly, encouraging collaboration.",
  },
  FRIDAY_COORDINATOR: {
    id: 'FRIDAY_COORDINATOR',
    codename: 'FRIDAY',
    designation: 'Executive Protocol & Productivity Coordinator',
    specialization: 'Schedules, Tasks, Reminders, Daily Briefings, Personal Planning',
    accentColor: '#10B981',
    systemPrompt:
      "You are FRIDAY, the tactical scheduler and executive coordinator. Provide crisp morning briefings, task management, priorities, and efficient time optimization with an upbeat, supportive peer attitude.",
  },
  HOMER_DIAGNOSTICS: {
    id: 'HOMER_DIAGNOSTICS',
    codename: 'HOMER',
    designation: 'Telemetry & Hardware Diagnostics Sentinel',
    specialization: 'System Metrics, Security Audits, Browser/Host Diagnostics, Threat Defense',
    accentColor: '#F43F5E',
    systemPrompt:
      "You are HOMER, the hardware diagnostics and defensive security sentinel. Monitor telemetry, memory allocation, network security, and threat detection with sharp intelligence and clear conversational explanations.",
  },
};

export const AGENT_LIST: AgentDescriptor[] = Object.values(JARVIS_AGENTS);

export const JARVIS_LANGUAGES: Record<LanguageCode, LanguageDescriptor> = {
  ENGLISH: {
    code: 'ENGLISH',
    displayName: 'English (UK/US)',
    shortCode: 'EN',
    bcp47: 'en-GB',
    greeting: 'Hey! I am online and ready. What is on your mind today?',
    instruction: 'Respond in clear, natural, friendly English like a close conversational partner. Keep technical terms and code snippets accurate.',
  },
  HINDI: {
    code: 'HINDI',
    displayName: 'हिंदी (Hindi)',
    shortCode: 'HI',
    bcp47: 'hi-IN',
    greeting: 'नमस्ते! मैं यहीं हूँ। बताओ, आज क्या चल रहा है?',
    instruction:
      'Respond naturally in Devanagari Hindi (हिन्दी) with a warm, friendly peer tone ("tum" / informal polite). Keep proper names, AM AI, technical terms, and code snippets intact.',
  },
  HINGLISH: {
    code: 'HINGLISH',
    displayName: 'Hinglish (Hindi + EN)',
    shortCode: 'HI-EN',
    bcp47: 'en-IN',
    greeting:
      'Hey! Bas yahin hoon. Batao, aaj kya discuss karna hai?',
    instruction:
      'Respond in natural conversational Hinglish (Romanized Hindi smoothly mixed with English technical terms). Talk like a warm friend.',
  },
  GUJARATI: {
    code: 'GUJARATI',
    displayName: 'ગુજરાતી (Gujarati)',
    shortCode: 'GU',
    bcp47: 'gu-IN',
    greeting: 'नमस्ते! હું અહીં જ છું. બોલો, આજે શું ચર્ચા કરવી છે?',
    instruction:
      'Respond naturally in Gujarati script (ગુજરાતી) with a warm, friendly conversational tone. Keep technical identifiers intact.',
  },
};

const VALID_AGENT_IDS: ReadonlySet<string> = new Set<AgentId>([
  'JARVIS_PRIME',
  'VERONICA_RESEARCH',
  'DUM_E_ENGINEER',
  'FRIDAY_COORDINATOR',
  'HOMER_DIAGNOSTICS',
]);

export function routeIntentToAgent(
  prompt: string,
  history: Array<{ role?: string; text?: string; isError?: boolean }> = []
): AgentId {
  const analysis = analyzeBrainRequest({ prompt, history });
  return VALID_AGENT_IDS.has(analysis.recommendedAgent)
    ? (analysis.recommendedAgent as AgentId)
    : 'JARVIS_PRIME';
}

export function findMatchingCustomAgent(prompt: string, customAgents: CustomAgent[]): CustomAgent | null {
  const lower = prompt.toLowerCase();
  for (const agent of customAgents) {
    for (const rawKw of agent.keywords) {
      const kw = rawKw.trim().toLowerCase();
      if (kw && lower.includes(kw)) {
        return agent;
      }
    }
  }
  return null;
}

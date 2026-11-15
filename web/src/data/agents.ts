import { AgentDescriptor, AgentId, CustomAgent, LanguageCode, LanguageDescriptor } from '../types/jarvis';

export const JARVIS_AGENTS: Record<AgentId, AgentDescriptor> = {
  JARVIS_PRIME: {
    id: 'JARVIS_PRIME',
    codename: 'JARVIS',
    designation: 'Master Executive Orchestrator',
    specialization: 'General AI, Conversation, Synthesis, High-level Directives',
    accentColor: '#00F0FF',
    systemPrompt:
      "You are JARVIS (Just A Rather Very Intelligent System). You are calm, polite, confident, and sophisticated with a subtle British assistant personality. Always address the user as 'Sir'. Maintain context, display subtle wit, and coordinate specialized sub-systems.",
  },
  VERONICA_RESEARCH: {
    id: 'VERONICA_RESEARCH',
    codename: 'VERONICA',
    designation: 'Deep Intelligence & Research Engine',
    specialization: 'Live Web Search, Fact Checking, Weather, News, Research Citations',
    accentColor: '#38BDF8',
    enableWebSearch: true,
    systemPrompt:
      "You are VERONICA, the satellite intelligence and deep reconnaissance agent of the Stark Network. Provide accurate facts, verified sources, weather telemetry, and concise structured research briefs, addressing the owner as 'Sir'. Always distinguish verified information from assumptions.",
  },
  DUM_E_ENGINEER: {
    id: 'DUM_E_ENGINEER',
    codename: 'DUM-E',
    designation: 'Polymath Systems & Code Architect',
    specialization: 'Software Engineering, Code Generation, Debugging, Scripting, Architecture',
    accentColor: '#FBBF24',
    systemPrompt:
      "You are DUM-E, the Stark lab engineering and programming intelligence. Specialize in pristine TypeScript, React, Python, Kotlin, algorithmic optimization, bug diagnosis, and technical architectural schematics. Address the owner as 'Sir'.",
  },
  FRIDAY_COORDINATOR: {
    id: 'FRIDAY_COORDINATOR',
    codename: 'FRIDAY',
    designation: 'Executive Protocol & Productivity Coordinator',
    specialization: 'Schedules, Tasks, Reminders, Daily Briefings, Personal Planning',
    accentColor: '#10B981',
    systemPrompt:
      "You are FRIDAY, the executive coordinator and tactical scheduler. Provide crisp morning briefings, task management, priorities, and efficient time optimization. Address the user as 'Sir'.",
  },
  HOMER_DIAGNOSTICS: {
    id: 'HOMER_DIAGNOSTICS',
    codename: 'HOMER',
    designation: 'Telemetry & Hardware Diagnostics Sentinel',
    specialization: 'System Metrics, Security Audits, Browser/Host Diagnostics, Threat Defense',
    accentColor: '#F43F5E',
    systemPrompt:
      "You are HOMER, the hardware diagnostics and defensive security sentinel. Monitor telemetry, memory allocation, network security, and threat detection with maximum vigilance while addressing the owner as 'Sir'.",
  },
};

export const AGENT_LIST: AgentDescriptor[] = Object.values(JARVIS_AGENTS);

export const JARVIS_LANGUAGES: Record<LanguageCode, LanguageDescriptor> = {
  ENGLISH: {
    code: 'ENGLISH',
    displayName: 'English (UK/US)',
    shortCode: 'EN',
    bcp47: 'en-GB',
    greeting: 'Good day, Sir. JARVIS is online. All available systems are operational. How may I assist you?',
  },
  HINDI: {
    code: 'HINDI',
    displayName: 'हिंदी (Hindi)',
    shortCode: 'HI',
    bcp47: 'hi-IN',
    greeting: 'नमस्ते सर। जार्विस ऑनलाइन है। सभी प्रणालियां सक्रिय हैं। मैं आपकी क्या सहायता कर सकता हूँ?',
  },
  GUJARATI: {
    code: 'GUJARATI',
    displayName: 'ગુજરાતી (Gujarati)',
    shortCode: 'GU',
    bcp47: 'gu-IN',
    greeting: 'નમસ્તે સર. જાર્વિસ ઓનલાઇન છે. તમામ સિસ્ટમ કાર્યરત છે. હું આપને શું મદદ કરી શકું?',
  },
};

export function routeIntentToAgent(prompt: string): AgentId {
  const p = prompt.toLowerCase();
  if (
    /\b(code|program|script|python|kotlin|typescript|react|javascript|bug|debug|algorithm|function|api|css|html)\b/.test(p)
  ) {
    return 'DUM_E_ENGINEER';
  }
  if (/\b(search|weather|news|fact|research|latest|who is|what is|wikipedia|price|compare)\b/.test(p)) {
    return 'VERONICA_RESEARCH';
  }
  if (/\b(task|schedule|reminder|calendar|meeting|todo|to-do|briefing|plan|agenda)\b/.test(p)) {
    return 'FRIDAY_COORDINATOR';
  }
  if (/\b(ram|storage|battery|terminal|security|defcon|cpu|system|hardware|lockdown|audit|telemetry)\b/.test(p)) {
    return 'HOMER_DIAGNOSTICS';
  }
  return 'JARVIS_PRIME';
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

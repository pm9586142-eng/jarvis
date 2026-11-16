import { LanguageCode } from '../types/jarvis';

export type BrainIntent =
  | 'CODING'
  | 'PLANNING'
  | 'SUMMARIZATION'
  | 'RESEARCH'
  | 'SYSTEM_DIAGNOSTICS'
  | 'EXPLANATION'
  | 'FOLLOW_UP'
  | 'CONVERSATION';

export type ReasoningMode = 'fast' | 'structured' | 'deep';

export interface BrainContextWindow {
  recentMessages: Array<{ role: 'user' | 'model'; text: string }>;
  earlierCount: number;
  earlierContextDigest: string;
}

export interface BrainAnalysis {
  intent: BrainIntent;
  detectedLanguage: LanguageCode;
  isFollowUp: boolean;
  reasoningMode: ReasoningMode;
  thinkingBudget: number;
  recommendedAgent: string;
  contextWindow: BrainContextWindow;
  brainDirectiveBlock: string;
}

export function detectLanguageMode(text?: string, preferredLanguage?: string): LanguageCode;
export function detectFollowUp(
  prompt?: string,
  history?: Array<{ role?: string; text?: string; isError?: boolean }>
): boolean;
export function detectIntent(
  prompt?: string,
  history?: Array<{ role?: string; text?: string; isError?: boolean }>
): BrainIntent;
export function determineReasoningMode(params: {
  prompt?: string;
  intent?: BrainIntent;
  isFollowUp?: boolean;
}): { mode: ReasoningMode; thinkingBudget: number };
export function recommendAgentForIntent(params: {
  intent: BrainIntent;
  prompt?: string;
}): string;
export function buildContextWindow(
  history?: Array<{ role?: string; text?: string; isError?: boolean }>,
  maxRecent?: number,
  maxCharsPerTurn?: number
): BrainContextWindow;
export function buildLanguageDirective(languageMode: LanguageCode): string;
export function analyzeBrainRequest(params: {
  prompt?: string;
  history?: Array<{ role?: string; text?: string; isError?: boolean }>;
  preferredLanguage?: string;
  conversationSummary?: string;
}): BrainAnalysis;
export function classifyGeminiError(
  statusCode?: number,
  rawMessage?: string
): { code: string; message: string };

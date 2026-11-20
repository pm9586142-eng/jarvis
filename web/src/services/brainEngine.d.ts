import {
  ChatSession,
  LanguageCode,
  PersonalityPresetId,
  ReasoningPreference,
  ResponseStyleId,
} from '../types/jarvis';

export type { PersonalityPresetId, ReasoningPreference, ResponseStyleId };

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

export const PERSONALITY_PRESETS: Record<
  PersonalityPresetId,
  { id: PersonalityPresetId; label: string; directive: string }
>;

export const RESPONSE_STYLE_DIRECTIVES: Record<ResponseStyleId, string>;

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
  personality: PersonalityPresetId;
  responseStyle: ResponseStyleId;
  contextWindow: BrainContextWindow;
  brainDirectiveBlock: string;
}

export interface ConversationSearchHit {
  sessionId: string;
  title: string;
  updatedAt: number;
  titleMatch: boolean;
  summaryMatch: boolean;
  matchCount: number;
  snippets: Array<{
    id: string;
    role: string;
    timestamp: number;
    snippet: string;
  }>;
}

export interface IntelligentErrorExplanation {
  summary: string;
  cause: string;
  suggestedAction: string;
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
  reasoningPreference?: ReasoningPreference;
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
  personality?: PersonalityPresetId;
  customInstructions?: string;
  responseStyle?: ResponseStyleId;
  reasoningPreference?: ReasoningPreference;
  documentContext?: string;
}): BrainAnalysis;

export function searchConversations(
  sessions: ChatSession[],
  query: string,
  limit?: number
): ConversationSearchHit[];

export function buildIntelligentErrorExplanation(
  classified: Partial<GeminiErrorClassification>
): IntelligentErrorExplanation;

export type GeminiQuotaCategory =
  | 'NONE'
  | 'RPM'
  | 'TPM'
  | 'RPD'
  | 'BILLING'
  | 'SPEND_CAP'
  | 'GENERIC_RATE_LIMIT';

export interface GeminiQuotaViolation {
  quotaMetric: string;
  quotaId: string;
  quotaValue: string;
  quotaDimensions: Record<string, string>;
  description: string;
}

export interface GeminiErrorDetails {
  httpStatus?: number;
  upstreamStatus: string | null;
  upstreamMessage: string;
  retryAfterSeconds: number | null;
  quotaViolations: GeminiQuotaViolation[];
  errorReason: string | null;
  helpLinks: string[];
  rawDetails: unknown[];
}

export interface GeminiErrorClassification {
  code: string;
  quotaCategory: GeminiQuotaCategory;
  httpStatus: number;
  upstreamStatus: string;
  upstreamMessage: string;
  retryable: boolean;
  retryAfterSeconds: number | null;
  quotaMetrics: string[];
  quotaIds: string[];
  message: string;
}

export function shouldAutoExtractMemories(prompt?: string): boolean;
export function parseRetryDelaySeconds(rawValue: unknown): number | null;
export function extractGeminiErrorDetails(err: unknown): GeminiErrorDetails;
export function classifyGeminiError(
  statusCode?: number,
  rawMessage?: string,
  detailsOrOptions?: Partial<GeminiErrorDetails>
): GeminiErrorClassification;

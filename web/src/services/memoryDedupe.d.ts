import { ChatSession, MemoryCategory, MemoryItem } from '../types/jarvis';

export interface ExtractedMemoryCandidate {
  key: string;
  category: MemoryCategory;
  content: string;
  importance: number;
}

export interface SecretCheckResult {
  blocked: boolean;
  reason?: string;
}

export interface UpsertMemoryResult {
  status: 'created' | 'updated' | 'duplicate' | 'blocked_secret' | 'invalid';
  memory?: MemoryItem | null;
  replacedMemory?: MemoryItem;
  reason?: string;
}

export interface RelevantConversationExcerpt {
  sessionId: string;
  title: string;
  updatedAt: number;
  contextSummary: string;
  excerpts: Array<{
    role: 'user' | 'jarvis';
    text: string;
    timestamp: number;
  }>;
  score: number;
}

export type ParsedMemoryCommand =
  | { type: 'SAVE'; key: string; category: MemoryCategory; content: string; importance: number }
  | { type: 'UPDATE'; key: string; category: MemoryCategory; content: string; importance: number }
  | { type: 'FORGET'; query: string }
  | { type: 'RECALL_MEMORIES'; importantOnly: boolean }
  | { type: 'RECALL_CONVERSATIONS'; query: string }
  | { type: 'CLARIFY'; action: 'SAVE' | 'UPDATE' | 'FORGET'; message: string }
  | { type: 'REJECT_SECRET'; message: string };

export const ALLOWED_MEMORY_CATEGORIES: Set<MemoryCategory>;

export function normalizeMemoryCategory(raw: unknown): MemoryCategory;
export function normalizeMemoryText(text: string): string;
export function tokenizeMemoryText(text: string): Set<string>;
export function jaccardSimilarity(a: string, b: string): number;
export function containsSensitiveSecret(text: string): SecretCheckResult;
export function sanitizeExtractedCandidates(rawItems: unknown): ExtractedMemoryCandidate[];
export function isNearDuplicateMemory(
  candidate: Pick<MemoryItem, 'key' | 'content'>,
  existingList: Array<Pick<MemoryItem, 'key' | 'content'>>
): boolean;
export function findConflictingMemory<T extends Pick<MemoryItem, 'key' | 'content' | 'category'>>(
  candidate: Pick<MemoryItem, 'key' | 'content' | 'category'>,
  existingList: T[]
): T | null;
export function upsertOrMergeMemory(
  candidate: Partial<MemoryItem> & { key: string; content: string },
  existingList: MemoryItem[],
  now?: number
): UpsertMemoryResult;
export function filterUniqueMemories(
  candidates: unknown,
  existingList: Array<Pick<MemoryItem, 'key' | 'content'>>
): ExtractedMemoryCandidate[];
export function retrieveRelevantMemories(
  query: string,
  memories: MemoryItem[],
  limit?: number,
  now?: number
): MemoryItem[];
export function retrieveRelevantConversations(
  query: string,
  sessions: ChatSession[],
  options?: { activeSessionId?: string; limit?: number; now?: number }
): RelevantConversationExcerpt[];
export function parseMemoryCommand(rawText: string): ParsedMemoryCommand | null;

import { MemoryItem } from '../types/jarvis';

export interface ExtractedMemoryCandidate {
  key: string;
  category: 'PREFERENCE' | 'PROJECT' | 'INSTRUCTION' | 'FACT';
  content: string;
  importance: number;
}

export function normalizeMemoryText(text: string): string;
export function tokenizeMemoryText(text: string): Set<string>;
export function jaccardSimilarity(a: string, b: string): number;
export function sanitizeExtractedCandidates(rawItems: unknown): ExtractedMemoryCandidate[];
export function isNearDuplicateMemory(
  candidate: Pick<MemoryItem, 'key' | 'content'>,
  existingList: Array<Pick<MemoryItem, 'key' | 'content'>>
): boolean;
export function filterUniqueMemories(
  candidates: unknown,
  existingList: Array<Pick<MemoryItem, 'key' | 'content'>>
): ExtractedMemoryCandidate[];

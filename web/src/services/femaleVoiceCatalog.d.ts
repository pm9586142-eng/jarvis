export const WELCOME_STEP_1: string;
export const WELCOME_STEP_2_ONLINE: string;
export const WELCOME_SESSION_STORAGE_KEY: string;

export interface WelcomeSequenceStep {
  id: string;
  text: string;
  pauseAfterMs: number;
}

export interface SpeechVoiceLike {
  name?: string;
  lang?: string;
  voiceURI?: string;
  default?: boolean;
  localService?: boolean;
}

export function buildWelcomeStatusGreeting(opts?: {
  backendOnline?: boolean;
  aiConfigured?: boolean;
}): string;

export function buildWelcomeVoiceSequence(opts?: {
  backendOnline?: boolean;
  aiConfigured?: boolean;
}): WelcomeSequenceStep[];

export function buildLocalizedWelcomeSequence(opts?: {
  language?: string;
  backendOnline?: boolean;
  aiConfigured?: boolean;
}): Array<WelcomeSequenceStep & { bcp47Lang?: string }>;

export function isLikelyFemaleVoice(voice: SpeechVoiceLike | null | undefined): boolean;
export function isLikelyMaleVoice(voice: SpeechVoiceLike | null | undefined): boolean;
export function isNeuralOrNaturalVoice(voice: SpeechVoiceLike | null | undefined): boolean;

export function scoreVoiceCandidate(
  voice: SpeechVoiceLike | null | undefined,
  opts?: { targetLang?: string; femaleVoiceEnabled?: boolean }
): number;

export function selectBestVoiceForSegment<T extends SpeechVoiceLike>(
  voices: T[],
  opts?: {
    targetLang?: string;
    explicitVoiceUri?: string;
    femaleVoiceEnabled?: boolean;
    autoDetectLanguage?: boolean;
  }
): T | null;

export function calibrateVoiceTone(opts?: {
  rate?: number;
  pitch?: number;
  femaleVoiceEnabled?: boolean;
  voice?: SpeechVoiceLike | null;
}): { rate: number; pitch: number };

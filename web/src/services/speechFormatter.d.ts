export interface BilingualSpeechSegment {
  text: string;
  lang: string;
}

export function formatTextForSpeech(rawText: string): string;
export function detectSegmentSpeechLang(
  segmentText: string,
  fallbackBcp47?: string,
  autoDetect?: boolean
): string;
export function splitSpeechIntoChunks(text: string, maxLength?: number): string[];
export function splitSpeechIntoBilingualSegments(
  rawText: string,
  opts?: {
    fallbackBcp47?: string;
    autoDetect?: boolean;
    maxLength?: number;
  }
): BilingualSpeechSegment[];

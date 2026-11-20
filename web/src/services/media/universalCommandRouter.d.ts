import {
  AiStructuredAction,
  ParsedUniversalCommand,
  UniversalCommandIntent,
} from '../../types/media';

export function normalizeCommandText(rawText: string): string;
export function detectWakeWordTrigger(rawText: string): {
  triggered: boolean;
  wakeWordOnly: boolean;
  remainder: string;
};
export function stripWakeWordPrefix(rawText: string): string;
export function validateClientAiAction(raw: unknown): AiStructuredAction | null;

export class MediaCommandRegistry {
  registerMatcher(
    matcher: (rawText: string, normalized: string) => ParsedUniversalCommand | null
  ): void;
  listSupportedIntents(): UniversalCommandIntent[];
}

export class UniversalCommandRouter {
  constructor(registry?: MediaCommandRegistry);
  route(rawText: string): ParsedUniversalCommand;
}

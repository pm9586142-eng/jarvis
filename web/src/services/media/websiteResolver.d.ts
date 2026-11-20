import { AiStructuredAction, WebsiteDirectoryEntry, WebsiteResolutionResult } from '../../types/media';

export const BUILTIN_WEBSITE_DIRECTORY: WebsiteDirectoryEntry[];

export function validateSafeHttpUrl(rawUrl: string): { ok: boolean; url?: string; error?: string };
export function cleanWebsiteTarget(rawTarget: string): string;
export function normalizeSpokenDomain(
  rawInput: string
): { url: string; domain: string; label: string } | null;
export function findBuiltInWebsite(rawQuery: string): WebsiteDirectoryEntry | null;
export function buildGoogleSearchUrl(query: string): string;

export interface BrowserOpenOutcome {
  opened: boolean;
  popupBlocked: boolean;
  url: string;
  error?: string;
}

export type BrowserOpenFn = (url: string, target?: string, features?: string) => Window | null;

export class BrowserActionService {
  constructor(openWindowFnOrOptions?: BrowserOpenFn | { openFn?: BrowserOpenFn });
  openUrl(rawUrl: string): BrowserOpenOutcome;
}

export class WebsiteResolver {
  constructor(options?: {
    aiResolveFn?: (target: string) => Promise<AiStructuredAction | null>;
  });
  resolve(rawTarget: string): Promise<WebsiteResolutionResult>;
}

export class WebsiteLauncher {
  constructor(resolver?: WebsiteResolver, browserActions?: BrowserActionService);
  launch(rawTarget: string): Promise<{
    resolved: WebsiteResolutionResult;
    opened: boolean;
    popupBlocked: boolean;
    error?: string;
  }>;
}

export class WebSearchService {
  constructor(browserActions?: BrowserActionService);
  searchGoogle(query: string): {
    query: string;
    url: string;
    opened: boolean;
    popupBlocked: boolean;
    error?: string;
  };
}

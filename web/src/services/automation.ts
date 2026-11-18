import { AutomationHistoryItem } from '../types/jarvis';

export interface ApprovedWebsite {
  id: string;
  name: string;
  category: 'PRODUCTIVITY' | 'DEVELOPER' | 'KNOWLEDGE' | 'COMMUNICATION';
  url: string;
  description: string;
}

export const APPROVED_WEBSITES: ApprovedWebsite[] = [
  {
    id: 'github',
    name: 'GitHub',
    category: 'DEVELOPER',
    url: 'https://github.com',
    description: 'Repositories, pull requests, and engineering workflows',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'COMMUNICATION',
    url: 'https://mail.google.com',
    description: 'Inbox & correspondence (drafts require manual send)',
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    category: 'PRODUCTIVITY',
    url: 'https://calendar.google.com',
    description: 'Schedule, events, and meeting overview',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    category: 'PRODUCTIVITY',
    url: 'https://drive.google.com',
    description: 'Cloud documents and shared workspaces',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    category: 'KNOWLEDGE',
    url: 'https://en.wikipedia.org',
    description: 'Encyclopedic reference lookup',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'KNOWLEDGE',
    url: 'https://www.youtube.com',
    description: 'Technical talks, lectures, and media',
  },
  {
    id: 'maps',
    name: 'Google Maps',
    category: 'PRODUCTIVITY',
    url: 'https://maps.google.com',
    description: 'Navigation, transit, and locations',
  },
  {
    id: 'mdn',
    name: 'MDN Web Docs',
    category: 'DEVELOPER',
    url: 'https://developer.mozilla.org',
    description: 'Web standards & JavaScript/CSS API documentation',
  },
];

export const SENSITIVE_ACTION_PATTERNS = [
  /\b(delete|remove|erase|wipe|format|drop)\b/i,
  /\b(send\s+(email|message|sms|whatsapp|mail)|email\s+to)\b/i,
  /\b(buy|purchase|checkout|pay|transfer|order)\b/i,
  /\b(submit\s+form|fill\s+form|publish|post\s+publicly)\b/i,
];

export function requiresUserConfirmation(actionDescription: string, explicitFlag = false): boolean {
  if (explicitFlag) return true;
  return SENSITIVE_ACTION_PATTERNS.some((re) => re.test(actionDescription));
}

export function validateSafeWebUrl(rawUrl: string): { ok: boolean; url?: string; error?: string } {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Please enter a valid website URL.' };
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: 'Only http:// and https:// URLs are permitted.' };
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { ok: false, error: 'Please provide a full domain name (e.g. github.com).' };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: 'Invalid URL format.' };
  }
}

export function openApprovedWebsiteSafely(url: string): {
  opened: boolean;
  error?: string;
} {
  const validated = validateSafeWebUrl(url);
  if (!validated.ok || !validated.url) {
    return { opened: false, error: validated.error };
  }
  try {
    const win = window.open(validated.url, '_blank', 'noopener,noreferrer');
    if (!win) {
      return {
        opened: false,
        error: 'Popup blocked by browser. Allow popups for this site or click the direct link.',
      };
    }
    return { opened: true };
  } catch {
    return { opened: false, error: 'Unable to launch external tab in this browser environment.' };
  }
}

export function buildAutomationRecord(params: {
  actionType: AutomationHistoryItem['actionType'];
  label: string;
  target?: string;
  status: AutomationHistoryItem['status'];
  confirmedByUser: boolean;
  detail: string;
}): AutomationHistoryItem {
  return {
    id: `auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actionType: params.actionType,
    label: params.label,
    target: params.target,
    status: params.status,
    confirmedByUser: params.confirmedByUser,
    detail: params.detail,
    timestamp: Date.now(),
  };
}

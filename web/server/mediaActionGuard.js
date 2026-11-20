/**
 * Zero-Trust Action & URL Validator for Server-Side Structured AI Responses (/api/chat)
 * Whitelists only safe structured media/web actions and blocks all unsafe URL schemes.
 */

const ALLOWED_MEDIA_CONTROL_COMMANDS = new Set([
  'play',
  'pause',
  'resume',
  'next',
  'previous',
  'stop',
  'close',
  'volume_up',
  'volume_down',
  'set_volume',
  'mute',
  'unmute',
  'seek_forward',
  'seek_backward',
  'repeat',
  'current',
]);

const PRIVATE_OR_LOCAL_HOST_PATTERN =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d+\.\d+|\[?(?:0*:)*:?1\]?|\[?(?:fc|fd|fe80|::ffff:)[0-9a-f:.]*\]?|.*\.local|.*\.internal)$/i;

export function validateStrictPublicHttpUrl(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input || input.length > 2048) {
    return { ok: false, error: 'URL is empty or exceeds maximum length.' };
  }
  if (/[\s<>'"`\\]/.test(input)) {
    return { ok: false, error: 'URL contains disallowed whitespace or unsafe characters.' };
  }
  if (/^(javascript|data|file|vbscript|blob|about|chrome|edge|jar):/i.test(input)) {
    return { ok: false, error: 'Unsafe URL protocol blocked.' };
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: 'Malformed URL.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'Only http:// and https:// URLs are permitted.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Embedded credentials in URLs are blocked.' };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || !hostname.includes('.') || hostname.startsWith('.') || hostname.endsWith('.')) {
    return { ok: false, error: 'URL must target a valid public domain name.' };
  }
  if (PRIVATE_OR_LOCAL_HOST_PATTERN.test(hostname)) {
    return { ok: false, error: 'Local or private network URLs are blocked for security.' };
  }

  return { ok: true, url: parsed.toString() };
}

export function extractJsonObjectFromText(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced && fenced[1] ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Validates model output against strict allowlist:
 * - { action: "open_url", url: "https://..." }
 * - { action: "play_song", query: "..." }
 * - { action: "play_video", query: "..." }
 * - { action: "media_control", command: "...", value?: number }
 * - { action: "clarify", question: "..." }
 */
export function validateWhitelistedAiAction(rawObj, { openUrlOnly = false } = {}) {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    return { ok: false, error: 'AI response did not match a structured action object.' };
  }

  const action = String(rawObj.action || '').trim().toLowerCase();

  if (action === 'open_url') {
    const urlCheck = validateStrictPublicHttpUrl(rawObj.url);
    if (!urlCheck.ok) {
      return { ok: false, error: urlCheck.error };
    }
    const label =
      typeof rawObj.label === 'string' && rawObj.label.trim()
        ? rawObj.label.trim().slice(0, 80)
        : undefined;
    return {
      ok: true,
      action: {
        action: 'open_url',
        url: urlCheck.url,
        ...(label ? { label } : {}),
      },
    };
  }

  if (openUrlOnly) {
    if (action === 'clarify' && typeof rawObj.question === 'string' && rawObj.question.trim()) {
      return {
        ok: true,
        action: { action: 'clarify', question: rawObj.question.trim().slice(0, 240) },
      };
    }
    return { ok: false, error: 'Only validated open_url responses are permitted for website resolution.' };
  }

  if (action === 'play_song' || action === 'play_video') {
    const query = String(rawObj.query || '').trim().slice(0, 160);
    if (!query) {
      return { ok: false, error: `Action "${action}" requires a non-empty query.` };
    }
    return { ok: true, action: { action, query } };
  }

  if (action === 'media_control') {
    const command = String(rawObj.command || '').trim().toLowerCase();
    if (!ALLOWED_MEDIA_CONTROL_COMMANDS.has(command)) {
      return { ok: false, error: `Unsupported media_control command: "${command}".` };
    }
    const numericVal =
      rawObj.value !== undefined && rawObj.value !== null && Number.isFinite(Number(rawObj.value))
        ? Number(rawObj.value)
        : undefined;
    return {
      ok: true,
      action: {
        action: 'media_control',
        command,
        ...(numericVal !== undefined ? { value: numericVal } : {}),
      },
    };
  }

  if (action === 'clarify') {
    const question = String(rawObj.question || '').trim().slice(0, 240);
    if (!question) {
      return { ok: false, error: 'Clarification action requires a question.' };
    }
    return { ok: true, action: { action: 'clarify', question } };
  }

  return { ok: false, error: `Action "${action || 'unknown'}" is not in the security allowlist.` };
}

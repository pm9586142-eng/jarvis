/**
 * Universal Website Directory, Spoken Domain Normalizer,
 * Strict URL Validator, WebsiteResolver, BrowserActionService,
 * WebsiteLauncher, and WebSearchService.
 */

export const BUILTIN_WEBSITE_DIRECTORY = [
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com',
    category: 'SEARCH',
    aliases: ['google', 'google.com', 'गूगल', 'गुगल'],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com',
    category: 'VIDEO',
    aliases: ['youtube', 'yt', 'youtube.com', 'यूट्यूब', 'यूटूब', 'यु ट्यूब'],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com',
    category: 'PRODUCTIVITY',
    aliases: ['gmail', 'google mail', 'जीमेल', 'ईमेल'],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Web',
    url: 'https://web.whatsapp.com',
    category: 'SOCIAL',
    aliases: ['whatsapp', 'whatsapp web', 'whats app', 'व्हाट्सएप', 'व्हाट्सऐप', 'वाट्सएप'],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com',
    category: 'SOCIAL',
    aliases: ['instagram', 'insta', 'ig', 'इंस्टाग्राम', 'इंस्टा'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    url: 'https://www.facebook.com',
    category: 'SOCIAL',
    aliases: ['facebook', 'fb', 'फेसबुक'],
  },
  {
    id: 'x',
    name: 'X',
    url: 'https://x.com',
    category: 'SOCIAL',
    aliases: ['x', 'twitter', 'x.com', 'twitter.com', 'एक्स', 'ट्विटर'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    url: 'https://www.linkedin.com',
    category: 'SOCIAL',
    aliases: ['linkedin', 'linked in', 'लिंक्डइन'],
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com',
    category: 'DEVELOPER',
    aliases: ['github', 'git hub', 'github.com', 'गिटहब'],
  },
  {
    id: 'amazon',
    name: 'Amazon',
    url: 'https://www.amazon.in',
    category: 'SHOPPING',
    aliases: ['amazon', 'amazon.in', 'amazon.com', 'अमेज़न', 'अमेजन', 'ऐमज़ॉन'],
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    url: 'https://www.flipkart.com',
    category: 'SHOPPING',
    aliases: ['flipkart', 'flipkart.com', 'फ्लिपकार्ट', 'फ़्लिपकार्ट'],
  },
  {
    id: 'netflix',
    name: 'Netflix',
    url: 'https://www.netflix.com',
    category: 'ENTERTAINMENT',
    aliases: ['netflix', 'नेटफ्लिक्स'],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    url: 'https://open.spotify.com',
    category: 'ENTERTAINMENT',
    aliases: ['spotify', 'स्पॉटिफाई', 'स्पोटिफाई'],
  },
  {
    id: 'google_maps',
    name: 'Google Maps',
    url: 'https://maps.google.com',
    category: 'UTILITY',
    aliases: ['google maps', 'maps', 'गूगल मैप्स', 'गूगल मैप', 'मैप्स'],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    category: 'AI',
    aliases: ['chatgpt', 'chat gpt', 'openai', 'चैटजीपीटी', 'चैट जीपीटी'],
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    category: 'AI',
    aliases: ['claude', 'claude ai', 'anthropic', 'क्लॉड'],
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    url: 'https://www.wikipedia.org',
    category: 'SEARCH',
    aliases: ['wikipedia', 'wiki', 'विकिपीडिया', 'विकीपीडिया'],
  },
  {
    id: 'hotstar',
    name: 'Hotstar',
    url: 'https://www.hotstar.com',
    category: 'ENTERTAINMENT',
    aliases: ['hotstar', 'disney hotstar', 'jiohotstar', 'jio hotstar', 'हॉटस्टार'],
  },
  {
    id: 'swiggy',
    name: 'Swiggy',
    url: 'https://www.swiggy.com',
    category: 'SHOPPING',
    aliases: ['swiggy', 'स्विगी'],
  },
  {
    id: 'zomato',
    name: 'Zomato',
    url: 'https://www.zomato.com',
    category: 'SHOPPING',
    aliases: ['zomato', 'ज़ोमैटो', 'जोमैटो'],
  },
  {
    id: 'irctc',
    name: 'IRCTC',
    url: 'https://www.irctc.co.in',
    category: 'UTILITY',
    aliases: ['irctc', 'indian railways', 'आईआरसीटीसी'],
  },
  {
    id: 'reddit',
    name: 'Reddit',
    url: 'https://www.reddit.com',
    category: 'SOCIAL',
    aliases: ['reddit', 'रेडिट'],
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    url: 'https://www.pinterest.com',
    category: 'SOCIAL',
    aliases: ['pinterest', 'पिंटरेस्ट'],
  },
  {
    id: 'discord',
    name: 'Discord',
    url: 'https://discord.com/app',
    category: 'SOCIAL',
    aliases: ['discord', 'डिस्कॉर्ड'],
  },
  {
    id: 'telegram',
    name: 'Telegram Web',
    url: 'https://web.telegram.org',
    category: 'SOCIAL',
    aliases: ['telegram', 'telegram web', 'टेलीग्राम'],
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    url: 'https://www.microsoft.com',
    category: 'PRODUCTIVITY',
    aliases: ['microsoft', 'माइक्रोसॉफ्ट'],
  },
  {
    id: 'apple',
    name: 'Apple',
    url: 'https://www.apple.com',
    category: 'PRODUCTIVITY',
    aliases: ['apple', 'एप्पल', 'ऐपल'],
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow',
    url: 'https://stackoverflow.com',
    category: 'DEVELOPER',
    aliases: ['stack overflow', 'stackoverflow', 'स्टैक ओवरफ्लो'],
  },
];

const DEVANAGARI_BRAND_TO_HOST = {
  गूगल: 'google',
  गुगल: 'google',
  फ्लिपकार्ट: 'flipkart',
  फ़्लिपकार्ट: 'flipkart',
  यूट्यूब: 'youtube',
  यूटूब: 'youtube',
  अमेजन: 'amazon',
  अमेज़न: 'amazon',
  इंस्टाग्राम: 'instagram',
  फेसबुक: 'facebook',
  विकिपीडिया: 'wikipedia',
  गिटहब: 'github',
  स्विगी: 'swiggy',
  जोमैटो: 'zomato',
  ज़ोमैटो: 'zomato',
  नेटफ्लिक्स: 'netflix',
  स्पॉटिफाई: 'spotify',
  माइक्रोसॉफ्ट: 'microsoft',
  एप्पल: 'apple',
  ऐपल: 'apple',
  रेडिट: 'reddit',
  डिस्कॉर्ड: 'discord',
  टेलीग्राम: 'telegram',
  हॉटस्टार: 'hotstar',
  चैटजीपीटी: 'chatgpt',
  क्लॉड: 'claude',
};

const SPOKEN_TLD_MAP = {
  कॉम: 'com',
  कॉम्: 'com',
  कम: 'com',
  इन: 'in',
  ऑर्ग: 'org',
  ओआरजी: 'org',
  नेट: 'net',
  आईओ: 'io',
  एआई: 'ai',
  को: 'co',
  डेव: 'dev',
  ऐप: 'app',
  गव: 'gov',
  एडू: 'edu',
};

const PRIVATE_OR_LOCAL_HOST_REGEX =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d+\.\d+|\[?(?:0*:)*:?1\]?|\[?(?:fc|fd|fe80|::ffff:)[0-9a-f:.]*\]?|.*\.local|.*\.internal)$/i;

const KNOWN_TLDS = new Set([
  'com',
  'org',
  'net',
  'in',
  'co',
  'io',
  'ai',
  'dev',
  'app',
  'edu',
  'gov',
  'me',
  'tv',
  'info',
  'xyz',
  'uk',
  'us',
  'ca',
  'de',
  'fr',
  'jp',
  'au',
  'gg',
  'so',
  'sh',
  'news',
  'tech',
  'site',
  'online',
  'store',
]);

export function validateSafeHttpUrl(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input || input.length > 2048) {
    return { ok: false, error: 'URL is empty or too long.' };
  }
  if (/[\s<>'"`\\]/.test(input)) {
    return { ok: false, error: 'URL contains unsafe characters or whitespace.' };
  }
  if (/^(javascript|data|file|vbscript|blob|about|chrome|edge|jar):/i.test(input)) {
    return { ok: false, error: 'Blocked unsafe URL protocol.' };
  }

  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { ok: false, error: 'Malformed URL.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'Only http:// and https:// URLs are allowed.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URLs with embedded credentials are blocked.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || !hostname.includes('.') || hostname.startsWith('.') || hostname.endsWith('.')) {
    return { ok: false, error: 'URL must contain a valid domain name.' };
  }
  if (hostname.includes('..') || !/^[a-z0-9.-]+$/i.test(hostname)) {
    return { ok: false, error: 'URL hostname contains invalid characters.' };
  }
  if (PRIVATE_OR_LOCAL_HOST_REGEX.test(hostname)) {
    return { ok: false, error: 'Local and private network URLs are blocked.' };
  }

  const parts = hostname.split('.');
  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]{2,24}$/i.test(tld)) {
    return { ok: false, error: 'URL has an invalid top-level domain.' };
  }

  return { ok: true, url: parsed.toString() };
}

export function cleanWebsiteTarget(rawTarget) {
  return String(rawTarget || '')
    .trim()
    .replace(/^[.,!?;:|"'`]+|[.,!?;:|"'`।]+$/g, '')
    .replace(/^(?:the\s+|a\s+|my\s+|website\s+|site\s+|app\s+)/i, '')
    .replace(/\s+(?:website|site|web\s*app|app|page|portal|वेबसाइट|साइट)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes spoken domains like:
 * - "github dot com" -> "https://github.com/"
 * - "wikipedia dot org" -> "https://wikipedia.org/"
 * - "example dot in" -> "https://example.in/"
 * - "गूगल डॉट कॉम" -> "https://google.com/"
 * - "फ्लिपकार्ट डॉट इन" -> "https://flipkart.in/"
 */
export function normalizeSpokenDomain(rawInput) {
  let working = cleanWebsiteTarget(rawInput);
  if (!working) return null;

  // Reject unsafe schemes immediately before normalization
  if (/^(javascript|data|file|vbscript|blob):/i.test(working)) {
    return null;
  }

  // If already a clean http(s) URL, validate directly
  if (/^https?:\/\//i.test(working)) {
    const check = validateSafeHttpUrl(working);
    if (!check.ok || !check.url) return null;
    const host = new URL(check.url).hostname.replace(/^www\./i, '');
    return { url: check.url, domain: host, label: host };
  }

  // Replace Devanagari brand names & spoken TLDs
  for (const [hiBrand, enBrand] of Object.entries(DEVANAGARI_BRAND_TO_HOST)) {
    if (working.includes(hiBrand)) {
      working = working.split(hiBrand).join(enBrand);
    }
  }
  for (const [hiTld, enTld] of Object.entries(SPOKEN_TLD_MAP)) {
    if (working.includes(hiTld)) {
      working = working.split(hiTld).join(enTld);
    }
  }

  // Convert spoken "dot" / "डॉट" / "डाट" / "point" into "."
  const hasSpokenDot = /(?:\s+(?:dot|डॉट|डाट)\s+|\.)/i.test(working);
  if (!hasSpokenDot) {
    return null;
  }

  working = working
    .replace(/\s*(?:dot|डॉट|डाट)\s*/gi, '.')
    .replace(/\s*slash\s*/gi, '/')
    .replace(/^www\s*\.\s*/i, 'www.')
    .replace(/\s+/g, '')
    .toLowerCase();

  // Ensure the final TLD looks legitimate
  const hostOnly = working.split('/')[0].split('?')[0];
  const segments = hostOnly.split('.').filter(Boolean);
  if (segments.length < 2) return null;
  const lastSegment = segments[segments.length - 1];
  if (!KNOWN_TLDS.has(lastSegment) && !/^[a-z]{2,6}$/.test(lastSegment)) {
    return null;
  }

  const validated = validateSafeHttpUrl(`https://${working}`);
  if (!validated.ok || !validated.url) return null;

  const parsedHost = new URL(validated.url).hostname.replace(/^www\./i, '');
  return {
    url: validated.url,
    domain: parsedHost,
    label: parsedHost,
  };
}

export function findBuiltInWebsite(rawQuery) {
  const cleaned = cleanWebsiteTarget(rawQuery).toLowerCase();
  if (!cleaned) return null;

  // Direct exact alias or name match
  for (const entry of BUILTIN_WEBSITE_DIRECTORY) {
    if (entry.name.toLowerCase() === cleaned || entry.id === cleaned) {
      return entry;
    }
    if (entry.aliases.some((alias) => alias.toLowerCase() === cleaned)) {
      return entry;
    }
  }

  // Match without whitespace (e.g. "chat gpt" vs "chatgpt", "whats app" vs "whatsapp")
  const compact = cleaned.replace(/\s+/g, '');
  for (const entry of BUILTIN_WEBSITE_DIRECTORY) {
    if (entry.name.toLowerCase().replace(/\s+/g, '') === compact) {
      return entry;
    }
    if (entry.aliases.some((alias) => alias.toLowerCase().replace(/\s+/g, '') === compact)) {
      return entry;
    }
  }

  return null;
}

export function buildGoogleSearchUrl(query) {
  const clean = String(query || '').trim();
  return `https://www.google.com/search?q=${encodeURIComponent(clean)}`;
}

export class BrowserActionService {
  constructor(openWindowFnOrOptions) {
    const customFn =
      typeof openWindowFnOrOptions === 'function'
        ? openWindowFnOrOptions
        : typeof openWindowFnOrOptions?.openFn === 'function'
          ? openWindowFnOrOptions.openFn
          : null;

    this.openWindowFn =
      customFn ||
      ((url, target, features) => {
        if (typeof window === 'undefined' || typeof window.open !== 'function') {
          return null;
        }
        return window.open(url, target, features);
      });
  }

  openUrl(rawUrl) {
    const validated = validateSafeHttpUrl(rawUrl);
    if (!validated.ok || !validated.url) {
      return {
        opened: false,
        popupBlocked: false,
        url: '',
        error: validated.error || 'Invalid or unsafe URL.',
      };
    }

    try {
      // Note: passing 'noopener,noreferrer' in windowFeatures forces browsers to return null
      // per the HTML spec even when the tab succeeds, breaking honest popup-blocked detection.
      // Opening with '_blank' and nulling win.opener secures against reverse-tabnabbing
      // while preserving accurate WindowProxy return values.
      const win = this.openWindowFn(validated.url, '_blank', '');
      if (!win || win.closed) {
        return {
          opened: false,
          popupBlocked: true,
          url: validated.url,
          error:
            'Your browser blocked the new tab popup. Click the link in the Activity Log or allow popups for this site in your browser address bar.',
        };
      }
      try {
        win.opener = null;
      } catch {
        // Cross-origin restriction; modern browsers default target="_blank" to noopener
      }
      return {
        opened: true,
        popupBlocked: false,
        url: validated.url,
      };
    } catch {
      return {
        opened: false,
        popupBlocked: true,
        url: validated.url,
        error:
          'Unable to open a new browser tab automatically. Click the direct link in the Activity Log instead.',
      };
    }
  }
}

export class WebsiteResolver {
  constructor(options = {}) {
    this.aiResolveFn = typeof options.aiResolveFn === 'function' ? options.aiResolveFn : null;
  }

  /**
   * 4-Tier Resolution Priority:
   * 1. Built-in 28-website directory
   * 2. Spoken domain normalization (github dot com, गूगल डॉट कॉम, फ्लिपकार्ट डॉट इन)
   * 3. AI-assisted official website resolution via /api/chat ({ action: "open_url", url })
   * 4. Google search fallback
   */
  async resolve(rawTarget) {
    const cleaned = cleanWebsiteTarget(rawTarget);
    if (!cleaned) {
      return {
        ok: false,
        url: buildGoogleSearchUrl(''),
        label: 'Google Search',
        source: 'google_fallback',
        isFallbackSearch: true,
        error: 'No website name or URL was provided.',
      };
    }

    // Reject obviously unsafe protocols up front
    if (/^(javascript|data|file|vbscript|blob):/i.test(cleaned)) {
      return {
        ok: false,
        url: '',
        label: cleaned,
        source: 'spoken_domain',
        error: 'Blocked unsafe URL protocol. Only http:// and https:// websites are permitted.',
      };
    }

    // Tier 1: Built-in website directory
    const builtIn = findBuiltInWebsite(cleaned);
    if (builtIn) {
      return {
        ok: true,
        url: builtIn.url,
        label: builtIn.name,
        source: 'directory',
      };
    }

    // Tier 2: Spoken domain normalization
    const spokenDomain = normalizeSpokenDomain(cleaned);
    if (spokenDomain) {
      return {
        ok: true,
        url: spokenDomain.url,
        label: spokenDomain.label,
        source: 'spoken_domain',
      };
    }

    // Tier 3: AI-assisted official website resolution via /api/chat
    if (this.aiResolveFn) {
      try {
        const aiAction = await this.aiResolveFn(cleaned);
        if (aiAction && aiAction.action === 'open_url' && aiAction.url) {
          const check = validateSafeHttpUrl(aiAction.url);
          if (check.ok && check.url) {
            const label =
              aiAction.label ||
              new URL(check.url).hostname.replace(/^www\./i, '');
            return {
              ok: true,
              url: check.url,
              label,
              source: 'ai_resolved',
            };
          }
        }
        if (aiAction && aiAction.action === 'clarify' && aiAction.question) {
          return {
            ok: true,
            url: buildGoogleSearchUrl(cleaned),
            label: `Google Search: ${cleaned}`,
            source: 'google_fallback',
            isFallbackSearch: true,
            clarificationQuestion: aiAction.question,
          };
        }
      } catch {
        // Fall through to Google search fallback gracefully
      }
    }

    // Tier 4: Google search fallback
    return {
      ok: true,
      url: buildGoogleSearchUrl(cleaned),
      label: `Google Search: ${cleaned}`,
      source: 'google_fallback',
      isFallbackSearch: true,
    };
  }
}

export class WebsiteLauncher {
  constructor(resolver, browserActions) {
    this.resolver = resolver || new WebsiteResolver();
    this.browserActions = browserActions || new BrowserActionService();
  }

  async launch(rawTarget) {
    const resolved = await this.resolver.resolve(rawTarget);
    if (!resolved.ok || !resolved.url) {
      return {
        resolved,
        opened: false,
        popupBlocked: false,
        error: resolved.error || 'Could not resolve a valid safe website URL.',
      };
    }
    const openResult = this.browserActions.openUrl(resolved.url);
    return {
      resolved,
      opened: openResult.opened,
      popupBlocked: openResult.popupBlocked,
      error: openResult.error,
    };
  }
}

export class WebSearchService {
  constructor(browserActions) {
    this.browserActions = browserActions || new BrowserActionService();
  }

  searchGoogle(query) {
    const clean = String(query || '').trim();
    const url = buildGoogleSearchUrl(clean);
    const openResult = this.browserActions.openUrl(url);
    return {
      query: clean,
      url,
      opened: openResult.opened,
      popupBlocked: openResult.popupBlocked,
      error: openResult.error,
    };
  }
}

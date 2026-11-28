// Formats Markdown / technical responses into natural spoken text, preserves names & technical
// terms without unnecessary translation, and splits bilingual Hindi/English/Hinglish speech cleanly.

const DEVANAGARI_CHAR_REGEX = /[\u0900-\u097F]/g;
const GUJARATI_CHAR_REGEX = /[\u0A80-\u0AFF]/g;
const LATIN_WORD_REGEX = /[A-Za-z]{2,}/g;
const HINGLISH_MARKERS =
  /\b(namaste|kaise|kaisa|kaisi|ho|hain|hai|aap|aapka|aapki|tum|main|mein|mera|meri|mere|kya|kyun|kab|kahan|nahi|nahin|haan|ji|bhai|dost|theek|thik|accha|achha|batao|bataiye|karo|kijiye|chahiye|samjhao|samjha|shukriya|dhanyavaad|madad|kaam|kal|aaj|abhi|baat|yaad|rakhna|hamesha|bahut|bohot|zaroori|lekin|aur|par|se|ko|ka|ki|ke|bilkul|sahi|galat)\b/gi;

/**
 * Formats Markdown / technical output into warm, natural spoken phrasing while preserving
 * proper names (AM AI, JARVIS), numbers, and technical terms without translating text.
 */
export function formatTextForSpeech(rawText) {
  if (!rawText || !String(rawText).trim()) return '';

  let text = String(rawText).replace(/\r\n/g, '\n');

  // Replace fenced code blocks with a brief natural spoken cue
  text = text.replace(/```([a-zA-Z0-9_+-]*)\n?[\s\S]*?```/g, (_match, lang) => {
    const cleanLang = (lang || '').trim();
    return cleanLang
      ? ` ${cleanLang} code snippet is displayed on screen. `
      : ' Code snippet is displayed on screen. ';
  });

  // Replace Markdown links [label](url) with label only
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|mailto:[^)]+)\)/gi, '$1');

  // Replace bare URLs with brief reference
  text = text.replace(/https?:\/\/[^\s)]+/gi, 'link on screen');

  // Strip HTML tags (<br>, <p>, <b>, etc.) before Markdown symbol cleanup
  text = text
    .replace(/<\s*br\s*\/?>/gi, '. ')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, ' and ')
    .replace(/&lt;|&gt;|&quot;|&#39;/gi, ' ');

  // Remove inline code backticks while preserving identifier/word
  text = text.replace(/`([^`]+)`/g, '$1');

  // Remove Markdown table separator rows (|---|---|)
  text = text.replace(/^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*$/gm, ' ');

  // Convert Markdown table pipes into natural pauses
  text = text.replace(/\|/g, ', ');

  // Strip headings (#), blockquotes (>), horizontal rules (---), and list bullets (-, *, +, 1.)
  text = text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '');

  // Strip emphasis and strikethrough markers (**bold**, __bold__, *italic*, _italic_, ~~strike~~)
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1');

  // Strip emojis, pictographs, dingbats, and variation selectors so they are never read aloud
  try {
    text = text.replace(/\p{Extended_Pictographic}|[\u2600-\u27BF\uFE0E\uFE0F\u200D]/gu, ' ');
  } catch {
    text = text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\uFE0E\uFE0F\u200D]/g, ' ');
  }

  // Preserve clear pronunciation of brand name "AM AI" and clean bullet / slash pauses
  text = text
    .replace(/\bJ\.A\.R\.V\.I\.S\.?\b/g, 'JARVIS')
    .replace(/\bAM\s*AI\b/g, 'A M A I')
    .replace(/\s*•\s*/g, ', ')
    .replace(/\s+—\s+/g, ', ')
    .replace(/([a-zA-Z])\/([a-zA-Z])/g, '$1 or $2');

  // Remove lingering Markdown / noisy formatting characters while keeping Unicode letters
  // (Devanagari, Gujarati), Latin letters, numbers, and natural punctuation
  text = text
    .replace(/[*_`#<>~\\[\]{}]/g, ' ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .replace(/([.!?।])\s*\./g, '$1')
    .trim();

  return text;
}

/**
 * Detects the best BCP-47 speech locale for an individual spoken segment so mixed
 * Hindi, English, and Hinglish responses pronounce naturally without translation.
 */
export function detectSegmentSpeechLang(segmentText, fallbackBcp47 = 'en-IN', autoDetect = true) {
  const clean = String(segmentText || '').trim();
  if (!clean || !autoDetect) {
    return fallbackBcp47 || 'en-IN';
  }

  const gujaratiCount = (clean.match(GUJARATI_CHAR_REGEX) || []).length;
  if (gujaratiCount >= 2) {
    return 'gu-IN';
  }

  const devanagariCount = (clean.match(DEVANAGARI_CHAR_REGEX) || []).length;
  const latinWords = clean.match(LATIN_WORD_REGEX) || [];

  // Native Hindi script (Devanagari) — speak with Hindi pronunciation
  if (devanagariCount >= 2) {
    // If segment is predominantly Devanagari or mixed Hindi+English terms, hi-IN handles both naturally
    return 'hi-IN';
  }

  // Romanized Hinglish detection — Indian English female voice (en-IN) pronounces Hinglish + English tech terms smoothly
  const hinglishHits = (clean.match(HINGLISH_MARKERS) || []).length;
  if (hinglishHits >= 2 || (hinglishHits >= 1 && latinWords.length <= 5)) {
    return 'en-IN';
  }

  // Pure English — honor user's English regional accent preference if English, otherwise en-IN / en-US
  if (fallbackBcp47 && fallbackBcp47.toLowerCase().startsWith('en')) {
    return fallbackBcp47;
  }
  return 'en-IN';
}

export function splitSpeechIntoChunks(text, maxLength = 220) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLength) return [cleaned];

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + maxLength, cleaned.length);
    if (end === cleaned.length) {
      const tail = cleaned.slice(start).trim();
      if (tail) chunks.push(tail);
      break;
    }

    let splitAt = -1;
    // Prefer Hindi danda (।), sentence terminators, semicolon/comma, or space
    for (const delim of ['. ', '! ', '? ', '। ', '; ', ', ', ' ']) {
      const idx = cleaned.lastIndexOf(delim, end - 1);
      if (idx > start + Math.floor(maxLength * 0.35)) {
        splitAt = idx + delim.length;
        break;
      }
    }
    if (splitAt <= start) {
      splitAt = end;
    }

    const piece = cleaned.slice(start, splitAt).trim();
    if (piece) chunks.push(piece);
    start = splitAt;
  }

  return chunks;
}

/**
 * Splits a response into natural sentence/clause chunks tagged with per-segment BCP-47
 * language so Hindi sentences use a Hindi voice and English sentences use an English voice
 * seamlessly in one smooth playback queue without translating content.
 */
export function splitSpeechIntoBilingualSegments(
  rawText,
  { fallbackBcp47 = 'en-IN', autoDetect = true, maxLength = 210 } = {}
) {
  const formatted = formatTextForSpeech(rawText);
  if (!formatted) return [];

  // Split by natural sentence boundaries (English . ! ? and Hindi danda ।) first
  const rawSentences = formatted
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments = [];
  for (const sentence of rawSentences.length > 0 ? rawSentences : [formatted]) {
    const lang = detectSegmentSpeechLang(sentence, fallbackBcp47, autoDetect);
    const subChunks = splitSpeechIntoChunks(sentence, maxLength);
    for (const chunk of subChunks) {
      const prev = segments[segments.length - 1];
      if (prev && prev.lang === lang && prev.text.length + 1 + chunk.length <= maxLength) {
        prev.text = `${prev.text} ${chunk}`;
      } else {
        segments.push({ text: chunk, lang });
      }
    }
  }

  return segments;
}

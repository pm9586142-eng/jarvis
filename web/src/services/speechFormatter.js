// Formats Markdown / technical responses into natural spoken text and chunks long replies safely.

export function formatTextForSpeech(rawText) {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText.replace(/\r\n/g, '\n');

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

  // Remove lingering Markdown / noisy formatting characters while keeping Unicode letters (Devanagari/Gujarati),
  // Latin letters, numbers, and natural punctuation
  text = text
    .replace(/[*_`#<>~\\[\]{}]/g, ' ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .replace(/([.!?])\s*\./g, '$1')
    .trim();

  return text;
}

export function splitSpeechIntoChunks(text, maxLength = 220) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
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

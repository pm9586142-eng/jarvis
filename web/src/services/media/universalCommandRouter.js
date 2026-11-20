/**
 * Smart Multilingual Voice Command Router & MediaCommandRegistry
 * Supports English, Hindi (Devanagari), and Hinglish.
 *
 * Strict Priority Evaluation Order:
 * 1. Media player controls
 * 2. Play song / playlist
 * 3. Play video
 * 4. Website opening
 * 5. Web search
 * 6. Existing registered voice/brain commands (delegated in executor)
 * 7. AI fallback (whitelisted structured actions only)
 */

import {
  findBuiltInWebsite,
  normalizeSpokenDomain,
  validateSafeHttpUrl,
} from './websiteResolver.js';

const ALLOWED_MEDIA_CONTROLS = new Set([
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

const VIDEO_CUE_REGEX =
  /\b(video|videos|trailer|trailers|tutorial|tutorials|highlights|documentary|vlog|podcast|lecture|course|coding\s+tutorial|programming\s+tutorial|review|unboxing|match\s+highlights|episode|clip|clips|news|shorts|dikhao|dikha\s+do|watch)\b|वीडियो|ट्रेलर|ट्यूटोरियल|हाइलाइट्स|दिखाओ|दिखा\s+दो|देखना/iu;

const SONG_CUE_REGEX =
  /\b(song|songs|music|gaana|gaane|gana|gane|track|tracks|album|beats|lofi|lo-fi|instrumental|classical|relaxing|bhajan|rap|qawwali|mashup|jukebox|remix|bajao|baja\s+do|suna\s+do|sunao)\b|गाना|गाने|म्यूजिक|संगीत|बजाओ|बजा\s+दो|सुनाओ/iu;

const PLAYLIST_CUE_REGEX = /\b(playlist|play\s*list|mixtape|jukebox)\b|प्लेलिस्ट/iu;

const WAKE_WORD_PREFIX_REGEX =
  /^(?:(?:hey|ok|okay|hi|hello|yo|listen|sun|suno|अरे|हे|हेलो|ओके)\s+)?(?:j\.?\s*a\.?\s*r\.?\s*v\.?\s*i\.?\s*s\.?|jarvis|जार्विस|जर्विस)[\s,!.:?-]*/iu;

const WAKE_WORD_SOLO_REGEX =
  /^(?:(?:hey|ok|okay|hi|hello|yo|अरे|हे|हेलो|ओके)\s+)?(?:j\.?\s*a\.?\s*r\.?\s*v\.?\s*i\.?\s*s\.?|jarvis|जार्विस|जर्विस)[\s!?.।]*$/iu;

export function normalizeCommandText(rawText) {
  return String(rawText || '')
    .normalize('NFC')
    .trim()
    .replace(/[।|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectWakeWordTrigger(rawText) {
  const cleaned = normalizeCommandText(rawText);
  if (!cleaned) {
    return { triggered: false, wakeWordOnly: false, remainder: '' };
  }
  if (WAKE_WORD_SOLO_REGEX.test(cleaned)) {
    return { triggered: true, wakeWordOnly: true, remainder: '' };
  }
  const match = cleaned.match(WAKE_WORD_PREFIX_REGEX);
  if (match && match[0]) {
    const remainder = cleaned.slice(match[0].length).trim();
    return {
      triggered: true,
      wakeWordOnly: remainder.length === 0,
      remainder,
    };
  }
  return { triggered: false, wakeWordOnly: false, remainder: cleaned };
}

export function stripWakeWordPrefix(rawText) {
  const cleaned = normalizeCommandText(rawText);
  return cleaned.replace(WAKE_WORD_PREFIX_REGEX, '').trim();
}

function stripPoliteWrappers(text) {
  return text
    .replace(/^(?:please|kindly|jarvis|can\s+you|could\s+you|would\s+you|mujhe|mere\s+liye|ज़रा|जरा|कृपया|प्लीज|मुझे)\s+/iu, '')
    .replace(/\s+(?:please|sir|jarvis|यार|प्लीज|ना)$/iu, '')
    .trim();
}

function parseNumberFromText(text, fallback = null) {
  const m = String(text || '').match(/(\d{1,3})/);
  if (!m) return fallback;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : fallback;
}

function extractSongAndArtist(rawQuery) {
  const clean = String(rawQuery || '')
    .replace(/\b(?:on\s+youtube|youtube\s+par|youtube\s+pe|यूट्यूब\s+पर)\b/giu, '')
    .replace(/\b(?:a|an|the|some|koi|ek|कोई|एक)\s+/giu, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Pattern: "<song> by <artist>"
  const byMatch = clean.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return {
      songName: byMatch[1].trim(),
      artistName: byMatch[2].trim(),
      query: `${byMatch[1].trim()} ${byMatch[2].trim()}`.trim(),
    };
  }

  // Pattern: "<artist> ke gaane" / "<artist> ka song" / "<artist> के गाने" / "<artist> songs"
  const artistHindiMatch = clean.match(
    /^(.+?)\s+(?:ke\s+(?:gaane|gane|songs?|tracks?)|ka\s+(?:gaana|gana|song|music)|की\s+गाने|के\s+गाने|का\s+गाना|songs?|tracks?)$/iu
  );
  if (artistHindiMatch) {
    const artist = artistHindiMatch[1].trim();
    return {
      songName: undefined,
      artistName: artist,
      query: `${artist} songs`,
    };
  }

  const strippedSongWords = clean
    .replace(/\s+(?:gaana|gaane|gana|gane|song|songs|music|गाना|गाने|म्यूजिक)$/iu, '')
    .trim();

  return {
    songName: strippedSongWords || clean,
    artistName: undefined,
    query: clean || strippedSongWords,
  };
}

/**
 * Stage 1: Media Player Controls (Highest Priority)
 */
function matchMediaControl(rawText, normalized) {
  const lower = normalized.toLowerCase();

  // Current media / "What is playing?" / "Who is singing?"
  if (
    /^(?:what(?:'s|\s+is)\s+(?:currently\s+)?playing|which\s+(?:song|track|video|music)\s+is\s+playing|current\s+(?:song|track|media|music)|now\s+playing)\??$/i.test(lower) ||
    /^(?:who\s+is\s+singing(?:\s+this(?:\s+song)?)?|who\s+sings\s+this|ye\s+gaana\s+kisne\s+gaya|kaun\s+ga\s+raha\s+hai|कौन\s+गा\s+रहा\s+है)\??$/iu.test(lower) ||
    /(?:abhi\s+kaun\s*sa\s+gaana\s+chal\s+raha\s+hai|abhi\s+kya\s+chal\s+raha\s+hai|kaun\s*sa\s+gaana\s+baj\s+raha\s+hai|अभी\s+कौन\s*सा\s+गाना\s+चल\s+रहा\s+है|अभी\s+क्या\s+चल\s+रहा\s+है)/iu.test(normalized)
  ) {
    const isWhoSingingQuestion = /(?:who\s+is\s+singing|who\s+sings|kisne\s+gaya|kaun\s+ga\s+raha|कौन\s+गा\s+रहा)/iu.test(normalized);
    return {
      intent: 'GET_CURRENT_MEDIA',
      rawText,
      normalizedText: normalized,
      isWhoSingingQuestion,
      confidence: 0.98,
      matchedRule: 'media_current_info',
    };
  }

  // Close player (check before stop)
  if (
    /^(?:close|hide|dismiss|shut\s+down)\s+(?:the\s+)?(?:media\s+|music\s+|video\s+)?player$/i.test(lower) ||
    /(?:player\s+band\s+karo|player\s+hatao|प्लेयर\s+बंद\s+करो|प्लेयर\s+हटाओ)/iu.test(normalized)
  ) {
    return {
      intent: 'CLOSE_PLAYER',
      rawText,
      normalizedText: normalized,
      confidence: 0.97,
      matchedRule: 'media_close_player',
    };
  }

  // Stop media
  if (
    /^(?:stop\s+(?:the\s+)?(?:music|song|video|media|playback|playing|player)|turn\s+off\s+(?:the\s+)?music)$/i.test(lower) ||
    /(?:music\s+band\s+karo|gaana\s+band\s+karo|gana\s+band\s+karo|song\s+band\s+karo|video\s+band\s+karo|म्यूजिक\s+बंद\s+करो|म्यूजिक\s+बंद\s+कर\s+दो|गाना\s+बंद\s+करो|गाना\s+बंद\s+कर\s+दो|वीडियो\s+बंद\s+करो)/iu.test(normalized)
  ) {
    return {
      intent: 'STOP_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.97,
      matchedRule: 'media_stop',
    };
  }

  // Next track (MUST come before PLAY_SONG so "Play the next song" routes here!)
  if (
    /^(?:(?:play\s+)?(?:the\s+)?next(?:\s+(?:song|track|video|one))?|skip(?:\s+(?:this\s+)?(?:song|track|video))?)$/i.test(lower) ||
    /(?:agla\s+(?:gaana|gana|song|track|video)(?:\s+(?:bajao|chalao|lagao|play\s+karo))?|अगला\s+(?:गाना|सॉन्ग|ट्रैक|वीडियो)(?:\s+(?:बजाओ|चलाओ|लगाओ))?)/iu.test(normalized)
  ) {
    return {
      intent: 'NEXT_TRACK',
      rawText,
      normalizedText: normalized,
      confidence: 0.98,
      matchedRule: 'media_next',
    };
  }

  // Previous track
  if (
    /^(?:(?:play\s+)?(?:the\s+)?(?:previous|prev|last)(?:\s+(?:song|track|video|one))?|go\s+back\s+to\s+previous(?:\s+(?:song|track))?)$/i.test(lower) ||
    /(?:pichh?la\s+(?:gaana|gana|song|track|video)(?:\s+(?:bajao|chalao|lagao))?|पिछला\s+(?:गाना|सॉन्ग|ट्रैक|वीडियो)(?:\s+(?:बजाओ|चलाओ|लगाओ))?)/iu.test(normalized)
  ) {
    return {
      intent: 'PREVIOUS_TRACK',
      rawText,
      normalizedText: normalized,
      confidence: 0.98,
      matchedRule: 'media_previous',
    };
  }

  // Pause media
  if (
    /^(?:pause(?:\s+(?:the\s+)?(?:music|song|video|media|playback|it))?|hold\s+music)$/i.test(lower) ||
    /^(?:ruko|ruk\s+jao|music\s+ruko|gaana\s+roko|gana\s+roko|pause\s+karo|रोको|रुको|म्यूजिक\s+रोको|गाना\s+रोको|पॉज़\s+करो)$/iu.test(normalized)
  ) {
    return {
      intent: 'PAUSE_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.96,
      matchedRule: 'media_pause',
    };
  }

  // Resume / bare Play
  if (
    /^(?:resume(?:\s+(?:the\s+)?(?:music|song|video|media|playback|playing|it))?|play|play\s+(?:music|media|again)|continue\s+(?:playing|music))$/i.test(lower) ||
    /^(?:dobara\s+chalao|phir\s+se\s+chalao|resume\s+karo|wapas\s+chalao|दोबारा\s+चलाओ|फिर\s+से\s+चलाओ|चलाओ)$/iu.test(normalized)
  ) {
    return {
      intent: 'RESUME_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.95,
      matchedRule: 'media_resume',
    };
  }

  // Unmute (check BEFORE mute because "unmute" contains "mute")
  if (
    /^(?:unmute(?:\s+(?:the\s+)?(?:music|audio|sound|video|media|player))?|sound\s+on)$/i.test(lower) ||
    /(?:unmute\s+karo|awaaz\s+chalu\s+karo|awaaz\s+on\s+karo|अनम्यूट\s+करो|(?:आवाज़|आवाज)\s+चालू\s+करो)/iu.test(normalized)
  ) {
    return {
      intent: 'UNMUTE_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.97,
      matchedRule: 'media_unmute',
    };
  }

  // Mute
  if (
    /^(?:mute(?:\s+(?:the\s+)?(?:music|audio|sound|video|media|player))?|silence\s+music)$/i.test(lower) ||
    /(?:mute\s+karo|awaaz\s+band\s+karo|म्यूट\s+करो|(?:आवाज़|आवाज)\s+बंद\s+करो)/iu.test(normalized)
  ) {
    return {
      intent: 'MUTE_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.97,
      matchedRule: 'media_mute',
    };
  }

  // Exact Volume Level: "volume 40", "set volume to 40", "40 volume karo", "volume 40 karo", "वॉल्यूम 40 करो"
  if (
    /(?:(?:set\s+)?(?:the\s+)?(?:volume|sound|awaaz|awaz|वॉल्यूम|आवाज़|आवाज)\s+(?:to\s+|at\s+)?\d{1,3}(?:\s*%|\s*percent)?(?:\s+(?:karo|kar\s+do|करो|कर\s+दो))?|\b\d{1,3}(?:\s*%|\s*percent)?\s+(?:volume|awaaz|वॉल्यूम)(?:\s+(?:karo|kar\s+do|करो))?)/iu.test(normalized)
  ) {
    const level = Math.max(0, Math.min(100, parseNumberFromText(normalized, 50)));
    return {
      intent: 'CHANGE_VOLUME',
      rawText,
      normalizedText: normalized,
      volumeLevel: level,
      confidence: 0.97,
      matchedRule: 'media_volume_exact',
    };
  }

  // Volume Up
  if (
    /(?:volume\s+up|increase\s+(?:the\s+)?volume|turn\s+up(?:\s+the)?\s+(?:volume|sound|music)|louder|awaaz\s+badhao|awaz\s+badhao|volume\s+badhao|sound\s+badhao|(?:आवाज़|आवाज)\s+(?:बढ़ाओ|बढाओ)|वॉल्यूम\s+(?:बढ़ाओ|बढाओ))/iu.test(normalized)
  ) {
    return {
      intent: 'CHANGE_VOLUME',
      rawText,
      normalizedText: normalized,
      volumeDelta: 15,
      confidence: 0.96,
      matchedRule: 'media_volume_up',
    };
  }

  // Volume Down
  if (
    /(?:volume\s+down|decrease\s+(?:the\s+)?volume|lower\s+(?:the\s+)?volume|turn\s+down(?:\s+the)?\s+(?:volume|sound|music)|quieter|softer|awaaz\s+kam\s+karo|awaz\s+kam\s+karo|volume\s+kam\s+karo|sound\s+kam\s+karo|(?:आवाज़|आवाज)\s+कम\s+करो|वॉल्यूम\s+कम\s+करो)/iu.test(normalized)
  ) {
    return {
      intent: 'CHANGE_VOLUME',
      rawText,
      normalizedText: normalized,
      volumeDelta: -15,
      confidence: 0.96,
      matchedRule: 'media_volume_down',
    };
  }

  // Seek Forward
  if (
    /(?:(?:fast\s+)?forward|seek\s+forward|skip\s+ahead|skip\s+forward|jump\s+forward)(?:\s+(?:by\s+)?\d+\s*(?:sec|secs|second|seconds|s))?/i.test(lower) ||
    /(?:(?:\d+\s*(?:sec|second|seconds|सेकंड|सेकेंड)\s+)?(?:aage\s+badhao|aage\s+karo|आगे\s+बढ़ाओ|आगे\s+करो))/iu.test(normalized)
  ) {
    const sec = parseNumberFromText(normalized, 10);
    return {
      intent: 'SEEK_FORWARD',
      rawText,
      normalizedText: normalized,
      seekSeconds: Math.max(1, Math.min(300, sec)),
      confidence: 0.96,
      matchedRule: 'media_seek_forward',
    };
  }

  // Seek Backward
  if (
    /(?:rewind|seek\s+back(?:ward)?|skip\s+back(?:ward)?|go\s+back|back)(?:\s+(?:by\s+)?\d+\s*(?:sec|secs|second|seconds|s))+/i.test(lower) ||
    /^(?:rewind|seek\s+back(?:ward)?|back\s+\d+\s*(?:s|sec|seconds?))$/i.test(lower) ||
    /(?:(?:\d+\s*(?:sec|second|seconds|सेकंड|सेकेंड)\s+)?(?:peeche\s+karo|piche\s+karo|peeche\s+le\s+jao|पीछे\s+करो|पीछे\s+ले\s+जाओ))/iu.test(normalized)
  ) {
    const sec = parseNumberFromText(normalized, 10);
    return {
      intent: 'SEEK_BACKWARD',
      rawText,
      normalizedText: normalized,
      seekSeconds: Math.max(1, Math.min(300, sec)),
      confidence: 0.96,
      matchedRule: 'media_seek_backward',
    };
  }

  // Repeat / Loop
  if (
    /(?:repeat\s+(?:this\s+)?(?:song|track|video|music|on|off)|loop\s+(?:this\s+)?(?:song|track|video|music|on|off)|turn\s+(?:on|off)\s+(?:repeat|loop)|गाना\s+रिपीट\s+करो|लूप\s+करो|रिपीट\s+करो)/iu.test(normalized)
  ) {
    const disable = /\b(off|stop|disable|band|बंद)\b/iu.test(normalized);
    return {
      intent: 'REPEAT_MEDIA',
      rawText,
      normalizedText: normalized,
      repeatEnabled: !disable,
      confidence: 0.96,
      matchedRule: 'media_repeat',
    };
  }

  return null;
}

/**
 * Helper to determine if a bare target after "chalao" is actually a built-in website (e.g., "Instagram chalao")
 */
function isPureBuiltInWebsiteTarget(candidate) {
  const trimmed = String(candidate || '').trim();
  if (!trimmed) return false;
  if (SONG_CUE_REGEX.test(trimmed) || VIDEO_CUE_REGEX.test(trimmed)) return false;
  return Boolean(findBuiltInWebsite(trimmed) || normalizeSpokenDomain(trimmed));
}

/**
 * Stage 2 & 3: Play Song / Playlist vs Play Video
 */
function matchMediaPlaybackRequest(rawText, normalized) {
  // Preserve existing Stage 6 welcome greeting voice commands
  if (/^(?:re)?play\s+welcome(?:\s+greeting)?$/i.test(normalized.toLowerCase())) {
    return null;
  }

  let extractedQuery = null;
  let explicitVideoVerb = false;
  let explicitSongVerb = false;
  let matchedRule = '';

  // Hindi/Hinglish: "YouTube par <X> chalao/dikhao/bajao/play karo"
  const ytParMatch = normalized.match(
    /^(?:youtube|यूट्यूब)\s+(?:par|pe|पर|में|mein)\s+(.+?)\s+(?:chalao|chala\s+do|dikhao|dikha\s+do|bajao|baja\s+do|play\s+karo|चलाओ|दिखाओ|बजाओ)$/iu
  );
  if (ytParMatch) {
    extractedQuery = ytParMatch[1].trim();
    explicitVideoVerb = /(?:dikhao|dikha\s+do|दिखाओ)$/iu.test(normalized);
    explicitSongVerb = /(?:bajao|baja\s+do|बजाओ)$/iu.test(normalized);
    matchedRule = 'youtube_par_play';
  }

  // English: "Play <X> on YouTube" or "Play <X>"
  if (!extractedQuery) {
    const engPlayMatch = normalized.match(/^(?:play|listen\s+to|put\s+on|stream)\s+(.+)$/i);
    if (engPlayMatch) {
      extractedQuery = engPlayMatch[1].trim();
      matchedRule = 'english_play';
    }
  }

  // English video watch/show: "Watch <X>", "Show me <X> video/tutorial/trailer"
  if (!extractedQuery) {
    const watchMatch = normalized.match(/^(?:watch|show\s+(?:me\s+)?)\s*(.+)$/i);
    if (watchMatch && VIDEO_CUE_REGEX.test(watchMatch[1])) {
      extractedQuery = watchMatch[1].trim();
      explicitVideoVerb = true;
      matchedRule = 'english_watch_video';
    }
  }

  // Hinglish/Hindi suffix verbs: "<X> bajao / chalao / play karo / dikhao / बजाओ / चलाओ / दिखाओ"
  if (!extractedQuery) {
    const suffixMatch = normalized.match(
      /^(.+?)\s+(?:play\s+karo|play\s+kar\s+do|bajao|baja\s+do|chalao|chala\s+do|dikhao|dikha\s+do|sunao|suna\s+do|बजाओ|बजा\s+दो|चलाओ|चला\s+दो|दिखाओ|दिखा\s+दो|सुनाओ)$/iu
    );
    if (suffixMatch) {
      const candidate = suffixMatch[1].trim();
      // Guard: "Instagram chalao" or "YouTube chalao" -> website launcher, NOT media!
      if (isPureBuiltInWebsiteTarget(candidate)) {
        return null;
      }
      extractedQuery = candidate;
      explicitVideoVerb = /(?:dikhao|dikha\s+do|दिखाओ|दिखा\s+दो)$/iu.test(normalized);
      explicitSongVerb = /(?:bajao|baja\s+do|sunao|suna\s+do|बजाओ|बजा\s+दो|सुनाओ)$/iu.test(normalized);
      matchedRule = 'indic_suffix_play';
    }
  }

  // Bare generic Hindi video request: "वीडियो चलाओ" / "video chalao"
  if (!extractedQuery && /^(?:वीडियो|video)\s+(?:चलाओ|chalao|dikhao|दिखाओ)$/iu.test(normalized)) {
    extractedQuery = 'trending technology videos';
    explicitVideoVerb = true;
    matchedRule = 'generic_video_play';
  }

  if (!extractedQuery) return null;

  // Guard: If user said "Play YouTube" or "Play Spotify" literally with nothing else
  if (isPureBuiltInWebsiteTarget(extractedQuery)) {
    return null;
  }

  // Clean leading Hindi fillers ("कोई ", "एक ", "koi ", "ek ")
  const cleanQuery = extractedQuery
    .replace(/^(?:koi|ek|कोई|एक|a|an|the|some)\s+/iu, '')
    .replace(/\s+(?:on\s+youtube|youtube\s+par|youtube\s+pe|यूट्यूब\s+पर)$/iu, '')
    .trim();

  // Generic video request if user literally said "वीडियो चलाओ"
  if (/^(?:वीडियो|video|videos)$/iu.test(cleanQuery)) {
    return {
      intent: 'PLAY_VIDEO',
      rawText,
      normalizedText: normalized,
      query: 'latest trending videos',
      confidence: 0.9,
      matchedRule: 'generic_video',
    };
  }

  // Classify Playlist vs Video vs Song
  if (PLAYLIST_CUE_REGEX.test(cleanQuery)) {
    return {
      intent: 'PLAY_PLAYLIST',
      rawText,
      normalizedText: normalized,
      query: cleanQuery,
      confidence: 0.94,
      matchedRule: `${matchedRule}:playlist`,
    };
  }

  const hasVideoCue = VIDEO_CUE_REGEX.test(cleanQuery) || explicitVideoVerb;
  const hasSongCue = SONG_CUE_REGEX.test(cleanQuery) || explicitSongVerb;

  // Priority 2: PLAY_SONG when song cues dominate or when no video cues exist
  if (hasSongCue && !VIDEO_CUE_REGEX.test(cleanQuery)) {
    const parsed = extractSongAndArtist(cleanQuery);
    return {
      intent: 'PLAY_SONG',
      rawText,
      normalizedText: normalized,
      query: parsed.query || cleanQuery,
      songName: parsed.songName,
      artistName: parsed.artistName,
      confidence: 0.96,
      matchedRule: `${matchedRule}:song`,
    };
  }

  // Priority 3: PLAY_VIDEO when explicit video cues or "dikhao" are present
  if (hasVideoCue) {
    return {
      intent: 'PLAY_VIDEO',
      rawText,
      normalizedText: normalized,
      query: cleanQuery,
      confidence: 0.95,
      matchedRule: `${matchedRule}:video`,
    };
  }

  // Default for "Play <title>" / "YouTube par <song> chalao" without video keywords: PLAY_SONG
  const parsed = extractSongAndArtist(cleanQuery);
  return {
    intent: 'PLAY_SONG',
    rawText,
    normalizedText: normalized,
    query: parsed.query || cleanQuery,
    songName: parsed.songName,
    artistName: parsed.artistName,
    confidence: 0.9,
    matchedRule: `${matchedRule}:default_song`,
  };
}

/**
 * Stage 4: Website Opening (English, Hindi Devanagari, Hinglish, Spoken Domains)
 */
function matchOpenWebsite(rawText, normalized) {
  // Guard: Keep internal JARVIS screens ("open security", "open multi ai brain", "open media control") for Stage 6!
  if (
    /^(?:open|show|go\s+to)\s+(?:stark\s+)?(?:security(?:\s+audit)?|brain\s+center|multi[\s-]+ai(?:\s+brain)?|control\s+center|media(?:\s+(?:and\s+web\s+)?control|\s+player|\s+hud)?|settings|memory\s+vault|dashboard|voice\s+matrix)$/i.test(
      normalized.toLowerCase()
    )
  ) {
    return null;
  }

  let target = null;
  let matchedRule = '';

  // English prefixes: "Open Flipkart", "Go to Wikipedia", "Visit Amazon", "Launch GitHub"
  const engMatch = normalized.match(
    /^(?:open|go\s+to|visit|launch|navigate\s+to|take\s+me\s+to|browse)\s+(.+)$/i
  );
  if (engMatch) {
    target = engMatch[1].trim();
    matchedRule = 'open_website_en';
  }

  // Hindi "मुझे <site> पर ले चलो" / "<site> पर ले चलो"
  if (!target) {
    const hiTakeMeMatch = normalized.match(
      /^(?:मुझे\s+|mujhe\s+)?(.+?)\s+(?:पर\s+ले\s+चलो|par\s+le\s+chalo|pe\s+le\s+chalo)$/iu
    );
    if (hiTakeMeMatch) {
      target = hiTakeMeMatch[1].trim();
      matchedRule = 'open_website_hi_take';
    }
  }

  // Hindi/Hinglish suffixes: "गूगल खोलो", "इंस्टाग्राम खोल दो", "YouTube kholo", "Flipkart open karo", "GitHub khol do", "Instagram chalao", "Amazon website kholo"
  if (!target) {
    const indicOpenMatch = normalized.match(
      /^(.+?)\s+(?:kholo|khol\s+do|open\s+karo|open\s+kar\s+do|chalao|chala\s+do|खोलो|खोल\s+दो|ओपन\s+करो|ओपन\s+कर\s+दो)$/iu
    );
    if (indicOpenMatch) {
      const candidate = indicOpenMatch[1].trim();
      // For "chalao", only match website if candidate looks like a website/domain
      if (/(?:chalao|chala\s+do)$/iu.test(normalized)) {
        if (findBuiltInWebsite(candidate) || normalizeSpokenDomain(candidate) || /website|site/i.test(candidate)) {
          target = candidate;
          matchedRule = 'open_website_hinglish_chalao';
        }
      } else {
        target = candidate;
        matchedRule = 'open_website_indic';
      }
    }
  }

  // Bare spoken domain alone: "github dot com", "गूगल डॉट कॉम", "फ्लिपकार्ट डॉट इन"
  if (!target) {
    const spoken = normalizeSpokenDomain(normalized);
    if (spoken) {
      target = normalized;
      matchedRule = 'open_website_bare_domain';
    }
  }

  if (!target) return null;

  return {
    intent: 'OPEN_WEBSITE',
    rawText,
    normalizedText: normalized,
    websiteTarget: target,
    query: target,
    confidence: 0.95,
    matchedRule,
  };
}

/**
 * Stage 5: Web Search
 */
function matchWebSearch(rawText, normalized) {
  // English: "Search Google for ...", "Google ...", "Search for ...", "Search web for ..."
  const engSearch = normalized.match(
    /^(?:search\s+(?:google\s+|the\s+web\s+|web\s+|online\s+)?(?:for\s+)?|google\s+(?:for\s+)?)(.+)$/i
  );
  if (engSearch && engSearch[1].trim()) {
    return {
      intent: 'SEARCH_WEB',
      rawText,
      normalizedText: normalized,
      query: engSearch[1].trim(),
      confidence: 0.92,
      matchedRule: 'search_web_en',
    };
  }

  // Hindi/Hinglish: "Google par <X> search karo", "<X> search karo", "गूगल पर <X> खोजो"
  const indicSearch = normalized.match(
    /^(?:(?:google|गूगल)\s+(?:par|pe|पर)\s+)?(.+?)\s+(?:search\s+karo|search\s+kar\s+do|dhundo|khojo|खोजो|सर्च\s+करो)$/iu
  );
  if (indicSearch && indicSearch[1].trim()) {
    return {
      intent: 'SEARCH_WEB',
      rawText,
      normalizedText: normalized,
      query: indicSearch[1].trim(),
      confidence: 0.92,
      matchedRule: 'search_web_indic',
    };
  }

  return null;
}

/**
 * Strict Client-Side Validator for AI Structured Fallback Actions
 */
export function validateClientAiAction(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const action = String(raw.action || '').trim().toLowerCase();

  if (action === 'open_url') {
    const check = validateSafeHttpUrl(raw.url);
    if (!check.ok || !check.url) return null;
    return {
      action: 'open_url',
      url: check.url,
      ...(typeof raw.label === 'string' && raw.label.trim() ? { label: raw.label.trim() } : {}),
    };
  }

  if (action === 'play_song' || action === 'play_video') {
    const query = String(raw.query || '').trim().slice(0, 160);
    if (!query) return null;
    return { action, query };
  }

  if (action === 'media_control') {
    const command = String(raw.command || '').trim().toLowerCase();
    if (!ALLOWED_MEDIA_CONTROLS.has(command)) return null;
    const value =
      raw.value !== undefined && raw.value !== null && Number.isFinite(Number(raw.value))
        ? Number(raw.value)
        : undefined;
    return {
      action: 'media_control',
      command,
      ...(value !== undefined ? { value } : {}),
    };
  }

  if (action === 'clarify') {
    const question = String(raw.question || '').trim().slice(0, 240);
    if (!question) return null;
    return { action: 'clarify', question };
  }

  return null;
}

export class MediaCommandRegistry {
  constructor() {
    this.customMatchers = [];
  }

  registerMatcher(matcher) {
    if (typeof matcher === 'function') {
      this.customMatchers.push(matcher);
    }
  }

  listSupportedIntents() {
    return [
      'OPEN_WEBSITE',
      'SEARCH_WEB',
      'PLAY_VIDEO',
      'PLAY_SONG',
      'PLAY_PLAYLIST',
      'PAUSE_MEDIA',
      'RESUME_MEDIA',
      'NEXT_TRACK',
      'PREVIOUS_TRACK',
      'STOP_MEDIA',
      'CLOSE_PLAYER',
      'CHANGE_VOLUME',
      'MUTE_MEDIA',
      'UNMUTE_MEDIA',
      'SEEK_FORWARD',
      'SEEK_BACKWARD',
      'REPEAT_MEDIA',
      'GET_CURRENT_MEDIA',
      'UNKNOWN_COMMAND',
    ];
  }
}

export class UniversalCommandRouter {
  constructor(registry = new MediaCommandRegistry()) {
    this.registry = registry;
  }

  route(rawText) {
    const original = String(rawText || '').trim();
    const withoutWake = stripWakeWordPrefix(original);
    const normalized = stripPoliteWrappers(normalizeCommandText(withoutWake || original));

    if (!normalized) {
      return {
        intent: 'UNKNOWN_COMMAND',
        rawText: original,
        normalizedText: '',
        confidence: 0,
      };
    }

    // Priority 1: Media player controls
    const mediaControl = matchMediaControl(original, normalized);
    if (mediaControl) return mediaControl;

    // Priority 2 & 3: Play song / playlist & Play video
    const playback = matchMediaPlaybackRequest(original, normalized);
    if (playback) return playback;

    // Priority 4: Website opening
    const website = matchOpenWebsite(original, normalized);
    if (website) return website;

    // Priority 5: Web search
    const search = matchWebSearch(original, normalized);
    if (search) return search;

    // Optional registered custom matchers
    for (const matcher of this.registry.customMatchers) {
      const matched = matcher(original, normalized);
      if (matched) return matched;
    }

    // Priority 6 (existing local/brain commands) & Priority 7 (AI fallback) handled by VoiceCommandExecutor
    return {
      intent: 'UNKNOWN_COMMAND',
      rawText: original,
      normalizedText: normalized,
      confidence: 0,
    };
  }
}

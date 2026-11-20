/**
 * Smart Multilingual Voice Command Router & MediaCommandRegistry
 * Supports English, Hindi (Devanagari), and Hinglish.
 *
 * Strict Priority Evaluation Order:
 * 1. Media player controls (including index select, fullscreen, play different)
 * 2. Play song / playlist
 * 3. Play video / YouTube search
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
  'fullscreen',
  'current',
]);

const VIDEO_CUE_REGEX =
  /\b(video|videos|trailer|trailers|tutorial|tutorials|highlights|documentary|vlog|podcast|lecture|course|coding\s+tutorial|programming\s+tutorial|review|unboxing|match\s+highlights|episode|clip|clips|news|shorts|dikhao|dikha\s+do|watch)\b|वीडियो|ट्रेलर|ट्यूटोरियल|हाइलाइट्स|दिखाओ|दिखा\s+दो|देखना/iu;

const EDUCATION_CUE_REGEX =
  /\b(tutorial|tutorials|lecture|lectures|course|courses|lesson|lessons|education|educational|learn|learning|explained|programming|coding|physics|math|mathematics|chemistry|biology|history|study|exam|ncert|upsc|jee|neet)\b|ट्यूटोरियल|क्लास|पढ़ाई|लेक्चर|कोर्स/iu;

const SONG_CUE_REGEX =
  /\b(song|songs|music|gaana|gaane|gana|gane|track|tracks|album|beats|lofi|lo-fi|instrumental|classical|relaxing|bhajan|rap|qawwali|mashup|jukebox|remix|bajao|baja\s+do|suna\s+do|sunao)\b|गाना|गाने|म्यूजिक|संगीत|बजाओ|बजा\s+दो|सुनाओ/iu;

const PLAYLIST_CUE_REGEX = /\b(playlist|play\s*list|mixtape|jukebox)\b|प्लेलिस्ट/iu;

const WAKE_WORD_PREFIX_REGEX =
  /^(?:(?:hey|ok|okay|hi|hello|yo|listen|sun|suno|अरे|हे|हेलो|ओके)\s+)?(?:j\.?\s*a\.?\s*r\.?\s*v\.?\s*i\.?\s*s\.?|jarvis|जार्विस|जर्विस)[\s,!.:?-]*/iu;

const WAKE_WORD_INLINE_REGEX =
  /(?:^|[\s,!.?।])(?:(?:hey|ok|okay|hi|hello|yo|listen|sun|suno|अरे|हे|हेलो|ओके)\s+)(?:j\.?\s*a\.?\s*r\.?\s*v\.?\s*i\.?\s*s\.?|jarvis|जार्विस|जर्विस)[\s,!.:?-]*/iu;

const WAKE_WORD_SOLO_REGEX =
  /^(?:(?:hey|ok|okay|hi|hello|yo|अरे|हे|हेलो|ओके)\s+)?(?:j\.?\s*a\.?\s*r\.?\s*v\.?\s*i\.?\s*s\.?|jarvis|जार्विस|जर्विस)[\s!?.।]*$/iu;

const WORD_NUMBER_MAP = new Map([
  ['zero', 0],
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['fifteen', 15],
  ['twenty', 20],
  ['twenty five', 25],
  ['thirty', 30],
  ['forty', 40],
  ['forty five', 45],
  ['fifty', 50],
  ['sixty', 60],
  ['seventy', 70],
  ['eighty', 80],
  ['ninety', 90],
  ['hundred', 100],
  ['ek', 1],
  ['do', 2],
  ['teen', 3],
  ['char', 4],
  ['paanch', 5],
  ['panch', 5],
  ['das', 10],
  ['pandrah', 15],
  ['bees', 20],
  ['tees', 30],
  ['chalis', 40],
  ['pachas', 50],
  ['saath', 60],
  ['sau', 100],
  ['एक', 1],
  ['दो', 2],
  ['तीन', 3],
  ['चार', 4],
  ['पांच', 5],
  ['पाँच', 5],
  ['छह', 6],
  ['सात', 7],
  ['आठ', 8],
  ['नौ', 9],
  ['दस', 10],
  ['पंद्रह', 15],
  ['बीस', 20],
  ['पच्चीस', 25],
  ['तीस', 30],
  ['चालीस', 40],
  ['पचास', 50],
  ['साठ', 60],
  ['सौ', 100],
]);

const ORDINAL_INDEX_MAP = new Map([
  ['1', 0],
  ['1st', 0],
  ['first', 0],
  ['pehla', 0],
  ['pehle', 0],
  ['pahla', 0],
  ['पहला', 0],
  ['पहले', 0],
  ['2', 1],
  ['2nd', 1],
  ['second', 1],
  ['doosra', 1],
  ['dusra', 1],
  ['दूसरा', 1],
  ['3', 2],
  ['3rd', 2],
  ['third', 2],
  ['teesra', 2],
  ['tisra', 2],
  ['तीसरा', 2],
  ['4', 3],
  ['4th', 3],
  ['fourth', 3],
  ['chautha', 3],
  ['चौथा', 3],
  ['5', 4],
  ['5th', 4],
  ['fifth', 4],
  ['paanchva', 4],
  ['panchwa', 4],
  ['पांचवा', 4],
  ['पाँचवाँ', 4],
  ['6', 5],
  ['6th', 5],
  ['sixth', 5],
  ['7', 6],
  ['7th', 6],
  ['seventh', 6],
  ['8', 7],
  ['8th', 7],
  ['eighth', 7],
  ['9', 8],
  ['9th', 8],
  ['ninth', 8],
  ['10', 9],
  ['10th', 9],
  ['tenth', 9],
]);

export function normalizeCommandText(rawText) {
  return String(rawText || '')
    .normalize('NFC')
    .trim()
    .replace(/[।|]+/g, ' ')
    .replace(/[.!?]+$/g, '')
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
  // Support ambient words spoken before "Hey JARVIS ..." in continuous recognition
  const inlineMatch = cleaned.match(WAKE_WORD_INLINE_REGEX);
  if (inlineMatch && typeof inlineMatch.index === 'number') {
    const remainder = cleaned.slice(inlineMatch.index + inlineMatch[0].length).trim();
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
    .replace(
      /^(?:please|kindly|jarvis|can\s+you|could\s+you|would\s+you|mujhe|mere\s+liye|ज़रा|जरा|कृपया|प्लीज|मुझे)\s+/iu,
      ''
    )
    .replace(/\s+(?:please|sir|jarvis|यार|प्लीज|ना)$/iu, '')
    .trim();
}

function parseNumberFromText(text, fallback = null) {
  const raw = String(text || '').trim();
  const digitMatch = raw.match(/(\d{1,3})/);
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    return Number.isFinite(n) ? n : fallback;
  }
  const tokens = raw.toLowerCase().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    if (i + 1 < tokens.length) {
      const pair = `${tokens[i]} ${tokens[i + 1]}`;
      if (WORD_NUMBER_MAP.has(pair)) return WORD_NUMBER_MAP.get(pair);
    }
    if (WORD_NUMBER_MAP.has(tokens[i])) {
      return WORD_NUMBER_MAP.get(tokens[i]);
    }
  }
  return fallback;
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

  // Pattern: "<artist> ka latest song" / "<artist> ke gaane" / "<artist> के गाने" / "<artist> songs"
  const artistHindiMatch = clean.match(
    /^(.+?)\s+(?:ke\s+(?:latest\s+|new\s+|best\s+)?(?:gaane|gane|songs?|tracks?)|ka\s+(?:latest\s+|new\s+|best\s+)?(?:gaana|gana|song|music)|की\s+गाने|के\s+गाने|का\s+गाना|(?:latest\s+|new\s+|best\s+)?(?:songs?|tracks?))$/iu
  );
  if (artistHindiMatch) {
    const artist = artistHindiMatch[1].trim();
    const wantsLatest = /\b(latest|new)\b|नया|लेटेस्ट/iu.test(clean);
    return {
      songName: undefined,
      artistName: artist,
      query: wantsLatest ? `${artist} latest song` : `${artist} songs`,
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
    /^(?:what(?:'s|\s+is)\s+(?:currently\s+)?playing|which\s+(?:song|track|video|music)\s+is\s+playing|current\s+(?:song|track|media|music)|now\s+playing)\??$/i.test(
      lower
    ) ||
    /^(?:who\s+is\s+singing(?:\s+this(?:\s+song)?)?|who\s+sings\s+this|ye\s+gaana\s+kisne\s+gaya|kaun\s+ga\s+raha\s+hai|कौन\s+गा\s+रहा\s+है)\??$/iu.test(
      lower
    ) ||
    /(?:abhi\s+kaun\s*sa\s+gaana\s+chal\s+raha\s+hai|abhi\s+kya\s+chal\s+raha\s+hai|kaun\s*sa\s+gaana\s+baj\s+raha\s+hai|अभी\s+कौन\s*सा\s+गाना\s+चल\s+रहा\s+है|अभी\s+क्या\s+चल\s+रहा\s+है)/iu.test(
      normalized
    )
  ) {
    const isWhoSingingQuestion =
      /(?:who\s+is\s+singing|who\s+sings|kisne\s+gaya|kaun\s+ga\s+raha|कौन\s+गा\s+रहा)/iu.test(
        normalized
      );
    return {
      intent: 'GET_CURRENT_MEDIA',
      rawText,
      normalizedText: normalized,
      isWhoSingingQuestion,
      confidence: 0.98,
      matchedRule: 'media_current_info',
    };
  }

  // Fullscreen On / Off / Toggle
  if (
    /^(?:(?:turn\s+on|enable|enter|go|switch\s+to|open)\s+full\s*screen|full\s*screen(?:\s+mode)?|full\s*screen\s+(?:on|karo|kar\s+do)|फुल\s*स्क्रीन(?:\s+(?:करो|कर\s+दो|ऑन\s+करो|चालू\s+करो))?)$/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'TOGGLE_FULLSCREEN',
      rawText,
      normalizedText: normalized,
      fullscreenEnabled: true,
      confidence: 0.97,
      matchedRule: 'media_fullscreen_on',
    };
  }
  if (
    /^(?:(?:turn\s+off|disable|exit|leave|close)\s+full\s*screen|full\s*screen\s+(?:off|band\s+karo)|फुल\s*स्क्रीन\s+(?:बंद\s+करो|हटाओ|ऑफ\s+करो))$/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'TOGGLE_FULLSCREEN',
      rawText,
      normalizedText: normalized,
      fullscreenEnabled: false,
      confidence: 0.97,
      matchedRule: 'media_fullscreen_off',
    };
  }

  // Select Nth result/track: "Play the first video", "पहला वीडियो चलाओ", "Play video 2"
  const selectEngMatch = lower.match(
    /^(?:play|open|select|watch)\s+(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th)\s+(?:video|song|track|result|one)$/i
  );
  if (selectEngMatch && ORDINAL_INDEX_MAP.has(selectEngMatch[1])) {
    return {
      intent: 'SELECT_MEDIA_INDEX',
      rawText,
      normalizedText: normalized,
      selectIndex: ORDINAL_INDEX_MAP.get(selectEngMatch[1]),
      confidence: 0.97,
      matchedRule: 'media_select_index_en',
    };
  }
  const selectNumMatch = lower.match(
    /^(?:play|open|select|watch)\s+(?:video|song|track|result|number)\s+(?:number\s+)?(\d{1,2})$/i
  );
  if (selectNumMatch) {
    const idx = Math.max(0, Math.min(14, Number(selectNumMatch[1]) - 1));
    return {
      intent: 'SELECT_MEDIA_INDEX',
      rawText,
      normalizedText: normalized,
      selectIndex: idx,
      confidence: 0.96,
      matchedRule: 'media_select_index_num',
    };
  }
  const selectIndicMatch = normalized.match(
    /^(पहला|पहले|दूसरा|तीसरा|चौथा|पांचवा|पाँचवाँ|pehla|pehle|pahla|doosra|dusra|teesra|tisra|chautha|paanchva|panchwa)\s+(?:वीडियो|गाना|सॉन्ग|ट्रैक|video|song|gaana|gana|track)(?:\s+(?:चलाओ|चला\s+दो|बजाओ|दिखाओ|chalao|chala\s+do|bajao|play\s+karo))?$/iu
  );
  if (selectIndicMatch && ORDINAL_INDEX_MAP.has(selectIndicMatch[1].toLowerCase())) {
    return {
      intent: 'SELECT_MEDIA_INDEX',
      rawText,
      normalizedText: normalized,
      selectIndex: ORDINAL_INDEX_MAP.get(selectIndicMatch[1].toLowerCase()),
      confidence: 0.97,
      matchedRule: 'media_select_index_indic',
    };
  }

  // Play a different / another song or video ("Play a different song", "कोई दूसरा गाना चलाओ")
  if (
    /^(?:play|put\s+on|switch\s+to)\s+(?:a\s+)?(?:different|another|some\s+other)\s+(?:song|track|music|video)$/i.test(
      lower
    ) ||
    /^(?:(?:koi|कोई)\s+)?(?:doosra|dusra|दूसरा|कोई\s+और|koi\s+aur)\s+(?:gaana|gana|song|music|video|गाना|म्यूजिक|वीडियो)\s+(?:chalao|chala\s+do|bajao|baja\s+do|lagao|play\s+karo|चलाओ|चला\s+दो|बजाओ|बजा\s+दो|लगाओ)$/iu.test(
      normalized
    )
  ) {
    const isVideo = /\bvideo\b|वीडियो/iu.test(normalized);
    return {
      intent: 'PLAY_DIFFERENT',
      rawText,
      normalizedText: normalized,
      searchMode: isVideo ? 'video' : 'music',
      confidence: 0.96,
      matchedRule: 'media_play_different',
    };
  }

  // Close player (check before stop)
  if (
    /^(?:close|hide|dismiss|shut\s+down)\s+(?:the\s+)?(?:media\s+|music\s+|video\s+|youtube\s+)?player$/i.test(
      lower
    ) ||
    /(?:player\s+band\s+karo|player\s+band\s+kar\s+do|player\s+hatao|प्लेयर\s+बंद\s+करो|प्लेयर\s+बंद\s+कर\s+दो|प्लेयर\s+हटाओ)/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'CLOSE_PLAYER',
      rawText,
      normalizedText: normalized,
      confidence: 0.97,
      matchedRule: 'media_close_player',
    };
  }

  // Stop media ("Stop the video", "वीडियो बंद कर दो", "Music band karo", "Video stop karo")
  if (
    /^(?:stop\s+(?:the\s+)?(?:music|song|video|media|playback|playing|player)|(?:video|song|music|gaana|gana)\s+stop\s+karo|turn\s+off\s+(?:the\s+)?(?:music|video))$/i.test(
      lower
    ) ||
    /(?:(?:music|gaana|gana|song|video)\s+band\s+(?:karo|kar\s+do)|(?:म्यूजिक|गाना|वीडियो)\s+बंद\s+(?:करो|कर\s+दो))/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'STOP_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.97,
      matchedRule: 'media_stop',
    };
  }

  // Next track (MUST come before PLAY_SONG so "Play the next song/video" and "Next video play karo" route here!)
  if (
    /^(?:(?:play\s+)?(?:the\s+)?next(?:\s+(?:song|track|video|one))?(?:\s+play\s+karo|\s+chalao|\s+bajao)?|skip(?:\s+(?:this\s+)?(?:song|track|video))?)$/i.test(
      lower
    ) ||
    /(?:agla\s+(?:gaana|gana|song|track|video)(?:\s+(?:bajao|chalao|lagao|play\s+karo))?|अगला\s+(?:गाना|सॉन्ग|ट्रैक|वीडियो)(?:\s+(?:बजाओ|चलाओ|लगाओ))?)/iu.test(
      normalized
    )
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
    /^(?:(?:play\s+)?(?:the\s+)?(?:previous|prev|last)(?:\s+(?:song|track|video|one))?(?:\s+play\s+karo|\s+chalao|\s+bajao)?|go\s+back\s+to\s+previous(?:\s+(?:song|track|video))?)$/i.test(
      lower
    ) ||
    /(?:pichh?la\s+(?:gaana|gana|song|track|video)(?:\s+(?:bajao|chalao|lagao|play\s+karo))?|पिछला\s+(?:गाना|सॉन्ग|ट्रैक|वीडियो)(?:\s+(?:बजाओ|चलाओ|लगाओ))?)/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'PREVIOUS_TRACK',
      rawText,
      normalizedText: normalized,
      confidence: 0.98,
      matchedRule: 'media_previous',
    };
  }

  // Pause media ("Pause the video", "Video pause karo", "वीडियो रोक दो", "गाना रोको")
  if (
    /^(?:pause(?:\s+(?:the\s+)?(?:music|song|video|media|playback|it))?|hold\s+music)$/i.test(lower) ||
    /^(?:(?:video|song|music|gaana|gana)\s+)?(?:pause\s+(?:karo|kar\s+do)|ruko|ruk\s+jao|roko|rok\s+do)$/i.test(
      lower
    ) ||
    /^(?:(?:वीडियो|गाना|म्यूजिक)\s+)?(?:रोको|रोक\s+दो|रुको|पॉज़\s+करो|पॉज\s+करो)$/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'PAUSE_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.97,
      matchedRule: 'media_pause',
    };
  }

  // Resume / bare Play ("Resume playback", "वीडियो फिर से चलाओ", "Video resume karo")
  if (
    /^(?:resume(?:\s+(?:the\s+)?(?:music|song|video|media|playback|playing|it))?|(?:video|song|music|gaana|gana)\s+resume\s+(?:karo|kar\s+do)|play|play\s+(?:music|media|video|again)|continue\s+(?:playing|music|video))$/i.test(
      lower
    ) ||
    /^(?:(?:video|song|music|gaana|gana|वीडियो|गाना|म्यूजिक)\s+)?(?:dobara\s+chalao|phir\s+se\s+chalao|fir\s+se\s+chalao|resume\s+karo|wapas\s+chalao|दोबारा\s+चलाओ|फिर\s+से\s+चलाओ|वापस\s+चलाओ)$|^चलाओ$/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'RESUME_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.96,
      matchedRule: 'media_resume',
    };
  }

  // Unmute (check BEFORE mute because "unmute" contains "mute")
  if (
    /^(?:unmute(?:\s+(?:the\s+)?(?:music|audio|sound|video|media|player))?|sound\s+on)$/i.test(lower) ||
    /(?:unmute\s+(?:karo|kar\s+do)|awaaz\s+chalu\s+(?:karo|kar\s+do)|awaz\s+chalu\s+(?:karo|kar\s+do)|awaaz\s+on\s+karo|अनम्यूट\s+करो|(?:आवाज़|आवाज)\s+चालू\s+(?:करो|कर\s+दो))/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'UNMUTE_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.97,
      matchedRule: 'media_unmute',
    };
  }

  // Mute ("Mute the video", "आवाज बंद करो")
  if (
    /^(?:mute(?:\s+(?:the\s+)?(?:music|audio|sound|video|media|player))?|silence\s+(?:music|video))$/i.test(
      lower
    ) ||
    /(?:mute\s+(?:karo|kar\s+do)|awaaz\s+band\s+(?:karo|kar\s+do)|awaz\s+band\s+(?:karo|kar\s+do)|म्यूट\s+करो|(?:आवाज़|आवाज)\s+बंद\s+(?:करो|कर\s+दो))/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'MUTE_MEDIA',
      rawText,
      normalizedText: normalized,
      confidence: 0.97,
      matchedRule: 'media_mute',
    };
  }

  // Full / Max Volume ("Volume full kar do", "Full volume", "वॉल्यूम फुल करो")
  if (
    /^(?:(?:set\s+)?(?:volume|sound|awaaz|awaz|वॉल्यूम|आवाज़|आवाज)\s+(?:to\s+)?(?:full|max|maximum|फुल|मैक्स)(?:\s+(?:karo|kar\s+do|करो|कर\s+दो))?|(?:full|max|maximum)\s+(?:volume|sound)(?:\s+(?:karo|kar\s+do))?)$/iu.test(
      normalized
    )
  ) {
    return {
      intent: 'CHANGE_VOLUME',
      rawText,
      normalizedText: normalized,
      volumeLevel: 100,
      confidence: 0.97,
      matchedRule: 'media_volume_full',
    };
  }

  // Exact Volume Level: "volume 40", "set volume to 40", "40 volume karo", "वॉल्यूम 40 करो"
  if (
    /^(?:(?:set\s+|change\s+|put\s+)?(?:the\s+)?(?:media\s+|music\s+|video\s+)?(?:volume|sound|awaaz|awaz|वॉल्यूम|आवाज़|आवाज)\s+(?:to\s+|at\s+)?\d{1,3}(?:\s*%|\s*percent)?(?:\s+(?:karo|kar\s+do|करो|कर\s+दो))?|\d{1,3}(?:\s*%|\s*percent)?\s+(?:volume|awaaz|वॉल्यूम)(?:\s+(?:karo|kar\s+do|करो|कर\s+दो))?)$/iu.test(
      normalized
    )
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

  // Volume Up (anchored so prose like "Why is thunder louder than lightning?" is never hijacked)
  if (
    /^(?:volume\s+up|increase\s+(?:the\s+)?(?:media\s+|music\s+|video\s+)?volume|turn\s+up(?:\s+the)?\s+(?:volume|sound|music|audio|video)|(?:make\s+it\s+)?louder|awaaz\s+badhao|awaz\s+badhao|volume\s+badhao|sound\s+badhao|(?:आवाज़|आवाज)\s+(?:बढ़ाओ|बढाओ|बढ़ा\s+दो)|वॉल्यूम\s+(?:बढ़ाओ|बढाओ|बढ़ा\s+दो))$/iu.test(
      normalized
    )
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

  // Volume Down (anchored so prose like "How to make my keyboard quieter?" is never hijacked)
  if (
    /^(?:volume\s+down|decrease\s+(?:the\s+)?(?:media\s+|music\s+|video\s+)?volume|lower\s+(?:the\s+)?(?:media\s+|music\s+|video\s+)?volume|turn\s+down(?:\s+the)?\s+(?:volume|sound|music|audio|video)|(?:make\s+it\s+)?(?:quieter|softer)|awaaz\s+kam\s+(?:karo|kar\s+do)|awaz\s+kam\s+(?:karo|kar\s+do)|volume\s+kam\s+(?:karo|kar\s+do)|sound\s+kam\s+(?:karo|kar\s+do)|(?:आवाज़|आवाज)\s+कम\s+(?:करो|कर\s+दो)|वॉल्यूम\s+कम\s+(?:करो|कर\s+दो))$/iu.test(
      normalized
    )
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

  // Seek Forward (supports digits AND English/Hindi word numbers like "दस सेकंड आगे करो", "Skip forward 10 seconds")
  const numPattern =
    '(?:\\d{1,3}|five|ten|fifteen|twenty|thirty|sixty|paanch|panch|das|pandrah|bees|tees|पांच|पाँच|दस|पंद्रह|बीस|पच्चीस|तीस|साठ)';
  const seekForwardEn = new RegExp(
    `^(?:fast\\s+forward|forward|seek\\s+forward|skip\\s+ahead|skip\\s+forward|jump\\s+forward)(?:\\s+(?:by\\s+)?${numPattern}\\s*(?:sec|secs|second|seconds|s))?$`,
    'i'
  );
  const seekForwardIndic = new RegExp(
    `^(?:(?:video|gaana|gana|song|track|वीडियो|गाना)\\s+)?(?:${numPattern}\\s*(?:sec|secs|second|seconds|s|सेकंड|सेकेंड|सैकंड)\\s+)?(?:aage\\s+(?:badhao|karo|kar\\s+do)|आगे\\s+(?:बढ़ाओ|बढाओ|करो|कर\\s+दो))$`,
    'iu'
  );
  if (seekForwardEn.test(lower) || seekForwardIndic.test(normalized)) {
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

  // Seek Backward (supports digits AND Hindi word numbers like "दस सेकंड पीछे करो", "Go back 10 seconds")
  const seekBackWithNumEn = new RegExp(
    `^(?:rewind|seek\\s+back(?:ward)?|skip\\s+back(?:ward)?|go\\s+back|back)\\s+(?:by\\s+)?${numPattern}\\s*(?:sec|secs|second|seconds|s)$`,
    'i'
  );
  const seekBackBareEn = /^(?:rewind|seek\s+back(?:ward)?|skip\s+back(?:ward)?)$/i;
  const seekBackIndic = new RegExp(
    `^(?:(?:video|gaana|gana|song|track|वीडियो|गाना)\\s+)?(?:${numPattern}\\s*(?:sec|secs|second|seconds|s|सेकंड|सेकेंड|सैकंड)\\s+)?(?:peeche\\s+(?:karo|kar\\s+do|le\\s+jao)|piche\\s+(?:karo|kar\\s+do)|पीछे\\s+(?:करो|कर\\s+दो|ले\\s+जाओ))$`,
    'iu'
  );
  if (
    seekBackWithNumEn.test(lower) ||
    seekBackBareEn.test(lower) ||
    seekBackIndic.test(normalized)
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

  // Repeat / Loop (anchored so coding questions about loops are never hijacked)
  if (
    /^(?:repeat(?:\s+(?:this\s+)?(?:song|track|video|music|one|all|on|off))?|loop(?:\s+(?:this\s+)?(?:song|track|video|music|on|off))?|turn\s+(?:on|off)\s+(?:repeat|loop)|(?:गाना|वीडियो)\s+रिपीट\s+करो|लूप\s+करो|रिपीट\s+(?:करो|बंद\s+करो|ऑन\s+करो|ऑफ\s+करो))$/iu.test(
      normalized
    )
  ) {
    const disable = /\b(off|stop|disable|band|बंद|ऑफ)\b/iu.test(normalized);
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

function inferSearchMode(query) {
  if (SONG_CUE_REGEX.test(query) && !VIDEO_CUE_REGEX.test(query)) return 'music';
  if (EDUCATION_CUE_REGEX.test(query)) return 'education';
  return 'video';
}

/**
 * Stage 2 & 3: YouTube Search, Play Song / Playlist, and Play Video
 */
function matchMediaPlaybackRequest(rawText, normalized) {
  // Preserve existing Stage 6 welcome greeting voice commands and non-media chat idioms
  const lowerNorm = normalized.toLowerCase();
  if (
    /^(?:re)?play\s+welcome(?:\s+greeting)?$/i.test(lowerNorm) ||
    /^play\s+(?:devil'?s\s+advocate|a\s+game|chess|trivia|tic\s*tac\s*toe|the\s+role\s+of|roleplay|with\s+me)\b/i.test(
      lowerNorm
    )
  ) {
    return null;
  }

  // Explicit YouTube Search commands (display search results + open YouTube player section)
  // e.g. "Search Arijit Singh songs", "Search YouTube for Python tutorials",
  // "YouTube par songs search karo", "यूट्यूब पर अरिजीत सिंह के गाने खोजो"
  const ytSearchParMatch = normalized.match(
    /^(?:youtube|यूट्यूब)\s+(?:par|pe|पर|में|mein)\s+(.+?)\s+(?:search\s+karo|search\s+kar\s+do|dhundo|khojo|सर्च\s+करो|खोजो)$/iu
  );
  if (ytSearchParMatch && ytSearchParMatch[1].trim()) {
    const q = ytSearchParMatch[1].trim();
    return {
      intent: 'SEARCH_YOUTUBE',
      rawText,
      normalizedText: normalized,
      query: q,
      searchMode: inferSearchMode(q),
      confidence: 0.96,
      matchedRule: 'youtube_par_search',
    };
  }

  const ytSearchEnExplicit = normalized.match(
    /^(?:search\s+youtube\s+(?:for\s+)?|youtube\s+search\s+(?:for\s+)?)(.+)$/i
  );
  if (ytSearchEnExplicit && ytSearchEnExplicit[1].trim()) {
    const q = ytSearchEnExplicit[1].trim();
    return {
      intent: 'SEARCH_YOUTUBE',
      rawText,
      normalizedText: normalized,
      query: q,
      searchMode: inferSearchMode(q),
      confidence: 0.96,
      matchedRule: 'youtube_search_en_explicit',
    };
  }

  const ytSearchEnWithCue = normalized.match(/^(?:search|find)\s+(?:for\s+)?(.+?)(?:\s+on\s+youtube)?$/i);
  if (ytSearchEnWithCue && ytSearchEnWithCue[1].trim()) {
    const rawCandidate = ytSearchEnWithCue[1].trim();
    const mentionsYoutube = /\bon\s+youtube\b/i.test(normalized);
    const hasMediaCue =
      mentionsYoutube ||
      SONG_CUE_REGEX.test(rawCandidate) ||
      VIDEO_CUE_REGEX.test(rawCandidate);
    const mentionsGoogle = /\b(google|the\s+web|web|online)\b/i.test(lowerNorm);
    if (hasMediaCue && !mentionsGoogle) {
      return {
        intent: 'SEARCH_YOUTUBE',
        rawText,
        normalizedText: normalized,
        query: rawCandidate,
        searchMode: inferSearchMode(rawCandidate),
        confidence: 0.95,
        matchedRule: 'youtube_search_en_media_cue',
      };
    }
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
      searchMode: 'video',
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
      searchMode: 'music',
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
      searchMode: 'music',
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
      searchMode: EDUCATION_CUE_REGEX.test(cleanQuery) ? 'education' : 'video',
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
    searchMode: 'music',
    confidence: 0.9,
    matchedRule: `${matchedRule}:default_song`,
  };
}

/**
 * Stage 4: Website Opening (English, Hindi Devanagari, Hinglish, Spoken Domains)
 */
function matchOpenWebsite(rawText, normalized) {
  const lowerNorm = normalized.toLowerCase();
  // Guard: Keep internal JARVIS screens ("open security", "open multi ai brain", "open media control") for Stage 6!
  if (
    /^(?:open|show|go\s+to)\s+(?:stark\s+)?(?:security(?:\s+audit)?|brain\s+center|multi[\s-]+ai(?:\s+brain)?|control\s+center|media(?:\s+(?:and\s+web\s+)?control|\s+player|\s+hud)?|youtube\s+(?:player|hub|studio|section|panel)|settings|memory\s+vault|dashboard|voice\s+matrix)$/i.test(
      lowerNorm
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
    const candidate = engMatch[1].trim();
    const isDirectKnownOrDomain = Boolean(
      findBuiltInWebsite(candidate) || normalizeSpokenDomain(candidate)
    );
    const looksLikeProse =
      !isDirectKnownOrDomain &&
      (/[?]/.test(rawText) ||
        candidate.split(/\s+/).length > 5 ||
        /^(?:open\s+(?:source|ended|-ended|a\s+|an\s+|the\s+(?:file|door|window|folder|book|box))|launch\s+(?:a\s+|an\s+|my\s+startup|a\s+product)|visit\s+(?:a\s+|the\s+doctor|the\s+hospital)|go\s+to\s+(?:sleep|bed|work|school|home|hell|the\s+(?:gym|store|doctor)))/i.test(
          lowerNorm
        ));
    if (!looksLikeProse) {
      target = candidate;
      matchedRule = 'open_website_en';
    }
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

  // Hindi/Hinglish suffixes: "गूगल खोलो", "यूट्यूब खोलो", "इंस्टाग्राम खोल दो", "YouTube kholo", "Flipkart open karo", "GitHub khol do", "Instagram chalao", "Amazon website kholo"
  if (!target) {
    const indicOpenMatch = normalized.match(
      /^(.+?)\s+(?:kholo|khol\s+do|open\s+karo|open\s+kar\s+do|chalao|chala\s+do|खोलो|खोल\s+दो|ओपन\s+करो|ओपन\s+कर\s+दो)$/iu
    );
    if (indicOpenMatch) {
      const candidate = indicOpenMatch[1].trim();
      if (/(?:chalao|chala\s+do)$/iu.test(normalized)) {
        if (
          findBuiltInWebsite(candidate) ||
          normalizeSpokenDomain(candidate) ||
          /website|site/i.test(candidate)
        ) {
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
  const engSearch = normalized.match(
    /^(?:search\s+(?:google\s+|the\s+web\s+|web\s+|online\s+)?(?:for\s+)?|google\s+(?:search\s+)?(?:for\s+))(.+)$/i
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

  // Conversational "Google <query>" only when NOT about Google products/comparisons
  const bareGoogle = normalized.match(/^google\s+(.+)$/i);
  if (bareGoogle && bareGoogle[1].trim()) {
    const q = bareGoogle[1].trim();
    const isAboutGoogleEntity =
      /^(?:is|was|are|were|has|have|had|vs\.?|versus|and|or|cloud|gemini|android|chrome|pixel|workspace|maps|drive|docs|sheets|gmail|youtube|play|pay|ads|analytics|api|ai|stock|ceo|founded|history|price|pricing|interview|salary|careers)\b/i.test(
        q
      );
    if (!isAboutGoogleEntity) {
      return {
        intent: 'SEARCH_WEB',
        rawText,
        normalizedText: normalized,
        query: q,
        confidence: 0.88,
        matchedRule: 'search_web_google_bare',
      };
    }
  }

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
      'SEARCH_YOUTUBE',
      'SELECT_MEDIA_INDEX',
      'PLAY_DIFFERENT',
      'TOGGLE_FULLSCREEN',
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

    // Priority 2 & 3: YouTube Search, Play song / playlist & Play video
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

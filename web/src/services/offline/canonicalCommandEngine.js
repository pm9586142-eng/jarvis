/**
 * Shared Canonical Offline Command Engine (Web + Android specification parity).
 * Executes deterministically without network or LLM weights across English, Hindi, and Hinglish.
 */

const AM_PREFIX_REGEX =
  /^(?:(?:hey|ok|okay|hi|hello)\s+)?(?:am\s+ai|a\.?\s*m\.?\s*ai|am|jarvis|ए\s*एम\s*ए\s*आई|जार्विस)[,:\s-]+/iu;

export function parseCanonicalOfflineCommand(rawText) {
  const original = String(rawText || '').trim();
  if (!original) return null;
  const cleaned = original.replace(AM_PREFIX_REGEX, '').trim();
  const lower = cleaned.toLowerCase();

  // 1. Time / Date queries
  if (
    /^(?:what\s+time\s+is\s+it|current\s+time|tell\s+me\s+the\s+time|samay\s+kya\s+hua|kitne\s+baje|टाइम\s+क्या\s+हुआ|समय\s+बताओ)/iu.test(
      cleaned
    )
  ) {
    return {
      intent: 'QUERY_TIME',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  if (
    /^(?:what(?:'s| is)\s+today(?:'s)?\s+date|current\s+date|aaj\s+kya\s+tarikh|आज\s+क्या\s+तारीख)/iu.test(
      cleaned
    )
  ) {
    return {
      intent: 'QUERY_DATE',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  // 2. Signature Protocols
  if (/^(?:good\s+morning|suprabhat|सुप्रभात|run\s+good\s+morning\s+protocol)$/iu.test(cleaned)) {
    return {
      intent: 'RUN_PROTOCOL',
      protocol: 'GOOD_MORNING',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }
  if (/^(?:focus\s+mode|start\s+focus|enable\s+focus\s+mode|फोकस\s+मोड)$/iu.test(cleaned)) {
    return {
      intent: 'RUN_PROTOCOL',
      protocol: 'FOCUS',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }
  if (/^(?:diagnostics|run\s+diagnostics|system\s+check|system\s+status|offline\s+status|डायग्नोस्टिक्स)$/iu.test(cleaned)) {
    return {
      intent: 'RUN_PROTOCOL',
      protocol: 'DIAGNOSTICS',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }
  if (/^(?:standby|standby\s+mode|sleep\s+mode|go\s+to\s+standby|स्टैंडबाय)$/iu.test(cleaned)) {
    return {
      intent: 'RUN_PROTOCOL',
      protocol: 'STANDBY',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  // 3. Task creation / listing
  const addTaskMatch = cleaned.match(
    /^(?:add\s+task|create\s+task|new\s+task|remind\s+me\s+to|task\s+jodo|naya\s+task|टास्क\s+जोड़ो|रिमाइंडर\s+लगाओ)\s*[:,-]?\s*(.+)$/iu
  );
  if (addTaskMatch && addTaskMatch[1]?.trim()) {
    return {
      intent: 'CREATE_TASK',
      title: addTaskMatch[1].trim(),
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  if (/^(?:list\s+tasks|show\s+(?:my\s+)?tasks|pending\s+tasks|mere\s+tasks|टास्क\s+दिखाओ)$/iu.test(cleaned)) {
    return {
      intent: 'LIST_TASKS',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  // 4. Note creation / listing / search
  const addNoteMatch = cleaned.match(
    /^(?:save\s+note|create\s+note|add\s+note|take\s+a?\s*note|note\s+banao|naya\s+note|नोट\s+बनाओ|नोट\s+सेव\s+करो)\s*[:,-]?\s*(.+)$/iu
  );
  if (addNoteMatch && addNoteMatch[1]?.trim()) {
    const body = addNoteMatch[1].trim();
    const firstSentence = body.split(/[.!?\n]/)[0]?.trim() || body;
    return {
      intent: 'CREATE_NOTE',
      title: firstSentence.slice(0, 48),
      content: body,
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  if (/^(?:list\s+notes|show\s+(?:my\s+)?notes|mere\s+notes|नोट्स\s+दिखाओ)$/iu.test(cleaned)) {
    return {
      intent: 'LIST_NOTES',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  // 5. Memory save / list
  const memMatch = cleaned.match(
    /^(?:remember\s+that|remember|yaad\s+rakho|save\s+memory|मेमोरी\s+सेव\s+करो|याद\s+रखो)\s*[:,-]?\s*(.+)$/iu
  );
  if (memMatch && memMatch[1]?.trim()) {
    return {
      intent: 'SAVE_MEMORY',
      content: memMatch[1].trim(),
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  if (/^(?:show\s+(?:my\s+)?memor(?:y|ies)|open\s+memory\s+vault|मेमोरी\s+दिखाओ)$/iu.test(cleaned)) {
    return {
      intent: 'OPEN_SCREEN',
      screen: 'memory',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  // 6. Full Ecosystem Screen Navigation
  const navMatch = cleaned.match(
    /^(?:open|go\s+to|show|switch\s+to|launch|kholo|खोलो)\s+([a-z0-9\s_-]+)$/iu
  );
  if (navMatch && navMatch[1]) {
    const target = navMatch[1].trim().toLowerCase();
    const map = [
      { keys: ['home', 'dashboard', 'command center'], screen: 'dashboard' },
      { keys: ['chat', 'ai chat', 'neural chat'], screen: 'chat' },
      { keys: ['voice', 'voice assistant', 'voice hud', 'voice matrix'], screen: 'voice' },
      { keys: ['youtube', 'media', 'media control', 'media player', 'media hud'], screen: 'media_control', section: 'youtube' },
      { keys: ['browser', 'web', 'websites'], screen: 'media_control', section: 'browser' },
      { keys: ['memory', 'memory vault', 'vault'], screen: 'memory' },
      { keys: ['tasks', 'reminders', 'planner', 'productivity'], screen: 'productivity', tab: 'tasks' },
      { keys: ['notes', 'notes vault'], screen: 'productivity', tab: 'notes' },
      { keys: ['settings', 'preferences', 'models', 'local models'], screen: 'settings' },
      { keys: ['research', 'research studio'], screen: 'research' },
      { keys: ['automation', 'automation hub'], screen: 'automation' },
      { keys: ['security', 'security audit', 'stark security'], screen: 'security' },
      { keys: ['brain center', 'multi ai', 'multi ai brain', 'control center'], screen: 'brain_center' },
      { keys: ['multi agent', 'agents'], screen: 'multi_agent' },
      { keys: ['telemetry', 'system telemetry'], screen: 'telemetry' },
      { keys: ['plugins', 'plugin'], screen: 'plugins' },
      { keys: ['insights'], screen: 'insights' },
      { keys: ['smart home'], screen: 'smart_home' },
      { keys: ['vision', 'vision scanner'], screen: 'vision' },
      { keys: ['music studio'], screen: 'music_studio' },
      { keys: ['orbital', 'orbital game'], screen: 'orbital_game' },
      { keys: ['ultron', 'ultron assistant', 'ultron hologram'], screen: 'ultron' },
      { keys: ['openjarvis', 'open jarvis', 'openjarvis core'], screen: 'openjarvis' },
    ];
    for (const entry of map) {
      if (entry.keys.includes(target)) {
        return {
          intent: 'OPEN_SCREEN',
          screen: entry.screen,
          section: entry.section,
          tab: entry.tab,
          engine: 'Offline Command Engine',
          rawText: original,
        };
      }
    }
  }

  // Fallback check if phrase directly ends with kholo/open without prefix
  if (/\b(?:settings|models)\b.*\b(?:kholo|open)\b|\b(?:kholo|open)\b.*\b(?:settings|models)\b/i.test(lower)) {
    return {
      intent: 'OPEN_SCREEN',
      screen: 'settings',
      engine: 'Offline Command Engine',
      rawText: original,
    };
  }

  return null;
}

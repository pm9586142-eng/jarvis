/**
 * ULTRON AI Holographic Command & Shape Transformation Parser
 * Supports English, Hindi (Devanagari), and Hinglish commands.
 */

export const ULTRON_SHAPE_ORDER = [
  'sphere',
  'icosahedron',
  'octahedron',
  'torus_knot',
  'helix',
];

export const ULTRON_SHAPE_LABELS = {
  sphere: 'Lattice Sphere Core',
  icosahedron: 'Geodesic Neural Armor',
  octahedron: 'Quantum Prism Octahedron',
  torus_knot: 'Arc Torus Reactor',
  helix: 'Synaptic Helix Matrix',
};

export function getNextUltronShape(currentShape) {
  const idx = ULTRON_SHAPE_ORDER.indexOf(currentShape);
  if (idx === -1) return ULTRON_SHAPE_ORDER[0];
  return ULTRON_SHAPE_ORDER[(idx + 1) % ULTRON_SHAPE_ORDER.length];
}

function normalizeUltronText(rawText) {
  return String(rawText || '')
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/[।|]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses ULTRON holographic UI & shape transformation commands.
 * Returns null if the utterance should fall through to general command/AI handling.
 */
export function parseUltronVoiceCommand(rawText) {
  const n = normalizeUltronText(rawText);
  if (!n) return null;

  // Strip optional leading "hey ultron" / "ultron" if caller passed full transcript
  const cleaned = n
    .replace(
      /^(?:(?:hey|ok|okay|hi|hello|yo|अरे|हे|हेलो|ओके)\s+)?(?:ultron|अल्ट्रॉन)\s*/iu,
      ''
    )
    .trim();

  // Bare wake word only ("hey ultron" / "ultron")
  if (!cleaned && /(?:ultron|अल्ट्रॉन)/iu.test(n)) {
    return { type: 'OPEN_ASSISTANT_MODE' };
  }

  const target = cleaned || n;

  // 1. Open Assistant Mode
  if (
    /^(?:open|activate|launch|start|enter|show)\s+(?:the\s+)?(?:ultron\s+)?assistant(?:\s+mode)?$/i.test(
      target
    ) ||
    /^(?:open|launch|show)\s+ultron(?:\s+mode|\s+hologram)?$/i.test(target) ||
    target === 'assistant mode' ||
    target === 'असिस्टेंट मोड खोलो' ||
    target === 'अल्ट्रॉन खोलो'
  ) {
    return { type: 'OPEN_ASSISTANT_MODE' };
  }

  // 2. Start Listening / Stop Listening
  if (
    target === 'start listening' ||
    target === 'listen to me' ||
    target === 'activate microphone' ||
    target === 'turn on microphone' ||
    target === 'सुनना शुरू करो' ||
    target === 'sunna shuru karo'
  ) {
    return { type: 'START_LISTENING' };
  }

  if (
    target === 'stop listening' ||
    target === 'mute microphone' ||
    target === 'turn off microphone' ||
    target === 'सुनना बंद करो' ||
    target === 'sunna band karo'
  ) {
    return { type: 'STOP_LISTENING' };
  }

  // 3. Explicit Specific Shape Selection
  if (/(?:sphere|orb|globe)\s+(?:shape|form|mode)/i.test(target)) {
    return { type: 'SET_SHAPE', shape: 'sphere' };
  }
  if (/(?:icosahedron|geodesic|armor)\s*(?:shape|form|mode)?/i.test(target) && target.includes('shape')) {
    return { type: 'SET_SHAPE', shape: 'icosahedron' };
  }
  if (/(?:octahedron|crystal|prism)\s*(?:shape|form|mode)?/i.test(target) && target.includes('shape')) {
    return { type: 'SET_SHAPE', shape: 'octahedron' };
  }
  if (/(?:torus|reactor|ring)\s*(?:shape|form|mode)?/i.test(target) && target.includes('shape')) {
    return { type: 'SET_SHAPE', shape: 'torus_knot' };
  }
  if (/(?:helix|spiral|dna)\s*(?:shape|form|mode)?/i.test(target) && target.includes('shape')) {
    return { type: 'SET_SHAPE', shape: 'helix' };
  }

  // 4. Dynamic Shape Cycling ("Change your shape")
  if (
    /\b(?:change|switch|transform|morph|cycle|alter|next)\s+(?:your\s+|the\s+)?(?:shape|form|geometry|avatar)\b/i.test(
      target
    ) ||
    target === 'shape badlo' ||
    target.includes('आकार बदलो') ||
    target.includes('शेप बदलो')
  ) {
    return { type: 'CYCLE_SHAPE' };
  }

  // 5. Hologram Mode ("Activate hologram mode")
  if (
    /\b(?:activate|enter|enable|switch\s+to|turn\s+on|open)?\s*hologram\s*(?:mode|form|projection)?\b/i.test(
      target
    ) ||
    target.includes('होलोग्राम मोड')
  ) {
    return { type: 'SET_MODE', mode: 'hologram' };
  }

  // 6. Energy Mode ("Activate energy mode")
  if (
    /\b(?:activate|enter|enable|switch\s+to|turn\s+on|open)?\s*energy\s*(?:core\s*)?(?:mode|form)?\b/i.test(
      target
    ) ||
    target.includes('एनर्जी मोड')
  ) {
    return { type: 'SET_MODE', mode: 'energy' };
  }

  // 7. Thinking Mode ("Enter thinking mode")
  if (
    /\b(?:enter|activate|enable|switch\s+to|turn\s+on)?\s*thinking\s*(?:mode|state)?\b/i.test(
      target
    ) ||
    target.includes('थिंकिंग मोड')
  ) {
    return { type: 'SET_MODE', mode: 'thinking' };
  }

  // 8. Return to Normal Mode ("Return to normal mode")
  if (
    /\b(?:return\s+to|back\s+to|reset\s+to|activate|enter|switch\s+to)?\s*(?:normal|default|standard|balanced)\s*(?:mode|state)?\b/i.test(
      target
    ) ||
    target === 'reset shape' ||
    target.includes('नॉर्मल मोड')
  ) {
    return { type: 'SET_MODE', mode: 'normal' };
  }

  return null;
}

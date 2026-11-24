/**
 * Pure real-event Shared AI State & Theme Preset helpers.
 * Zero random timers or synthetic animations: every state transition is
 * derived from real microphone, AI request, and speech synthesis events.
 */

export const HUD_THEME_PRESETS = {
  cosmic: {
    id: 'cosmic',
    label: 'Cosmic Default',
    shortLabel: 'COSMIC',
    themeMode: 'dark',
    accentTheme: 'cyan',
    bgHex: '#02050B',
    primaryHex: '#00E5FF',
    secondaryHex: '#2F8BFF',
    particleHex: '#7DEEFF',
    description: 'Deep Cosmic Space (#02050B) with Neon Cyan & Electric Blue',
  },
  arc_cyan: {
    id: 'arc_cyan',
    label: 'Arc Cyan',
    shortLabel: 'ARC CYAN',
    themeMode: 'dark',
    accentTheme: 'cyan',
    bgHex: '#010A14',
    primaryHex: '#22D3EE',
    secondaryHex: '#0EA5E9',
    particleHex: '#A5F3FC',
    description: 'High-luminance Arc Reactor Cyan holographic grid',
  },
  stark_gold: {
    id: 'stark_gold',
    label: 'Stark Gold',
    shortLabel: 'STARK GOLD',
    themeMode: 'dark',
    accentTheme: 'amber',
    bgHex: '#090602',
    primaryHex: '#FFB020',
    secondaryHex: '#F59E0B',
    particleHex: '#FDE68A',
    description: 'Warm Stark Amber & Gold holographic command matrix',
  },
  light_hud: {
    id: 'light_hud',
    label: 'Light HUD',
    shortLabel: 'LIGHT HUD',
    themeMode: 'light',
    accentTheme: 'cyan',
    bgHex: '#F3F7FD',
    primaryHex: '#0057B8',
    secondaryHex: '#1D4ED8',
    particleHex: '#0284C7',
    description: 'High-contrast Ceramic Cobalt Daylight HUD',
  },
};

export const HUD_THEME_PRESET_LIST = Object.values(HUD_THEME_PRESETS);

/**
 * Derives the canonical Shared AI State from real runtime event booleans.
 * Priority when events overlap: speaking > listening > thinking > idle.
 * @param {object} flags
 * @param {boolean} [flags.isSpeaking]
 * @param {boolean} [flags.isSpeechPaused]
 * @param {boolean} [flags.isListening]
 * @param {boolean} [flags.isThinking]
 * @returns {'idle' | 'listening' | 'thinking' | 'speaking'}
 */
export function deriveSharedAiState(flags = {}) {
  const {
    isSpeaking = false,
    isSpeechPaused = false,
    isListening = false,
    isThinking = false,
  } = flags;

  if (isSpeaking && !isSpeechPaused) return 'speaking';
  if (isListening) return 'listening';
  if (isThinking) return 'thinking';
  return 'idle';
}

export function getSharedAiStateMeta(aiState) {
  switch (aiState) {
    case 'listening':
      return {
        state: 'listening',
        label: 'LISTENING',
        detail: 'Microphone stream active',
        badgeTone: 'cyan',
      };
    case 'thinking':
      return {
        state: 'thinking',
        label: 'THINKING',
        detail: 'Processing neural request',
        badgeTone: 'blue',
      };
    case 'speaking':
      return {
        state: 'speaking',
        label: 'SPEAKING',
        detail: 'Vocal synthesis active',
        badgeTone: 'emerald',
      };
    case 'idle':
    default:
      return {
        state: 'idle',
        label: 'IDLE',
        detail: 'Systems calm & ready',
        badgeTone: 'slate',
      };
  }
}

export function resolveHudThemePreset(presetId, themeMode = 'dark', accentTheme = 'cyan') {
  if (presetId && Object.prototype.hasOwnProperty.call(HUD_THEME_PRESETS, presetId)) {
    return HUD_THEME_PRESETS[presetId];
  }
  if (themeMode === 'light') {
    return HUD_THEME_PRESETS.light_hud;
  }
  if (accentTheme === 'amber') {
    return HUD_THEME_PRESETS.stark_gold;
  }
  return HUD_THEME_PRESETS.cosmic;
}

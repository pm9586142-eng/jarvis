import { AccentThemeId, HudThemePresetId, SharedAiState, ThemeMode } from '../types/jarvis';

export interface HudThemePresetDescriptor {
  id: HudThemePresetId;
  label: string;
  shortLabel: string;
  themeMode: ThemeMode;
  accentTheme: AccentThemeId;
  bgHex: string;
  primaryHex: string;
  secondaryHex: string;
  particleHex: string;
  description: string;
}

export declare const HUD_THEME_PRESETS: Record<HudThemePresetId, HudThemePresetDescriptor>;
export declare const HUD_THEME_PRESET_LIST: HudThemePresetDescriptor[];

export declare function deriveSharedAiState(flags?: {
  isSpeaking?: boolean;
  isSpeechPaused?: boolean;
  isListening?: boolean;
  isThinking?: boolean;
}): SharedAiState;

export declare function getSharedAiStateMeta(aiState: SharedAiState): {
  state: SharedAiState;
  label: string;
  detail: string;
  badgeTone: 'cyan' | 'blue' | 'emerald' | 'slate';
};

export declare function resolveHudThemePreset(
  presetId?: HudThemePresetId,
  themeMode?: ThemeMode,
  accentTheme?: AccentThemeId
): HudThemePresetDescriptor;

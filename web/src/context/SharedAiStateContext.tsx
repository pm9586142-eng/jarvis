import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  deriveSharedAiState,
  getSharedAiStateMeta,
  HudThemePresetDescriptor,
  resolveHudThemePreset,
} from '../services/sharedAiState.js';
import { AccentThemeId, HudThemePresetId, SharedAiState, ThemeMode } from '../types/jarvis';

export interface SharedAiStateValue {
  aiState: SharedAiState;
  stateLabel: string;
  stateDetail: string;
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  lastTransitionAt: number;
  reducedMotion: boolean;
  themePreset: HudThemePresetDescriptor;
}

const DEFAULT_VALUE: SharedAiStateValue = {
  aiState: 'idle',
  stateLabel: 'IDLE',
  stateDetail: 'Systems calm & ready',
  isListening: false,
  isThinking: false,
  isSpeaking: false,
  audioLevel: 0,
  lastTransitionAt: 0,
  reducedMotion: false,
  themePreset: resolveHudThemePreset('cosmic', 'dark', 'cyan'),
};

const SharedAiStateContext = createContext<SharedAiStateValue>(DEFAULT_VALUE);

interface SharedAiStateProviderProps {
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  isSpeechPaused?: boolean;
  audioLevel: number;
  reducedMotion: boolean;
  hudThemePreset?: HudThemePresetId;
  themeMode?: ThemeMode;
  accentTheme?: AccentThemeId;
  children: React.ReactNode;
}

export const SharedAiStateProvider: React.FC<SharedAiStateProviderProps> = ({
  isListening,
  isThinking,
  isSpeaking,
  isSpeechPaused = false,
  audioLevel,
  reducedMotion,
  hudThemePreset = 'cosmic',
  themeMode = 'dark',
  accentTheme = 'cyan',
  children,
}) => {
  const aiState = deriveSharedAiState({
    isSpeaking,
    isSpeechPaused,
    isListening,
    isThinking,
  });

  const [lastTransitionAt, setLastTransitionAt] = useState<number>(() => Date.now());
  const prevStateRef = useRef<SharedAiState>(aiState);

  useEffect(() => {
    if (prevStateRef.current !== aiState) {
      prevStateRef.current = aiState;
      setLastTransitionAt(Date.now());
    }
  }, [aiState]);

  const clampedAudio = aiState === 'idle' ? 0 : Math.max(0, Math.min(1, audioLevel));

  const themePreset = useMemo(
    () => resolveHudThemePreset(hudThemePreset, themeMode, accentTheme),
    [hudThemePreset, themeMode, accentTheme]
  );

  // Sync Shared AI State & Theme Preset onto <html> root so panels, background,
  // hologram, and CSS glassmorphism share one synchronized source of truth.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-ai-state', aiState);
    root.setAttribute('data-hud-theme', themePreset.id);
    root.style.setProperty('--am-ai-energy', clampedAudio.toFixed(3));
  }, [aiState, clampedAudio, themePreset.id]);

  const value = useMemo<SharedAiStateValue>(() => {
    const meta = getSharedAiStateMeta(aiState);
    return {
      aiState,
      stateLabel: meta.label,
      stateDetail: meta.detail,
      isListening: aiState === 'listening',
      isThinking: aiState === 'thinking',
      isSpeaking: aiState === 'speaking',
      audioLevel: clampedAudio,
      lastTransitionAt,
      reducedMotion,
      themePreset,
    };
  }, [aiState, clampedAudio, lastTransitionAt, reducedMotion, themePreset]);

  return (
    <SharedAiStateContext.Provider value={value}>
      {children}
    </SharedAiStateContext.Provider>
  );
};

export function useSharedAiState(): SharedAiStateValue {
  return useContext(SharedAiStateContext);
}

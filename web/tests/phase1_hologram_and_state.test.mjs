import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  deriveSharedAiState,
  getSharedAiStateMeta,
  HUD_THEME_PRESET_LIST,
  HUD_THEME_PRESETS,
  resolveHudThemePreset,
} from '../src/services/sharedAiState.js';

test('Shared AI State System derives idle, listening, thinking, speaking from real events only', () => {
  assert.equal(deriveSharedAiState(), 'idle');
  assert.equal(
    deriveSharedAiState({ isSpeaking: false, isListening: false, isThinking: false }),
    'idle'
  );
  assert.equal(deriveSharedAiState({ isThinking: true }), 'thinking');
  assert.equal(deriveSharedAiState({ isListening: true, isThinking: true }), 'listening');
  assert.equal(
    deriveSharedAiState({ isSpeaking: true, isSpeechPaused: false, isListening: true }),
    'speaking'
  );
  // Paused speech falls back to underlying active state
  assert.equal(
    deriveSharedAiState({ isSpeaking: true, isSpeechPaused: true, isThinking: true }),
    'thinking'
  );
  assert.equal(
    deriveSharedAiState({ isSpeaking: true, isSpeechPaused: true }),
    'idle'
  );

  assert.equal(getSharedAiStateMeta('speaking').label, 'SPEAKING');
  assert.equal(getSharedAiStateMeta('listening').label, 'LISTENING');
  assert.equal(getSharedAiStateMeta('thinking').label, 'THINKING');
  assert.equal(getSharedAiStateMeta('idle').label, 'IDLE');
});

test('Phase 1 HUD Theme Presets preserve Cosmic Default (#02050B) and expose Arc Cyan, Stark Gold, and Light HUD', () => {
  assert.equal(HUD_THEME_PRESET_LIST.length, 4);
  assert.equal(HUD_THEME_PRESETS.cosmic.bgHex, '#02050B');
  assert.equal(HUD_THEME_PRESETS.cosmic.themeMode, 'dark');
  assert.equal(HUD_THEME_PRESETS.arc_cyan.themeMode, 'dark');
  assert.equal(HUD_THEME_PRESETS.stark_gold.themeMode, 'dark');
  assert.equal(HUD_THEME_PRESETS.light_hud.themeMode, 'light');

  assert.equal(resolveHudThemePreset('stark_gold').id, 'stark_gold');
  assert.equal(resolveHudThemePreset(undefined, 'light', 'cyan').id, 'light_hud');
  assert.equal(resolveHudThemePreset(undefined, 'dark', 'amber').id, 'stark_gold');
  assert.equal(resolveHudThemePreset(undefined, 'dark', 'cyan').id, 'cosmic');
});

test('Phase 1 preserves existing DashboardView AMReactor, QuantumCoreCanvas, and adds HologramSphere3D', () => {
  const dashboardSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/views/DashboardView.tsx'),
    'utf8'
  );
  assert.match(dashboardSrc, /HologramSphere3D/);
  assert.match(dashboardSrc, /AMReactor/);
  assert.match(dashboardSrc, /QuantumCoreCanvas/);
  assert.match(dashboardSrc, /core-mode-3d-btn/);
  assert.match(dashboardSrc, /core-mode-reactor-btn/);

  const hologramSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/HologramSphere3D.tsx'),
    'utf8'
  );
  assert.match(hologramSrc, /IcosahedronGeometry/);
  assert.match(hologramSrc, /TorusGeometry/);
  assert.match(hologramSrc, /PointsMaterial/);
  assert.match(hologramSrc, /onPointerMove/);
});

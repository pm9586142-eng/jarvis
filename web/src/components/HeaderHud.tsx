import React from 'react';
import { Battery, Globe, Menu, RefreshCw, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { JARVIS_LANGUAGES } from '../data/agents';
import { BrowserTelemetry, ConnectionState, LanguageCode } from '../types/jarvis';
import { GlobalAudioVisualizer } from './GlobalAudioVisualizer';

interface HeaderHudProps {
  title: string;
  subtitle: string;
  connectionState: ConnectionState;
  telemetry: BrowserTelemetry;
  language: LanguageCode;
  reducedMotion: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  onStopAudio?: () => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onToggleReducedMotion: () => void;
  onRetryConnection: () => void;
  onOpenMenu: () => void;
}

export const HeaderHud: React.FC<HeaderHudProps> = ({
  title,
  subtitle,
  connectionState,
  telemetry,
  language,
  reducedMotion,
  isListening,
  isSpeaking,
  audioLevel,
  onStopAudio,
  onLanguageChange,
  onToggleReducedMotion,
  onRetryConnection,
  onOpenMenu,
}) => {
  const statusMeta: Record<ConnectionState, { label: string; badgeClass: string }> = {
    online: {
      label: 'Online • Gemini Ready',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    },
    connecting: {
      label: 'Connecting...',
      badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    },
    key_missing: {
      label: 'Key Missing',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    },
    offline: {
      label: 'Backend Offline',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    },
  };

  const status = statusMeta[connectionState];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#02040A]/90 backdrop-blur-md px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 rounded-lg border border-slate-800 bg-[#0D1527] text-cyan-300 hover:border-cyan-400 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-semibold tracking-wider text-slate-100 truncate">
              {title}
            </h2>
            <p className="font-mono-hud text-[11px] text-cyan-300 truncate">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Global Audio Visualizer (appears when AI is speaking or listening) */}
          <GlobalAudioVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            reducedMotion={reducedMotion}
            onStop={onStopAudio}
          />
          {/* Connection Status Pill */}
          <button
            type="button"
            onClick={onRetryConnection}
            title="Click to re-check backend & Gemini status"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono-hud text-[11px] cursor-pointer transition-opacity hover:opacity-90 ${status.badgeClass}`}
          >
            {connectionState === 'offline' ? (
              <WifiOff className="w-3.5 h-3.5" />
            ) : connectionState === 'connecting' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wifi className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{status.label}</span>
          </button>

          {/* Battery (when browser supports Battery API) */}
          {telemetry.batteryPercent !== null && (
            <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0D1527] border border-slate-800 font-mono-hud text-[11px] text-slate-300">
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span>{telemetry.batteryPercent}%</span>
            </div>
          )}

          {/* Reduced Motion Quick Toggle */}
          <button
            type="button"
            onClick={onToggleReducedMotion}
            title={reducedMotion ? 'Enable Full Cosmic Motion' : 'Enable Reduced Motion'}
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono-hud text-[11px] cursor-pointer ${
              reducedMotion
                ? 'bg-violet-500/20 border-violet-400/50 text-violet-200'
                : 'bg-[#0D1527] border-slate-800 text-slate-300 hover:border-cyan-500/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{reducedMotion ? 'MIN MOTION' : '3D MOTION'}</span>
          </button>

          {/* Language Selector */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0D1527] border border-slate-800">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <select
              aria-label="Select JARVIS language"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
              className="bg-transparent font-mono-hud text-[11px] text-cyan-200 focus:outline-none cursor-pointer"
            >
              {Object.values(JARVIS_LANGUAGES).map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#070D18] text-slate-100">
                  {lang.shortCode} - {lang.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};

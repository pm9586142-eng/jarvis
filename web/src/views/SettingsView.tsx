import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Lock,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import { JARVIS_LANGUAGES } from '../data/agents';
import { API_BASE_URL } from '../services/api';
import { BackendHealth, ConnectionState, JarvisSettings, LanguageCode } from '../types/jarvis';

interface SettingsViewProps {
  settings: JarvisSettings;
  language: LanguageCode;
  connectionState: ConnectionState;
  backendHealth: BackendHealth | null;
  onUpdateSettings: (next: JarvisSettings) => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onRetryConnection: () => void;
  onClearAllChats: () => void;
  onResetAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  language,
  connectionState,
  backendHealth,
  onUpdateSettings,
  onLanguageChange,
  onRetryConnection,
  onClearAllChats,
  onResetAllData,
}) => {
  const [pinDraft, setPinDraft] = useState(settings.userPin);
  const [pinSaved, setPinSaved] = useState(false);
  const [pinValidationError, setPinValidationError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinDraft.trim();
    if (!/^\d{4,8}$/.test(cleaned)) {
      setPinValidationError('Master PIN must contain 4 to 8 numeric digits.');
      setPinSaved(false);
      return;
    }
    setPinValidationError(null);
    onUpdateSettings({ ...settings, userPin: cleaned });
    setPinSaved(true);
    window.setTimeout(() => setPinSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Backend & Gemini Diagnostics */}
      <div className="glass-panel rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-300" />
            <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
              BACKEND & GEMINI ENGINE HEALTH
            </h3>
          </div>
          <button
            type="button"
            onClick={onRetryConnection}
            className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 font-mono-hud text-xs text-cyan-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>PING /HEALTH</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono-hud text-xs">
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400">CONNECTION STATE</p>
            <p className="text-slate-100 font-bold mt-1 uppercase">{connectionState}</p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400">GEMINI API KEY (SERVER)</p>
            <p
              className={`font-bold mt-1 ${
                backendHealth?.geminiConfigured ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {backendHealth ? (backendHealth.geminiConfigured ? 'CONFIGURED' : 'NOT SET') : 'UNKNOWN'}
            </p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400">ACTIVE MODEL</p>
            <p className="text-cyan-300 font-bold mt-1">{backendHealth?.model || 'gemini-2.5-flash'}</p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400">API ENDPOINT TARGET</p>
            <p className="text-slate-200 font-bold mt-1 truncate">
              {API_BASE_URL || 'Same-Origin / Vite Proxy'}
            </p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="glass-panel rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-cyan-300" />
          <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            INTERFACE & INTELLIGENCE PREFERENCES
          </h3>
        </div>

        {/* Language */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-sky-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Primary Assistant Language</p>
              <p className="text-xs text-slate-400">Controls Gemini persona prompts, STT, and TTS locale</p>
            </div>
          </div>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
            aria-label="Primary language"
            className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
          >
            {Object.values(JARVIS_LANGUAGES).map((l) => (
              <option key={l.code} value={l.code}>
                {l.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Reduced Motion */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-violet-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Reduced Motion Mode</p>
              <p className="text-xs text-slate-400">Slows Quantum Core rotation and disables pulse animations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, reducedMotion: !settings.reducedMotion })}
            className={`px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold border cursor-pointer ${
              settings.reducedMotion
                ? 'bg-violet-500/20 border-violet-400 text-violet-200'
                : 'bg-[#040812] border-slate-700 text-slate-300'
            }`}
          >
            {settings.reducedMotion ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Auto Speak */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-cyan-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Auto-Speak Gemini Replies</p>
              <p className="text-xs text-slate-400">Automatically read completed AI replies aloud via Web Speech</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ ...settings, autoSpeakReplies: !settings.autoSpeakReplies })
            }
            className={`px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold border cursor-pointer ${
              settings.autoSpeakReplies
                ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                : 'bg-[#040812] border-slate-700 text-slate-300'
            }`}
          >
            {settings.autoSpeakReplies ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Web Grounding */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Default Google Search Grounding</p>
              <p className="text-xs text-slate-400">Include live web citations in Gemini chat responses</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ ...settings, webSearchEnabled: !settings.webSearchEnabled })
            }
            className={`px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold border cursor-pointer ${
              settings.webSearchEnabled
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-[#040812] border-slate-700 text-slate-300'
            }`}
          >
            {settings.webSearchEnabled ? 'ENABLED' : 'OFF'}
          </button>
        </div>
      </div>

      {/* PIN & Data Controls */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-300" />
          <h3 className="font-mono-hud text-xs font-bold text-amber-300 tracking-wider">
            SECURITY PIN & LOCAL SESSION VAULT
          </h3>
        </div>

        <form onSubmit={handleSavePin} className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="password"
              inputMode="numeric"
              value={pinDraft}
              onChange={(e) => {
                setPinDraft(e.target.value);
                if (pinValidationError) setPinValidationError(null);
              }}
              placeholder="4-8 digit PIN"
              className="bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 font-mono-hud text-xs text-slate-100 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold cursor-pointer"
            >
              UPDATE MASTER PIN
            </button>
            {pinSaved && (
              <span className="flex items-center gap-1 font-mono-hud text-xs text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                PIN Saved
              </span>
            )}
          </div>
          {pinValidationError && (
            <p className="flex items-center gap-1.5 font-mono-hud text-xs text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{pinValidationError}</span>
            </p>
          )}
        </form>

        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">Clear local chat conversation history stored in this browser.</p>
          <button
            type="button"
            onClick={onClearAllChats}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 hover:bg-rose-500/25 font-mono-hud text-xs text-rose-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>CLEAR CHAT HISTORY</span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Restore default JARVIS memories, tasks, smart devices, and security settings.
          </p>
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetAllData();
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-mono-hud text-xs font-bold cursor-pointer"
              >
                CONFIRM FULL RESET
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 rounded-xl border border-slate-700 font-mono-hud text-xs text-slate-300 cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="px-3.5 py-2 rounded-xl bg-[#040812] border border-slate-700 hover:border-amber-400/60 font-mono-hud text-xs text-amber-300 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET LOCAL VAULT</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

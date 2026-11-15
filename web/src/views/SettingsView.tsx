import React, { useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Database,
  Globe,
  Lock,
  Palette,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import { AGENT_LIST, JARVIS_LANGUAGES } from '../data/agents';
import { API_BASE_URL } from '../services/api';
import {
  AccentThemeId,
  AgentId,
  BackendHealth,
  ConnectionState,
  JarvisSettings,
  LanguageCode,
} from '../types/jarvis';

const ACCENT_OPTIONS: Array<{ id: AccentThemeId; label: string; hex: string }> = [
  { id: 'cyan', label: 'Arc Cyan', hex: '#00F0FF' },
  { id: 'violet', label: 'Synaptic Violet', hex: '#A78BFA' },
  { id: 'emerald', label: 'Sentinel Emerald', hex: '#10B981' },
  { id: 'amber', label: 'Mark Gold', hex: '#FBBF24' },
  { id: 'rose', label: 'Defense Crimson', hex: '#F43F5E' },
];

interface SettingsViewProps {
  settings: JarvisSettings;
  language: LanguageCode;
  memoriesCount: number;
  connectionState: ConnectionState;
  backendHealth: BackendHealth | null;
  onUpdateSettings: (next: JarvisSettings) => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onTestVoice: () => void;
  onRetryConnection: () => void;
  onClearAllMemories: () => void;
  onClearAllChats: () => void;
  onResetAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  language,
  memoriesCount,
  connectionState,
  backendHealth,
  onUpdateSettings,
  onLanguageChange,
  onTestVoice,
  onRetryConnection,
  onClearAllMemories,
  onClearAllChats,
  onResetAllData,
}) => {
  const [pinDraft, setPinDraft] = useState(settings.userPin);
  const [pinSaved, setPinSaved] = useState(false);
  const [pinValidationError, setPinValidationError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);

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

  const triggerNotice = (msg: string) => {
    setVaultNotice(msg);
    window.setTimeout(() => setVaultNotice(null), 2600);
  };

  return (
    <div className="space-y-6">
      {vaultNotice && (
        <div className="glass-panel rounded-xl px-4 py-2.5 border border-emerald-400/50 bg-emerald-500/15 flex items-center gap-2 font-mono-hud text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{vaultNotice}</span>
        </div>
      )}

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

        {/* Default Agent */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Bot className="w-4 h-4 text-cyan-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Default Neural Agent</p>
              <p className="text-xs text-slate-400">Initializes new sessions and handles unrouted directives</p>
            </div>
          </div>
          <select
            value={settings.defaultAgent}
            onChange={(e) =>
              onUpdateSettings({ ...settings, defaultAgent: e.target.value as AgentId })
            }
            aria-label="Default neural agent"
            className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
          >
            {AGENT_LIST.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.codename} — {ag.designation}
              </option>
            ))}
          </select>
        </div>

        {/* Speech Rate & Pitch */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-cyan-300" />
              <div>
                <p className="text-sm font-semibold text-slate-100">Speech Rate & Pitch Calibration</p>
                <p className="text-xs text-slate-400">Fine-tune Web Speech synthesis cadence</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onTestVoice}
              className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-cyan-500/40 hover:border-cyan-400 font-mono-hud text-xs text-cyan-300 cursor-pointer"
            >
              TEST VOICE
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <div className="flex justify-between font-mono-hud text-xs text-slate-300">
                <span>Speech Rate</span>
                <span className="text-cyan-300">{settings.speechRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.05}
                value={settings.speechRate}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, speechRate: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="block space-y-1.5">
              <div className="flex justify-between font-mono-hud text-xs text-slate-300">
                <span>Speech Pitch</span>
                <span className="text-cyan-300">{settings.speechPitch.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.05}
                value={settings.speechPitch}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, speechPitch: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Theme Accent Color */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5">
            <Palette className="w-4 h-4 text-violet-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">HUD Theme Accent Color</p>
              <p className="text-xs text-slate-400">Personalize holographic grid and glow accents</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {ACCENT_OPTIONS.map((opt) => {
              const active = settings.accentTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, accentTheme: opt.id })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-mono-hud text-xs cursor-pointer transition-all ${
                    active
                      ? 'bg-white/10 border-white/60 text-white'
                      : 'bg-[#040812] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: opt.hex }}
                  >
                    {active && <Check className="w-2.5 h-2.5 text-[#02040A]" />}
                  </span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
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

        {/* Auto Memory Extraction */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Automatic Memory Extraction</p>
              <p className="text-xs text-slate-400">Save durable facts and preferences from conversations to Vault</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                ...settings,
                autoExtractMemories: !settings.autoExtractMemories,
              })
            }
            className={`px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold border cursor-pointer ${
              settings.autoExtractMemories
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-[#040812] border-slate-700 text-slate-300'
            }`}
          >
            {settings.autoExtractMemories ? 'ENABLED' : 'OFF'}
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
          <p className="text-xs text-slate-400">Clear all chat sessions stored in this browser.</p>
          <button
            type="button"
            onClick={() => {
              onClearAllChats();
              triggerNotice('All chat sessions cleared.');
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 hover:bg-rose-500/25 font-mono-hud text-xs text-rose-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>CLEAR ALL CHATS</span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Clear all {memoriesCount} saved facts from your local Memory Vault.
          </p>
          <button
            type="button"
            onClick={() => {
              onClearAllMemories();
              triggerNotice('Memory vault cleared.');
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 font-mono-hud text-xs text-amber-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>CLEAR MEMORIES</span>
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
                  triggerNotice('Local vault restored to defaults.');
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

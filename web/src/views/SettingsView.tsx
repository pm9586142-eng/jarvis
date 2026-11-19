import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileCode2,
  FileJson,
  Globe,
  Lock,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { AGENT_LIST, JARVIS_LANGUAGES } from '../data/agents';
import {
  API_BASE_URL,
  getStoredAccessToken,
  setActiveUserNamespace,
  setStoredAccessToken,
} from '../services/api';
import { AvailableVoiceOption, getAvailableVoices } from '../services/voice';
import {
  AccentThemeId,
  AgentId,
  BackendHealth,
  ConnectionState,
  JarvisSettings,
  LanguageCode,
  PersonalityPresetId,
  ReasoningPreference,
  ResponseStyleId,
  ThemeMode,
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
  sessionsCount: number;
  tasksCount: number;
  notesCount?: number;
  connectionState: ConnectionState;
  backendHealth: BackendHealth | null;
  onUpdateSettings: (next: JarvisSettings) => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onTestVoice: () => void;
  onReplayWelcome?: () => void;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
  activeVoiceInfo?: { name: string; lang: string; isFemale: boolean } | null;
  onRetryConnection: () => void;
  onSyncWorkspaceNow?: () => Promise<{ ok: boolean; message: string }>;
  onExportBackup: (format: 'json' | 'md') => void;
  onInspectBackupFile: (rawJson: string, filename: string) => void;
  onClearAllMemories: () => void;
  onClearAllChats: () => void;
  onResetAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  language,
  memoriesCount,
  sessionsCount,
  tasksCount,
  notesCount = 0,
  connectionState,
  backendHealth,
  onUpdateSettings,
  onLanguageChange,
  onTestVoice,
  onReplayWelcome,
  isSpeaking = false,
  onStopSpeaking,
  activeVoiceInfo = null,
  onRetryConnection,
  onSyncWorkspaceNow,
  onExportBackup,
  onInspectBackupFile,
  onClearAllMemories,
  onClearAllChats,
  onResetAllData,
}) => {
  const [pinDraft, setPinDraft] = useState(settings.userPin);
  const [pinSaved, setPinSaved] = useState(false);
  const [pinValidationError, setPinValidationError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);
  const [accessTokenDraft, setAccessTokenDraft] = useState(() => getStoredAccessToken());
  const [namespaceDraft, setNamespaceDraft] = useState(settings.userNamespace || 'default');
  const [customInstructionsDraft, setCustomInstructionsDraft] = useState(
    settings.customInstructions || ''
  );
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [voices, setVoices] = useState<AvailableVoiceOption[]>(() =>
    getAvailableVoices(settings.femaleVoiceEnabled ?? true)
  );
  const [previewAccent, setPreviewAccent] = useState<AccentThemeId | null>(null);
  const savedAccentRef = useRef<AccentThemeId>(settings.accentTheme || 'cyan');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNamespaceDraft(settings.userNamespace || 'default');
  }, [settings.userNamespace]);

  useEffect(() => {
    setCustomInstructionsDraft(settings.customInstructions || '');
  }, [settings.customInstructions]);

  useEffect(() => {
    const refreshVoices = () => setVoices(getAvailableVoices(settings.femaleVoiceEnabled ?? true));
    refreshVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
      return () => {
        window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
      };
    }
  }, [settings.femaleVoiceEnabled]);

  useEffect(() => {
    savedAccentRef.current = settings.accentTheme || 'cyan';
  }, [settings.accentTheme]);

  useEffect(() => {
    const targetAccent = previewAccent ?? settings.accentTheme ?? 'cyan';
    document.documentElement.setAttribute('data-accent', targetAccent);
  }, [previewAccent, settings.accentTheme]);

  useEffect(() => {
    return () => {
      document.documentElement.setAttribute('data-accent', savedAccentRef.current || 'cyan');
    };
  }, []);

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
            <span>PING /API/HEALTH</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono-hud text-xs">
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400">CONNECTION STATE</p>
            <p className="text-slate-100 font-bold mt-1 uppercase">{connectionState}</p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400">FREE AI PROVIDERS (SERVER)</p>
            <p
              className={`font-bold mt-1 ${
                backendHealth?.aiConfigured || backendHealth?.geminiConfigured
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {backendHealth
                ? `${backendHealth.multiProvider?.configuredProviders?.length ?? (backendHealth.geminiConfigured ? 1 : 0)} / 3 CONFIGURED`
                : 'UNKNOWN'}
            </p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400">ACTIVE PROVIDER & MODEL</p>
            <p className="text-cyan-300 font-bold mt-1 truncate">
              {backendHealth?.activeProviderLabel || 'Google Gemini Free'} •{' '}
              {backendHealth?.activeModel || backendHealth?.model || 'gemini-3.8-flash'}
            </p>
          </div>
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400">API ENDPOINT TARGET</p>
            <p className="text-slate-200 font-bold mt-1 truncate">
              {API_BASE_URL || 'Same-Origin / Vite Proxy'}
            </p>
          </div>
        </div>

        {backendHealth?.multiProvider ? (
          <div className="rounded-xl bg-[#040812] border border-cyan-500/25 p-3.5 space-y-3 font-mono-hud">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span className="text-[11px] font-bold text-cyan-200">
                  FREE-ONLY MULTI-PROVIDER AI ROUTER (GEMINI • GROQ • OPENROUTER)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-bold">
                  ₹0 ZERO-COST ENFORCED • PAID BLOCKED
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                  {backendHealth.multiProvider.readyProvidersCount} /{' '}
                  {backendHealth.multiProvider.configuredProviders.length} PROVIDERS READY
                </span>
                {backendHealth.multiProvider.totalFallbackSwitches > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200">
                    {backendHealth.multiProvider.totalFallbackSwitches} AUTO-SWITCH
                    {backendHealth.multiProvider.totalFallbackSwitches === 1 ? '' : 'ES'}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              {backendHealth.multiProvider.providers.map((provider) => {
                const isActiveProvider =
                  provider.id === backendHealth.multiProvider?.activeProvider && provider.configured;
                const badgeCls = !provider.configured
                  ? 'bg-slate-800/80 border-slate-700 text-slate-400'
                  : provider.status === 'ready'
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                    : provider.status === 'cooldown'
                      ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                      : 'bg-rose-500/15 border-rose-400/40 text-rose-200';
                return (
                  <div
                    key={provider.id}
                    className={`rounded-xl bg-[#0D1527]/85 border p-3 space-y-2 ${
                      isActiveProvider ? 'border-cyan-400/60' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-100 truncate">
                        {provider.label}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${badgeCls}`}>
                        {!provider.configured
                          ? 'KEY NOT SET'
                          : provider.status === 'ready'
                            ? `${provider.availableCount}/${provider.totalModels} READY`
                            : provider.status === 'auth_error'
                              ? 'AUTH ERROR'
                              : `COOLDOWN ${provider.cooldownRemainingSeconds}S`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 text-[9px]">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/35 text-emerald-300">
                        {provider.pricingPolicy === 'LIVE_ZERO_PRICE_VERIFIED'
                          ? provider.pricingVerified
                            ? '$0 LIVE PRICING VERIFIED'
                            : '$0 VERIFIED ON CALL'
                          : 'FREE ALLOWLIST ONLY'}
                      </span>
                      {isActiveProvider && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {provider.models.map((entry) => (
                        <div
                          key={`${provider.id}-${entry.model}`}
                          className="flex items-center justify-between gap-1.5 text-[10px] rounded bg-[#040812]/80 px-2 py-1 border border-slate-800/80"
                        >
                          <span className="text-slate-200 truncate">{entry.model}</span>
                          <span
                            className={`text-[9px] shrink-0 ${
                              entry.status === 'available'
                                ? 'text-emerald-300'
                                : entry.status === 'cooldown'
                                  ? 'text-amber-300'
                                  : 'text-rose-300'
                            }`}
                          >
                            {entry.status === 'available'
                              ? 'READY'
                              : entry.status === 'cooldown'
                                ? `${entry.cooldownRemainingSeconds}S`
                                : entry.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          backendHealth?.freeTierFallback && (
            <div className="rounded-xl bg-[#040812] border border-cyan-500/25 p-3.5 space-y-2.5 font-mono-hud">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="text-[11px] font-bold text-cyan-200">
                    SMART FREE GEMINI MODEL FALLBACK POOL
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-bold text-[10px]">
                  FREE TIER ONLY • NO PAID MODELS
                </span>
              </div>
            </div>
          )
        )}

        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={accessTokenDraft}
            onChange={(e) => setAccessTokenDraft(e.target.value)}
            placeholder={
              backendHealth?.authRequired
                ? 'Server APP_ACCESS_TOKEN required — enter Bearer token (session only)'
                : 'Optional server APP_ACCESS_TOKEN (sessionStorage only)'
            }
            aria-label="Server access token"
            className="flex-1 min-w-[220px] bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 font-mono-hud text-xs text-slate-100 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setStoredAccessToken(accessTokenDraft);
              triggerNotice(
                accessTokenDraft.trim()
                  ? 'Access token stored in sessionStorage for this browser tab.'
                  : 'Access token cleared from sessionStorage.'
              );
              onRetryConnection();
            }}
            className="px-3.5 py-2 rounded-xl bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 font-mono-hud text-xs text-cyan-200 cursor-pointer"
          >
            APPLY TOKEN
          </button>
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

        {/* Phase 1: AI Brain Personality, Reasoning & Custom Instructions */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-2.5">
            <Brain className="w-4 h-4 text-violet-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">
                AI Personality, Reasoning Mode & Custom Instructions
              </p>
              <p className="text-xs text-slate-400">
                Customize JARVIS tone, response depth, reasoning mode, and standing personal directives
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block space-y-1.5">
              <span className="font-mono-hud text-[10px] text-slate-400">PERSONALITY PRESET</span>
              <select
                value={settings.personality || 'executive_butler'}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    personality: e.target.value as PersonalityPresetId,
                  })
                }
                aria-label="AI Personality preset"
                className="w-full bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
              >
                <option value="executive_butler">Executive Butler (JARVIS)</option>
                <option value="concise_tactical">Concise Tactical</option>
                <option value="friendly_mentor">Friendly Mentor</option>
                <option value="deep_analyst">Deep Systems Analyst</option>
                <option value="custom">Custom Persona</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="font-mono-hud text-[10px] text-slate-400">RESPONSE STYLE</span>
              <select
                value={settings.responseStyle || 'balanced'}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    responseStyle: e.target.value as ResponseStyleId,
                  })
                }
                aria-label="Response style"
                className="w-full bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
              >
                <option value="concise">Concise & Actionable</option>
                <option value="balanced">Balanced (Default)</option>
                <option value="detailed">Detailed & Comprehensive</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="font-mono-hud text-[10px] text-slate-400">DEFAULT REASONING MODE</span>
              <select
                value={settings.reasoningPreference || 'auto'}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    reasoningPreference: e.target.value as ReasoningPreference,
                  })
                }
                aria-label="Default reasoning mode"
                className="w-full bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
              >
                <option value="auto">Auto (Intent-Adaptive)</option>
                <option value="fast">Fast Direct</option>
                <option value="structured">Structured Step-by-Step</option>
                <option value="deep">Deep Analytical Reasoning</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="font-mono-hud text-[10px] text-slate-400">MULTI-AI COLLABORATION</span>
              <select
                value={settings.brainCollaborationMode || 'auto'}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    brainCollaborationMode: e.target.value as 'auto' | 'on' | 'off',
                  })
                }
                aria-label="Multi-AI collaboration mode"
                className="w-full bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
              >
                <option value="auto">Auto (Complex Tasks Only)</option>
                <option value="on">Always Collaborate & Verify</option>
                <option value="off">Direct Fast Specialist Only</option>
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <label className="block font-mono-hud text-[10px] text-slate-400">
              CUSTOM SYSTEM INSTRUCTIONS (APPLIED TO ALL CHATS)
            </label>
            <textarea
              rows={3}
              value={customInstructionsDraft}
              onChange={(e) => setCustomInstructionsDraft(e.target.value)}
              placeholder="e.g., Always explain complex code in simple Hinglish first, include edge cases, and keep action lists bulleted."
              className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-y"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({
                    ...settings,
                    customInstructions: customInstructionsDraft.trim().slice(0, 1200),
                  });
                  triggerNotice('Custom AI system instructions saved.');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-400/15 border border-cyan-400/50 hover:bg-cyan-400/25 font-mono-hud text-xs font-bold text-cyan-200 cursor-pointer"
              >
                SAVE INSTRUCTIONS
              </button>
            </div>
          </div>
        </div>

        {/* AM AI Premium Female Voice & Bilingual Speech Settings (All 9 Controls) */}
        <div
          data-testid="settings-premium-voice-section"
          className="pt-4 border-t border-slate-800 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-fuchsia-300" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-100">
                    AM AI Premium Female Voice & Welcome Settings
                  </p>
                  {(settings.femaleVoiceEnabled ?? true) && (
                    <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/50 font-mono-hud text-[9px] font-bold text-fuchsia-200">
                      FEMALE VOICE ON
                    </span>
                  )}
                  {activeVoiceInfo && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 font-mono-hud text-[9px] text-cyan-200">
                      {activeVoiceInfo.name} ({activeVoiceInfo.lang})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Soft, natural Hindi & English bilingual female speech, two-step welcome sequence, speed, and volume
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isSpeaking && onStopSpeaking && (
                <button
                  type="button"
                  onClick={onStopSpeaking}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/60 hover:bg-rose-500/30 font-mono-hud text-xs font-bold text-rose-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>STOP SPEAKING</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, voiceMuted: !settings.voiceMuted })
                }
                className={`px-3 py-1.5 rounded-lg border font-mono-hud text-xs font-bold cursor-pointer ${
                  settings.voiceMuted
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-[#040812] border-slate-700 text-slate-300'
                }`}
              >
                {settings.voiceMuted ? 'MUTED' : 'UNMUTED'}
              </button>
              {onReplayWelcome && (
                <button
                  type="button"
                  data-testid="settings-replay-welcome-btn"
                  onClick={onReplayWelcome}
                  className="px-3 py-1.5 rounded-lg bg-fuchsia-500/15 border border-fuchsia-400/50 hover:border-fuchsia-300 font-mono-hud text-xs font-bold text-fuchsia-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>REPLAY WELCOME</span>
                </button>
              )}
              <button
                type="button"
                data-testid="settings-test-voice-btn"
                onClick={onTestVoice}
                className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-cyan-500/40 hover:border-cyan-400 font-mono-hud text-xs text-cyan-300 cursor-pointer"
              >
                TEST VOICE
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={settings.femaleVoiceEnabled ?? true}
              data-testid="settings-female-voice-toggle"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  femaleVoiceEnabled: !(settings.femaleVoiceEnabled ?? true),
                })
              }
              className={`rounded-xl border p-3 text-left cursor-pointer transition-colors ${
                (settings.femaleVoiceEnabled ?? true)
                  ? 'bg-fuchsia-500/15 border-fuchsia-400/60 text-fuchsia-100'
                  : 'bg-[#040812] border-slate-800 text-slate-400'
              }`}
            >
              <p className="font-mono-hud text-[11px] font-bold">FEMALE VOICE</p>
              <p className="text-xs mt-1">
                {(settings.femaleVoiceEnabled ?? true) ? 'ENABLED (SOFT NATURAL)' : 'STANDARD VOICE'}
              </p>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={settings.welcomeGreetingEnabled ?? true}
              data-testid="settings-welcome-greeting-toggle"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  welcomeGreetingEnabled: !(settings.welcomeGreetingEnabled ?? true),
                })
              }
              className={`rounded-xl border p-3 text-left cursor-pointer transition-colors ${
                (settings.welcomeGreetingEnabled ?? true)
                  ? 'bg-cyan-400/15 border-cyan-400/60 text-cyan-100'
                  : 'bg-[#040812] border-slate-800 text-slate-400'
              }`}
            >
              <p className="font-mono-hud text-[11px] font-bold">WELCOME GREETING</p>
              <p className="text-xs mt-1">
                {(settings.welcomeGreetingEnabled ?? true) ? 'ON (2-STEP AM AI)' : 'OFF'}
              </p>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={settings.autoDetectVoiceLanguage ?? true}
              data-testid="settings-auto-detect-lang-toggle"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  autoDetectVoiceLanguage: !(settings.autoDetectVoiceLanguage ?? true),
                })
              }
              className={`rounded-xl border p-3 text-left cursor-pointer transition-colors ${
                (settings.autoDetectVoiceLanguage ?? true)
                  ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-100'
                  : 'bg-[#040812] border-slate-800 text-slate-400'
              }`}
            >
              <p className="font-mono-hud text-[11px] font-bold">AUTO-DETECT LANG</p>
              <p className="text-xs mt-1">
                {(settings.autoDetectVoiceLanguage ?? true) ? 'ON (HINDI / EN / HINGLISH)' : 'FIXED LOCALE'}
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, voiceModeEnabled: !settings.voiceModeEnabled })
              }
              className={`rounded-xl border p-3 text-left cursor-pointer transition-colors ${
                settings.voiceModeEnabled
                  ? 'bg-cyan-400/15 border-cyan-400/60 text-cyan-100'
                  : 'bg-[#040812] border-slate-800 text-slate-400'
              }`}
            >
              <p className="font-mono-hud text-[11px] font-bold">VOICE MODE</p>
              <p className="text-xs mt-1">{settings.voiceModeEnabled ? 'ENABLED' : 'DISABLED'}</p>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={settings.autoSpeakDailySummary}
              data-testid="settings-auto-speak-daily-summary"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  autoSpeakDailySummary: !settings.autoSpeakDailySummary,
                })
              }
              className={`rounded-xl border p-3 text-left cursor-pointer transition-colors ${
                settings.autoSpeakDailySummary
                  ? 'bg-cyan-400/15 border-cyan-400/60 text-cyan-100'
                  : 'bg-[#040812] border-slate-800 text-slate-400'
              }`}
            >
              <p className="font-mono-hud text-[11px] font-bold">LAUNCH SUMMARY</p>
              <p className="text-xs mt-1">
                {settings.autoSpeakDailySummary ? 'AUTO-SPEAK ON' : 'MANUAL'}
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, autoSpeakReplies: !settings.autoSpeakReplies })
              }
              className={`rounded-xl border p-3 text-left cursor-pointer transition-colors ${
                settings.autoSpeakReplies
                  ? 'bg-cyan-400/15 border-cyan-400/60 text-cyan-100'
                  : 'bg-[#040812] border-slate-800 text-slate-400'
              }`}
            >
              <p className="font-mono-hud text-[11px] font-bold">AUTO-SPEAK REPLIES</p>
              <p className="text-xs mt-1">{settings.autoSpeakReplies ? 'ON' : 'OFF'}</p>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  continuousConversationMode: !settings.continuousConversationMode,
                })
              }
              className={`rounded-xl border p-3 text-left cursor-pointer transition-colors sm:col-span-2 ${
                settings.continuousConversationMode
                  ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-100'
                  : 'bg-[#040812] border-slate-800 text-slate-400'
              }`}
            >
              <p className="font-mono-hud text-[11px] font-bold">CONTINUOUS MODE</p>
              <p className="text-xs mt-1">
                {settings.continuousConversationMode ? 'AUTO-RELISTEN ON' : 'SINGLE TURN'}
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <label className="block space-y-1.5">
              <span className="font-mono-hud text-xs text-slate-300">Voice Profile</span>
              <select
                value={settings.selectedVoiceUri || ''}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, selectedVoiceUri: e.target.value })
                }
                aria-label="Preferred speech synthesis voice"
                className="w-full bg-[#040812] border border-slate-700 rounded-xl px-2.5 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
              >
                <option value="">
                  Auto Best {(settings.femaleVoiceEnabled ?? true) ? 'Female ' : ''}Locale
                </option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang}
                    {v.isFemale ? ' • Female' : ''}
                    {v.qualityTier === 'neural' ? ' • Natural' : ''})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="font-mono-hud text-xs text-slate-300">Hindi / English Preference</span>
              <select
                value={settings.voiceLanguagePreference || language}
                onChange={(e) => {
                  const nextLang = e.target.value as LanguageCode;
                  onUpdateSettings({ ...settings, voiceLanguagePreference: nextLang });
                  onLanguageChange(nextLang);
                }}
                aria-label="Hindi and English voice language preference"
                className="w-full bg-[#040812] border border-slate-700 rounded-xl px-2.5 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
              >
                {Object.values(JARVIS_LANGUAGES).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <div className="flex justify-between font-mono-hud text-xs text-slate-300">
                <span>Speaking Speed</span>
                <span className="text-cyan-300">{settings.speechRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.02}
                value={settings.speechRate}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, speechRate: Number(e.target.value) })
                }
                className="w-full accent-fuchsia-400 cursor-pointer"
              />
            </label>

            <label className="block space-y-1.5">
              <div className="flex justify-between font-mono-hud text-xs text-slate-300">
                <span>Tone Pitch</span>
                <span className="text-cyan-300">{settings.speechPitch.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.7}
                max={1.4}
                step={0.02}
                value={settings.speechPitch}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, speechPitch: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="block space-y-1.5">
              <div className="flex justify-between font-mono-hud text-xs text-slate-300">
                <span>Voice Volume</span>
                <span className="text-cyan-300">
                  {Math.round((settings.voiceVolume ?? 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.voiceVolume ?? 1}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, voiceVolume: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Phase 5: Dark & Light Theme Mode */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5">
            {settings.themeMode === 'light' ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-cyan-300" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-100">HUD Visual Theme Mode</p>
              <p className="text-xs text-slate-400">
                Switch between Obsidian Cyan Dark, Ceramic Cobalt Light, or System preference
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'dark', label: 'Obsidian Cyan Dark' },
                { id: 'light', label: 'Ceramic Cobalt Light' },
                { id: 'system', label: 'System Default' },
              ] as Array<{ id: ThemeMode; label: string }>
            ).map((opt) => {
              const active = (settings.themeMode || 'dark') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, themeMode: opt.id })}
                  className={`px-3 py-2.5 rounded-xl border font-mono-hud text-xs cursor-pointer transition-all ${
                    active
                      ? 'bg-cyan-400/20 border-cyan-400 text-cyan-100 font-bold'
                      : 'bg-[#040812] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
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
              const displayedAccent = previewAccent ?? settings.accentTheme;
              const active = displayedAccent === opt.id;
              const isSaved = settings.accentTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`accent-option-${opt.id}`}
                  aria-pressed={active}
                  onClick={() => {
                    document.documentElement.setAttribute('data-accent', opt.id);
                    setPreviewAccent(opt.id === settings.accentTheme ? null : opt.id);
                  }}
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
                    {isSaved && <Check className="w-2.5 h-2.5 text-[#02040A]" />}
                  </span>
                  <span>{opt.label}</span>
                  {previewAccent === opt.id && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/15 text-slate-100">
                      Preview
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {previewAccent && previewAccent !== settings.accentTheme && (
            <div
              data-testid="accent-preview-banner"
              className="mt-3 glass-panel-glow rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: 'var(--cyan-primary)',
                    boxShadow: '0 0 12px var(--cyan-primary)',
                  }}
                />
                <div className="min-w-0">
                  <p className="font-mono-hud text-xs font-bold text-slate-100 truncate">
                    PREVIEWING:{' '}
                    <span style={{ color: 'var(--cyan-primary)' }}>
                      {ACCENT_OPTIONS.find((o) => o.id === previewAccent)?.label || previewAccent}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Live preview applied to HUD root (<code className="text-slate-200">data-accent=&quot;{previewAccent}&quot;</code>). Confirm to save.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="cancel-accent-preview-btn"
                  onClick={() => {
                    const fallback = settings.accentTheme || 'cyan';
                    document.documentElement.setAttribute('data-accent', fallback);
                    setPreviewAccent(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#040812] border border-slate-700 hover:border-slate-500 font-mono-hud text-xs text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="confirm-accent-btn"
                  onClick={() => {
                    const chosen = previewAccent;
                    const label = ACCENT_OPTIONS.find((o) => o.id === chosen)?.label || chosen;
                    savedAccentRef.current = chosen;
                    onUpdateSettings({ ...settings, accentTheme: chosen });
                    setPreviewAccent(null);
                    triggerNotice(`HUD accent theme updated to ${label}.`);
                  }}
                  className="px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold text-[#02040A] cursor-pointer"
                  style={{ backgroundColor: 'var(--cyan-primary)' }}
                >
                  Confirm Theme
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reduced Motion */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-violet-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Reduced Motion Mode</p>
              <p className="text-xs text-slate-400">
                Applies the root <code className="text-violet-300">.reduced-motion</code> class to disable HUD scanlines, pulses, and core rotation
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.reducedMotion}
            aria-label="Toggle Reduced Motion Mode"
            data-testid="reduced-motion-toggle"
            onClick={() => onUpdateSettings({ ...settings, reducedMotion: !settings.reducedMotion })}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold border cursor-pointer transition-colors ${
              settings.reducedMotion
                ? 'bg-violet-500/20 border-violet-400 text-violet-200'
                : 'bg-[#040812] border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {settings.reducedMotion ? 'ON' : 'OFF'}
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

        {/* Master Persistent Memory ON/OFF */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-cyan-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Persistent Memory System</p>
              <p className="text-xs text-slate-400">
                Master switch controlling memory recall & saving across chats (secrets are always blocked)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                ...settings,
                memoryEnabled: !(settings.memoryEnabled ?? true),
              })
            }
            className={`px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold border cursor-pointer ${
              (settings.memoryEnabled ?? true)
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-[#040812] border-slate-700 text-slate-300'
            }`}
          >
            {(settings.memoryEnabled ?? true) ? 'ON' : 'OFF'}
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

        {/* Task Reminder Notifications */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-emerald-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Task & Reminder Notifications</p>
              <p className="text-xs text-slate-400">Show in-app alerts and browser notifications when reminders fire</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                ...settings,
                taskNotificationsEnabled: !(settings.taskNotificationsEnabled ?? true),
              })
            }
            className={`px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold border cursor-pointer ${
              (settings.taskNotificationsEnabled ?? true)
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-[#040812] border-slate-700 text-slate-300'
            }`}
          >
            {(settings.taskNotificationsEnabled ?? true) ? 'ENABLED' : 'MUTED'}
          </button>
        </div>

        {/* Cross-Device Sync Namespace */}
        <div className="pt-4 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-cyan-300" />
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Cross-Device Workspace Namespace (Web ↔ Android)
              </p>
              <p className="text-xs text-slate-400">
                Isolates your memories, tasks, notes, and automation history on the Express backend via{' '}
                <code className="text-cyan-300">X-Jarvis-User-Id</code>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={namespaceDraft}
              onChange={(e) => setNamespaceDraft(e.target.value)}
              placeholder="e.g., stark_main or default"
              aria-label="Cross-device user namespace"
              className="flex-1 min-w-[200px] bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 font-mono-hud text-xs text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={async () => {
                const sanitized = setActiveUserNamespace(namespaceDraft);
                setNamespaceDraft(sanitized);
                onUpdateSettings({ ...settings, userNamespace: sanitized });
                if (onSyncWorkspaceNow) {
                  setIsSyncingNow(true);
                  const res = await onSyncWorkspaceNow();
                  setIsSyncingNow(false);
                  triggerNotice(res.message);
                } else {
                  triggerNotice(`Active namespace set to "${sanitized}".`);
                }
              }}
              disabled={isSyncingNow}
              className="px-3.5 py-2 rounded-xl bg-cyan-400/15 border border-cyan-400/50 hover:bg-cyan-400/25 font-mono-hud text-xs font-bold text-cyan-200 cursor-pointer disabled:opacity-50"
            >
              {isSyncingNow ? 'SYNCING...' : 'APPLY & SYNC NOW'}
            </button>
          </div>
        </div>
      </div>

      {/* Export & Import Vault Backup */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-300" />
            <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
              EXPORT, IMPORT & VAULT BACKUP
            </h3>
          </div>
          <span className="font-mono-hud text-[11px] text-slate-400">
            {sessionsCount} sessions • {memoriesCount} memories • {tasksCount} tasks • {notesCount} notes
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Export your complete chats, Memory Vault, and tasks as JSON or Markdown, or import a JSON backup with validation & duplicate filtering.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => {
              onExportBackup('json');
              triggerNotice('JSON vault backup downloaded.');
            }}
            className="px-4 py-2 rounded-xl bg-cyan-400/15 border border-cyan-400/50 hover:bg-cyan-400/25 font-mono-hud text-xs font-bold text-cyan-200 flex items-center gap-1.5 cursor-pointer"
          >
            <FileJson className="w-4 h-4" />
            <span>EXPORT JSON BACKUP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onExportBackup('md');
              triggerNotice('Markdown backup downloaded.');
            }}
            className="px-4 py-2 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400 font-mono-hud text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-4 h-4 text-violet-300" />
            <span>EXPORT MARKDOWN</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 hover:bg-emerald-500/25 font-mono-hud text-xs font-bold text-emerald-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>IMPORT JSON BACKUP</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            aria-label="Import JARVIS JSON backup file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                onInspectBackupFile(String(reader.result || ''), file.name);
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
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

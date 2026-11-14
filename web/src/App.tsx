import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { HeaderHud } from './components/HeaderHud';
import { OpeningScreen } from './components/OpeningScreen';
import { SidebarNav } from './components/SidebarNav';
import { JARVIS_AGENTS, JARVIS_LANGUAGES, routeIntentToAgent } from './data/agents';
import { checkBackendHealth, streamGeminiChat } from './services/api';
import { createInitialPlugins, JarvisPlugin } from './services/plugins';
import { runBrowserSecurityAudit } from './services/security';
import { jarvisStore } from './services/storage';
import { collectBrowserTelemetry } from './services/telemetry';
import { WebVoiceEngine } from './services/voice';
import {
  AgentCollaborationLog,
  AgentId,
  BackendHealth,
  BrowserTelemetry,
  ChatMessage,
  ChatSource,
  ConnectionState,
  JarvisSettings,
  LanguageCode,
  MemoryItem,
  ScreenId,
  SecurityLogItem,
  SmartDevice,
  TaskItem,
} from './types/jarvis';
import { ChatView } from './views/ChatView';
import { DashboardView } from './views/DashboardView';
import { MemoryVaultView } from './views/MemoryVaultView';
import { MultiAgentView } from './views/MultiAgentView';
import { PluginsView } from './views/PluginsView';
import { ProductivityView } from './views/ProductivityView';
import { SecurityView } from './views/SecurityView';
import { SettingsView } from './views/SettingsView';
import { SmartHomeView } from './views/SmartHomeView';
import { TelemetryCliView } from './views/TelemetryCliView';
import { VisionScannerView } from './views/VisionScannerView';
import { VoiceHudView } from './views/VoiceHudView';

const INITIAL_TELEMETRY: BrowserTelemetry = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  networkType: typeof navigator !== 'undefined' && navigator.onLine ? 'Online' : 'Offline',
  batteryPercent: null,
  isCharging: null,
  deviceMemoryGb: null,
  heapUsedMb: null,
  heapLimitMb: null,
  cpuCores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
  platform: typeof navigator !== 'undefined' ? navigator.platform || 'Web Browser' : 'Web Browser',
  viewport: typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '1280×720',
  uptimeMinutes: 0,
};

const SCREEN_META: Record<Exclude<ScreenId, 'opening'>, { title: string; subtitle: string }> = {
  dashboard: { title: 'COMMAND CENTER', subtitle: 'JARVIS Quantum HUD • Multi-Subsystem Control' },
  chat: { title: 'NEURAL CHAT MATRIX', subtitle: 'Streaming Gemini 2.5 Intelligence & Citations' },
  voice: { title: 'VOICE INTELLIGENCE', subtitle: 'Web Speech Recognition & Vocal Synthesis' },
  multi_agent: { title: 'MULTI-AGENT HUB', subtitle: 'JARVIS • VERONICA • DUM-E • FRIDAY • HOMER' },
  security: { title: 'STARK SECURITY AUDIT', subtitle: 'DEFCON Posture, Key Isolation & Audit Trail' },
  telemetry: { title: 'TELEMETRY & CLI', subtitle: 'Live Browser Metrics & Neural Terminal' },
  plugins: { title: 'PLUGIN MATRIX', subtitle: 'Modular Tool APIs & Agile Kanban Board' },
  memory: { title: 'MEMORY VAULT', subtitle: 'Persistent Long-Term Context Directives' },
  productivity: { title: 'EXECUTIVE PLANNER', subtitle: 'Tasks, Schedules, Reminders & FRIDAY Briefings' },
  smart_home: { title: 'STARK SMART HOME', subtitle: 'Ambient Lighting, Climate & Security Bridge' },
  vision: { title: 'OPTICAL VISION SCANNER', subtitle: 'Webcam Capture, File Upload & Gemini Vision OCR' },
  settings: { title: 'SYSTEM SETTINGS', subtitle: 'Server Health, Voice Calibration & Security PIN' },
};

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('opening');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Persistent state hydrated immediately (never blocks on a loading spinner)
  const [memories, setMemories] = useState<MemoryItem[]>(() => jarvisStore.getMemories());
  const [messages, setMessages] = useState<ChatMessage[]>(() => jarvisStore.getChats());
  const [tasks, setTasks] = useState<TaskItem[]>(() => jarvisStore.getTasks());
  const [securityLogs, setSecurityLogs] = useState<SecurityLogItem[]>(() =>
    jarvisStore.getSecurityLogs()
  );
  const [devices, setDevices] = useState<SmartDevice[]>(() => jarvisStore.getDevices());
  const [settings, setSettings] = useState<JarvisSettings>(() => jarvisStore.getSettings());

  // Runtime state
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('JARVIS_PRIME');
  const [language, setLanguage] = useState<LanguageCode>('ENGLISH');
  const [telemetry, setTelemetry] = useState<BrowserTelemetry>(INITIAL_TELEMETRY);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

  // Chat streaming state
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamTimeoutRef = useRef<number | null>(null);
  const lastPromptRef = useRef<{ text: string; isVoice: boolean; agentId?: AgentId } | null>(null);

  // Voice state
  const voiceEngineRef = useRef<WebVoiceEngine | null>(null);
  if (!voiceEngineRef.current) {
    voiceEngineRef.current = new WebVoiceEngine();
  }
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Security & Multi-agent state
  const [isLockdownActive, setIsLockdownActive] = useState(false);
  const [collaborationLogs, setCollaborationLogs] = useState<AgentCollaborationLog[]>([
    {
      id: 'collab_init',
      fromCodename: 'JARVIS',
      toCodename: 'ALL NODES',
      action: 'MESH SYNCHRONIZED',
      detail: 'Web Neural Matrix initialized. Sub-agents awaiting directives.',
      timestamp: Date.now(),
    },
  ]);

  // PIN confirmation modal state
  const [pinModalAction, setPinModalAction] = useState<'lockdown' | 'toggle_pin' | null>(null);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Plugins state
  const pluginsRef = useRef<JarvisPlugin[]>(createInitialPlugins());
  const [, setPluginTick] = useState(0);
  const [lastToolOutput, setLastToolOutput] = useState<string | null>(null);

  // Persist changes automatically
  useEffect(() => jarvisStore.saveMemories(memories), [memories]);
  useEffect(() => jarvisStore.saveChats(messages), [messages]);
  useEffect(() => jarvisStore.saveTasks(tasks), [tasks]);
  useEffect(() => jarvisStore.saveSecurityLogs(securityLogs), [securityLogs]);
  useEffect(() => jarvisStore.saveDevices(devices), [devices]);
  useEffect(() => jarvisStore.saveSettings(settings), [settings]);

  const appendSecurityLog = useCallback(
    (
      eventType: SecurityLogItem['eventType'],
      description: string,
      severity: SecurityLogItem['severity'],
      sourceAgent = 'JARVIS_SECURITY'
    ) => {
      setSecurityLogs((prev) => [
        {
          id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          eventType,
          description,
          severity,
          sourceAgent,
        },
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  // Backend health probe (returns boolean whether reachable)
  const refreshHealth = useCallback(async (): Promise<boolean> => {
    setConnectionState('connecting');
    try {
      const health = await checkBackendHealth(5000);
      setBackendHealth(health);
      setConnectionState(health.geminiConfigured ? 'online' : 'key_missing');
      return true;
    } catch {
      setBackendHealth(null);
      setConnectionState('offline');
      return false;
    }
  }, []);

  useEffect(() => {
    let retryTimer: number | null = null;
    refreshHealth().then((reachable) => {
      if (!reachable) {
        // Retry once after 2.5s in case Express server is still binding during concurrent boot
        retryTimer = window.setTimeout(() => {
          refreshHealth();
        }, 2500);
      }
    });

    const handleOnline = () => {
      refreshHealth();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshHealth]);

  // Real browser telemetry updates
  const refreshTelemetry = useCallback(async () => {
    const snap = await collectBrowserTelemetry();
    setTelemetry(snap);
  }, []);

  useEffect(() => {
    refreshTelemetry();
    const interval = window.setInterval(refreshTelemetry, 5000);
    window.addEventListener('online', refreshTelemetry);
    window.addEventListener('offline', refreshTelemetry);
    window.addEventListener('resize', refreshTelemetry);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', refreshTelemetry);
      window.removeEventListener('offline', refreshTelemetry);
      window.removeEventListener('resize', refreshTelemetry);
    };
  }, [refreshTelemetry]);

  // Cleanup voice/streams on unmount
  useEffect(() => {
    return () => {
      voiceEngineRef.current?.stopListening();
      voiceEngineRef.current?.stopSpeaking();
      streamAbortRef.current?.abort();
      if (streamTimeoutRef.current !== null) {
        window.clearTimeout(streamTimeoutRef.current);
      }
    };
  }, []);

  const securityReport = useMemo(
    () =>
      runBrowserSecurityAudit({
        logs: securityLogs,
        isLockdownActive,
        isPinProtected: settings.pinProtected,
        connectionState,
      }),
    [securityLogs, isLockdownActive, settings.pinProtected, connectionState]
  );

  const speakText = useCallback(
    (text: string) => {
      const langDesc = JARVIS_LANGUAGES[language];
      voiceEngineRef.current?.speak(
        text,
        langDesc.bcp47,
        settings.speechRate,
        settings.speechPitch,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false)
      );
    },
    [language, settings.speechRate, settings.speechPitch]
  );

  const stopSpeaking = useCallback(() => {
    voiceEngineRef.current?.stopSpeaking();
    setIsSpeaking(false);
  }, []);

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    if (streamTimeoutRef.current !== null) {
      window.clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
    setIsThinking(false);
  }, []);

  const sendPromptToGemini = useCallback(
    async (rawText: string, isVoice = false, explicitAgentId?: AgentId) => {
      const prompt = rawText.trim();
      if (!prompt || isThinking) return;

      lastPromptRef.current = { text: prompt, isVoice, agentId: explicitAgentId };

      // Determine active agent (automatic routing when on JARVIS_PRIME)
      let targetAgentId: AgentId = explicitAgentId ?? selectedAgent;
      if (!explicitAgentId && selectedAgent === 'JARVIS_PRIME') {
        const routed = routeIntentToAgent(prompt);
        if (routed !== 'JARVIS_PRIME') {
          targetAgentId = routed;
          setSelectedAgent(routed);
          setCollaborationLogs((prev) => [
            {
              id: `collab_${Date.now()}`,
              fromCodename: 'JARVIS',
              toCodename: JARVIS_AGENTS[routed].codename,
              action: 'INTENT DELEGATION',
              detail: `Delegated prompt "${prompt.slice(0, 64)}${prompt.length > 64 ? '...' : ''}"`,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 29),
          ]);
        }
      }

      const agent = JARVIS_AGENTS[targetAgentId];
      const langDesc = JARVIS_LANGUAGES[language];

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_u`,
        role: 'user',
        text: prompt,
        agentCodename: agent.codename,
        timestamp: Date.now(),
        isVoice,
      };

      const historySnapshot = [...messages, userMsg];
      setMessages(historySnapshot);
      setStreamingText('');
      setIsThinking(true);

      streamAbortRef.current?.abort();
      if (streamTimeoutRef.current !== null) {
        window.clearTimeout(streamTimeoutRef.current);
      }

      const controller = new AbortController();
      streamAbortRef.current = controller;
      streamTimeoutRef.current = window.setTimeout(() => {
        controller.abort();
      }, 60000);

      let latestSources: ChatSource[] = [];

      await streamGeminiChat({
        prompt,
        agent,
        language: langDesc,
        telemetry,
        memories,
        history: messages,
        enableWebSearch: settings.webSearchEnabled,
        signal: controller.signal,
        callbacks: {
          onSources: (sources) => {
            latestSources = sources;
          },
          onChunk: (fullText) => {
            setStreamingText(fullText);
          },
          onComplete: (fullText) => {
            if (streamTimeoutRef.current !== null) {
              window.clearTimeout(streamTimeoutRef.current);
              streamTimeoutRef.current = null;
            }
            streamAbortRef.current = null;
            setStreamingText('');
            setIsThinking(false);

            const replyMsg: ChatMessage = {
              id: `msg_${Date.now()}_j`,
              role: 'jarvis',
              text: fullText,
              agentCodename: agent.codename,
              timestamp: Date.now(),
              sources: latestSources.length > 0 ? latestSources : undefined,
            };
            setMessages((prev) => [...prev, replyMsg]);

            if (isVoice || settings.autoSpeakReplies) {
              speakText(fullText);
            }
          },
          onError: (errMsg) => {
            if (streamTimeoutRef.current !== null) {
              window.clearTimeout(streamTimeoutRef.current);
              streamTimeoutRef.current = null;
            }
            streamAbortRef.current = null;
            setStreamingText('');
            setIsThinking(false);

            const errBubble: ChatMessage = {
              id: `msg_${Date.now()}_err`,
              role: 'jarvis',
              text: errMsg,
              agentCodename: agent.codename,
              timestamp: Date.now(),
              isError: true,
            };
            setMessages((prev) => [...prev, errBubble]);
          },
        },
      });
    },
    [
      isThinking,
      selectedAgent,
      language,
      messages,
      telemetry,
      memories,
      settings.webSearchEnabled,
      settings.autoSpeakReplies,
      speakText,
    ]
  );

  const startVoiceCapture = useCallback(
    (autoNavigateToChat = false) => {
      setVoiceError(null);
      setTranscript('');
      let finalCaptured = '';
      const langDesc = JARVIS_LANGUAGES[language];

      voiceEngineRef.current?.startListening({
        bcp47Lang: langDesc.bcp47,
        onStart: () => {
          setIsListening(true);
        },
        onTranscript: (text, isFinal) => {
          setTranscript(text);
          if (isFinal) {
            finalCaptured = text;
          }
        },
        onAudioLevel: (rms) => {
          setAudioLevel(rms);
        },
        onError: (msg) => {
          setVoiceError(msg);
          setIsListening(false);
          setAudioLevel(0);
        },
        onEnd: () => {
          setIsListening(false);
          setAudioLevel(0);
          if (finalCaptured.trim()) {
            if (autoNavigateToChat) {
              setActiveScreen('chat');
            }
            sendPromptToGemini(finalCaptured.trim(), true);
          }
        },
      });
    },
    [language, sendPromptToGemini]
  );

  const stopVoiceCapture = useCallback(() => {
    voiceEngineRef.current?.stopListening();
    setIsListening(false);
    setAudioLevel(0);
  }, []);

  // Security PIN-gated actions
  const executeToggleLockdown = () => {
    setIsLockdownActive((prev) => {
      const next = !prev;
      appendSecurityLog(
        'ANOMALY',
        next
          ? 'Emergency Defense Lockdown ENGAGED (DEFCON 1).'
          : 'Emergency Defense Lockdown disengaged by owner.',
        next ? 'CRITICAL' : 'INFO',
        'HOMER_SECURITY'
      );
      return next;
    });
  };

  const executeTogglePinProtection = () => {
    setSettings((prev) => {
      const next = !prev.pinProtected;
      appendSecurityLog(
        'AUTH',
        `Master Stark PIN protection ${next ? 'ENABLED' : 'DISABLED'}.`,
        next ? 'INFO' : 'WARNING'
      );
      return { ...prev, pinProtected: next };
    });
  };

  const requestProtectedAction = (action: 'lockdown' | 'toggle_pin') => {
    if (!settings.pinProtected) {
      if (action === 'lockdown') executeToggleLockdown();
      else executeTogglePinProtection();
      return;
    }
    setPinEntry('');
    setPinError(null);
    setPinModalAction(action);
  };

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinEntry.trim() !== settings.userPin) {
      setPinError('Invalid Stark PIN entered. Incident logged.');
      appendSecurityLog('AUTH', 'Failed PIN verification attempt on protected control.', 'WARNING');
      return;
    }
    const action = pinModalAction;
    setPinModalAction(null);
    setPinEntry('');
    setPinError(null);
    if (action === 'lockdown') executeToggleLockdown();
    if (action === 'toggle_pin') executeTogglePinProtection();
  };

  // Root container carries reduced-motion attribute
  if (activeScreen === 'opening') {
    return (
      <div data-reduced-motion={settings.reducedMotion ? 'true' : 'false'}>
        <OpeningScreen
          telemetry={telemetry}
          connectionState={connectionState}
          reducedMotion={settings.reducedMotion}
          onInitialize={() => setActiveScreen('dashboard')}
          onEnterVoiceMode={() => {
            setActiveScreen('voice');
            startVoiceCapture(false);
          }}
        />
      </div>
    );
  }

  const meta = SCREEN_META[activeScreen];

  return (
    <div
      data-reduced-motion={settings.reducedMotion ? 'true' : 'false'}
      className="min-h-screen bg-[#02040A] hud-grid-bg text-slate-100 flex"
    >
      <SidebarNav
        activeScreen={activeScreen}
        isOpenMobile={mobileMenuOpen}
        onSelect={(scr) => setActiveScreen(scr)}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLockScreen={() => {
          stopVoiceCapture();
          stopSpeaking();
          setActiveScreen('opening');
        }}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <HeaderHud
          title={meta.title}
          subtitle={meta.subtitle}
          connectionState={connectionState}
          telemetry={telemetry}
          language={language}
          reducedMotion={settings.reducedMotion}
          onLanguageChange={(lang) => setLanguage(lang)}
          onToggleReducedMotion={() =>
            setSettings((prev) => ({ ...prev, reducedMotion: !prev.reducedMotion }))
          }
          onRetryConnection={refreshHealth}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeScreen === 'dashboard' && (
            <DashboardView
              telemetry={telemetry}
              securityReport={securityReport}
              connectionState={connectionState}
              isListening={isListening}
              audioLevel={audioLevel}
              reducedMotion={settings.reducedMotion}
              onNavigate={(scr) => setActiveScreen(scr)}
              onSelectAgentAndChat={(agentId) => {
                setSelectedAgent(agentId);
                setActiveScreen('chat');
              }}
            />
          )}

          {activeScreen === 'chat' && (
            <ChatView
              selectedAgent={selectedAgent}
              messages={messages}
              streamingText={streamingText}
              isThinking={isThinking}
              isListening={isListening}
              isSpeaking={isSpeaking}
              connectionState={connectionState}
              webSearchEnabled={settings.webSearchEnabled}
              onSelectAgent={(id) => setSelectedAgent(id)}
              onSendMessage={(txt) => sendPromptToGemini(txt, false)}
              onRetryLast={() => {
                const last = lastPromptRef.current;
                if (last) sendPromptToGemini(last.text, last.isVoice, last.agentId);
              }}
              onStopStreaming={stopStreaming}
              onClearHistory={() => setMessages([])}
              onStartVoice={() => startVoiceCapture(false)}
              onStopVoice={stopVoiceCapture}
              onSpeakText={speakText}
              onStopSpeaking={stopSpeaking}
              onToggleWebSearch={() =>
                setSettings((prev) => ({ ...prev, webSearchEnabled: !prev.webSearchEnabled }))
              }
              onRetryConnection={refreshHealth}
            />
          )}

          {activeScreen === 'voice' && (
            <VoiceHudView
              language={language}
              isListening={isListening}
              isSpeaking={isSpeaking}
              transcript={transcript}
              voiceError={voiceError}
              audioLevel={audioLevel}
              reducedMotion={settings.reducedMotion}
              onStartListening={() => startVoiceCapture(false)}
              onStopListening={stopVoiceCapture}
              onStopSpeaking={stopSpeaking}
              onQuickCommand={(cmd) => {
                setActiveScreen('chat');
                sendPromptToGemini(cmd, true);
              }}
            />
          )}

          {activeScreen === 'multi_agent' && (
            <MultiAgentView
              collaborationLogs={collaborationLogs}
              onEngageAgent={(agentId) => {
                setSelectedAgent(agentId);
                setActiveScreen('chat');
              }}
              onDispatchDirective={(directive) => {
                setActiveScreen('chat');
                sendPromptToGemini(directive, false);
              }}
            />
          )}

          {activeScreen === 'security' && (
            <SecurityView
              report={securityReport}
              logs={securityLogs}
              isLockdownActive={isLockdownActive}
              isPinProtected={settings.pinProtected}
              onRunScan={() => {
                refreshHealth();
                appendSecurityLog(
                  'SCAN',
                  `Manual security audit completed. Score: ${securityReport.score}/100.`,
                  'INFO',
                  'HOMER_SENTINEL'
                );
              }}
              onToggleLockdown={() => requestProtectedAction('lockdown')}
              onTogglePinProtection={() => requestProtectedAction('toggle_pin')}
            />
          )}

          {activeScreen === 'telemetry' && (
            <TelemetryCliView
              telemetry={telemetry}
              settings={settings}
              onRefreshTelemetry={refreshTelemetry}
              onUpdateSpeech={(speechRate, speechPitch) =>
                setSettings((prev) => ({ ...prev, speechRate, speechPitch }))
              }
              onTestVoice={() => speakText(JARVIS_LANGUAGES[language].greeting)}
            />
          )}

          {activeScreen === 'plugins' && (
            <PluginsView
              plugins={pluginsRef.current}
              lastToolOutput={lastToolOutput}
              onTogglePlugin={(pluginId) => {
                const target = pluginsRef.current.find((p) => p.id === pluginId);
                if (target) {
                  target.isEnabled = !target.isEnabled;
                  setPluginTick((n) => n + 1);
                }
              }}
              onExecutePluginTool={async (pluginId, toolId, params) => {
                const target = pluginsRef.current.find((p) => p.id === pluginId);
                if (!target) return;
                const result = await target.executeTool(toolId, params);
                setLastToolOutput(result.summary);
                setPluginTick((n) => n + 1);
                appendSecurityLog(
                  'TOOL_EXEC',
                  `Executed plugin tool ${target.name} :: ${toolId}`,
                  'INFO',
                  'JARVIS_PLUGINS'
                );
              }}
            />
          )}

          {activeScreen === 'memory' && (
            <MemoryVaultView
              memories={memories}
              onAddMemory={(item) =>
                setMemories((prev) => [
                  {
                    ...item,
                    id: `mem_${Date.now()}`,
                    createdAt: Date.now(),
                  },
                  ...prev,
                ])
              }
              onDeleteMemory={(id) => setMemories((prev) => prev.filter((m) => m.id !== id))}
            />
          )}

          {activeScreen === 'productivity' && (
            <ProductivityView
              tasks={tasks}
              onAddTask={(task) =>
                setTasks((prev) => [
                  {
                    ...task,
                    id: `task_${Date.now()}`,
                    isCompleted: false,
                    createdAt: Date.now(),
                  },
                  ...prev,
                ])
              }
              onToggleTask={(id) =>
                setTasks((prev) =>
                  prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t))
                )
              }
              onDeleteTask={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
              onRequestFridayBriefing={() => {
                const pendingSummary = tasks
                  .filter((t) => !t.isCompleted)
                  .map((t) => `- [${t.priority}] ${t.title} (${t.dueTime})`)
                  .join('\n');
                setSelectedAgent('FRIDAY_COORDINATOR');
                setActiveScreen('chat');
                sendPromptToGemini(
                  `Prepare a concise executive briefing for my current pending queue:\n${pendingSummary || 'No pending tasks.'}`,
                  false,
                  'FRIDAY_COORDINATOR'
                );
              }}
            />
          )}

          {activeScreen === 'smart_home' && (
            <SmartHomeView
              devices={devices}
              onToggleDevice={(id) =>
                setDevices((prev) =>
                  prev.map((d) => (d.id === id ? { ...d, isOn: !d.isOn } : d))
                )
              }
              onApplyScene={(scene) =>
                setDevices((prev) =>
                  prev.map((d) => {
                    if (scene === 'STEALTH') {
                      return d.type === 'SECURITY' ? { ...d, isOn: true } : { ...d, isOn: false };
                    }
                    if (scene === 'LAB_FOCUS') {
                      return { ...d, isOn: d.type !== 'APPLIANCE' || d.room === 'Study' };
                    }
                    return { ...d, isOn: true };
                  })
                )
              }
            />
          )}

          {activeScreen === 'vision' && <VisionScannerView connectionState={connectionState} />}

          {activeScreen === 'settings' && (
            <SettingsView
              settings={settings}
              language={language}
              connectionState={connectionState}
              backendHealth={backendHealth}
              onUpdateSettings={setSettings}
              onLanguageChange={setLanguage}
              onRetryConnection={refreshHealth}
              onClearAllChats={() => setMessages([])}
              onResetAllData={() => {
                const defaults = jarvisStore.resetAll();
                setMemories(defaults.memories);
                setMessages(defaults.chats);
                setTasks(defaults.tasks);
                setSecurityLogs(defaults.securityLogs);
                setDevices(defaults.devices);
                setSettings(defaults.settings);
                setIsLockdownActive(false);
              }}
            />
          )}
        </main>
      </div>

      {/* Stark Master PIN Modal */}
      {pinModalAction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmPin}
            className="glass-panel-glow rounded-2xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300">
                <Lock className="w-4 h-4" />
                <h3 className="font-display text-sm font-bold tracking-wider">
                  STARK PIN VERIFICATION
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPinModalAction(null)}
                aria-label="Cancel PIN entry"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Enter your Master Stark PIN (default: <code className="text-cyan-300">1000</code>) to authorize this security change.
            </p>

            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pinEntry}
              onChange={(e) => setPinEntry(e.target.value)}
              placeholder="Enter PIN..."
              className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 font-mono-hud text-sm text-slate-100 focus:outline-none"
            />

            {pinError && <p className="font-mono-hud text-xs text-rose-400">{pinError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPinModalAction(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-mono-hud text-slate-300 cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold cursor-pointer"
              >
                AUTHORIZE
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;

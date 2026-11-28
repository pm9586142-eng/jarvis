import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  AudioWaveform,
  Bookmark,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  FileText,
  Globe,
  Image as ImageIcon,
  Menu,
  Mic,
  PanelLeft,
  Paperclip,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ChatExportModal } from '../components/ChatExportModal';
import {
  buildMediaPayloadFromVideoId,
  ChatMediaDeck,
  extractYouTubeVideoIdFromText,
  FullscreenMediaModal,
} from '../components/ChatMediaDeck';
import { ChatSidebar } from '../components/ChatSidebar';
import { MarkdownMessage } from '../components/MarkdownMessage';
import { JARVIS_AGENTS } from '../data/agents';
import {
  ActiveEngineAttribution,
  AgentId,
  AiRoutingMode,
  BackendHealth,
  ChatBrainMeta,
  ChatMediaPayload,
  ChatMediaTrackRef,
  ChatMessage,
  ChatSession,
  ConnectionState,
  CustomAgent,
  ReasoningPreference,
  ScreenId,
} from '../types/jarvis';
import { MediaPlayerState } from '../types/media';

export interface PendingChatAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64Data?: string;
  previewDataUrl?: string;
  textContent?: string;
  useAsTextContext: boolean;
}

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

function isTextLikeFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    /\.(txt|md|markdown|csv|json|log|yaml|yml)$/i.test(name)
  );
}

interface ChatViewProps {
  selectedAgent: AgentId;
  customAgents: CustomAgent[];
  selectedCustomAgentId: string | null;
  sessions: ChatSession[];
  activeSessionId: string;
  messages: ChatMessage[];
  streamingText: string;
  isThinking: boolean;
  isSummarizing?: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isSpeechPaused?: boolean;
  isSpeechMuted?: boolean;
  voiceDraft?: string;
  voiceStatusMessage?: string | null;
  connectionState: ConnectionState;
  backendHealth?: BackendHealth | null;
  liveBrainMeta?: ChatBrainMeta | null;
  webSearchEnabled: boolean;
  isTemporaryChat?: boolean;
  reasoningPreference?: ReasoningPreference;
  brainCollaborationMode?: 'auto' | 'on' | 'off';
  femaleVoiceEnabled?: boolean;
  activeEngine?: ActiveEngineAttribution;
  routingMode?: AiRoutingMode;
  openSessionsSignal?: number;
  mediaState: MediaPlayerState;
  onSelectAgent: (id: AgentId) => void;
  onSelectCustomAgent: (id: string) => void;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onToggleSaveSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onSummarizeSession?: () => void;
  onToggleTemporaryChat?: () => void;
  onChangeReasoningPreference?: (pref: ReasoningPreference) => void;
  onChangeBrainCollaborationMode?: (mode: 'auto' | 'on' | 'off') => void;
  onOpenBrainCenter?: () => void;
  onNavigateScreen: (screen: ScreenId) => void;
  onStartVoiceConversation: () => void;
  onSendMessage: (text: string, attachment?: PendingChatAttachment) => void;
  onRetryLast: () => void;
  onRegenerateLast: () => void;
  onEditAndResend: (messageId: string, newText: string) => void;
  onStopStreaming: () => void;
  onClearHistory: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onClearVoiceDraft?: () => void;
  onSpeakText: (text: string) => void;
  onPauseSpeaking?: () => void;
  onResumeSpeaking?: () => void;
  onStopSpeaking: () => void;
  onToggleMute?: () => void;
  onToggleWebSearch: () => void;
  onRetryConnection: () => void;
  onPlayMediaTrack: (track: ChatMediaTrackRef, queue?: ChatMediaTrackRef[]) => void;
  onPauseMedia: () => void;
  onNextMedia: () => void;
  onPreviousMedia: () => void;
  onToggleMediaMute: () => void;
  onSetMediaVolume: (level: number) => void;
  onUpdateChatMediaStageRect: (
    rect: { top: number; left: number; width: number; height: number } | null
  ) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  selectedAgent,
  customAgents,
  selectedCustomAgentId,
  sessions,
  activeSessionId,
  messages,
  streamingText,
  isThinking,
  isSummarizing = false,
  isListening,
  isSpeaking,
  isSpeechPaused = false,
  isSpeechMuted = false,
  voiceDraft = '',
  voiceStatusMessage = null,
  connectionState,
  backendHealth = null,
  liveBrainMeta = null,
  webSearchEnabled,
  isTemporaryChat = false,
  reasoningPreference = 'auto',
  brainCollaborationMode = 'auto',
  activeEngine = 'Cloud AI',
  openSessionsSignal = 0,
  mediaState,
  onSelectAgent,
  onSelectCustomAgent,
  onCreateSession,
  onSelectSession,
  onToggleSaveSession,
  onRenameSession,
  onDeleteSession,
  onSummarizeSession,
  onToggleTemporaryChat,
  onChangeReasoningPreference,
  onChangeBrainCollaborationMode,
  onNavigateScreen,
  onStartVoiceConversation,
  onSendMessage,
  onRetryLast,
  onRegenerateLast,
  onEditAndResend,
  onStopStreaming,
  onClearHistory,
  onStartVoice,
  onStopVoice,
  onClearVoiceDraft,
  onSpeakText,
  onPauseSpeaking,
  onResumeSpeaking,
  onStopSpeaking,
  onToggleMute,
  onToggleWebSearch,
  onRetryConnection,
  onPlayMediaTrack,
  onPauseMedia,
  onNextMedia,
  onPreviousMedia,
  onToggleMediaMute,
  onSetMediaVolume,
  onUpdateChatMediaStageRect,
}) => {
  const [input, setInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportedFormat, setExportedFormat] = useState<'json' | 'csv' | 'md' | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingChatAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [inlineVideoMessageId, setInlineVideoMessageId] = useState<string | null>(null);
  const [fullscreenMediaPayload, setFullscreenMediaPayload] = useState<ChatMediaPayload | null>(null);

  const attachMixedRef = useRef<HTMLInputElement | null>(null);
  const attachImageRef = useRef<HTMLInputElement | null>(null);
  const attachFileRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

  const agent = JARVIS_AGENTS[selectedAgent];
  const activeCustomAgent = useMemo(
    () => (selectedCustomAgentId ? customAgents.find((c) => c.id === selectedCustomAgentId) ?? null : null),
    [customAgents, selectedCustomAgentId]
  );

  useEffect(() => {
    if (voiceDraft) {
      setInput(voiceDraft);
    }
  }, [voiceDraft]);

  useEffect(() => {
    if (openSessionsSignal > 0) {
      setDesktopSidebarOpen(true);
      setMobileSidebarOpen(true);
    }
  }, [openSessionsSignal]);

  useEffect(() => {
    if (!exportModalOpen && !mobileSidebarOpen && !fullscreenMediaPayload) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportModalOpen(false);
        setMobileSidebarOpen(false);
        if (fullscreenMediaPayload) {
          setFullscreenMediaPayload(null);
          onUpdateChatMediaStageRect(null);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [exportModalOpen, mobileSidebarOpen, fullscreenMediaPayload, onUpdateChatMediaStageRect]);

  useEffect(() => {
    if (nearBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, streamingText, isThinking]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distanceFromBottom < 140;
  }, []);

  const handleAttachmentSelected = async (file: File) => {
    setAttachmentError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(`File "${file.name}" exceeds the 4 MB limit.`);
      return;
    }

    const isText = isTextLikeFile(file);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDocx =
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.docx');
    const isImage = (file.type || '').startsWith('image/');

    if (!isText && !isPdf && !isDocx && !isImage) {
      setAttachmentError(
        'Unsupported file type. Select an image (PNG/JPG/WebP), PDF, DOCX, or text/markdown/JSON/CSV file.'
      );
      return;
    }

    try {
      if (isText) {
        const textContent = await file.text();
        setPendingAttachment({
          name: file.name,
          mimeType: file.type || 'text/plain',
          sizeBytes: file.size,
          textContent: textContent.slice(0, 60000),
          useAsTextContext: true,
        });
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setPendingAttachment({
        name: file.name,
        mimeType: isPdf
          ? 'application/pdf'
          : isDocx
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : file.type || 'image/png',
        sizeBytes: file.size,
        base64Data,
        previewDataUrl: isImage ? dataUrl : undefined,
        useAsTextContext: false,
      });
    } catch {
      setAttachmentError(`Could not read "${file.name}".`);
    }
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedMessageId(msg.id);
      window.setTimeout(() => {
        setCopiedMessageId((prev) => (prev === msg.id ? null : prev));
      }, 1800);
    } catch {
      // Ignore clipboard unavailability
    }
  };

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredMessages = useMemo(() => {
    if (!normalizedQuery) return messages;
    return messages.filter((m) => {
      if (m.text.toLowerCase().includes(normalizedQuery)) return true;
      if (m.agentCodename.toLowerCase().includes(normalizedQuery)) return true;
      if (
        m.sources?.some(
          (s) =>
            s.title.toLowerCase().includes(normalizedQuery) ||
            s.uri.toLowerCase().includes(normalizedQuery)
        )
      ) {
        return true;
      }
      return false;
    });
  }, [messages, normalizedQuery]);

  const renderHighlightedText = (text: string, query: string): React.ReactNode => {
    const trimmed = query.trim();
    if (!trimmed) return text;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, idx) =>
      idx % 2 === 1 ? (
        <mark
          key={idx}
          className="bg-cyan-400/35 text-cyan-100 rounded px-0.5 border-b border-cyan-300"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const activeModelTelemetry = useMemo(() => {
    const lastAiMsg = [...messages]
      .reverse()
      .find((m) => m.role === 'jarvis' && !m.isError && m.brainMeta?.model);
    const activeMeta = liveBrainMeta || lastAiMsg?.brainMeta;
    const providerLabel =
      activeMeta?.providerLabel ||
      backendHealth?.activeProviderLabel ||
      backendHealth?.multiProvider?.activeProviderLabel ||
      'Gemini Free';
    const modelName =
      activeMeta?.model || backendHealth?.activeModel || backendHealth?.model || 'gemini-3.8-flash';
    const voiceBadge =
      backendHealth?.elevenLabsConfigured !== false
        ? backendHealth?.ttsVoiceName || 'Monika Sogam (ElevenLabs)'
        : 'Device Voice';
    return {
      providerLabel,
      modelName,
      voiceBadge,
      fallbackUsed: Boolean(activeMeta?.fallbackUsed),
    };
  }, [messages, liveBrainMeta, backendHealth]);

  const suggestedPrompts: Record<AgentId, string[]> = {
    JARVIS_PRIME: [
      'Good day, AM AI. Summarize active priorities and system readiness.',
      'Open YouTube and play relaxing cosmic lo-fi music.',
      'Compare REST vs WebSockets vs Server-Sent Events in a table.',
    ],
    VERONICA_RESEARCH: [
      'Search the latest breakthroughs in clean fusion energy.',
      'Fact check: How does WebRTC low-latency audio streaming work?',
      'Verify top science and technology headlines today.',
    ],
    DUM_E_ENGINEER: [
      'Write a clean TypeScript React hook for debounced search.',
      'Design a resilient multi-provider LLM fallback architecture.',
      'Explain time and space complexity of A* pathfinding.',
    ],
    FRIDAY_COORDINATOR: [
      'Prepare my executive morning briefing with key priorities.',
      'Help me structure an engineering roadmap for this week.',
      'Draft a concise meeting agenda for architecture review.',
    ],
    HOMER_DIAGNOSTICS: [
      'Audit zero-trust API key isolation between frontend and Express.',
      'Explain SSE stream reconnection and cancellation safeguards.',
      'Check common Android WebView permission bridge pitfalls.',
    ],
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isThinking) return;
    if (input.length > 8000) return;
    if (!input.trim() && !pendingAttachment) return;
    const effectivePrompt =
      input.trim() || `Analyze attached file: ${pendingAttachment?.name ?? 'document'}`;
    nearBottomRef.current = true;
    onSendMessage(effectivePrompt, pendingAttachment ?? undefined);
    setInput('');
    onClearVoiceDraft?.();
    setPendingAttachment(null);
    setAttachmentError(null);
  };

  const readingColumnWidthClass = desktopSidebarOpen
    ? 'max-w-4xl xl:max-w-5xl'
    : 'max-w-5xl xl:max-w-6xl';

  const activeSpeakerCodename = activeCustomAgent?.codename || agent.codename;
  const activeSpeakerColor = activeCustomAgent?.accentColor || agent.accentColor;

  return (
    <div
      data-testid="chat-workspace-root"
      className="h-dvh w-screen overflow-hidden flex am-cosmic-bg text-slate-100"
    >
      {/* Desktop Collapsible Left Sidebar */}
      <aside
        aria-label="Desktop chat sidebar"
        className={`hidden md:block shrink-0 h-full transition-all duration-200 overflow-hidden ${
          desktopSidebarOpen ? 'w-[280px] lg:w-[296px]' : 'w-0'
        }`}
      >
        {desktopSidebarOpen && (
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            selectedAgent={selectedAgent}
            customAgents={customAgents}
            selectedCustomAgentId={selectedCustomAgentId}
            hasMessages={messages.length > 0}
            onCreateSession={onCreateSession}
            onSelectSession={onSelectSession}
            onToggleSaveSession={onToggleSaveSession}
            onRenameSession={onRenameSession}
            onDeleteSession={onDeleteSession}
            onClearHistory={onClearHistory}
            onSelectAgent={onSelectAgent}
            onSelectCustomAgent={onSelectCustomAgent}
            onNavigateScreen={onNavigateScreen}
            onCollapseDesktop={() => setDesktopSidebarOpen(false)}
          />
        )}
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/75 backdrop-blur-sm flex"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div
            className="w-[300px] max-w-[86vw] h-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              selectedAgent={selectedAgent}
              customAgents={customAgents}
              selectedCustomAgentId={selectedCustomAgentId}
              hasMessages={messages.length > 0}
              onCreateSession={onCreateSession}
              onSelectSession={onSelectSession}
              onToggleSaveSession={onToggleSaveSession}
              onRenameSession={onRenameSession}
              onDeleteSession={onDeleteSession}
              onClearHistory={onClearHistory}
              onSelectAgent={onSelectAgent}
              onSelectCustomAgent={onSelectCustomAgent}
              onNavigateScreen={onNavigateScreen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Full-Height Conversation Canvas */}
      <div className="flex-1 min-w-0 h-full flex flex-col relative">
        {/* Compact Cosmic Top Bar */}
        <header
          data-testid="chat-compact-header"
          className="shrink-0 h-14 px-3 sm:px-5 border-b border-cyan-500/20 bg-[#030712]/88 backdrop-blur-md flex items-center justify-between gap-2 z-20"
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile drawer toggle */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open chat sidebar"
              className="md:hidden p-2 rounded-xl border border-slate-800 bg-[#081326] text-cyan-300 hover:border-cyan-400/50 cursor-pointer shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Desktop reopen toggle when collapsed */}
            {!desktopSidebarOpen && (
              <button
                type="button"
                data-testid="expand-sidebar-btn"
                onClick={() => setDesktopSidebarOpen(true)}
                aria-label="Expand sidebar"
                title="Show sidebar"
                className="hidden md:inline-flex p-2 rounded-xl border border-cyan-500/35 bg-[#081326] text-cyan-300 hover:border-cyan-400 cursor-pointer shrink-0"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            {!desktopSidebarOpen && (
              <button
                type="button"
                onClick={onCreateSession}
                title="New Chat"
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-[#081326] hover:border-cyan-400/60 text-xs font-mono-hud text-slate-200 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-300" />
                <span>New</span>
              </button>
            )}

            <div className="flex items-center gap-2 min-w-0">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#071326] border border-cyan-500/30 shrink-0">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeSpeakerColor }}
                />
                <span className="font-display text-[11px] font-bold tracking-wider text-white">
                  AM AI
                </span>
                <span className="font-mono-hud text-[10px] text-cyan-300">
                  • {activeSpeakerCodename}
                </span>
              </div>

              <span className="text-xs sm:text-sm font-medium text-slate-200 truncate max-w-[160px] sm:max-w-[260px]">
                {activeSession?.title ?? 'Primary Neural Link'}
              </span>

              {activeSession && (
                <button
                  type="button"
                  onClick={() => onToggleSaveSession(activeSession.id)}
                  aria-label={activeSession.isSaved ? 'Unsave conversation' : 'Save conversation'}
                  title={activeSession.isSaved ? 'Saved conversation' : 'Bookmark conversation'}
                  className={`p-1.5 rounded-lg cursor-pointer shrink-0 ${
                    activeSession.isSaved
                      ? 'text-amber-300 bg-amber-500/10'
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${activeSession.isSaved ? 'fill-current' : ''}`}
                  />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Compact Online + Free Engine Status Pill */}
            <div
              data-testid="chat-active-provider-strip"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#071326]/90 border border-slate-800 font-mono-hud text-[10px]"
              title={`Engine: ${activeEngine} • Voice: ${activeModelTelemetry.voiceBadge}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionState === 'online'
                    ? 'bg-emerald-400'
                    : connectionState === 'connecting'
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-amber-400'
                }`}
              />
              <span className="text-emerald-300 font-bold">₹0</span>
              <span className="text-cyan-200 truncate max-w-[190px]">
                {activeModelTelemetry.providerLabel} • {activeModelTelemetry.modelName}
              </span>
            </div>

            {onChangeReasoningPreference && (
              <select
                aria-label="Reasoning depth"
                value={reasoningPreference}
                onChange={(e) => onChangeReasoningPreference(e.target.value as ReasoningPreference)}
                className="hidden xl:block bg-[#081326] border border-slate-800 hover:border-cyan-400/50 rounded-lg px-2 py-1 font-mono-hud text-[10px] text-cyan-200 focus:outline-none cursor-pointer"
              >
                <option value="auto">AUTO</option>
                <option value="fast">FAST</option>
                <option value="structured">STEP</option>
                <option value="deep">DEEP</option>
              </select>
            )}

            {onChangeBrainCollaborationMode && (
              <button
                type="button"
                onClick={() => {
                  const nextMode =
                    brainCollaborationMode === 'auto'
                      ? 'on'
                      : brainCollaborationMode === 'on'
                        ? 'off'
                        : 'auto';
                  onChangeBrainCollaborationMode(nextMode);
                }}
                title="Toggle Multi-AI Collaboration"
                className={`hidden xl:inline-flex px-2 py-1 rounded-lg border font-mono-hud text-[10px] cursor-pointer ${
                  brainCollaborationMode === 'on'
                    ? 'bg-violet-500/20 border-violet-400/60 text-violet-200'
                    : 'bg-[#081326] border-slate-800 text-slate-300 hover:border-cyan-400/50'
                }`}
              >
                MULTI-AI: {brainCollaborationMode.toUpperCase()}
              </button>
            )}

            <button
              type="button"
              onClick={onToggleWebSearch}
              title="Toggle Web Search Grounding"
              aria-label="Toggle web grounding"
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border font-mono-hud text-[10px] flex items-center gap-1 cursor-pointer ${
                webSearchEnabled || agent.enableWebSearch
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                  : 'bg-[#081326] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WEB</span>
            </button>

            {onToggleTemporaryChat && (
              <button
                type="button"
                onClick={onToggleTemporaryChat}
                title="Temporary Private Chat"
                aria-label="Toggle temporary chat"
                className={`p-2 rounded-xl border cursor-pointer ${
                  isTemporaryChat
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-[#081326] border-slate-800 text-slate-400 hover:text-amber-200'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search inside conversation"
              title="Search messages"
              className={`p-2 rounded-xl border cursor-pointer ${
                searchOpen || normalizedQuery
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                  : 'bg-[#081326] border-slate-800 text-slate-300 hover:border-cyan-400/50'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {onToggleMute && (
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isSpeechMuted ? 'Unmute voice output' : 'Mute voice output'}
                title={isSpeechMuted ? 'Unmute AM AI voice' : 'Mute AM AI voice'}
                className={`p-2 rounded-xl border cursor-pointer ${
                  isSpeechMuted
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                    : 'bg-[#081326] border-slate-800 text-slate-200 hover:border-cyan-400/50'
                }`}
              >
                {isSpeechMuted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <button
              type="button"
              data-testid="header-voice-mode-btn"
              onClick={onStartVoiceConversation}
              title="Open Full Voice Conversation HUD"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-violet-500/25 border border-cyan-400/50 hover:border-cyan-300 text-cyan-100 font-mono-hud text-[11px] font-semibold cursor-pointer"
            >
              <AudioWaveform className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden sm:inline">Voice Mode</span>
            </button>

            {onSummarizeSession && messages.length >= 2 && (
              <button
                type="button"
                disabled={isSummarizing || isThinking}
                onClick={onSummarizeSession}
                title="Summarize conversation"
                aria-label="Summarize conversation"
                className="hidden sm:inline-flex p-2 rounded-xl border border-violet-500/40 bg-[#081326] text-violet-300 hover:border-violet-400 disabled:opacity-45 cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              disabled={messages.length === 0}
              onClick={() => setExportModalOpen(true)}
              aria-label="Export Options"
              title="Export transcript"
              className={`hidden sm:inline-flex p-2 rounded-xl border cursor-pointer ${
                messages.length === 0
                  ? 'border-slate-800/60 bg-[#081326]/40 text-slate-600 cursor-not-allowed'
                  : exportedFormat
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-800 bg-[#081326] text-cyan-300 hover:border-cyan-400/50'
              }`}
            >
              {exportedFormat ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigateScreen('settings')}
              aria-label="Settings"
              title="Open AM AI Settings"
              className="p-2 rounded-xl border border-slate-800 bg-[#081326] text-slate-300 hover:text-cyan-200 hover:border-cyan-400/50 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Optional Collapsible Banners (Search / Connection / Temp / Summary) */}
        {searchOpen && (
          <div className="shrink-0 px-4 py-2 border-b border-slate-800/80 bg-[#040812]/90">
            <div className={`${readingColumnWidthClass} mx-auto flex items-center gap-2`}>
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter messages in this conversation..."
                  aria-label="Filter messages in conversation"
                  className="w-full bg-[#0A1426] border border-slate-700 focus:border-cyan-400 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear filter"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {normalizedQuery && (
                <span className="font-mono-hud text-[11px] text-cyan-300 shrink-0">
                  {filteredMessages.length} / {messages.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {connectionState !== 'online' && (
          <div
            className={`shrink-0 px-4 py-2 border-b text-xs font-mono-hud ${
              connectionState === 'key_missing'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : connectionState === 'connecting'
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            }`}
          >
            <div className={`${readingColumnWidthClass} mx-auto flex items-center justify-between gap-2`}>
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {connectionState === 'key_missing'
                  ? 'Backend active, awaiting free AI key (GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY).'
                  : connectionState === 'connecting'
                    ? 'Connecting to AM AI Cloud neural router...'
                    : 'Cloud backend unreachable — offline local capabilities remain active.'}
              </span>
              {connectionState !== 'connecting' && (
                <button
                  type="button"
                  onClick={onRetryConnection}
                  className="shrink-0 px-2.5 py-1 rounded-md border border-current/40 hover:bg-white/10 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>RETRY</span>
                </button>
              )}
            </div>
          </div>
        )}

        {(isTemporaryChat || activeSession?.isTemporary) && (
          <div className="shrink-0 px-4 py-1.5 border-b border-amber-500/30 bg-amber-500/10 text-xs font-mono-hud text-amber-200">
            <div className={`${readingColumnWidthClass} mx-auto flex items-center justify-between gap-2`}>
              <span className="flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
                <span>Temporary Chat Active — Not saved to history or memory.</span>
              </span>
              {onToggleTemporaryChat && (
                <button
                  type="button"
                  onClick={onToggleTemporaryChat}
                  className="px-2 py-0.5 rounded border border-amber-400/50 text-[10px] font-bold cursor-pointer"
                >
                  EXIT TEMP
                </button>
              )}
            </div>
          </div>
        )}

        {activeSession?.contextSummary && (
          <div className="shrink-0 px-4 py-2 border-b border-violet-500/30 bg-violet-950/20">
            <div className={`${readingColumnWidthClass} mx-auto space-y-1`}>
              <button
                type="button"
                onClick={() => setSummaryExpanded((v) => !v)}
                className="flex items-center gap-1.5 font-mono-hud text-[11px] font-bold text-violet-300 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>NEURAL MEMORY SUMMARY</span>
                {summaryExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              {summaryExpanded && (
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeSession.contextSummary}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Spacious Centered Conversation Feed */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          data-testid="chat-messages-scroll"
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-6"
        >
          <div className={`${readingColumnWidthClass} mx-auto space-y-7`}>
            {messages.length === 0 && !streamingText && (
              <div className="min-h-[55vh] flex flex-col items-center justify-center text-center py-10 space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 via-sky-500/15 to-violet-500/25 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_40px_rgba(0,229,255,0.18)]">
                  <Sparkles className="w-8 h-8 text-cyan-300" />
                </div>
                <div className="space-y-1.5 max-w-2xl">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white">
                    AM AI <span className="text-cyan-300">• {activeSpeakerCodename}</span>
                  </h1>
                  <p className="text-sm sm:text-base text-slate-400">
                    {activeCustomAgent?.systemPrompt.slice(0, 120) || agent.designation} — Ask anything in English, Hindi, or Hinglish.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl text-left">
                  {suggestedPrompts[selectedAgent].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onSendMessage(prompt)}
                      className="p-4 rounded-2xl bg-[#071122]/85 border border-slate-800/90 hover:border-cyan-400/60 hover:bg-[#091830] text-sm text-slate-200 transition-all cursor-pointer shadow-sm"
                    >
                      <p className="leading-snug">{prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length > 0 && normalizedQuery && filteredMessages.length === 0 && (
              <div className="max-w-md mx-auto my-10 rounded-2xl bg-[#040812]/90 border border-slate-800 p-6 text-center space-y-3">
                <Search className="w-7 h-7 text-cyan-400/60 mx-auto" />
                <p className="text-sm text-slate-200">
                  No messages match{' '}
                  <span className="text-cyan-300 font-mono-hud">"{searchQuery.trim()}"</span>
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#0D1527] border border-cyan-500/40 font-mono-hud text-xs text-cyan-300 cursor-pointer"
                >
                  CLEAR FILTER
                </button>
              </div>
            )}

            {filteredMessages.map((msg) => {
              const isUser = msg.role === 'user';
              const isLastAiReply =
                !isUser && messages.length > 0 && messages[messages.length - 1].id === msg.id;
              const isEditingThis = isUser && editingMessageId === msg.id;
              const isCopied = copiedMessageId === msg.id;
              const detectedYtId =
                !isUser && !msg.mediaPayload ? extractYouTubeVideoIdFromText(msg.text) : null;
              const inlineMediaPayload =
                msg.mediaPayload ?? (detectedYtId ? buildMediaPayloadFromVideoId(detectedYtId) : null);

              if (isUser) {
                return (
                  <div
                    key={msg.id}
                    data-testid={`chat-msg-user-${msg.id}`}
                    className="flex flex-col items-end"
                  >
                    <div className="max-w-[85%] sm:max-w-[72%] rounded-2xl rounded-br-sm px-4 sm:px-5 py-3.5 bg-gradient-to-br from-[#0E3F7D] via-[#0B2D5C] to-[#082043] border border-cyan-400/35 text-slate-50 shadow-[0_8px_24px_rgba(8,32,67,0.4)]">
                      {msg.attachment && (
                        <div className="mb-2.5 rounded-xl bg-[#040812]/70 border border-cyan-400/30 p-2.5 space-y-2">
                          {msg.attachment.previewDataUrl && (
                            <img
                              src={msg.attachment.previewDataUrl}
                              alt={msg.attachment.name}
                              className="max-h-60 rounded-lg object-contain border border-slate-800"
                            />
                          )}
                          <div className="flex items-center gap-2 font-mono-hud text-xs text-cyan-200">
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate">{msg.attachment.name}</span>
                            <span className="text-slate-400 shrink-0">
                              ({Math.max(1, Math.round(msg.attachment.sizeBytes / 1024))} KB)
                            </span>
                          </div>
                        </div>
                      )}

                      {isEditingThis ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (editingMessageText.trim()) {
                              onEditAndResend(msg.id, editingMessageText.trim());
                              setEditingMessageId(null);
                            }
                          }}
                          className="space-y-2.5 min-w-[260px]"
                        >
                          <textarea
                            value={editingMessageText}
                            onChange={(e) => setEditingMessageText(e.target.value)}
                            rows={3}
                            autoFocus
                            aria-label="Edit message"
                            className="w-full bg-[#040812] border border-cyan-400/70 rounded-xl p-3 text-sm sm:text-base text-slate-100 focus:outline-none resize-y"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingMessageId(null)}
                              className="px-3 py-1 rounded-lg border border-slate-600 font-mono-hud text-[11px] text-slate-200 cursor-pointer"
                            >
                              CANCEL
                            </button>
                            <button
                              type="submit"
                              disabled={!editingMessageText.trim() || isThinking}
                              className="px-3 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 font-mono-hud text-[11px] font-bold text-[#02050B] cursor-pointer"
                            >
                              SAVE & RESEND
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="whitespace-pre-wrap text-[15px] sm:text-base leading-relaxed">
                          {renderHighlightedText(msg.text, searchQuery)}
                        </div>
                      )}
                    </div>

                    {!isEditingThis && (
                      <div className="mt-1.5 px-1 flex items-center gap-3 font-mono-hud text-[10px] text-slate-400">
                        {msg.isVoice && <span className="text-emerald-300">[VOICE]</span>}
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg)}
                          className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopied ? 'COPIED' : 'COPY'}</span>
                        </button>
                        {!isThinking && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditingMessageText(msg.text);
                            }}
                            className="inline-flex items-center gap-1 hover:text-cyan-300 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>EDIT</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // Left-Aligned Wide Borderless AI Response with Subtle Purple Highlight
              return (
                <article
                  key={msg.id}
                  data-testid={`chat-msg-ai-${msg.id}`}
                  className={`w-full border-l-2 pl-4 sm:pl-6 pr-2 py-2.5 rounded-r-2xl transition-colors ${
                    msg.isError
                      ? 'border-rose-500/80 bg-gradient-to-r from-rose-950/35 via-rose-950/10 to-transparent'
                      : 'border-violet-500/75 bg-gradient-to-r from-violet-950/28 via-violet-950/10 to-transparent'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 font-mono-hud text-[11px] text-slate-400 mb-2">
                    <span className="font-bold text-violet-200 tracking-wide">
                      {renderHighlightedText(msg.agentCodename, searchQuery)}
                    </span>
                    {msg.isVoice && <span className="text-emerald-300">• VOICE</span>}
                    {msg.brainMeta?.model && (
                      <span className="px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-[10px] text-violet-200">
                        {msg.brainMeta.providerLabel || 'Gemini Free'} • {msg.brainMeta.model}
                      </span>
                    )}
                  </div>

                  {msg.isError && msg.errorMeta && (
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 font-mono-hud text-[10px]">
                      {msg.errorMeta.upstreamStatus && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-rose-200">
                          HTTP {msg.errorMeta.upstreamStatus}
                        </span>
                      )}
                      {msg.errorMeta.quotaCategory && msg.errorMeta.quotaCategory !== 'NONE' && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200">
                          {msg.errorMeta.quotaCategory.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  )}

                  {msg.isError ? (
                    <div className="space-y-2 text-rose-200">
                      <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">
                        {renderHighlightedText(msg.text, searchQuery)}
                      </p>
                      {msg.errorMeta?.explanation && (
                        <p className="text-xs text-slate-300 font-mono-hud">
                          {msg.errorMeta.explanation}{' '}
                          {msg.errorMeta.suggestedAction ? `— ${msg.errorMeta.suggestedAction}` : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <MarkdownMessage content={msg.text} searchQuery={searchQuery} />
                  )}

                  {inlineMediaPayload && (
                    <ChatMediaDeck
                      payload={inlineMediaPayload}
                      mediaState={mediaState}
                      isFullscreenOpen={Boolean(fullscreenMediaPayload)}
                      onPlayTrack={onPlayMediaTrack}
                      onPause={onPauseMedia}
                      onNext={onNextMedia}
                      onPrevious={onPreviousMedia}
                      onToggleMute={onToggleMediaMute}
                      onVolumeChange={onSetMediaVolume}
                      isInlineVideoActive={inlineVideoMessageId === msg.id}
                      onToggleInlineVideo={() =>
                        setInlineVideoMessageId((prev) => (prev === msg.id ? null : msg.id))
                      }
                      onUpdateStageRect={onUpdateChatMediaStageRect}
                      onOpenFullscreen={(payload) => {
                        setInlineVideoMessageId(null);
                        setFullscreenMediaPayload(payload);
                      }}
                      onCloseFullscreen={() => {
                        setFullscreenMediaPayload(null);
                        onUpdateChatMediaStageRect(null);
                      }}
                      onOpenAmPlayer={() => onNavigateScreen('media_control')}
                    />
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-2.5 border-t border-slate-800/70 flex flex-wrap gap-2">
                      {msg.sources.map((src) => (
                        <a
                          key={src.uri}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#081326] border border-slate-800 hover:border-cyan-400/50 text-xs text-sky-300 max-w-xs truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 font-mono-hud text-[11px]">
                    {!msg.isError && (
                      <button
                        type="button"
                        onClick={() => (isSpeaking ? onStopSpeaking() : onSpeakText(msg.text))}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#071326]/90 border border-slate-800 hover:border-cyan-400/60 text-cyan-200 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{isSpeaking ? 'Stop' : 'Speak'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#071326]/90 border border-slate-800 hover:border-cyan-400/60 text-slate-300 hover:text-white cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {isLastAiReply && !isThinking && (
                      <button
                        type="button"
                        onClick={onRegenerateLast}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#071326]/90 border border-slate-800 hover:border-violet-400/60 text-violet-200 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Regenerate</span>
                      </button>
                    )}

                    {msg.isError && (
                      <button
                        type="button"
                        disabled={isThinking}
                        onClick={onRetryLast}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-100 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}

            {streamingText && (
              <article
                data-testid="chat-streaming-response"
                className="w-full border-l-2 border-violet-400/90 pl-4 sm:pl-6 pr-2 py-2.5 rounded-r-2xl bg-gradient-to-r from-violet-950/30 via-violet-950/10 to-transparent"
              >
                <div className="flex items-center gap-2 font-mono-hud text-[11px] text-cyan-300 mb-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  <span>{activeSpeakerCodename} • STREAMING</span>
                </div>
                <MarkdownMessage content={streamingText} />
              </article>
            )}

            {isThinking && !streamingText && (
              <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-violet-950/25 border border-violet-500/35 font-mono-hud text-xs text-violet-200">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>{activeSpeakerCodename} thinking...</span>
              </div>
            )}

            <div ref={endRef} />
          </div>
        </div>

        {/* Bottom Docked Area: Stop Generating / Attachment Preview / Voice Status / Large Composer */}
        <div className="shrink-0 px-3 sm:px-8 pb-3 sm:pb-5 pt-2 bg-gradient-to-t from-[#02050B] via-[#02050B]/95 to-transparent">
          <div className={`${readingColumnWidthClass} mx-auto space-y-2`}>
            {(isThinking || streamingText) && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/60 hover:bg-rose-500/30 text-rose-100 font-mono-hud text-xs font-semibold cursor-pointer shadow-lg"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Generating</span>
                </button>
              </div>
            )}

            {attachmentError && (
              <div className="px-3.5 py-2 rounded-xl border border-rose-500/40 bg-rose-500/15 flex items-center justify-between gap-2 font-mono-hud text-xs text-rose-200">
                <span>{attachmentError}</span>
                <button
                  type="button"
                  onClick={() => setAttachmentError(null)}
                  aria-label="Dismiss attachment error"
                  className="text-rose-200 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {pendingAttachment && (
              <div className="px-3.5 py-2 rounded-xl border border-cyan-500/40 bg-[#071122] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {pendingAttachment.previewDataUrl ? (
                    <img
                      src={pendingAttachment.previewDataUrl}
                      alt={pendingAttachment.name}
                      className="w-10 h-10 rounded-lg object-cover border border-cyan-500/40 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-cyan-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-mono-hud text-xs text-slate-100 truncate max-w-[240px]">
                      {pendingAttachment.name}
                    </p>
                    <p className="font-mono-hud text-[10px] text-slate-400">
                      {pendingAttachment.mimeType} •{' '}
                      {Math.max(1, Math.round(pendingAttachment.sizeBytes / 1024))} KB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {typeof pendingAttachment.textContent === 'string' && (
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAttachment((prev) =>
                          prev ? { ...prev, useAsTextContext: !prev.useAsTextContext } : prev
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg border font-mono-hud text-[10px] font-bold cursor-pointer ${
                        pendingAttachment.useAsTextContext
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-[#0D1527] border-slate-700 text-slate-300'
                      }`}
                    >
                      Context: {pendingAttachment.useAsTextContext ? 'ON' : 'OFF'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    aria-label="Remove attachment"
                    className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {(isSpeaking || isListening || voiceStatusMessage) && (
              <div className="px-3.5 py-2 rounded-xl border border-cyan-500/30 bg-[#071122]/95 flex flex-wrap items-center justify-between gap-2 font-mono-hud text-xs">
                <span
                  className={
                    isListening ? 'text-cyan-300' : isSpeaking ? 'text-violet-300' : 'text-amber-200'
                  }
                >
                  {isListening
                    ? '● Listening (Hindi / English / Hinglish)...'
                    : isSpeaking
                      ? isSpeechPaused
                        ? '❚❚ Voice Paused'
                        : `▶ Speaking (${activeModelTelemetry.voiceBadge})`
                      : voiceStatusMessage}
                </span>
                {isSpeaking && (
                  <div className="flex items-center gap-2">
                    {isSpeechPaused && onResumeSpeaking ? (
                      <button
                        type="button"
                        onClick={onResumeSpeaking}
                        className="px-2.5 py-1 rounded-lg bg-emerald-400 text-[#02050B] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>Resume</span>
                      </button>
                    ) : onPauseSpeaking ? (
                      <button
                        type="button"
                        onClick={onPauseSpeaking}
                        className="px-2.5 py-1 rounded-lg bg-amber-400 text-[#02050B] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={onStopSpeaking}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/60 text-rose-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3" />
                      <span>Stop</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Large ChatGPT-Style Composer */}
            <form
              onSubmit={handleSubmit}
              data-testid="chat-bottom-composer"
              className="rounded-2xl border border-cyan-500/30 bg-[#071122]/95 shadow-[0_12px_36px_rgba(0,0,0,0.6)] p-2.5 sm:p-3 space-y-2 focus-within:border-cyan-400/75 transition-colors"
            >
              <input
                ref={attachMixedRef}
                type="file"
                accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,.md,.markdown,.csv,.json,text/*"
                aria-label="Attach mixed file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAttachmentSelected(f);
                  e.target.value = '';
                }}
              />
              <input
                ref={attachImageRef}
                type="file"
                accept="image/*"
                aria-label="Upload image"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAttachmentSelected(f);
                  e.target.value = '';
                }}
              />
              <input
                ref={attachFileRef}
                type="file"
                accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,.md,.markdown,.csv,.json,text/*"
                aria-label="Upload document"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAttachmentSelected(f);
                  e.target.value = '';
                }}
              />

              <textarea
                rows={input.includes('\n') || input.length > 100 ? 3 : 2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  pendingAttachment
                    ? `Message ${activeSpeakerCodename} about ${pendingAttachment.name}...`
                    : `Message ${activeSpeakerCodename} (English / Hindi / Hinglish)...`
                }
                aria-label="Message input"
                className="w-full bg-transparent px-2 py-1 text-[15px] sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-48 leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => attachMixedRef.current?.click()}
                    title="Attach image or document"
                    aria-label="Attach"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0B172C] border border-slate-800 hover:border-cyan-400/60 text-xs text-cyan-200 cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Attach</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => attachImageRef.current?.click()}
                    title="Upload image"
                    aria-label="Upload image"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0B172C] border border-slate-800 hover:border-cyan-400/60 text-xs text-slate-200 hover:text-cyan-200 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-sky-300" />
                    <span className="hidden sm:inline">Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => attachFileRef.current?.click()}
                    title="Upload document (PDF, DOCX, TXT, JSON, CSV)"
                    aria-label="Upload file"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0B172C] border border-slate-800 hover:border-cyan-400/60 text-xs text-slate-200 hover:text-cyan-200 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-violet-300" />
                    <span className="hidden sm:inline">File</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {input.length > 0 && (
                    <span
                      className={`hidden md:inline font-mono-hud text-[10px] ${
                        input.length > 8000 ? 'text-rose-400 font-bold' : 'text-slate-500'
                      }`}
                    >
                      {input.length} / 8000
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={isSpeaking ? onStopSpeaking : isListening ? onStopVoice : onStartVoice}
                    aria-label={isListening ? 'Stop voice dictation' : 'Voice dictation'}
                    title="Microphone dictation"
                    className={`p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      isListening
                        ? 'bg-rose-500/20 border-rose-400 text-rose-300 animate-pulse'
                        : isSpeaking
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-[#0B172C] border-slate-700 text-cyan-300 hover:border-cyan-400'
                    }`}
                  >
                    {isSpeaking || isListening ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="composer-voice-conversation-btn"
                    onClick={onStartVoiceConversation}
                    aria-label="Start voice conversation"
                    title="Conversational Voice Mode"
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-violet-500/20 border border-violet-400/50 hover:border-violet-300 text-violet-100 text-xs font-medium cursor-pointer"
                  >
                    <AudioWaveform className="w-4 h-4 text-violet-300" />
                    <span className="hidden md:inline">Voice</span>
                  </button>

                  {isThinking ? (
                    <button
                      type="button"
                      onClick={onStopStreaming}
                      aria-label="Stop generation"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-display text-xs font-bold cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={(!input.trim() && !pendingAttachment) || input.length > 8000}
                      aria-label="Send message"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 disabled:opacity-40 text-[#02050B] font-display text-xs font-bold cursor-pointer shadow-[0_0_20px_rgba(0,229,255,0.28)] transition-all"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {exportModalOpen && messages.length > 0 && (
        <ChatExportModal
          messages={messages}
          agent={agent}
          onClose={() => setExportModalOpen(false)}
          onExported={(fmt) => {
            setExportedFormat(fmt);
            window.setTimeout(() => setExportedFormat(null), 2200);
          }}
        />
      )}

      {fullscreenMediaPayload && (
        <FullscreenMediaModal
          payload={fullscreenMediaPayload}
          mediaState={mediaState}
          onPlay={() => mediaState.currentTrack && onPlayMediaTrack(mediaState.currentTrack)}
          onPause={onPauseMedia}
          onNext={onNextMedia}
          onPrevious={onPreviousMedia}
          onToggleMute={onToggleMediaMute}
          onClose={() => {
            setFullscreenMediaPayload(null);
            onUpdateChatMediaStageRect(null);
          }}
          onUpdateStageRect={onUpdateChatMediaStageRect}
        />
      )}
    </div>
  );
};

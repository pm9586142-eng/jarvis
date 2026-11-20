import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  FileText,
  Globe,
  MessageSquare,
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
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MarkdownMessage } from '../components/MarkdownMessage';
import { AGENT_LIST, JARVIS_AGENTS } from '../data/agents';
import { searchConversations } from '../services/brainEngine.js';
import {
  AgentId,
  BackendHealth,
  ChatBrainMeta,
  ChatMessage,
  ChatSession,
  ConnectionState,
  CustomAgent,
  ReasoningPreference,
} from '../types/jarvis';

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
  openSessionsSignal?: number;
  onSelectAgent: (id: AgentId) => void;
  onSelectCustomAgent: (id: string) => void;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onSummarizeSession?: () => void;
  onToggleTemporaryChat?: () => void;
  onChangeReasoningPreference?: (pref: ReasoningPreference) => void;
  onChangeBrainCollaborationMode?: (mode: 'auto' | 'on' | 'off') => void;
  onOpenBrainCenter?: () => void;
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
  femaleVoiceEnabled = true,
  openSessionsSignal = 0,
  onSelectAgent,
  onSelectCustomAgent,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onSummarizeSession,
  onToggleTemporaryChat,
  onChangeReasoningPreference,
  onChangeBrainCollaborationMode,
  onOpenBrainCenter,
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
}) => {
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionsDrawerOpen, setSessionsDrawerOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  useEffect(() => {
    if (voiceDraft) {
      setInput(voiceDraft);
    }
  }, [voiceDraft]);

  useEffect(() => {
    if (openSessionsSignal > 0) {
      setSessionsDrawerOpen(true);
    }
  }, [openSessionsSignal]);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<'json' | 'csv' | 'md'>('json');
  const [exportedFormat, setExportedFormat] = useState<'json' | 'csv' | 'md' | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingChatAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const agent = JARVIS_AGENTS[selectedAgent];

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
  const activeSessionTitle = activeSession?.title ?? 'Primary Neural Link';

  const sessionSearchHits = useMemo(() => {
    const q = sessionSearchQuery.trim();
    if (!q) return new Map<string, { matchCount: number; snippet?: string }>();
    const hits = searchConversations(sessions, q, 30);
    const map = new Map<string, { matchCount: number; snippet?: string }>();
    for (const h of hits) {
      map.set(h.sessionId, {
        matchCount: h.matchCount,
        snippet: h.snippets[0]?.snippet,
      });
    }
    return map;
  }, [sessions, sessionSearchQuery]);

  const filteredSessions = useMemo(() => {
    const q = sessionSearchQuery.trim().toLowerCase();
    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter((s) => sessionSearchHits.has(s.id));
  }, [sessions, sessionSearchQuery, sessionSearchHits]);

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText, isThinking]);

  useEffect(() => {
    if (!exportModalOpen && !sessionsDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportModalOpen(false);
        setSessionsDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [exportModalOpen, sessionsDrawerOpen]);

  const buildTranscriptPayload = (format: 'json' | 'csv' | 'md') => {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes()
    ).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    if (format === 'json') {
      const content = JSON.stringify(
        {
          system: 'J.A.R.V.I.S. Cosmic Intelligence',
          exportedAt: now.toISOString(),
          activeAgent: agent.codename,
          messageCount: messages.length,
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            sender: m.role === 'user' ? 'Sir' : m.agentCodename,
            agentCodename: m.agentCodename,
            timestamp: m.timestamp,
            isoTime: new Date(m.timestamp).toISOString(),
            isVoice: Boolean(m.isVoice),
            isError: Boolean(m.isError),
            text: m.text,
            sources: m.sources ?? [],
          })),
        },
        null,
        2
      );
      return {
        content,
        mimeType: 'application/json;charset=utf-8',
        filename: `jarvis-transcript-${stamp}.json`,
      };
    }

    if (format === 'csv') {
      const csvCell = (val: string | number | boolean) =>
        `"${String(val).replace(/"/g, '""')}"`;

      const headerRow = [
        'id',
        'timestamp',
        'iso_time',
        'role',
        'sender',
        'agent_codename',
        'is_voice',
        'is_error',
        'text',
        'sources',
      ]
        .map(csvCell)
        .join(',');

      const rows = messages.map((m) =>
        [
          m.id,
          m.timestamp,
          new Date(m.timestamp).toISOString(),
          m.role,
          m.role === 'user' ? 'Sir' : m.agentCodename,
          m.agentCodename,
          Boolean(m.isVoice),
          Boolean(m.isError),
          m.text,
          (m.sources ?? []).map((s) => `${s.title} (${s.uri})`).join(' | '),
        ]
          .map(csvCell)
          .join(',')
      );

      return {
        content: `\uFEFF${headerRow}\n${rows.join('\n')}\n`,
        mimeType: 'text/csv;charset=utf-8',
        filename: `jarvis-transcript-${stamp}.csv`,
      };
    }

    // Markdown (.md)
    const mdHeader = [
      '# J.A.R.V.I.S. — Neural Chat Transcript',
      '',
      `- **Exported:** ${now.toLocaleString()}`,
      `- **Active Agent:** ${agent.codename} (${agent.designation})`,
      `- **Messages:** ${messages.length}`,
      '',
      '---',
      '',
    ].join('\n');

    const mdBody = messages
      .map((m) => {
        const timeStr = new Date(m.timestamp).toLocaleString();
        const sender = m.role === 'user' ? 'Sir' : m.agentCodename;
        const badges = [
          m.isVoice ? '`VOICE`' : null,
          m.isError ? '`ERROR`' : null,
        ]
          .filter(Boolean)
          .join(' ');
        const badgeSuffix = badges ? ` ${badges}` : '';
        const sourcesSection =
          m.sources && m.sources.length > 0
            ? '\n\n**Verified Sources:**\n' +
              m.sources.map((s) => `- [${s.title}](${s.uri})`).join('\n')
            : '';
        return `### ${sender}${badgeSuffix}\n*${timeStr}*\n\n${m.text}${sourcesSection}`;
      })
      .join('\n\n---\n\n');

    return {
      content: `${mdHeader}${mdBody}\n`,
      mimeType: 'text/markdown;charset=utf-8',
      filename: `jarvis-transcript-${stamp}.md`,
    };
  };

  const previewText = useMemo(() => {
    if (!exportModalOpen || messages.length === 0) return '';
    const { content } = buildTranscriptPayload(selectedExportFormat);
    const lines = content.split('\n').slice(0, 9);
    const truncated = lines.join('\n');
    return content.split('\n').length > 9 ? `${truncated}\n...` : truncated;
  }, [exportModalOpen, selectedExportFormat, messages, selectedAgent]);

  const handleDownloadTranscript = (format: 'json' | 'csv' | 'md') => {
    if (messages.length === 0) return;

    const { content, mimeType, filename } = buildTranscriptPayload(format);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportModalOpen(false);
    setExportedFormat(format);
    window.setTimeout(() => setExportedFormat(null), 2200);
  };

  const suggestedPrompts: Record<AgentId, string[]> = {
    JARVIS_PRIME: [
      'Good day, JARVIS. Give me a system readiness status.',
      'Tell me an intelligent joke, Sir.',
      'Summarize our active memories and priorities.',
    ],
    VERONICA_RESEARCH: [
      'Search the latest breakthroughs in clean fusion energy.',
      'What are the key differences between HTTP/3 and WebSockets?',
      'Verify current world news highlights.',
    ],
    DUM_E_ENGINEER: [
      'Write a clean TypeScript debounce hook with cleanup.',
      'Review REST vs GraphQL vs tRPC trade-offs.',
      'Explain time complexity of A* pathfinding.',
    ],
    FRIDAY_COORDINATOR: [
      'Prepare my executive morning briefing.',
      'Help me prioritize engineering vs board review tasks.',
      'Draft a concise meeting agenda for Q4 clean energy.',
    ],
    HOMER_DIAGNOSTICS: [
      'Evaluate browser security posture and defensive best practices.',
      'Explain how zero-trust backend API key isolation protects web apps.',
      'Diagnose common SSE streaming timeout scenarios.',
    ],
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isThinking) return;
    if (input.length > 8000) return;
    if (!input.trim() && !pendingAttachment) return;
    const effectivePrompt = input.trim() || `Analyze attached file: ${pendingAttachment?.name ?? 'document'}`;
    onSendMessage(effectivePrompt, pendingAttachment ?? undefined);
    setInput('');
    onClearVoiceDraft?.();
    setPendingAttachment(null);
    setAttachmentError(null);
  };

  return (
    <div className="relative flex flex-col min-h-[420px] h-[calc(100dvh-9rem)] glass-panel rounded-2xl overflow-hidden">
      {/* Session & Agent Selection Bar */}
      <div className="relative z-20 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-[#040812]/90">
        <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 pr-1">
          <button
            type="button"
            onClick={() => setSessionsDrawerOpen(true)}
            title="Open chat sessions drawer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-500/40 bg-[#0D1527] hover:border-cyan-400 text-cyan-300 font-mono-hud text-xs whitespace-nowrap cursor-pointer shrink-0"
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span className="max-w-[120px] truncate">{activeSessionTitle}</span>
            <span className="text-[10px] px-1 rounded bg-cyan-500/15 text-cyan-200">
              {sessions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={onCreateSession}
            title="Start a new chat session"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-[#0D1527] hover:border-cyan-400/60 text-slate-200 hover:text-cyan-300 font-mono-hud text-xs whitespace-nowrap cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">New chat</span>
          </button>

          <span className="h-4 w-px bg-slate-800 shrink-0" />

          {AGENT_LIST.map((ag) => {
            const active = !selectedCustomAgentId && ag.id === selectedAgent;
            return (
              <button
                key={ag.id}
                type="button"
                onClick={() => onSelectAgent(ag.id)}
                className={`px-3 py-1.5 rounded-lg font-mono-hud text-xs whitespace-nowrap transition-all cursor-pointer border ${
                  active
                    ? 'bg-cyan-400/15 text-white border-cyan-400/60'
                    : 'bg-[#0D1527] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                style={active ? { borderColor: ag.accentColor, color: ag.accentColor } : undefined}
              >
                {ag.codename}
              </button>
            );
          })}
          {customAgents.map((cag) => {
            const active = selectedCustomAgentId === cag.id;
            return (
              <button
                key={cag.id}
                type="button"
                onClick={() => onSelectCustomAgent(cag.id)}
                className={`px-3 py-1.5 rounded-lg font-mono-hud text-xs whitespace-nowrap transition-all cursor-pointer border ${
                  active
                    ? 'bg-cyan-400/15 text-white border-cyan-400/60'
                    : 'bg-[#0D1527] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                style={active ? { borderColor: cag.accentColor, color: cag.accentColor } : undefined}
              >
                {cag.codename}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onChangeReasoningPreference && (
            <select
              aria-label="Reasoning depth"
              title="Select AI reasoning depth"
              value={reasoningPreference}
              onChange={(e) => onChangeReasoningPreference(e.target.value as ReasoningPreference)}
              className="hidden sm:block bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 rounded-lg px-2 py-1 font-mono-hud text-[11px] text-cyan-200 focus:outline-none cursor-pointer"
            >
              <option value="auto">REASON: AUTO</option>
              <option value="fast">REASON: FAST</option>
              <option value="structured">REASON: STEP</option>
              <option value="deep">REASON: DEEP</option>
            </select>
          )}

          {onToggleTemporaryChat && (
            <button
              type="button"
              onClick={onToggleTemporaryChat}
              title="Temporary Chat Mode: messages are not saved to history and memory read/write is paused"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono-hud text-[11px] cursor-pointer ${
                isTemporaryChat
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-[#0D1527] border-slate-800 text-slate-400 hover:text-amber-200 hover:border-amber-400/50'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{isTemporaryChat ? 'TEMP ON' : 'TEMP'}</span>
            </button>
          )}

          {onSummarizeSession && (
            <button
              type="button"
              disabled={messages.length === 0 || isSummarizing || isThinking}
              onClick={onSummarizeSession}
              title="Summarize current conversation via Gemini Brain"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-violet-500/40 bg-[#0D1527] hover:border-violet-400 disabled:opacity-45 text-violet-300 font-mono-hud text-[11px] cursor-pointer"
            >
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isSummarizing ? 'SUMMARIZING...' : 'SUMMARIZE'}
              </span>
            </button>
          )}

          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isSpeechMuted ? 'Unmute voice output' : 'Mute voice output'}
              className={`p-1.5 rounded-lg border font-mono-hud text-[11px] cursor-pointer ${
                isSpeechMuted
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-[#0D1527] border-slate-800 text-slate-300 hover:border-cyan-400/50'
              }`}
            >
              {isSpeechMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleWebSearch}
            title="Toggle Google Search Grounding for Gemini"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono-hud text-[11px] cursor-pointer ${
              webSearchEnabled || agent.enableWebSearch
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                : 'bg-[#0D1527] border-slate-800 text-slate-400'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WEB GROUNDING</span>
          </button>

          <button
            type="button"
            disabled={messages.length === 0}
            onClick={() => setExportModalOpen(true)}
            aria-label="Export Options"
            aria-haspopup="dialog"
            title={
              messages.length === 0
                ? 'Start a conversation to export the transcript'
                : 'Open Export Options (JSON, CSV, Markdown)'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono-hud text-[11px] transition-colors ${
              messages.length === 0
                ? 'bg-[#0D1527]/50 border-slate-800/70 text-slate-500 opacity-55 cursor-not-allowed'
                : exportedFormat
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 cursor-pointer'
                  : 'bg-[#0D1527] border-slate-800 text-cyan-300 hover:border-cyan-400/60 cursor-pointer'
            }`}
          >
            {exportedFormat ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">SAVED .{exportedFormat.toUpperCase()}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export Options</span>
              </>
            )}
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              aria-label="Clear conversation history"
              className="p-1.5 rounded-lg border border-slate-800 bg-[#0D1527] text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Active Free Multi-Provider & Model Telemetry Strip */}
      {(() => {
        const lastAiMsg = [...messages].reverse().find((m) => m.role === 'jarvis' && !m.isError && m.brainMeta?.model);
        const activeMeta = liveBrainMeta || lastAiMsg?.brainMeta;
        const activeProviderLabel =
          activeMeta?.providerLabel ||
          backendHealth?.activeProviderLabel ||
          backendHealth?.multiProvider?.activeProviderLabel ||
          'Google Gemini Free';
        const activeModelName =
          activeMeta?.model ||
          backendHealth?.activeModel ||
          backendHealth?.model ||
          'gemini-3.8-flash';
        const isSwitched = Boolean(activeMeta?.fallbackUsed);
        const configuredCount = backendHealth?.multiProvider?.configuredProviders?.length ?? (backendHealth?.geminiConfigured ? 1 : 0);
        const allExhausted = Boolean(backendHealth?.multiProvider?.allProvidersExhausted);
        return (
          <div
            data-testid="chat-active-provider-strip"
            className="px-4 py-1.5 border-b border-slate-800/80 bg-[#040812]/80 flex flex-wrap items-center justify-between gap-2 font-mono-hud text-[10px]"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-bold">
                ₹0 FREE-ONLY
              </span>
              <span
                className={`px-2 py-0.5 rounded border font-semibold ${
                  allExhausted
                    ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                    : isSwitched
                      ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                      : 'bg-cyan-500/10 border-cyan-500/35 text-cyan-200'
                }`}
              >
                ACTIVE: {activeProviderLabel.toUpperCase()} • {activeModelName}
              </span>
              {isSwitched && activeMeta?.switchedFromProvider && (
                <span className="text-amber-300/90">
                  (auto-switched from {activeMeta.switchedFromProvider.toUpperCase()})
                </span>
              )}
              {femaleVoiceEnabled && (
                <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/15 border border-fuchsia-400/40 text-fuchsia-200">
                  AM AI FEMALE VOICE
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
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
                  title="Toggle Multi-AI Collaboration & Self-Verification Mode"
                  className={`px-2 py-0.5 rounded border font-bold cursor-pointer ${
                    brainCollaborationMode === 'on'
                      ? 'bg-violet-500/20 border-violet-400/60 text-violet-200'
                      : brainCollaborationMode === 'auto'
                        ? 'bg-cyan-500/15 border-cyan-400/45 text-cyan-200'
                        : 'bg-[#0D1527] border-slate-700 text-slate-400'
                  }`}
                >
                  MULTI-AI: {brainCollaborationMode.toUpperCase()}
                </button>
              )}
              {onOpenBrainCenter && (
                <button
                  type="button"
                  onClick={onOpenBrainCenter}
                  className="px-2 py-0.5 rounded bg-[#0D1527] border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 flex items-center gap-1 cursor-pointer"
                >
                  <Brain className="w-3 h-3" />
                  <span>BRAIN HUB</span>
                </button>
              )}
              {isSpeaking && (
                <button
                  type="button"
                  onClick={onStopSpeaking}
                  className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/60 text-rose-200 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>STOP VOICE</span>
                </button>
              )}
              <span className="text-slate-400 hidden xl:inline">
                {configuredCount > 0
                  ? `${configuredCount} FREE PROVIDER${configuredCount === 1 ? '' : 'S'} ARMED`
                  : 'NO FREE KEY SET'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Temporary Chat Privacy Banner */}
      {(isTemporaryChat || activeSession?.isTemporary) && (
        <div className="px-4 py-2 border-b border-amber-500/35 bg-amber-500/10 flex flex-wrap items-center justify-between gap-2 font-mono-hud text-xs text-amber-200">
          <span className="flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
            <span>
              TEMPORARY CHAT ACTIVE — Not saved to persistent browser history; long-term memory read/write paused.
            </span>
          </span>
          {onToggleTemporaryChat && (
            <button
              type="button"
              onClick={onToggleTemporaryChat}
              className="px-2.5 py-1 rounded-md border border-amber-400/50 hover:bg-amber-500/20 text-[10px] font-bold cursor-pointer"
            >
              EXIT TEMP MODE
            </button>
          )}
        </div>
      )}

      {/* Brain Context Summary Card */}
      {activeSession?.contextSummary && (
        <div className="px-4 py-2 border-b border-violet-500/30 bg-violet-950/20 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSummaryExpanded((v) => !v)}
              className="flex items-center gap-1.5 font-mono-hud text-[11px] font-bold text-violet-300 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>NEURAL MEMORY SUMMARY</span>
              {summaryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          {summaryExpanded && (
            <div className="text-xs text-slate-300 space-y-1">
              <p className="leading-relaxed">{activeSession.contextSummary}</p>
              {activeSession.summaryKeyPoints && activeSession.summaryKeyPoints.length > 0 && (
                <p className="font-mono-hud text-[10px] text-cyan-300">
                  Key Points: {activeSession.summaryKeyPoints.join(' • ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conversation Keyword Search Bar */}
      <div className="px-4 py-2 border-b border-slate-800/90 bg-[#040812]/75 flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search conversation messages"
            placeholder="Filter conversation by keyword..."
            className="w-full bg-[#0D1527]/90 border border-slate-800 focus:border-cyan-400/70 rounded-lg pl-8 pr-8 py-1.5 font-mono-hud text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-cyan-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {normalizedQuery && (
          <span className="font-mono-hud text-[11px] text-cyan-300 shrink-0">
            {filteredMessages.length} / {messages.length} MATCH{filteredMessages.length === 1 ? '' : 'ES'}
          </span>
        )}
      </div>

      {/* Honest Gemini Connection Banner */}
      {connectionState !== 'online' && (
        <div
          className={`px-4 py-2 border-b flex items-center justify-between gap-2 text-xs font-mono-hud ${
            connectionState === 'key_missing'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              : connectionState === 'connecting'
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {connectionState === 'key_missing'
              ? 'Server running, but no free AI provider key is set. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in your server environment variables.'
              : connectionState === 'connecting'
                ? 'Checking backend free multi-provider AI connection...'
                : 'Backend API server is unreachable. Start the Express server or verify VITE_API_BASE_URL.'}
          </span>
          {connectionState !== 'connecting' && (
            <button
              type="button"
              onClick={onRetryConnection}
              className="shrink-0 px-2.5 py-1 rounded-md border border-current/40 hover:bg-white/10 font-mono-hud text-[10px] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>RETRY</span>
            </button>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingText && (
          <div className="max-w-xl mx-auto py-8 text-center space-y-5">
            <div>
              <p className="font-display text-lg font-semibold" style={{ color: agent.accentColor }}>
                {agent.designation}
              </p>
              <p className="font-mono-hud text-xs text-slate-400 mt-1">{agent.specialization}</p>
            </div>
            <div className="space-y-2 text-left">
              <p className="font-mono-hud text-[11px] text-cyan-300 uppercase tracking-wider">
                Suggested Directives:
              </p>
              {suggestedPrompts[selectedAgent].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSendMessage(prompt)}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#0D1527] border border-slate-800 hover:border-cyan-400/50 text-xs sm:text-sm text-slate-200 transition-colors cursor-pointer"
                >
                  • {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && normalizedQuery && filteredMessages.length === 0 && (
          <div className="max-w-md mx-auto my-8 rounded-2xl bg-[#040812]/90 border border-slate-800 p-6 text-center space-y-3">
            <Search className="w-7 h-7 text-cyan-400/60 mx-auto" />
            <p className="text-sm text-slate-200">
              No messages match <span className="text-cyan-300 font-mono-hud">"{searchQuery.trim()}"</span>
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-3.5 py-1.5 rounded-lg bg-[#0D1527] border border-cyan-500/40 hover:border-cyan-400 font-mono-hud text-xs text-cyan-300 cursor-pointer"
            >
              CLEAR SEARCH
            </button>
          </div>
        )}

        {filteredMessages.map((msg) => {
          const isUser = msg.role === 'user';
          const isLastAiReply =
            !isUser && messages.length > 0 && messages[messages.length - 1].id === msg.id;
          const isEditingThis = isUser && editingMessageId === msg.id;
          const isCopied = copiedMessageId === msg.id;

          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div className="flex flex-wrap items-center gap-1.5 font-mono-hud text-[10px] text-slate-400 mb-1 px-1">
                <span>
                  {isUser ? 'Sir' : renderHighlightedText(msg.agentCodename, searchQuery)}
                  {msg.isVoice ? ' • [VOICE]' : ''}
                </span>
                {!isUser && msg.brainMeta && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[9px] text-cyan-300">
                    {msg.brainMeta.intent} • {msg.brainMeta.detectedLanguage} • {msg.brainMeta.reasoningMode}
                  </span>
                )}
                {!isUser && msg.brainMeta?.model && (
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${
                      msg.brainMeta.fallbackUsed
                        ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                        : 'bg-slate-900/70 border-slate-700 text-slate-300'
                    }`}
                    title={
                      msg.brainMeta.fallbackUsed
                        ? `Automatically switched from ${msg.brainMeta.switchedFromProvider ? `${msg.brainMeta.switchedFromProvider} (${msg.brainMeta.switchedFrom || msg.brainMeta.primaryModel})` : msg.brainMeta.switchedFrom || msg.brainMeta.primaryModel} to free ${msg.brainMeta.providerLabel || msg.brainMeta.provider || 'provider'} model ${msg.brainMeta.model}`
                        : `Served by ${msg.brainMeta.providerLabel || 'Google Gemini Free'} (${msg.brainMeta.model})`
                    }
                  >
                    {msg.brainMeta.fallbackUsed
                      ? `FREE SWITCH: ${msg.brainMeta.providerLabel || msg.brainMeta.provider || 'FREE'} • ${msg.brainMeta.model}`
                      : `${msg.brainMeta.providerLabel || 'Gemini Free'} • ${msg.brainMeta.model}`}
                  </span>
                )}
              </div>

              <div
                className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.isError
                    ? 'bg-rose-500/15 border border-rose-500/50 text-rose-200'
                    : isUser
                      ? 'bg-[#0D1527] border border-slate-700 text-slate-100 rounded-br-sm'
                      : 'bg-violet-950/35 border border-cyan-500/35 text-slate-100 rounded-bl-sm'
                }`}
              >
                {msg.attachment && (
                  <div className="mb-2.5 rounded-xl bg-[#040812]/80 border border-slate-700/80 p-2 space-y-1.5">
                    {msg.attachment.previewDataUrl && (
                      <img
                        src={msg.attachment.previewDataUrl}
                        alt={msg.attachment.name}
                        className="max-h-44 rounded-lg object-contain border border-slate-800"
                      />
                    )}
                    <div className="flex items-center gap-2 font-mono-hud text-[11px] text-cyan-300">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{msg.attachment.name}</span>
                      <span className="text-slate-500 shrink-0">
                        ({Math.max(1, Math.round(msg.attachment.sizeBytes / 1024))} KB
                        {msg.attachment.isTextContext ? ' • Context' : ''})
                      </span>
                    </div>
                  </div>
                )}

                {msg.isError && msg.errorMeta && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 font-mono-hud text-[10px]">
                    {msg.errorMeta.upstreamStatus && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-400/50 text-rose-100 font-semibold">
                        HTTP {msg.errorMeta.upstreamStatus}
                      </span>
                    )}
                    {msg.errorMeta.quotaCategory && msg.errorMeta.quotaCategory !== 'NONE' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 font-semibold">
                        {msg.errorMeta.quotaCategory.replace(/_/g, ' ')}
                      </span>
                    )}
                    {typeof msg.errorMeta.retryAfterSeconds === 'number' && msg.errorMeta.retryAfterSeconds > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/70 border border-slate-700 text-slate-200">
                        RETRY AFTER {Math.ceil(msg.errorMeta.retryAfterSeconds)}S
                      </span>
                    )}
                    {typeof msg.errorMeta.attempts === 'number' && msg.errorMeta.attempts > 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/70 border border-slate-700 text-slate-300">
                        {msg.errorMeta.attempts} ATTEMPTS
                      </span>
                    )}
                    {(msg.errorMeta.allProvidersExhausted || msg.errorMeta.allModelsExhausted) && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 text-amber-100 font-bold">
                        {msg.errorMeta.allProvidersExhausted
                          ? 'ALL FREE PROVIDERS UNAVAILABLE — ₹0 GUARD ACTIVE'
                          : 'ALL FREE MODELS EXHAUSTED — NO PAID BILLING USED'}
                      </span>
                    )}
                    {msg.errorMeta.attemptedProviders && msg.errorMeta.attemptedProviders.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-cyan-200">
                        PROVIDERS TRIED: {msg.errorMeta.attemptedProviders.join(' → ').toUpperCase()}
                      </span>
                    )}
                    {msg.errorMeta.attemptedModels && msg.errorMeta.attemptedModels.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-slate-300">
                        TRIED: {msg.errorMeta.attemptedModels.join(' → ')}
                      </span>
                    )}
                    {msg.errorMeta.retryable === false && msg.errorMeta.quotaCategory && msg.errorMeta.quotaCategory !== 'NONE' && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-400/40 text-rose-200">
                        NON-RETRYABLE QUOTA
                      </span>
                    )}
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
                    className="space-y-2.5 min-w-[240px]"
                  >
                    <textarea
                      value={editingMessageText}
                      onChange={(e) => setEditingMessageText(e.target.value)}
                      rows={3}
                      autoFocus
                      aria-label="Edit message"
                      className="w-full bg-[#040812] border border-cyan-400/70 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none resize-y"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMessageId(null)}
                        className="px-2.5 py-1 rounded-lg border border-slate-700 font-mono-hud text-[10px] text-slate-300 hover:text-white cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        disabled={!editingMessageText.trim() || isThinking}
                        className="px-3 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 font-mono-hud text-[10px] font-bold text-[#02040A] cursor-pointer"
                      >
                        SAVE & RESEND
                      </button>
                    </div>
                  </form>
                ) : isUser ? (
                  <div className="whitespace-pre-wrap">{renderHighlightedText(msg.text, searchQuery)}</div>
                ) : msg.isError ? (
                  <div className="space-y-2">
                    <div className="whitespace-pre-wrap break-words font-mono-hud text-xs leading-relaxed">
                      {renderHighlightedText(msg.text, searchQuery)}
                    </div>
                    {msg.errorMeta?.explanation && (
                      <div className="rounded-lg bg-slate-950/60 border border-rose-400/30 p-2.5 text-xs text-slate-200 space-y-1">
                        <p className="font-mono-hud text-[10px] text-amber-300 font-bold">
                          DIAGNOSTIC EXPLANATION
                        </p>
                        <p>{msg.errorMeta.explanation}</p>
                        {msg.errorMeta.suggestedAction && (
                          <p className="text-cyan-300 font-mono-hud text-[11px]">
                            Recommended Action: {msg.errorMeta.suggestedAction}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <MarkdownMessage content={msg.text} searchQuery={searchQuery} />
                )}

                {!isUser &&
                  !msg.isError &&
                  (msg.brainMeta?.verification ||
                    (msg.brainMeta?.subtasks && msg.brainMeta.subtasks.length > 0)) && (
                    <details className="mt-3 pt-2 border-t border-cyan-500/25 text-xs">
                      <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 font-mono-hud text-[10px] text-cyan-200">
                        <span className="flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-violet-300" />
                          <span>
                            MULTI-AI TRACE
                            {msg.brainMeta?.subtasks?.length
                              ? ` • ${msg.brainMeta.subtasks.length} SPECIALISTS`
                              : ''}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          {msg.brainMeta?.verification && (
                            <span
                              className={`px-1.5 py-0.5 rounded border font-bold ${
                                msg.brainMeta.verification.confidenceLevel === 'HIGH'
                                  ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-200'
                                  : 'bg-amber-500/15 border-amber-400/45 text-amber-200'
                              }`}
                            >
                              CONFIDENCE {Math.round(msg.brainMeta.verification.confidenceScore)}%
                            </span>
                          )}
                          {msg.brainMeta?.selfCorrected && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-400/50 text-violet-200 font-bold">
                              SELF-CORRECTED
                            </span>
                          )}
                        </span>
                      </summary>
                      <div className="mt-2 space-y-2">
                        {msg.brainMeta?.subtasks && msg.brainMeta.subtasks.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {msg.brainMeta.subtasks.map((st) => (
                              <div
                                key={st.subtaskId}
                                className="rounded-lg bg-[#040812]/85 border border-slate-800 p-2 font-mono-hud text-[10px] space-y-0.5"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-cyan-200 font-bold truncate">
                                    {st.agentName}
                                  </span>
                                  <span
                                    className={
                                      st.status === 'fulfilled'
                                        ? 'text-emerald-300'
                                        : 'text-rose-300'
                                    }
                                  >
                                    {st.latencyMs}ms
                                  </span>
                                </div>
                                <p className="text-slate-400 truncate">
                                  {st.provider || 'free'} • {st.model || 'auto'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const v = msg.brainMeta?.verification;
                          if (!v) return null;
                          const notes = [
                            ...v.codeIssues.map((i) => i.detail),
                            ...v.contradictions.map((c) => c.summary),
                            ...v.missingInfo,
                            ...v.toolIssues,
                          ];
                          if (notes.length === 0) return null;
                          return (
                            <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 p-2 font-mono-hud text-[10px] text-amber-200 space-y-0.5">
                              <p className="font-bold">VERIFICATION NOTES:</p>
                              {notes.map((iss, idx) => (
                                <p key={idx}>• {iss}</p>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </details>
                  )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-700/70 space-y-1">
                    <p className="font-mono-hud text-[10px] text-cyan-300 uppercase">Verified Sources:</p>
                    {msg.sources.map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-sky-300 hover:underline truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                )}

                {!isEditingThis && (
                  <div className="mt-2.5 pt-1.5 border-t border-slate-800/70 flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      aria-label="Copy message"
                      className="flex items-center gap-1 font-mono-hud text-[10px] text-slate-300 hover:text-cyan-300 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>COPY</span>
                        </>
                      )}
                    </button>

                    {isUser && !isThinking && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessageId(msg.id);
                          setEditingMessageText(msg.text);
                        }}
                        aria-label="Edit and resend message"
                        className="flex items-center gap-1 font-mono-hud text-[10px] text-cyan-300 hover:text-white cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>EDIT & RESEND</span>
                      </button>
                    )}

                    {!isUser && msg.isError && (
                      <button
                        type="button"
                        disabled={isThinking}
                        onClick={onRetryLast}
                        className="flex items-center gap-1 font-mono-hud text-[10px] text-cyan-300 hover:text-white disabled:opacity-40 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>RETRY</span>
                      </button>
                    )}

                    {isLastAiReply && !isThinking && (
                      <button
                        type="button"
                        onClick={onRegenerateLast}
                        aria-label="Regenerate response"
                        className="flex items-center gap-1 font-mono-hud text-[10px] text-cyan-300 hover:text-white cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>REGENERATE</span>
                      </button>
                    )}

                    {!isUser && !msg.isError && (
                      <button
                        type="button"
                        onClick={() => (isSpeaking ? onStopSpeaking() : onSpeakText(msg.text))}
                        className="flex items-center gap-1 font-mono-hud text-[10px] text-cyan-300 hover:text-white cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{isSpeaking ? 'STOP' : 'SPEAK'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {streamingText && (
          <div className="flex flex-col items-start">
            <span className="font-mono-hud text-[10px] text-cyan-300 mb-1 px-1">
              {agent.codename} • STREAMING
            </span>
            <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed bg-violet-950/40 border border-cyan-400/50 text-slate-100">
              <MarkdownMessage content={streamingText} />
            </div>
          </div>
        )}

        {isThinking && !streamingText && (
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0D1527] border border-slate-800 font-mono-hud text-xs text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>{agent.codename} processing via Gemini...</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {(isThinking || streamingText) && (
        <div className="px-4 py-2 border-t border-slate-800/80 bg-[#040812]/90 flex justify-center">
          <button
            type="button"
            onClick={onStopStreaming}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/60 hover:bg-rose-500/30 text-rose-200 font-mono-hud text-xs font-semibold cursor-pointer transition-colors"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop generating</span>
          </button>
        </div>
      )}

      {/* Attachment Error Banner */}
      {attachmentError && (
        <div className="px-4 py-2 border-t border-rose-500/40 bg-rose-500/15 flex items-center justify-between gap-2 font-mono-hud text-xs text-rose-300">
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

      {/* Pending Attachment Preview Strip */}
      {pendingAttachment && (
        <div className="px-4 py-2 border-t border-cyan-500/35 bg-[#070D18] flex flex-wrap items-center justify-between gap-2">
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
              <p className="font-mono-hud text-xs text-slate-100 truncate max-w-[220px]">
                {pendingAttachment.name}
              </p>
              <p className="font-mono-hud text-[10px] text-slate-400">
                {pendingAttachment.mimeType} • {Math.max(1, Math.round(pendingAttachment.sizeBytes / 1024))} KB
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
                Use as context: {pendingAttachment.useAsTextContext ? 'ON' : 'OFF'}
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
        <div className="px-4 py-2 border-t border-slate-800/80 bg-[#070D18] flex flex-wrap items-center justify-between gap-2 font-mono-hud text-xs">
          <span className={isListening ? 'text-cyan-300' : isSpeaking ? 'text-violet-300' : 'text-amber-200'}>
            {isListening
              ? '● LISTENING — Speak naturally (Hindi / English / Hinglish); edit recognized text below before sending.'
              : isSpeaking
                ? isSpeechPaused
                  ? '❚❚ VOICE PAUSED'
                  : '▶ SPEAKING AI RESPONSE'
                : voiceStatusMessage}
          </span>
          {isSpeaking && (
            <div className="flex items-center gap-2">
              {isSpeechPaused && onResumeSpeaking ? (
                <button
                  type="button"
                  onClick={onResumeSpeaking}
                  className="px-2.5 py-1 rounded-lg bg-emerald-400 text-[#02040A] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>RESUME</span>
                </button>
              ) : onPauseSpeaking ? (
                <button
                  type="button"
                  onClick={onPauseSpeaking}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 text-[#02040A] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Pause className="w-3 h-3" />
                  <span>PAUSE</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={onStopSpeaking}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/60 text-rose-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Square className="w-3 h-3" />
                <span>STOP</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input Composer */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-[#040812]/95 flex items-end gap-2">
        <input
          ref={attachInputRef}
          type="file"
          accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,.md,.markdown,.csv,.json,text/*"
          aria-label="Attach image, PDF, DOCX, or text document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleAttachmentSelected(file);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => attachInputRef.current?.click()}
          title="Attach image, PDF, DOCX, or text file (max 4 MB)"
          aria-label="Attach file"
          className={`p-3 rounded-xl border transition-colors cursor-pointer shrink-0 ${
            pendingAttachment
              ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
              : 'bg-[#0D1527] border-slate-700 text-cyan-300 hover:border-cyan-400'
          }`}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={isSpeaking ? onStopSpeaking : isListening ? onStopVoice : onStartVoice}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          className={`p-3 rounded-xl border transition-colors cursor-pointer shrink-0 ${
            isListening
              ? 'bg-rose-500/20 border-rose-400 text-rose-300 animate-pulse'
              : isSpeaking
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#0D1527] border-slate-700 text-cyan-300 hover:border-cyan-400'
          }`}
        >
          {isSpeaking || isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <textarea
            rows={input.includes('\n') || input.length > 90 ? 3 : 1}
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
                ? `Ask ${agent.codename} about ${pendingAttachment.name}...`
                : `Instruct ${agent.codename} (English / Hindi / Hinglish)...`
            }
            className="w-full bg-[#0D1527] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-36"
          />
          {input.length > 0 && (
            <div className="flex items-center justify-between px-1 font-mono-hud text-[10px]">
              <span className="text-slate-500">Enter to send • Shift+Enter newline</span>
              <span className={input.length > 8000 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                {input.length} / 8000
              </span>
            </div>
          )}
        </div>

        {isThinking ? (
          <button
            type="button"
            onClick={onStopStreaming}
            aria-label="Stop generation"
            className="p-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white cursor-pointer shrink-0"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={(!input.trim() && !pendingAttachment) || input.length > 8000}
            aria-label="Send message"
            className="p-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] cursor-pointer transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Export Options Modal */}
      {exportModalOpen && messages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setExportModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-options-title"
            className="glass-panel-glow rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-4 border border-cyan-500/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="export-options-title"
                  className="font-display text-base sm:text-lg font-semibold text-cyan-300 tracking-wide"
                >
                  EXPORT OPTIONS
                </h2>
                <p className="font-mono-hud text-[11px] text-slate-400 mt-0.5">
                  Select format for {messages.length} message{messages.length === 1 ? '' : 's'} • Agent: {agent.codename}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                aria-label="Close export options"
                className="p-1.5 rounded-lg border border-slate-800 bg-[#0D1527] text-slate-400 hover:text-cyan-300 hover:border-cyan-400/50 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: 'json',
                    label: 'JSON',
                    ext: '.json',
                    desc: 'Structured payload & metadata',
                    Icon: FileJson,
                  },
                  {
                    id: 'csv',
                    label: 'CSV',
                    ext: '.csv',
                    desc: 'Spreadsheet-ready rows',
                    Icon: FileSpreadsheet,
                  },
                  {
                    id: 'md',
                    label: 'Markdown',
                    ext: '.md',
                    desc: 'Readable formatted doc',
                    Icon: FileCode2,
                  },
                ] as const
              ).map(({ id, label, ext, desc, Icon }) => {
                const isSelected = selectedExportFormat === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedExportFormat(id)}
                    className={`flex flex-col items-start text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_16px_rgba(34,211,238,0.18)]'
                        : 'bg-[#0D1527]/90 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <Icon
                        className={`w-4 h-4 ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`}
                      />
                      <span
                        className={`font-mono-hud text-[10px] px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/40'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {ext}
                      </span>
                    </div>
                    <span className="font-display text-sm font-semibold">{label}</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 leading-snug">{desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono-hud text-[10px] text-cyan-300 uppercase tracking-wider">
                  LIVE PREVIEW (.{selectedExportFormat.toUpperCase()})
                </span>
                <span className="font-mono-hud text-[10px] text-slate-500">
                  UTF-8 Transcript
                </span>
              </div>
              <pre className="bg-[#040812] border border-slate-800/90 rounded-xl p-3 font-mono-hud text-[11px] leading-relaxed text-slate-300 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                {previewText}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 bg-[#0D1527] hover:border-slate-500 font-mono-hud text-xs text-slate-300 cursor-pointer transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTranscript(selectedExportFormat)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 font-mono-hud text-xs font-semibold text-[#02040A] cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>DOWNLOAD .{selectedExportFormat.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions Drawer */}
      {sessionsDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex"
          onClick={() => setSessionsDrawerOpen(false)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Chat sessions drawer"
            className="w-80 max-w-[88vw] h-full bg-[#040812] border-r border-cyan-500/35 flex flex-col p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-cyan-300">
                <MessageSquare className="w-4 h-4" />
                <h2 className="font-display text-sm font-bold tracking-wider">CHAT SESSIONS</h2>
              </div>
              <button
                type="button"
                onClick={() => setSessionsDrawerOpen(false)}
                aria-label="Close sessions drawer"
                className="p-1.5 rounded-lg border border-slate-800 bg-[#0D1527] text-slate-400 hover:text-cyan-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onCreateSession();
                setSessionsDrawerOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wide cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>NEW CHAT SESSION</span>
            </button>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={sessionSearchQuery}
                onChange={(e) => setSessionSearchQuery(e.target.value)}
                placeholder="Search sessions..."
                aria-label="Search chat sessions"
                className="w-full bg-[#0D1527] border border-slate-800 focus:border-cyan-400 rounded-xl pl-8 pr-8 py-2 font-mono-hud text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              {sessionSearchQuery && (
                <button
                  type="button"
                  onClick={() => setSessionSearchQuery('')}
                  aria-label="Clear session search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredSessions.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#0D1527]/50 p-4 text-center">
                  <p className="font-mono-hud text-xs text-slate-400">
                    No sessions match "{sessionSearchQuery.trim()}".
                  </p>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isEditing = editingSessionId === session.id;
                  return (
                    <div
                      key={session.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        isActive
                          ? 'bg-cyan-500/15 border-cyan-400/60'
                          : 'bg-[#0D1527]/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (editingTitle.trim()) {
                              onRenameSession(session.id, editingTitle.trim());
                            }
                            setEditingSessionId(null);
                          }}
                          className="space-y-2"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            aria-label="Session title"
                            className="w-full bg-[#040812] border border-cyan-400 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingSessionId(null)}
                              className="px-2 py-1 rounded-md border border-slate-700 text-[10px] font-mono-hud text-slate-300 cursor-pointer"
                            >
                              CANCEL
                            </button>
                            <button
                              type="submit"
                              className="px-2 py-1 rounded-md bg-cyan-400 text-[#02040A] text-[10px] font-mono-hud font-semibold cursor-pointer"
                            >
                              SAVE
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSession(session.id);
                              setSessionsDrawerOpen(false);
                            }}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <p
                              className={`text-xs font-semibold truncate ${
                                isActive ? 'text-cyan-200' : 'text-slate-100'
                              }`}
                            >
                              {session.isTemporary ? '[TEMP] ' : ''}
                              {session.title}
                            </p>
                            <p className="font-mono-hud text-[10px] text-slate-400 mt-1">
                              {session.messages.length} msg{session.messages.length === 1 ? '' : 's'} •{' '}
                              {new Date(session.updatedAt).toLocaleDateString()}
                            </p>
                            {sessionSearchHits.get(session.id)?.snippet && (
                              <p className="text-[11px] text-cyan-300/90 mt-1 line-clamp-2">
                                {renderHighlightedText(
                                  sessionSearchHits.get(session.id)!.snippet!,
                                  sessionSearchQuery
                                )}
                              </p>
                            )}
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSessionId(session.id);
                                setEditingTitle(session.title);
                              }}
                              aria-label={`Rename ${session.title}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/70 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSession(session.id)}
                              aria-label={`Delete ${session.title}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/70 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

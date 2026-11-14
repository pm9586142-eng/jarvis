import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Globe,
  Mic,
  RefreshCw,
  Search,
  Send,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { AGENT_LIST, JARVIS_AGENTS } from '../data/agents';
import { AgentId, ChatMessage, ConnectionState } from '../types/jarvis';

interface ChatViewProps {
  selectedAgent: AgentId;
  messages: ChatMessage[];
  streamingText: string;
  isThinking: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  connectionState: ConnectionState;
  webSearchEnabled: boolean;
  onSelectAgent: (id: AgentId) => void;
  onSendMessage: (text: string) => void;
  onRetryLast: () => void;
  onStopStreaming: () => void;
  onClearHistory: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onSpeakText: (text: string) => void;
  onStopSpeaking: () => void;
  onToggleWebSearch: () => void;
  onRetryConnection: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  selectedAgent,
  messages,
  streamingText,
  isThinking,
  isListening,
  isSpeaking,
  connectionState,
  webSearchEnabled,
  onSelectAgent,
  onSendMessage,
  onRetryLast,
  onStopStreaming,
  onClearHistory,
  onStartVoice,
  onStopVoice,
  onSpeakText,
  onStopSpeaking,
  onToggleWebSearch,
  onRetryConnection,
}) => {
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportedFormat, setExportedFormat] = useState<'json' | 'txt' | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const agent = JARVIS_AGENTS[selectedAgent];

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
    if (!exportMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [exportMenuOpen]);

  const handleExportTranscript = (format: 'json' | 'txt') => {
    if (messages.length === 0) return;

    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes()
    ).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    let content = '';
    let mimeType = 'text/plain;charset=utf-8';
    if (format === 'json') {
      mimeType = 'application/json;charset=utf-8';
      content = JSON.stringify(
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
    } else {
      const header = [
        '============================================================',
        'J.A.R.V.I.S. — NEURAL CHAT TRANSCRIPT',
        `Exported: ${now.toLocaleString()}`,
        `Active Agent: ${agent.codename} (${agent.designation})`,
        `Messages: ${messages.length}`,
        '============================================================',
        '',
      ].join('\n');

      const body = messages
        .map((m) => {
          const timeStr = new Date(m.timestamp).toLocaleString();
          const sender = m.role === 'user' ? 'Sir' : m.agentCodename;
          const tags = [
            m.isVoice ? 'VOICE' : null,
            m.isError ? 'ERROR' : null,
          ]
            .filter(Boolean)
            .join(', ');
          const tagSuffix = tags ? ` [${tags}]` : '';
          const sourcesBlock =
            m.sources && m.sources.length > 0
              ? '\nSources:\n' + m.sources.map((s) => `  - ${s.title}: ${s.uri}`).join('\n')
              : '';
          return `[${timeStr}] ${sender}${tagSuffix}:\n${m.text}${sourcesBlock}`;
        })
        .join('\n\n------------------------------------------------------------\n\n');

      content = `${header}${body}\n`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jarvis-transcript-${stamp}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportMenuOpen(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col min-h-[420px] h-[calc(100dvh-9rem)] glass-panel rounded-2xl overflow-hidden">
      {/* Agent Selection Bar */}
      <div className="relative z-20 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-[#040812]/90">
        <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 pr-1">
          {AGENT_LIST.map((ag) => {
            const active = ag.id === selectedAgent;
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
        </div>

        <div className="flex items-center gap-2 shrink-0">
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

          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              disabled={messages.length === 0}
              onClick={() => setExportMenuOpen((open) => !open)}
              aria-label="Export Transcript"
              aria-expanded={exportMenuOpen}
              aria-haspopup="menu"
              title={
                messages.length === 0
                  ? 'Start a conversation to export the transcript'
                  : 'Export Transcript as JSON or Plain Text'
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
                  <span className="hidden sm:inline">Export Transcript</span>
                </>
              )}
            </button>

            {exportMenuOpen && messages.length > 0 && (
              <div
                role="menu"
                aria-label="Transcript export formats"
                className="absolute right-0 mt-2 w-48 rounded-xl bg-[#070D18] border border-cyan-500/40 shadow-[0_12px_32px_rgba(0,0,0,0.65)] p-1.5 space-y-1 z-30"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleExportTranscript('json')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left font-mono-hud text-xs text-slate-200 hover:bg-cyan-400/15 hover:text-cyan-200 cursor-pointer transition-colors"
                >
                  <FileJson className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <p className="font-semibold">Export JSON</p>
                    <p className="text-[10px] text-slate-400">Formatted (.json)</p>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleExportTranscript('txt')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left font-mono-hud text-xs text-slate-200 hover:bg-cyan-400/15 hover:text-cyan-200 cursor-pointer transition-colors"
                >
                  <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <p className="font-semibold">Export Text</p>
                    <p className="text-[10px] text-slate-400">Plain text (.txt)</p>
                  </div>
                </button>
              </div>
            )}
          </div>

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
              ? 'Server running, but GEMINI_API_KEY is not set on the server. Add GEMINI_API_KEY in server environment variables or Cloud Run Secrets.'
              : connectionState === 'connecting'
                ? 'Checking backend Gemini connection...'
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
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <span className="font-mono-hud text-[10px] text-slate-400 mb-1 px-1">
                {isUser ? 'Sir' : renderHighlightedText(msg.agentCodename, searchQuery)}{' '}
                {msg.isVoice ? '• [VOICE]' : ''}
              </span>

              <div
                className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.isError
                    ? 'bg-rose-500/15 border border-rose-500/50 text-rose-200'
                    : isUser
                      ? 'bg-[#0D1527] border border-slate-700 text-slate-100 rounded-br-sm'
                      : 'bg-violet-950/35 border border-cyan-500/35 text-slate-100 rounded-bl-sm'
                }`}
              >
                {renderHighlightedText(msg.text, searchQuery)}

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

                {!isUser && (
                  <div className="mt-2 flex items-center justify-end gap-3">
                    {msg.isError && (
                      <button
                        type="button"
                        onClick={onRetryLast}
                        className="flex items-center gap-1 font-mono-hud text-[11px] text-cyan-300 hover:text-white cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>RETRY</span>
                      </button>
                    )}
                    {!msg.isError && (
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
            <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-violet-950/40 border border-cyan-400/50 text-slate-100">
              {streamingText}
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

      {/* Input Composer */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-[#040812]/95 flex items-center gap-2">
        <button
          type="button"
          onClick={isSpeaking ? onStopSpeaking : isListening ? onStopVoice : onStartVoice}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          className={`p-3 rounded-xl border transition-colors cursor-pointer ${
            isListening
              ? 'bg-rose-500/20 border-rose-400 text-rose-300'
              : isSpeaking
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#0D1527] border-slate-700 text-cyan-300 hover:border-cyan-400'
          }`}
        >
          {isSpeaking || isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Instruct ${agent.codename}...`}
          className="flex-1 bg-[#0D1527] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />

        {isThinking ? (
          <button
            type="button"
            onClick={onStopStreaming}
            aria-label="Stop generation"
            className="p-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white cursor-pointer"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            className="p-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] cursor-pointer transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
};

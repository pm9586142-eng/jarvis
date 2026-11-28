import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Bot,
  Brain,
  ChevronLeft,
  Compass,
  Home,
  MessageSquare,
  Mic,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
  Youtube,
} from 'lucide-react';
import { AGENT_LIST } from '../data/agents';
import { searchConversations } from '../services/brainEngine.js';
import { AgentId, ChatSession, CustomAgent, ScreenId } from '../types/jarvis';

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  selectedAgent: AgentId;
  customAgents: CustomAgent[];
  selectedCustomAgentId: string | null;
  hasMessages: boolean;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onToggleSaveSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onClearHistory: () => void;
  onSelectAgent: (id: AgentId) => void;
  onSelectCustomAgent: (id: string) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  onCloseMobile?: () => void;
  onCollapseDesktop?: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  sessions,
  activeSessionId,
  selectedAgent,
  customAgents,
  selectedCustomAgentId,
  hasMessages,
  onCreateSession,
  onSelectSession,
  onToggleSaveSession,
  onRenameSession,
  onDeleteSession,
  onClearHistory,
  onSelectAgent,
  onSelectCustomAgent,
  onNavigateScreen,
  onCloseMobile,
  onCollapseDesktop,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showMoreAgents, setShowMoreAgents] = useState(false);

  const searchHits = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return new Map<string, { matchCount: number; snippet?: string }>();
    const hits = searchConversations(sessions, q, 40);
    const map = new Map<string, { matchCount: number; snippet?: string }>();
    for (const h of hits) {
      map.set(h.sessionId, {
        matchCount: h.matchCount,
        snippet: h.snippets[0]?.snippet,
      });
    }
    return map;
  }, [sessions, searchQuery]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim();
    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter((s) => searchHits.has(s.id));
  }, [sessions, searchQuery, searchHits]);

  const savedSessions = useMemo(
    () => filteredSessions.filter((s) => s.isSaved),
    [filteredSessions]
  );
  const recentSessions = useMemo(
    () => filteredSessions.filter((s) => !s.isSaved),
    [filteredSessions]
  );

  const featuredAgentIds: AgentId[] = ['JARVIS_PRIME', 'VERONICA_RESEARCH', 'DUM_E_ENGINEER'];
  const featuredAgents = AGENT_LIST.filter((a) => featuredAgentIds.includes(a.id));
  const extraAgents = AGENT_LIST.filter((a) => !featuredAgentIds.includes(a.id));

  const renderSessionRow = (session: ChatSession) => {
    const isActive = session.id === activeSessionId;
    const isEditing = editingSessionId === session.id;
    const hit = searchHits.get(session.id);

    if (isEditing) {
      return (
        <form
          key={session.id}
          onSubmit={(e) => {
            e.preventDefault();
            if (editingTitle.trim()) onRenameSession(session.id, editingTitle.trim());
            setEditingSessionId(null);
          }}
          className="rounded-xl border border-cyan-400/60 bg-[#081326] p-2 space-y-2"
        >
          <input
            type="text"
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            aria-label="Edit chat title"
            className="w-full bg-[#030712] border border-cyan-400/70 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
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
              className="px-2.5 py-1 rounded-md bg-cyan-400 text-[#02050B] text-[10px] font-mono-hud font-bold cursor-pointer"
            >
              SAVE
            </button>
          </div>
        </form>
      );
    }

    return (
      <div
        key={session.id}
        data-testid={`sidebar-session-${session.id}`}
        className={`group rounded-xl px-2.5 py-2 transition-colors border ${
          isActive
            ? 'bg-cyan-500/12 border-cyan-400/50 text-white'
            : 'bg-transparent border-transparent hover:bg-white/[0.04] hover:border-slate-800/80 text-slate-300'
        }`}
      >
        <div className="flex items-start justify-between gap-1.5">
          <button
            type="button"
            onClick={() => {
              onSelectSession(session.id);
              onCloseMobile?.();
            }}
            className="flex-1 min-w-0 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <MessageSquare
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              <span
                className={`text-xs font-medium truncate ${
                  isActive ? 'text-cyan-100 font-semibold' : 'text-slate-200'
                }`}
              >
                {session.isTemporary ? '[TEMP] ' : ''}
                {session.title}
              </span>
            </div>
            <p className="pl-5 font-mono-hud text-[10px] text-slate-500 mt-0.5 truncate">
              {session.messages.length} msg{session.messages.length === 1 ? '' : 's'} •{' '}
              {new Date(session.updatedAt).toLocaleDateString()}
            </p>
            {hit?.snippet && (
              <p className="pl-5 text-[11px] text-cyan-300/90 mt-1 line-clamp-2">{hit.snippet}</p>
            )}
          </button>

          <div className="flex items-center gap-0.5 shrink-0 opacity-90 sm:opacity-60 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onToggleSaveSession(session.id)}
              aria-label={session.isSaved ? `Unsave ${session.title}` : `Save ${session.title}`}
              title={session.isSaved ? 'Remove from Saved Conversations' : 'Save Conversation'}
              className={`p-1 rounded-md cursor-pointer ${
                session.isSaved
                  ? 'text-amber-300 hover:text-amber-200'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${session.isSaved ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingSessionId(session.id);
                setEditingTitle(session.title);
              }}
              aria-label={`Rename ${session.title}`}
              title="Rename chat"
              className="p-1 rounded-md text-slate-400 hover:text-cyan-300 cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteSession(session.id)}
              aria-label={`Delete ${session.title}`}
              title="Delete chat"
              className="p-1 rounded-md text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="chat-workspace-sidebar"
      className="h-full w-full flex flex-col bg-[#030712]/98 border-r border-cyan-500/20 text-slate-100 select-none"
    >
      {/* Top Sidebar Brand + Collapse/Close + New Chat */}
      <div className="p-3 border-b border-slate-800/80 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400/25 to-violet-500/25 border border-cyan-400/50 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-xs font-black tracking-[0.18em] text-white truncate">
                AM <span className="text-cyan-300">AI</span>
              </p>
              <p className="font-mono-hud text-[9px] text-cyan-300/75 tracking-wider truncate">
                COSMIC WORKSPACE
              </p>
            </div>
          </div>

          {onCollapseDesktop && (
            <button
              type="button"
              onClick={onCollapseDesktop}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="hidden md:inline-flex p-1.5 rounded-lg border border-slate-800 bg-[#081326] text-slate-300 hover:text-cyan-300 hover:border-cyan-400/50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="md:hidden p-1.5 rounded-lg border border-slate-800 bg-[#081326] text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          data-testid="sidebar-new-chat-btn"
          onClick={() => {
            onCreateSession();
            onCloseMobile?.();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-[#02050B] font-display text-xs font-bold tracking-wide cursor-pointer shadow-[0_0_18px_rgba(0,229,255,0.2)] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Chats..."
            aria-label="Search Chats"
            data-testid="sidebar-search-chats"
            className="w-full bg-[#071122] border border-slate-800 focus:border-cyan-400/70 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear chat search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Independently Scrollable Sidebar Body */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
        {/* Saved Conversations */}
        {savedSessions.length > 0 && (
          <section aria-label="Saved Conversations" className="space-y-1">
            <div className="px-2 flex items-center justify-between">
              <span className="font-mono-hud text-[10px] tracking-[0.14em] text-amber-300/90 uppercase flex items-center gap-1.5">
                <Bookmark className="w-3 h-3 fill-current" />
                <span>Saved Conversations</span>
              </span>
              <span className="font-mono-hud text-[10px] text-slate-500">
                {savedSessions.length}
              </span>
            </div>
            <div className="space-y-0.5">{savedSessions.map(renderSessionRow)}</div>
          </section>
        )}

        {/* Recent Conversations / Chat History */}
        <section aria-label="Recent Conversations" className="space-y-1">
          <div className="px-2 flex items-center justify-between">
            <span className="font-mono-hud text-[10px] tracking-[0.14em] text-slate-400 uppercase">
              Recent Conversations
            </span>
            <span className="font-mono-hud text-[10px] text-slate-500">
              {recentSessions.length}
            </span>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="mx-1 rounded-xl border border-slate-800/80 bg-[#071122]/60 p-3 text-center">
              <p className="font-mono-hud text-[11px] text-slate-400">
                No conversations match "{searchQuery.trim()}".
              </p>
            </div>
          ) : recentSessions.length === 0 ? (
            <p className="px-2 font-mono-hud text-[11px] text-slate-500">
              All matching threads are in Saved Conversations above.
            </p>
          ) : (
            <div className="space-y-0.5">{recentSessions.map(renderSessionRow)}</div>
          )}
        </section>

        {/* Specialized Agents */}
        <section aria-label="AI Agents" className="space-y-1.5 pt-2 border-t border-slate-800/70">
          <div className="px-2 flex items-center justify-between">
            <span className="font-mono-hud text-[10px] tracking-[0.14em] text-cyan-300/90 uppercase">
              Agents
            </span>
            <button
              type="button"
              onClick={() => setShowMoreAgents((v) => !v)}
              className="font-mono-hud text-[10px] text-slate-400 hover:text-cyan-300 cursor-pointer"
            >
              {showMoreAgents ? 'Less' : 'More'}
            </button>
          </div>

          <div className="space-y-1">
            {featuredAgents.map((ag) => {
              const active = !selectedCustomAgentId && selectedAgent === ag.id;
              return (
                <button
                  key={ag.id}
                  type="button"
                  data-testid={`sidebar-agent-${ag.codename.toLowerCase()}`}
                  onClick={() => {
                    onSelectAgent(ag.id);
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-cyan-500/12 border-cyan-400/50 text-white'
                      : 'bg-transparent border-transparent hover:bg-white/[0.04] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ag.accentColor }}
                    />
                    <div className="min-w-0">
                      <p className="font-mono-hud text-xs font-semibold truncate">
                        {ag.codename} Agent
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{ag.specialization}</p>
                    </div>
                  </div>
                </button>
              );
            })}

            {(showMoreAgents ||
              extraAgents.some((a) => a.id === selectedAgent && !selectedCustomAgentId) ||
              customAgents.length > 0) && (
              <div className="space-y-1 pt-1">
                {extraAgents.map((ag) => {
                  const active = !selectedCustomAgentId && selectedAgent === ag.id;
                  return (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={() => {
                        onSelectAgent(ag.id);
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs cursor-pointer ${
                        active
                          ? 'bg-cyan-500/12 border-cyan-400/50 text-white'
                          : 'border-transparent hover:bg-white/[0.04] text-slate-400'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: ag.accentColor }}
                      />
                      <span className="font-mono-hud truncate">{ag.codename} Agent</span>
                    </button>
                  );
                })}
                {customAgents.map((cag) => {
                  const active = selectedCustomAgentId === cag.id;
                  return (
                    <button
                      key={cag.id}
                      type="button"
                      onClick={() => {
                        onSelectCustomAgent(cag.id);
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs cursor-pointer ${
                        active
                          ? 'bg-violet-500/15 border-violet-400/50 text-white'
                          : 'border-transparent hover:bg-white/[0.04] text-slate-400'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5 shrink-0 text-violet-300" />
                      <span className="font-mono-hud truncate">{cag.codename}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Subsystems Quick Access */}
        <section aria-label="Workspace Modules" className="space-y-1 pt-2 border-t border-slate-800/70">
          <p className="px-2 font-mono-hud text-[10px] tracking-[0.14em] text-slate-500 uppercase">
            AM Modules
          </p>
          {[
            { id: 'dashboard' as ScreenId, label: 'Home Cockpit', Icon: Home },
            { id: 'media_control' as ScreenId, label: 'AM Player', Icon: Youtube },
            { id: 'voice' as ScreenId, label: 'Voice Assistant', Icon: Mic },
            { id: 'brain_center' as ScreenId, label: 'Multi-AI Brain', Icon: Brain },
            { id: 'research' as ScreenId, label: 'Research Studio', Icon: Compass },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onNavigateScreen(id);
                onCloseMobile?.();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-slate-300 hover:text-cyan-200 hover:bg-white/[0.04] cursor-pointer transition-colors"
            >
              <Icon className="w-4 h-4 text-cyan-400/80 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </section>
      </div>

      {/* Sidebar Footer: Clear History + Settings */}
      <div className="p-2.5 border-t border-slate-800/80 space-y-1.5 shrink-0 bg-[#02050B]/95">
        {hasMessages && (
          <button
            type="button"
            onClick={() => {
              onClearHistory();
              onCloseMobile?.();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-800/90 hover:border-rose-500/40 text-xs text-slate-400 hover:text-rose-300 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Clear History</span>
          </button>
        )}
        <button
          type="button"
          data-testid="sidebar-settings-btn"
          onClick={() => {
            onNavigateScreen('settings');
            onCloseMobile?.();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#071122] border border-slate-800 hover:border-cyan-400/50 text-xs font-medium text-slate-200 hover:text-cyan-200 cursor-pointer transition-colors"
        >
          <Settings className="w-4 h-4 text-cyan-300 shrink-0" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

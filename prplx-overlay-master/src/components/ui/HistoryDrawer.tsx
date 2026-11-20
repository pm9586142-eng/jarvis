import React, { useMemo, useState } from "react"
import { History, Search, Trash2, Download, X, MessageSquare } from "lucide-react"
import {
  ChatSessionRecord,
  filterChatHistory
} from "../../lib/chatStorage"

interface HistoryDrawerProps {
  open: boolean
  sessions: ChatSessionRecord[]
  activeSessionId: string
  onClose: () => void
  onSelectSession: (session: ChatSessionRecord) => void
  onExportSession: (session: ChatSessionRecord) => void
  onDeleteSession: (sessionId: string) => void
  onClearAll: () => void
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  open,
  sessions,
  activeSessionId,
  onClose,
  onSelectSession,
  onExportSession,
  onDeleteSession,
  onClearAll
}) => {
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = useMemo(
    () => filterChatHistory(sessions, searchQuery),
    [sessions, searchQuery]
  )

  if (!open) return null

  return (
    <div className="mb-3 rounded-xl border border-white/15 bg-[rgba(10,16,32,0.92)] p-3 text-xs text-white space-y-2.5">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 font-semibold">
          <History className="h-3.5 w-3.5 text-blue-400" />
          <span>Chat History ({sessions.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded px-1.5 py-0.5 text-[10px] text-red-300/80 hover:bg-red-500/20 hover:text-red-200"
              title="Clear all saved sessions"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="overlay-button h-6 w-6 flex items-center justify-center rounded-md"
            title="Close history"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          className="w-full rounded-md border border-white/15 bg-white/5 pl-8 pr-2.5 py-1.5 text-[11px] text-white placeholder-white/40 focus:border-blue-400 focus:outline-none"
        />
      </div>

      {/* Session List */}
      {filtered.length === 0 ? (
        <div className="py-4 text-center text-[11px] text-white/50">
          {sessions.length === 0
            ? "No saved sessions yet. Start chatting to auto-save history."
            : "No matching sessions found."}
        </div>
      ) : (
        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
          {filtered.map((session) => {
            const isActive = session.id === activeSessionId
            return (
              <div
                key={session.id}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                  isActive
                    ? "border-blue-400/50 bg-blue-500/15"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(session)
                    onClose()
                  }}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 shrink-0 text-blue-300" />
                    <span className="truncate font-medium text-[11px] text-white">
                      {session.title}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/55">
                    <span>{session.modelLabel}</span>
                    <span>•</span>
                    <span>{session.messages.length} msgs</span>
                    <span>•</span>
                    <span>{new Date(session.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onExportSession(session)}
                    className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
                    title="Export as Markdown"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.id)}
                    className="rounded p-1 text-white/60 hover:bg-red-500/20 hover:text-red-300"
                    title="Delete session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default HistoryDrawer

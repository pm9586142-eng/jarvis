export interface StoredChatMessage {
  role: "user" | "assistant" | "system"
  text: string
  timestamp?: number
  hasAttachment?: boolean
  modelLabel?: string
}

export interface ChatSessionRecord {
  id: string
  title: string
  engine: "perplexity" | "direct"
  modelLabel: string
  updatedAt: number
  messages: StoredChatMessage[]
}

export interface PromptTemplate {
  id: string
  label: string
  prompt: string
}

export interface OverlayUiPreferences {
  opacity: number
  stealthEnabled: boolean
  preferredEngine: "perplexity" | "direct"
  quickSolvePrompt: string
}

const HISTORY_STORAGE_KEY = "prplx_overlay_chat_history_v1"
const PREFS_STORAGE_KEY = "prplx_overlay_ui_prefs_v1"
const MAX_HISTORY_SESSIONS = 50

export const DEFAULT_QUICK_SOLVE_PROMPT =
  "Solve this step by step. Think carefully and verify your final answer."

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "explain",
    label: "Explain",
    prompt: "Explain this clearly and concisely with the key takeaways."
  },
  {
    id: "fix-bug",
    label: "Fix Bug",
    prompt: "Find any bugs or edge cases here and provide the corrected version."
  },
  {
    id: "solve",
    label: "Solve",
    prompt: "Solve this problem step by step and verify the final answer."
  },
  {
    id: "summarize",
    label: "Summarize",
    prompt: "Summarize the key points in concise bullet points."
  },
  {
    id: "review",
    label: "Code Review",
    prompt: "Review this code for correctness, security, and performance improvements."
  },
  {
    id: "translate",
    label: "Translate",
    prompt: "Translate this clearly into natural English and explain any technical terms."
  }
]

export function deriveSessionTitle(messages: StoredChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.text.trim().length > 0)
  if (firstUser) {
    const singleLine = firstUser.text.trim().replace(/\s+/g, " ")
    return singleLine.length > 56 ? `${singleLine.slice(0, 56)}…` : singleLine
  }
  const hasAttachment = messages.some((m) => m.hasAttachment)
  if (hasAttachment) {
    return "Screenshot Analysis"
  }
  return "Untitled Session"
}

export function loadChatHistory(): ChatSessionRecord[] {
  if (typeof window === "undefined" || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is ChatSessionRecord =>
          Boolean(item && typeof item.id === "string" && Array.isArray(item.messages))
      )
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  } catch {
    return []
  }
}

export function saveChatSession(
  sessions: ChatSessionRecord[],
  session: ChatSessionRecord
): ChatSessionRecord[] {
  const filtered = sessions.filter((existing) => existing.id !== session.id)
  const next = [session, ...filtered]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_HISTORY_SESSIONS)

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage quota issues gracefully
    }
  }
  return next
}

export function deleteChatSession(
  sessions: ChatSessionRecord[],
  sessionId: string
): ChatSessionRecord[] {
  const next = sessions.filter((item) => item.id !== sessionId)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }
  return next
}

export function clearAllChatHistory(): ChatSessionRecord[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY)
    } catch {
      // ignore
    }
  }
  return []
}

export function filterChatHistory(
  sessions: ChatSessionRecord[],
  query: string
): ChatSessionRecord[] {
  const normalized = (query || "").trim().toLowerCase()
  if (!normalized) return sessions
  return sessions.filter((session) => {
    if (session.title.toLowerCase().includes(normalized)) return true
    if (session.modelLabel.toLowerCase().includes(normalized)) return true
    return session.messages.some((msg) => msg.text.toLowerCase().includes(normalized))
  })
}

export function formatSessionAsMarkdown(session: {
  title: string
  modelLabel?: string
  updatedAt?: number
  messages: StoredChatMessage[]
}): string {
  const dateLabel = new Date(session.updatedAt || Date.now()).toISOString()
  const lines: string[] = [
    `# ${session.title || "Perplexity Overlay Session"}`,
    "",
    `- **Exported:** ${dateLabel}`,
    ...(session.modelLabel ? [`- **Model:** ${session.modelLabel}`] : []),
    "",
    "---",
    ""
  ]

  for (const msg of session.messages) {
    const roleLabel =
      msg.role === "user"
        ? "### User"
        : msg.role === "system"
          ? "### System"
          : `### Assistant${msg.modelLabel ? ` (${msg.modelLabel})` : ""}`
    lines.push(roleLabel)
    lines.push("")
    if (msg.hasAttachment) {
      lines.push("_[Screenshot attached]_")
      lines.push("")
    }
    lines.push(msg.text || "")
    lines.push("")
  }

  return lines.join("\n").trim() + "\n"
}

export function loadOverlayUiPreferences(
  defaultEngine: "perplexity" | "direct" = "perplexity"
): OverlayUiPreferences {
  const defaults: OverlayUiPreferences = {
    opacity: 0.96,
    stealthEnabled: true,
    preferredEngine: defaultEngine,
    quickSolvePrompt: DEFAULT_QUICK_SOLVE_PROMPT
  }
  if (typeof window === "undefined" || !window.localStorage) return defaults
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<OverlayUiPreferences>
    return {
      opacity:
        typeof parsed.opacity === "number" && Number.isFinite(parsed.opacity)
          ? Math.max(0.35, Math.min(1, parsed.opacity))
          : defaults.opacity,
      stealthEnabled:
        typeof parsed.stealthEnabled === "boolean"
          ? parsed.stealthEnabled
          : defaults.stealthEnabled,
      preferredEngine:
        parsed.preferredEngine === "direct" || parsed.preferredEngine === "perplexity"
          ? parsed.preferredEngine
          : defaults.preferredEngine,
      quickSolvePrompt:
        typeof parsed.quickSolvePrompt === "string" && parsed.quickSolvePrompt.trim()
          ? parsed.quickSolvePrompt.trim()
          : defaults.quickSolvePrompt
    }
  } catch {
    return defaults
  }
}

export function saveOverlayUiPreferences(prefs: OverlayUiPreferences): void {
  if (typeof window === "undefined" || !window.localStorage) return
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage errors
  }
}

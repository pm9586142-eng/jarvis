import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useQuery } from "react-query"
import {
  Clipboard,
  Download,
  HelpCircle,
  History,
  Mic,
  Scissors,
  Settings,
  Shield,
  Sparkles,
  Square
} from "lucide-react"
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastVariant,
  ToastMessage
} from "../components/ui/toast"
import RichHtmlContent from "../components/ui/RichHtmlContent"
import MarkdownContent from "../components/ui/MarkdownContent"
import ModelSelector from "../components/ui/ModelSelector"
import ShortcutsModal from "../components/ui/ShortcutsModal"
import HistoryDrawer from "../components/ui/HistoryDrawer"
import type { ChatEngine, LlmConfigSnapshot, PerplexityModelKey } from "../types/electron"
import {
  ChatSessionRecord,
  DEFAULT_PROMPT_TEMPLATES,
  clearAllChatHistory,
  deleteChatSession,
  deriveSessionTitle,
  formatSessionAsMarkdown,
  loadChatHistory,
  loadOverlayUiPreferences,
  saveChatSession,
  saveOverlayUiPreferences
} from "../lib/chatStorage"

interface QueueProps {
  setView: React.Dispatch<React.SetStateAction<"queue" | "solutions" | "debug">>
}

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  text: string
  html?: string | null
  htmlSegments?: string[] | null
  attachments?: Array<{ preview: string; path?: string }>
  streaming?: boolean
  requestId?: string
  modelLabel?: string
  timestamp: number
}

const PERPLEXITY_MODEL_LABELS: Record<PerplexityModelKey, string> = {
  sonar: "Sonar",
  "gpt-5": "GPT-5",
  "gpt-5-reasoning": "GPT-5 + Reasoning",
  "claude-sonnet-4.5-reasoning": "Claude 4.5 + Reasoning"
}

const PERPLEXITY_MODEL_SHORTCUTS: Record<PerplexityModelKey, string> = {
  sonar: "⌘M",
  "gpt-5": "⌘,",
  "gpt-5-reasoning": "⌘.",
  "claude-sonnet-4.5-reasoning": "⌘/"
}

const THINK_SUFFIX = " Think longer and harder."

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const Queue: React.FC<QueueProps> = ({ setView }) => {
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral"
  })

  const contentRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pendingDimensionsRef = useRef<{ width: number; height: number } | null>(null)
  const streamingHtmlRef = useRef<Record<string, string[]>>({})
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Voice recording refs for leak-free cleanup
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  const [sessionId, setSessionId] = useState<string>(() => createId("session"))
  const [chatHistory, setChatHistory] = useState<ChatSessionRecord[]>(() => loadChatHistory())
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)

  const [platform, setPlatform] = useState<string>("darwin")
  const [chatEngine, setChatEngine] = useState<ChatEngine>("perplexity")
  const [llmConfig, setLlmConfig] = useState<LlmConfigSnapshot | null>(null)
  const [shouldStartNewChat, setShouldStartNewChat] = useState(true)
  const [isThinkAppended, setIsThinkAppended] = useState(false)
  const [isOverlayActive, setIsOverlayActive] = useState(true)
  const [activeModelLabel, setActiveModelLabel] = useState<string | null>(null)
  const [perplexityModel, setPerplexityModel] = useState<PerplexityModelKey>("sonar")
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)

  const [pendingAttachment, setPendingAttachment] = useState<{
    path: string
    preview: string
  } | null>(null)
  const [hoveredAttachmentKey, setHoveredAttachmentKey] = useState<string | null>(null)
  const [attachmentSubmitting, setAttachmentSubmitting] = useState(false)

  // Panels & Overlay HUD state
  const [activePanel, setActivePanel] = useState<"none" | "settings" | "history" | "shortcuts">(
    "none"
  )
  const [showPresets, setShowPresets] = useState(true)
  const [opacity, setOpacity] = useState<number>(0.96)
  const [stealthEnabled, setStealthEnabled] = useState<boolean>(true)
  const [quickSolvePrompt, setQuickSolvePrompt] = useState<string>(
    "Solve this step by step. Think carefully and verify your final answer."
  )

  const pendingAttachmentRef = useRef(pendingAttachment)
  useEffect(() => {
    pendingAttachmentRef.current = pendingAttachment
  }, [pendingAttachment])

  const chatMessagesRef = useRef(chatMessages)
  useEffect(() => {
    chatMessagesRef.current = chatMessages
  }, [chatMessages])

  const isStreaming = useMemo(() => chatMessages.some((msg) => msg.streaming), [chatMessages])
  const isMac = platform === "darwin"

  const currentModelDisplay = useMemo(() => {
    if (chatEngine === "perplexity") {
      return PERPLEXITY_MODEL_LABELS[perplexityModel]
    }
    if (!llmConfig) return "Direct AI"
    if (llmConfig.isMock) return "Direct AI (Configure in Settings)"
    return `${llmConfig.provider}: ${llmConfig.model}`
  }, [chatEngine, perplexityModel, llmConfig])

  const chatPlaceholder = pendingAttachment
    ? "Screenshot attached — add a question or press Enter to send"
    : chatEngine === "direct"
      ? `Ask ${currentModelDisplay}...`
      : "Ask Perplexity anything..."

  const showToast = useCallback(
    (title: string, description: string, variant: ToastVariant = "neutral") => {
      setToastMessage({ title, description, variant })
      setToastOpen(true)
    },
    []
  )

  // Initial sync with Electron main process & saved UI preferences
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    let cancelled = false

    const init = async () => {
      try {
        const [engineRes, llmRes, captureRes] = await Promise.all([
          api.getChatEngine?.(),
          api.getCurrentLlmConfig?.(),
          api.getOverlayCaptureMode?.()
        ])
        if (cancelled) return

        const detectedPlatform = engineRes?.platform || "darwin"
        setPlatform(detectedPlatform)

        const defaultEngine: ChatEngine = detectedPlatform === "darwin" ? "perplexity" : "direct"
        const savedPrefs = loadOverlayUiPreferences(defaultEngine)

        const effectiveEngine: ChatEngine =
          detectedPlatform !== "darwin" ? "direct" : savedPrefs.preferredEngine

        setChatEngine(effectiveEngine)
        setOpacity(savedPrefs.opacity)
        setStealthEnabled(savedPrefs.stealthEnabled)
        setQuickSolvePrompt(savedPrefs.quickSolvePrompt)

        if (llmRes) setLlmConfig(llmRes)
        if (captureRes) setIsOverlayActive(Boolean(captureRes.active))

        await Promise.all([
          api.setChatEngine?.(effectiveEngine),
          api.setWindowOpacity?.(savedPrefs.opacity),
          api.setContentProtection?.(savedPrefs.stealthEnabled),
          api.setQuickSolvePrompt?.(savedPrefs.quickSolvePrompt)
        ])
      } catch (error) {
        console.warn("Initial overlay state sync warning:", error)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist overlay UI preferences whenever they change
  useEffect(() => {
    saveOverlayUiPreferences({
      opacity,
      stealthEnabled,
      preferredEngine: chatEngine,
      quickSolvePrompt
    })
  }, [opacity, stealthEnabled, chatEngine, quickSolvePrompt])

  // Auto-save chat history when messages settle
  useEffect(() => {
    if (chatMessages.length === 0 || isStreaming) return
    const storedMessages = chatMessages.map((m) => ({
      role: m.role,
      text: m.text,
      timestamp: m.timestamp,
      hasAttachment: Boolean(m.attachments && m.attachments.length > 0),
      modelLabel: m.modelLabel
    }))
    const record: ChatSessionRecord = {
      id: sessionId,
      title: deriveSessionTitle(storedMessages),
      engine: chatEngine,
      modelLabel: currentModelDisplay,
      updatedAt: Date.now(),
      messages: storedMessages
    }
    setChatHistory((prev) => saveChatSession(prev, record))
  }, [chatMessages, isStreaming, sessionId, chatEngine, currentModelDisplay])

  // Auto-scroll chat container to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [chatMessages, chatLoading])

  // Stop microphone tracks safely on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          // ignore
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
      }
    }
  }, [])

  const { refetch } = useQuery<Array<{ path: string; preview: string }>, Error>(
    "screenshots",
    async () => {
      if (!window.electronAPI?.getScreenshots) return []
      try {
        return await window.electronAPI.getScreenshots()
      } catch (error) {
        console.error("Error loading screenshots:", error)
        showToast("Error", "Failed to load screenshots", "error")
        return []
      }
    },
    {
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnWindowFocus: true,
      refetchOnMount: true
    }
  )

  useEffect(() => {
    void window.electronAPI?.updatePerplexityPreferences({
      model: perplexityModel,
      webSearch: webSearchEnabled,
      shouldStartNewChat
    })
  }, [perplexityModel, webSearchEnabled, shouldStartNewChat])

  const sendMessageInternal = useCallback(
    async (
      rawInput: string,
      overrides?: {
        model?: PerplexityModelKey
        forceNewChat?: boolean
        preservePreferences?: boolean
        attachmentOverride?: { path: string; preview: string } | null
      }
    ) => {
      const api = window.electronAPI
      if (!api) {
        showToast("Preview Mode", "Electron runtime API is unavailable.", "neutral")
        return
      }

      const trimmedInput = rawInput.trim()
      const attachment =
        overrides?.attachmentOverride !== undefined
          ? overrides.attachmentOverride
          : pendingAttachmentRef.current

      if (!trimmedInput && !attachment) return

      const requestModel = overrides?.model ?? perplexityModel
      const modelLabel =
        chatEngine === "perplexity"
          ? PERPLEXITY_MODEL_LABELS[requestModel]
          : currentModelDisplay

      const useNewChat = overrides?.forceNewChat ?? shouldStartNewChat

      const userMessage: ChatMessage = {
        id: createId("msg"),
        role: "user",
        text: trimmedInput,
        attachments: attachment ? [{ preview: attachment.preview, path: attachment.path }] : undefined,
        timestamp: Date.now()
      }

      const historySnapshot = chatMessagesRef.current
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.text.trim().length > 0)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          text: m.text
        }))

      setChatMessages((msgs) => [...msgs, userMessage])
      if (attachment) {
        setAttachmentSubmitting(true)
      }

      setChatLoading(true)
      setActiveModelLabel(modelLabel)
      setChatInput("")
      setIsThinkAppended(false)

      let activeRequestId: string | null = null

      try {
        if (chatEngine === "direct") {
          const result = await api.directAiChat(trimmedInput, {
            imagePaths: attachment ? [attachment.path] : undefined,
            history: historySnapshot
          })

          if (attachment) {
            setPendingAttachment(null)
            setHoveredAttachmentKey(null)
            setAttachmentSubmitting(false)
            void api.clearPendingAttachment()
          }

          setChatMessages((msgs) => [
            ...msgs,
            {
              id: createId("msg"),
              role: "assistant",
              text: result.response,
              modelLabel: `${result.provider}: ${result.model}`,
              timestamp: Date.now()
            }
          ])
        } else if (attachment) {
          const result = await api.perplexitySendPending(trimmedInput, {})
          streamingHtmlRef.current = {}
          setPendingAttachment(null)
          setHoveredAttachmentKey(null)
          setAttachmentSubmitting(false)
          void api.clearPendingAttachment()

          setChatMessages((msgs) => [
            ...msgs,
            {
              id: createId("msg"),
              role: "assistant",
              text: result.response,
              html: result.responseHtml ?? null,
              htmlSegments: result.responsesHtml ?? null,
              modelLabel,
              timestamp: Date.now()
            }
          ])

          if (!overrides?.preservePreferences) {
            setShouldStartNewChat(false)
            void api.updatePerplexityPreferences({ shouldStartNewChat: false })
          }
          void refetch()
        } else {
          const requestId = createId("req")
          activeRequestId = requestId
          streamingHtmlRef.current[requestId] = []

          setChatMessages((msgs) => [
            ...msgs,
            {
              id: createId("msg"),
              role: "assistant",
              text: "",
              htmlSegments: [],
              requestId,
              streaming: true,
              modelLabel,
              timestamp: Date.now()
            }
          ])

          const result = await api.perplexityChat(trimmedInput, {
            newChat: useNewChat,
            model: useNewChat ? requestModel : undefined,
            webSearch: webSearchEnabled,
            requestId
          })

          streamingHtmlRef.current[requestId] =
            result.responsesHtml ?? streamingHtmlRef.current[requestId] ?? []

          setChatMessages((msgs) =>
            msgs.map((msg) =>
              msg.requestId === requestId
                ? {
                    ...msg,
                    text: result.response,
                    html: result.responseHtml ?? msg.html ?? null,
                    htmlSegments:
                      streamingHtmlRef.current[requestId] ?? msg.htmlSegments ?? null,
                    streaming: false
                  }
                : msg
            )
          )

          if (!overrides?.preservePreferences) {
            setShouldStartNewChat(false)
            void api.updatePerplexityPreferences({ shouldStartNewChat: false })
          }
        }
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err)
        if (activeRequestId) {
          setChatMessages((msgs) =>
            msgs.map((msg) =>
              msg.requestId === activeRequestId
                ? { ...msg, text: `Error: ${errorText}`, streaming: false }
                : msg
            )
          )
        } else {
          setChatMessages((msgs) => [
            ...msgs,
            {
              id: createId("msg"),
              role: "assistant",
              text: `Error: ${errorText}`,
              timestamp: Date.now()
            }
          ])
        }
        showToast(
          chatEngine === "direct" ? "Direct AI Error" : "Perplexity Error",
          errorText,
          "error"
        )
        setAttachmentSubmitting(false)
      } finally {
        setChatLoading(false)
        setActiveModelLabel(null)
        chatInputRef.current?.focus()
      }
    },
    [
      chatEngine,
      currentModelDisplay,
      perplexityModel,
      refetch,
      shouldStartNewChat,
      showToast,
      webSearchEnabled
    ]
  )

  const handleChatSend = useCallback(async () => {
    await sendMessageInternal(chatInput)
  }, [chatInput, sendMessageInternal])

  const handlePerplexityNewChat = useCallback(() => {
    setSessionId(createId("session"))
    setChatMessages([])
    setShouldStartNewChat(true)
    setChatInput("")
    setIsThinkAppended(false)
    setPendingAttachment(null)
    setHoveredAttachmentKey(null)
    setAttachmentSubmitting(false)
    streamingHtmlRef.current = {}
    void window.electronAPI?.clearPendingAttachment()
    void window.electronAPI?.updatePerplexityPreferences({ shouldStartNewChat: true })
    chatInputRef.current?.focus()
  }, [])

  const handleRemoveAttachment = useCallback(() => {
    setPendingAttachment(null)
    setHoveredAttachmentKey(null)
    setAttachmentSubmitting(false)
    void window.electronAPI?.clearPendingAttachment()
  }, [])

  const handleWebSearchToggle = useCallback(() => {
    setWebSearchEnabled((prev) => {
      const next = !prev
      setShouldStartNewChat(true)
      return next
    })
    setTimeout(() => chatInputRef.current?.focus(), 50)
  }, [])

  const handleModelSelect = useCallback(
    (model: PerplexityModelKey) => {
      if (perplexityModel === model && !shouldStartNewChat) return
      setPerplexityModel(model)
      setShouldStartNewChat(true)
    },
    [perplexityModel, shouldStartNewChat]
  )

  const handleEngineSwitch = useCallback(
    async (nextEngine: ChatEngine) => {
      if (nextEngine === "perplexity" && !isMac) {
        showToast(
          "macOS Required",
          "Perplexity Safari mode requires macOS. Use Direct AI (Gemini, Ollama, or OpenAI/Groq) on Windows & Linux.",
          "neutral"
        )
        return
      }
      setChatEngine(nextEngine)
      await window.electronAPI?.setChatEngine?.(nextEngine)
      if (nextEngine === "direct") {
        const cfg = await window.electronAPI?.getCurrentLlmConfig?.()
        if (cfg) setLlmConfig(cfg)
      }
    },
    [isMac, showToast]
  )

  const handleForceConnect = useCallback(async () => {
    try {
      await window.electronAPI?.forceOpenPerplexity()
      showToast("Opening Perplexity", "Connecting to perplexity.ai...", "neutral")
    } catch (error) {
      console.error("Failed to open Perplexity:", error)
      showToast(
        "Browser Error",
        "Could not open perplexity.ai. Check Safari or switch to Direct AI mode.",
        "error"
      )
    }
  }, [showToast])

  const handleCopyMessage = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        showToast("Copied", "Copied to clipboard.", "success")
      } catch (error) {
        console.error("Clipboard copy failed:", error)
        showToast("Clipboard Error", "Could not copy message.", "error")
      }
    },
    [showToast]
  )

  const handleSnipScreen = useCallback(async () => {
    try {
      await window.electronAPI?.startCutScreenshot()
    } catch (error) {
      showToast(
        "Capture Failed",
        error instanceof Error ? error.message : String(error),
        "error"
      )
    }
  }, [showToast])

  const handleFullScreenshot = useCallback(async () => {
    try {
      const result = await window.electronAPI?.takeScreenshot()
      if (result) {
        setPendingAttachment(result)
        showToast("Screenshot Captured", "Ready to analyze — type a question or press Enter.", "success")
        setTimeout(() => chatInputRef.current?.focus(), 60)
      }
    } catch (error) {
      showToast(
        "Screenshot Failed",
        error instanceof Error ? error.message : String(error),
        "error"
      )
    }
  }, [showToast])

  const handleClipboardAsk = useCallback(async () => {
    if (!window.electronAPI?.readClipboard) return
    try {
      const clip = await window.electronAPI.readClipboard()
      if (clip.type === "image" && clip.imagePath && clip.imagePreview) {
        setPendingAttachment({ path: clip.imagePath, preview: clip.imagePreview })
        showToast("Clipboard Image Attached", "Press Enter or click a preset to analyze.", "success")
        setTimeout(() => chatInputRef.current?.focus(), 60)
      } else if (clip.type === "text" && clip.text) {
        setChatInput((prev) => (prev ? `${prev}\n${clip.text}` : clip.text || ""))
        showToast("Clipboard Loaded", "Pasted clipboard text into input.", "neutral")
        setTimeout(() => chatInputRef.current?.focus(), 60)
      } else {
        showToast("Clipboard Empty", "No text or image found in your clipboard.", "neutral")
      }
    } catch (error) {
      showToast(
        "Clipboard Error",
        error instanceof Error ? error.message : String(error),
        "error"
      )
    }
  }, [showToast])

  const handleVoiceToggle = useCallback(async () => {
    if (isRecordingVoice) {
      try {
        mediaRecorderRef.current?.stop()
      } catch {
        // ignore
      }
      setIsRecordingVoice(false)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Voice Unavailable", "Microphone recording is not supported on this system.", "error")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      const chunks: Blob[] = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      recorder.onstop = () => {
        // Always release microphone hardware tracks immediately
        stream.getTracks().forEach((track) => track.stop())
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null
        }
        setIsRecordingVoice(false)

        if (chunks.length === 0) return

        const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" })
        const reader = new FileReader()
        reader.onloadend = async () => {
          const dataUrl = typeof reader.result === "string" ? reader.result : ""
          const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : ""
          if (!base64Data) return

          setChatLoading(true)
          setActiveModelLabel("Voice AI")
          setChatMessages((msgs) => [
            ...msgs,
            {
              id: createId("msg"),
              role: "user",
              text: "[Voice recording sent]",
              timestamp: Date.now()
            }
          ])

          try {
            const result = await window.electronAPI.analyzeAudioFromBase64(
              base64Data,
              blob.type || "audio/webm"
            )
            setChatMessages((msgs) => [
              ...msgs,
              {
                id: createId("msg"),
                role: "assistant",
                text: result.text,
                modelLabel: "Gemini Audio",
                timestamp: result.timestamp || Date.now()
              }
            ])
          } catch (error) {
            const errText = error instanceof Error ? error.message : String(error)
            setChatMessages((msgs) => [
              ...msgs,
              {
                id: createId("msg"),
                role: "assistant",
                text: `Voice Error: ${errText}`,
                timestamp: Date.now()
              }
            ])
            showToast("Voice Analysis Failed", errText, "error")
          } finally {
            setChatLoading(false)
            setActiveModelLabel(null)
          }
        }
        reader.readAsDataURL(blob)
      }

      recorder.start()
      setIsRecordingVoice(true)
      showToast("Recording Voice", "Speak now — click Stop when finished.", "neutral")
    } catch (error) {
      showToast(
        "Microphone Denied",
        error instanceof Error ? error.message : "Could not access microphone.",
        "error"
      )
      setIsRecordingVoice(false)
    }
  }, [isRecordingVoice, showToast])

  const handleExportCurrentChat = useCallback(async () => {
    if (chatMessages.length === 0) {
      showToast("Nothing to Export", "Start a conversation first.", "neutral")
      return
    }
    const stored = chatMessages.map((m) => ({
      role: m.role,
      text: m.text,
      timestamp: m.timestamp,
      hasAttachment: Boolean(m.attachments?.length),
      modelLabel: m.modelLabel
    }))
    const markdown = formatSessionAsMarkdown({
      title: deriveSessionTitle(stored),
      modelLabel: currentModelDisplay,
      updatedAt: Date.now(),
      messages: stored
    })
    try {
      await navigator.clipboard.writeText(markdown)
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `overlay-chat-${new Date().toISOString().slice(0, 10)}.md`
      anchor.click()
      URL.revokeObjectURL(url)
      showToast("Exported", "Chat exported as Markdown & copied to clipboard.", "success")
    } catch (error) {
      showToast("Export Failed", error instanceof Error ? error.message : String(error), "error")
    }
  }, [chatMessages, currentModelDisplay, showToast])

  const handleExportSavedSession = useCallback(
    async (session: ChatSessionRecord) => {
      const markdown = formatSessionAsMarkdown(session)
      try {
        await navigator.clipboard.writeText(markdown)
        showToast("Session Copied", "Markdown transcript copied to clipboard.", "success")
      } catch {
        showToast("Export Failed", "Could not write Markdown to clipboard.", "error")
      }
    },
    [showToast]
  )

  const handleSelectHistorySession = useCallback((session: ChatSessionRecord) => {
    setSessionId(session.id)
    setChatMessages(
      session.messages.map((m, idx) => ({
        id: `hist-${session.id}-${idx}`,
        role: m.role,
        text: m.text,
        modelLabel: m.modelLabel,
        timestamp: m.timestamp || session.updatedAt
      }))
    )
    setShouldStartNewChat(true)
  }, [])

  const handleOpacityChange = useCallback(async (nextOpacity: number) => {
    setOpacity(nextOpacity)
    await window.electronAPI?.setWindowOpacity?.(nextOpacity)
  }, [])

  const handleStealthChange = useCallback(
    async (nextEnabled: boolean) => {
      setStealthEnabled(nextEnabled)
      await window.electronAPI?.setContentProtection?.(nextEnabled)
      showToast(
        nextEnabled ? "Stealth Enabled" : "Stealth Disabled",
        nextEnabled
          ? "Overlay is hidden from screen sharing and recordings."
          : "Overlay is now visible in screen captures.",
        "neutral"
      )
    },
    [showToast]
  )

  const handleQuickSolvePromptChange = useCallback(async (nextPrompt: string) => {
    setQuickSolvePrompt(nextPrompt)
    await window.electronAPI?.setQuickSolvePrompt?.(nextPrompt)
  }, [])

  const handlePresetClick = useCallback(
    (presetPrompt: string) => {
      if (pendingAttachmentRef.current) {
        void sendMessageInternal(presetPrompt)
        return
      }
      setChatInput((prev) => (prev.trim() ? `${presetPrompt}\n\n${prev.trim()}` : presetPrompt))
      setTimeout(() => chatInputRef.current?.focus(), 40)
    },
    [sendMessageInternal]
  )

  // Listen to Perplexity streaming updates
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onPerplexityStreamUpdate) return

    const unsubscribe = api.onPerplexityStreamUpdate((update) => {
      if (!update) return
      setChatMessages((messages) => {
        if (messages.length === 0) return messages

        let targetIndex = -1
        if (update.requestId) {
          targetIndex = messages.findIndex((msg) => msg.requestId === update.requestId)
        }
        if (targetIndex === -1) {
          for (let idx = messages.length - 1; idx >= 0; idx--) {
            if (messages[idx].role === "assistant") {
              targetIndex = idx
              break
            }
          }
        }
        if (targetIndex === -1) return messages

        const target = messages[targetIndex]
        if (target.role !== "assistant") return messages
        const requestId = update.requestId ?? target.requestId ?? "__default"
        const store = streamingHtmlRef.current
        const previousSegments = store[requestId] ?? target.htmlSegments ?? []
        const incomingSegments = Array.isArray(update.responsesHtml) ? update.responsesHtml : []

        if (
          incomingSegments.length === 0 &&
          (!update.responseHtml || !update.responseHtml.trim()) &&
          !update.response
        ) {
          return messages
        }

        let mergedSegments: string[] = previousSegments.slice()

        for (let i = 0; i < incomingSegments.length; i++) {
          const nextSegment = incomingSegments[i] ?? ""
          if (!nextSegment) continue
          if (!mergedSegments[i]) {
            mergedSegments.push(nextSegment)
            continue
          }
          if (mergedSegments[i] !== nextSegment) {
            mergedSegments = mergedSegments.slice(0, i)
            mergedSegments.push(nextSegment)
            for (let j = i + 1; j < incomingSegments.length; j++) {
              const candidate = incomingSegments[j]
              if (candidate && candidate.trim()) {
                mergedSegments.push(candidate)
              }
            }
            break
          }
        }

        store[requestId] = mergedSegments

        const next = messages.slice()
        next[targetIndex] = {
          ...target,
          text: update.response,
          html: update.responseHtml ?? target.html ?? null,
          htmlSegments: mergedSegments,
          streaming: true
        }
        return next
      })
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Resize observer (throttled during streaming) + screenshot / error listeners
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const updateDimensions = () => {
      if (!contentRef.current) return
      const contentHeight = contentRef.current.scrollHeight
      const contentWidth = contentRef.current.scrollWidth
      const dimensions = { width: contentWidth, height: contentHeight }

      if (isStreaming) {
        pendingDimensionsRef.current = dimensions
        return
      }

      pendingDimensionsRef.current = null
      void api.updateContentDimensions(dimensions)
    }

    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    const cleanupFunctions = [
      api.onResetView(() => refetch()),
      api.onSolutionError((error: string) => {
        showToast("Processing Failed", error || "Error processing screenshot.", "error")
        setView("queue")
      }),
      api.onProcessingNoScreenshots(() => {
        showToast("No Screenshots", "There are no screenshots to process.", "neutral")
      })
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [refetch, showToast, setView, isStreaming])

  useEffect(() => {
    if (!isStreaming && pendingDimensionsRef.current) {
      void window.electronAPI?.updateContentDimensions(pendingDimensionsRef.current)
      pendingDimensionsRef.current = null
    }
  }, [isStreaming])

  // Attachment, Capture Mode, Auto-Send (FIXED!), and Clipboard Trigger listeners
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const unsubscribeCaptureMode = api.onOverlayCaptureModeChange?.((active) => {
      setIsOverlayActive(Boolean(active))
    })

    const unsubscribeReady = api.onPerplexityAttachmentReady((data) => {
      setPendingAttachment(data)
      setChatLoading(false)
      setActiveModelLabel(null)
      setHoveredAttachmentKey(null)
      setAttachmentSubmitting(false)
      setTimeout(() => chatInputRef.current?.focus(), 80)
      void refetch()
    })

    const unsubscribeError = api.onPerplexityAttachmentError((error) => {
      setPendingAttachment(null)
      setHoveredAttachmentKey(null)
      setAttachmentSubmitting(false)
      showToast("Attachment Failed", error || "Could not attach screenshot", "error")
    })

    const unsubscribeNewChatStarted = api.onPerplexityNewChatStarted(() => {
      setShouldStartNewChat(false)
      void api.updatePerplexityPreferences({ shouldStartNewChat: false })
    })

    // FIXED BUG: Previously onPerplexityAutoSend was never subscribed in Queue.tsx!
    const unsubscribeAutoSend = api.onPerplexityAutoSend?.((payload) => {
      if (!payload) return
      void sendMessageInternal(payload.prompt || "", {
        model: payload.model,
        forceNewChat: payload.shouldStartNewChat ?? true,
        preservePreferences: payload.preservePreferences ?? true
      })
    })

    const unsubscribeClipboard = api.onTriggerClipboardAsk?.(() => {
      void handleClipboardAsk()
    })

    return () => {
      unsubscribeReady?.()
      unsubscribeError?.()
      unsubscribeNewChatStarted?.()
      unsubscribeCaptureMode?.()
      unsubscribeAutoSend?.()
      unsubscribeClipboard?.()
    }
  }, [refetch, showToast, sendMessageInternal, handleClipboardAsk])

  // Full-screen screenshot listener (Cmd+H)
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onScreenshotTaken) return

    const unsubscribe = api.onScreenshotTaken(async (data) => {
      await refetch()
      if (data?.source === "cut-selection") return

      setChatLoading(true)
      setActiveModelLabel("Vision AI")
      try {
        if (data?.path) {
          const response = await api.analyzeImageFile(data.path)
          setChatMessages((msgs) => [
            ...msgs,
            {
              id: createId("msg"),
              role: "user",
              text: "Analyze full-screen screenshot",
              attachments: data.preview ? [{ preview: data.preview, path: data.path }] : undefined,
              timestamp: Date.now()
            },
            {
              id: createId("msg"),
              role: "assistant",
              text: response.text,
              modelLabel: "Vision AI",
              timestamp: response.timestamp || Date.now()
            }
          ])
        }
      } catch (err) {
        setChatMessages((msgs) => [
          ...msgs,
          {
            id: createId("msg"),
            role: "assistant",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: Date.now()
          }
        ])
      } finally {
        setChatLoading(false)
        setActiveModelLabel(null)
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [refetch])

  const handleToggleThink = useCallback(() => {
    setChatInput((prev) => {
      const suffixIndex = prev.lastIndexOf(THINK_SUFFIX)
      if (isThinkAppended) {
        if (suffixIndex === -1) {
          setIsThinkAppended(false)
          return prev
        }
        setIsThinkAppended(false)
        return `${prev.slice(0, suffixIndex)}${prev.slice(suffixIndex + THINK_SUFFIX.length)}`
      }
      const base =
        suffixIndex !== -1
          ? prev.slice(0, suffixIndex) + prev.slice(suffixIndex + THINK_SUFFIX.length)
          : prev
      setIsThinkAppended(true)
      return `${base}${THINK_SUFFIX}`
    })
    setTimeout(() => chatInputRef.current?.focus(), 50)
  }, [isThinkAppended])

  const handleChatInputChange = useCallback((value: string) => {
    setChatInput(value)
    setIsThinkAppended(value.endsWith(THINK_SUFFIX))
  }, [])

  // Local keyboard shortcuts inside focused overlay window
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const metaPressed = event.metaKey || event.ctrlKey
      if (!metaPressed) return

      if (event.shiftKey && event.code === "KeyN") {
        event.preventDefault()
        handlePerplexityNewChat()
        return
      }
      if (event.code === "KeyK") {
        event.preventDefault()
        setActivePanel((prev) => (prev === "shortcuts" ? "none" : "shortcuts"))
        return
      }
      if (event.code === "KeyM") {
        event.preventDefault()
        handleModelSelect("sonar")
        return
      }
      if (event.code === "Comma") {
        event.preventDefault()
        handleModelSelect("gpt-5")
        return
      }
      if (event.code === "Period") {
        event.preventDefault()
        handleModelSelect("gpt-5-reasoning")
        return
      }
      if (event.code === "Slash") {
        event.preventDefault()
        handleModelSelect("claude-sonnet-4.5-reasoning")
        return
      }
      if (event.code === "KeyW") {
        event.preventDefault()
        handleWebSearchToggle()
        return
      }
      if (event.code === "KeyL") {
        event.preventDefault()
        handleToggleThink()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handlePerplexityNewChat, handleModelSelect, handleWebSearchToggle, handleToggleThink])

  useEffect(() => {
    if (!isOverlayActive) {
      chatInputRef.current?.blur()
      return
    }
    const timer = setTimeout(() => chatInputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [isOverlayActive])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const unsubscribeFocus = api.onFocusChatInput(() => {
      setTimeout(() => chatInputRef.current?.focus(), 50)
    })
    const unsubscribeModel = api.onModelShortcut((model) => {
      handleModelSelect(model)
    })
    const unsubscribeWeb = api.onWebSearchToggle(() => {
      handleWebSearchToggle()
    })

    return () => {
      unsubscribeFocus()
      unsubscribeModel()
      unsubscribeWeb()
    }
  }, [handleModelSelect, handleWebSearchToggle])

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        pointerEvents: "auto"
      }}
      className="select-none"
    >
      <div className="bg-transparent w-full">
        <div ref={contentRef} className="px-3 py-2">
          <Toast
            open={toastOpen}
            onOpenChange={setToastOpen}
            variant={toastMessage.variant}
            duration={3000}
          >
            <ToastTitle>{toastMessage.title}</ToastTitle>
            <ToastDescription>{toastMessage.description}</ToastDescription>
          </Toast>

          <div className="liquid-glass chat-container text-white mt-1 pb-3">
            {/* Draggable Header Bar */}
            <div className="sticky top-0 z-10 overlay-header px-3 py-2 space-y-1.5">
              {/* Row 1: Engine Switcher + Mode Indicator + Utility Controls */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  <span
                    className={`overlay-mode-indicator ${
                      isOverlayActive
                        ? "overlay-mode-indicator--active"
                        : "overlay-mode-indicator--passive"
                    }`}
                    title={isOverlayActive ? "Overlay active (interactive)" : "Overlay passive (click-through)"}
                  />
                  <div className="inline-flex rounded-md bg-black/30 p-0.5 border border-white/10">
                    <button
                      type="button"
                      onClick={() => void handleEngineSwitch("perplexity")}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        chatEngine === "perplexity"
                          ? "bg-blue-500/40 text-white"
                          : "text-white/60 hover:text-white"
                      }`}
                      title="Perplexity Safari automation (macOS)"
                    >
                      Perplexity
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleEngineSwitch("direct")}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        chatEngine === "direct"
                          ? "bg-blue-500/40 text-white"
                          : "text-white/60 hover:text-white"
                      }`}
                      title="Direct AI API (Gemini, Ollama, Groq, OpenRouter, OpenAI)"
                    >
                      Direct AI
                    </button>
                  </div>
                  {stealthEnabled && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300 border border-emerald-500/30"
                      title="Hidden from screen recording / screen sharing"
                    >
                      <Shield className="h-2.5 w-2.5" /> Stealth
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleSnipScreen()}
                    className="overlay-button h-6 w-6 flex items-center justify-center rounded-md"
                    title="Snip screen region (⌘↵)"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleClipboardAsk()}
                    className="overlay-button h-6 w-6 flex items-center justify-center rounded-md"
                    title="Paste clipboard text or image (⌘⇧C)"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePanel((p) => (p === "history" ? "none" : "history"))
                    }
                    className={`overlay-button h-6 w-6 flex items-center justify-center rounded-md ${
                      activePanel === "history" ? "overlay-button-active" : ""
                    }`}
                    title="Chat history"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportCurrentChat()}
                    className="overlay-button h-6 w-6 flex items-center justify-center rounded-md"
                    title="Export chat as Markdown"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePanel((p) => (p === "settings" ? "none" : "settings"))
                    }
                    className={`overlay-button h-6 w-6 flex items-center justify-center rounded-md ${
                      activePanel === "settings" ? "overlay-button-active" : ""
                    }`}
                    title="Direct AI models, opacity & stealth settings"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePanel((p) => (p === "shortcuts" ? "none" : "shortcuts"))
                    }
                    className={`overlay-button h-6 w-6 flex items-center justify-center rounded-md ${
                      activePanel === "shortcuts" ? "overlay-button-active" : ""
                    }`}
                    title="Shortcuts & quick actions (⌘K)"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePerplexityNewChat}
                    className="overlay-button h-6 w-6 flex items-center justify-center rounded-md text-sm font-medium leading-none"
                    title="Start a new chat (⌘⇧N)"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Row 2: Engine-Specific Model & Search Controls */}
              {chatEngine === "perplexity" ? (
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {(Object.keys(PERPLEXITY_MODEL_LABELS) as PerplexityModelKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleModelSelect(key)}
                        className={`overlay-button h-6 rounded-md px-1.5 text-[10px] leading-none tracking-wide ${
                          perplexityModel === key ? "overlay-button-active" : ""
                        }`}
                        title={`Select ${PERPLEXITY_MODEL_LABELS[key]} (${PERPLEXITY_MODEL_SHORTCUTS[key]})`}
                      >
                        {PERPLEXITY_MODEL_LABELS[key]}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleToggleThink}
                      className={`overlay-button h-6 rounded-md px-2 text-[10px] ${
                        isThinkAppended ? "overlay-toggle-active" : ""
                      }`}
                      title="Toggle think prompt (⌘L)"
                    >
                      Think
                    </button>
                    <button
                      type="button"
                      onClick={handleForceConnect}
                      className="overlay-button h-6 rounded-md px-2 text-[10px]"
                      title="Open perplexity.ai in browser"
                    >
                      Open Web
                    </button>
                    <button
                      type="button"
                      onClick={handleWebSearchToggle}
                      className={`overlay-button h-6 rounded-md px-2 text-[10px] ${
                        webSearchEnabled ? "overlay-toggle-active" : ""
                      }`}
                      title="Toggle web search (⌘W)"
                    >
                      {webSearchEnabled ? "Web On" : "Web Off"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-[10px] text-white/75">
                  <span className="truncate">
                    Model:{" "}
                    <strong className="text-blue-200 font-medium">{currentModelDisplay}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePanel("settings")}
                    className="overlay-button h-5 rounded px-2 text-[10px] shrink-0"
                  >
                    Configure Model
                  </button>
                </div>
              )}
            </div>

            <div className="px-3 pt-3">
              {/* Collapsible Settings / History / Shortcuts Drawers */}
              {activePanel === "settings" && (
                <ModelSelector
                  opacity={opacity}
                  stealthEnabled={stealthEnabled}
                  quickSolvePrompt={quickSolvePrompt}
                  onOpacityChange={(val) => void handleOpacityChange(val)}
                  onStealthChange={(val) => void handleStealthChange(val)}
                  onQuickSolvePromptChange={(val) => void handleQuickSolvePromptChange(val)}
                  onModelChange={async () => {
                    const updated = await window.electronAPI?.getCurrentLlmConfig?.()
                    if (updated) setLlmConfig(updated)
                    setChatEngine("direct")
                    await window.electronAPI?.setChatEngine?.("direct")
                    showToast("AI Provider Updated", "Switched to Direct AI mode.", "success")
                  }}
                  onClose={() => setActivePanel("none")}
                />
              )}

              <HistoryDrawer
                open={activePanel === "history"}
                sessions={chatHistory}
                activeSessionId={sessionId}
                onClose={() => setActivePanel("none")}
                onSelectSession={handleSelectHistorySession}
                onExportSession={(session) => void handleExportSavedSession(session)}
                onDeleteSession={(id) => setChatHistory((prev) => deleteChatSession(prev, id))}
                onClearAll={() => {
                  setChatHistory(clearAllChatHistory())
                  showToast("History Cleared", "All saved sessions removed.", "neutral")
                }}
              />

              <ShortcutsModal
                open={activePanel === "shortcuts"}
                isMac={isMac}
                onClose={() => setActivePanel("none")}
                onSnipScreen={() => void handleSnipScreen()}
                onFullScreenshot={() => void handleFullScreenshot()}
                onCenterWindow={() => void window.electronAPI?.centerAndShowWindow?.()}
                onResetQueues={async () => {
                  await window.electronAPI?.resetQueues?.()
                  handlePerplexityNewChat()
                  showToast("Reset Complete", "Cleared screenshot queues and chat.", "neutral")
                }}
                onQuit={() => void window.electronAPI?.quitApp?.()}
              />

              {/* Pending Screenshot Attachment Badge */}
              {pendingAttachment && !attachmentSubmitting && (
                <div className="mb-2 w-full flex justify-start">
                  <div
                    className="relative chat-bubble flex items-center gap-2 rounded-lg border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-xs text-white/90 focus:outline-none focus:ring-1 focus:ring-white/40"
                    onMouseEnter={() => setHoveredAttachmentKey("pending")}
                    onMouseLeave={() => setHoveredAttachmentKey(null)}
                    onFocus={() => setHoveredAttachmentKey("pending")}
                    onBlur={() => setHoveredAttachmentKey(null)}
                    tabIndex={0}
                  >
                    <span className="font-medium text-blue-200">[screenshot attached]</span>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="overlay-button h-5 w-5 flex items-center justify-center rounded-md text-xs leading-none"
                      title="Remove attachment"
                    >
                      ×
                    </button>
                    {hoveredAttachmentKey === "pending" && (
                      <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg border border-white/20 bg-black/90 p-2 shadow-lg">
                        <img
                          src={pendingAttachment.preview}
                          alt="Screenshot preview"
                          className="w-full rounded"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scrollable Chat Viewport */}
              {chatMessages.length > 0 && (
                <div className="max-h-[420px] overflow-y-auto overlay-scroll space-y-2.5 pr-1">
                  {chatMessages.map((msg, idx) => {
                    const isUser = msg.role === "user"
                    const isSystem = msg.role === "system"
                    const isAssistant = !isUser && !isSystem
                    const attachmentKey = `msg-${msg.id}`
                    const alignmentClass = isUser ? "ml-auto text-right" : "mr-auto text-left"
                    const bodyTextClass = isUser
                      ? "text-white text-right"
                      : isSystem
                        ? "text-amber-200 text-left"
                        : "text-white text-left"
                    const hasUserAttachment = Boolean(
                      isUser && msg.attachments && msg.attachments.length > 0
                    )
                    const hasAssistantHtml = Boolean(isAssistant && msg.html)

                    const messageContent = hasAssistantHtml ? (
                      <RichHtmlContent
                        html={msg.html ?? ""}
                        segments={msg.htmlSegments}
                        className={bodyTextClass}
                      />
                    ) : isAssistant ? (
                      <MarkdownContent content={msg.text} className={bodyTextClass} />
                    ) : (
                      <p className={`text-xs leading-relaxed whitespace-pre-wrap ${bodyTextClass}`}>
                        {msg.text}
                      </p>
                    )

                    return (
                      <div
                        key={msg.id || idx}
                        className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`chat-bubble ${alignmentClass} w-full space-y-1 text-xs leading-relaxed select-text rounded-lg ${
                            isUser ? "bg-white/5 px-2.5 py-1.5" : "px-1 py-0.5"
                          }`}
                          style={{ wordBreak: "break-word", lineHeight: "1.45" }}
                        >
                          {hasUserAttachment ? (
                            <div className="flex items-start gap-2">
                              <div
                                className="relative inline-flex shrink-0 cursor-pointer select-none rounded bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-medium text-blue-200"
                                onMouseEnter={() => setHoveredAttachmentKey(attachmentKey)}
                                onMouseLeave={() => setHoveredAttachmentKey(null)}
                              >
                                [image]
                                {hoveredAttachmentKey === attachmentKey && (
                                  <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-white/20 bg-black/90 p-2 shadow-lg">
                                    <img
                                      src={msg.attachments![0].preview}
                                      alt="Attached screenshot"
                                      className="w-full rounded"
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 text-left">{messageContent}</div>
                            </div>
                          ) : (
                            <>{messageContent}</>
                          )}

                          {isAssistant && !msg.streaming && msg.text && (
                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-[10px] text-white/40">
                                {msg.modelLabel || ""}
                              </span>
                              <button
                                type="button"
                                className="chat-copy-button text-[10px] leading-none"
                                onClick={() => void handleCopyMessage(msg.text)}
                                title="Copy full answer"
                              >
                                Copy
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {chatLoading && (
                <p className="mt-2 text-xs text-blue-200/80 animate-pulse">
                  {activeModelLabel || currentModelDisplay} thinking...
                </p>
              )}
            </div>

            {/* Quick Prompt Presets Strip */}
            <div className="mt-2.5 px-3">
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setShowPresets((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60 hover:text-white shrink-0"
                  title="Toggle quick prompt templates"
                >
                  <Sparkles className="h-3 w-3 text-blue-300" />
                  Presets
                </button>
                {showPresets &&
                  DEFAULT_PROMPT_TEMPLATES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={chatLoading}
                      onClick={() => handlePresetClick(preset.prompt)}
                      className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/80 hover:border-blue-400/40 hover:bg-blue-500/20 hover:text-white disabled:opacity-40 transition-colors"
                      title={preset.prompt}
                    >
                      {preset.label}
                    </button>
                  ))}
              </div>
            </div>

            {/* Input Form */}
            <div className="mt-1 px-4 pt-1">
              <form
                className="flex items-center gap-2 border-t overlay-divider pt-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleChatSend()
                }}
              >
                <button
                  type="button"
                  onClick={() => void handleVoiceToggle()}
                  disabled={chatLoading}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                    isRecordingVoice
                      ? "bg-red-500/80 text-white animate-pulse"
                      : "overlay-button text-white/75"
                  }`}
                  title={isRecordingVoice ? "Stop voice recording" : "Record voice prompt (Gemini Audio)"}
                  aria-label="Voice input"
                >
                  {isRecordingVoice ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  ref={chatInputRef}
                  className="overlay-input flex-1 text-xs"
                  placeholder={chatPlaceholder}
                  value={chatInput}
                  onChange={(e) => handleChatInputChange(e.target.value)}
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  className="overlay-send flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  disabled={chatLoading || (!chatInput.trim() && !pendingAttachment)}
                  tabIndex={-1}
                  aria-label="Send"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="white"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 19.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z"
                    />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Queue

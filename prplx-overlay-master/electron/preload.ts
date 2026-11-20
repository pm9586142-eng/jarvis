import { contextBridge, ipcRenderer } from "electron"

type PerplexityModelKey =
  | "sonar"
  | "gpt-5"
  | "gpt-5-reasoning"
  | "claude-sonnet-4.5-reasoning"

type LlmProvider = "ollama" | "gemini" | "openai-compatible"
type ChatEngine = "perplexity" | "direct"

interface PerplexityResult {
  prompt: string
  response: string
  responses: string[]
  responseHtml?: string | null
  responsesHtml?: string[]
}

interface PerplexityStreamUpdate {
  requestId: string | null
  response: string
  responses: string[]
  responseHtml: string | null
  responsesHtml: string[] | null
  timestamp: number
}

interface LlmConfigSnapshot {
  provider: LlmProvider
  model: string
  isOllama: boolean
  isMock: boolean
  ollamaUrl: string
  openaiBaseUrl: string
  hasGeminiKey: boolean
  hasOpenaiKey: boolean
}

interface ClipboardReadResult {
  type: "image" | "text" | "empty"
  text?: string
  imagePath?: string
  imagePreview?: string
}

interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string; source?: string }) => void
  ) => () => void
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void
  onUnauthorized: (callback: () => void) => () => void
  onFocusChatInput: (callback: () => void) => () => void
  onOverlayCaptureModeChange: (callback: (active: boolean) => void) => () => void
  onPerplexityAttachmentReady: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onPerplexityAutoSend: (
    callback: (payload: {
      prompt: string
      model: PerplexityModelKey
      shouldStartNewChat?: boolean
      preservePreferences?: boolean
    }) => void
  ) => () => void
  onPerplexityAttachmentError: (callback: (error: string) => void) => () => void
  onPerplexityNewChatStarted: (callback: () => void) => () => void
  onPerplexityStreamUpdate: (
    callback: (update: PerplexityStreamUpdate) => void
  ) => () => void
  onModelShortcut: (callback: (model: PerplexityModelKey) => void) => () => void
  onWebSearchToggle: (callback: () => void) => () => void
  onTriggerClipboardAsk: (callback: () => void) => () => void
  takeScreenshot: () => Promise<{ path: string; preview: string }>
  startCutScreenshot: () => Promise<{ path: string; preview: string } | null>
  readClipboard: () => Promise<ClipboardReadResult>
  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  centerAndShowWindow: () => Promise<void>
  toggleWindow: () => Promise<void>
  resetQueues: () => Promise<{ success: boolean; error?: string }>
  forceOpenPerplexity: () => Promise<{ success: boolean }>
  openExternalUrl: (url: string) => Promise<{ success: boolean }>
  enterOverlayCaptureMode: () => Promise<{ active: boolean }>
  exitOverlayCaptureMode: () => Promise<{ active: boolean }>
  toggleOverlayCaptureMode: () => Promise<{ active: boolean }>
  getOverlayCaptureMode: () => Promise<{ active: boolean }>
  setWindowOpacity: (opacity: number) => Promise<{ opacity: number }>
  getWindowOpacity: () => Promise<{ opacity: number }>
  setContentProtection: (enabled: boolean) => Promise<{ enabled: boolean }>
  getContentProtection: () => Promise<{ enabled: boolean }>
  setChatEngine: (engine: ChatEngine) => Promise<{ engine: ChatEngine; platform: string }>
  getChatEngine: () => Promise<{ engine: ChatEngine; platform: string }>
  setQuickSolvePrompt: (prompt: string) => Promise<{ prompt: string }>
  getQuickSolvePrompt: () => Promise<{ prompt: string }>
  analyzeAudioFromBase64: (
    data: string,
    mimeType: string
  ) => Promise<{ text: string; timestamp: number }>
  analyzeAudioFile: (path: string) => Promise<{ text: string; timestamp: number }>
  analyzeImageFile: (path: string) => Promise<{ text: string; timestamp: number }>
  quitApp: () => Promise<void>
  directAiChat: (
    message: string,
    options?: {
      imagePaths?: string[]
      history?: Array<{ role: "user" | "assistant"; text: string }>
      systemPrompt?: string
    }
  ) => Promise<{ response: string; provider: LlmProvider; model: string }>
  perplexityChat: (
    prompt: string,
    options?: {
      newChat?: boolean
      model?: PerplexityModelKey
      webSearch?: boolean
      requestId?: string
    }
  ) => Promise<PerplexityResult>
  perplexitySendPending: (
    message: string,
    options?: { timeoutSeconds?: number }
  ) => Promise<PerplexityResult>
  getCurrentLlmConfig: () => Promise<LlmConfigSnapshot>
  getAvailableOllamaModels: (customUrl?: string) => Promise<string[]>
  switchToOllama: (
    model?: string,
    url?: string
  ) => Promise<{ success: boolean; error?: string }>
  switchToGemini: (
    apiKey?: string,
    modelName?: string
  ) => Promise<{ success: boolean; error?: string }>
  switchToOpenAICompatible: (config: {
    apiKey?: string
    baseUrl?: string
    model?: string
  }) => Promise<{ success: boolean; error?: string }>
  testLlmConnection: () => Promise<{ success: boolean; error?: string; model?: string }>
  updatePerplexityPreferences: (
    preferences: Partial<{
      model: PerplexityModelKey
      webSearch: boolean
      shouldStartNewChat: boolean
    }>
  ) => Promise<void>
  clearPendingAttachment: () => Promise<{ success: boolean }>
  invoke: (channel: string, ...args: any[]) => Promise<any>
}

export const PROCESSING_EVENTS = {
  UNAUTHORIZED: "processing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error"
} as const

// Explicit IPC allowlist for backward-compatible generic invoke()
const ALLOWED_INVOKE_CHANNELS = new Set<string>([
  "update-content-dimensions",
  "delete-screenshot",
  "take-screenshot",
  "start-cut-screenshot",
  "read-clipboard",
  "perplexity-send-pending",
  "update-perplexity-preferences",
  "clear-pending-attachment",
  "get-screenshots",
  "toggle-window",
  "overlay-enter-capture-mode",
  "overlay-exit-capture-mode",
  "overlay-toggle-capture-mode",
  "overlay-capture-mode-state",
  "set-window-opacity",
  "get-window-opacity",
  "set-content-protection",
  "get-content-protection",
  "set-chat-engine",
  "get-chat-engine",
  "set-quick-solve-prompt",
  "get-quick-solve-prompt",
  "open-external-url",
  "force-open-perplexity",
  "reset-queues",
  "analyze-audio-base64",
  "analyze-audio-file",
  "analyze-image-file",
  "gemini-chat",
  "direct-ai-chat",
  "perplexity-chat",
  "quit-app",
  "move-window-left",
  "move-window-right",
  "move-window-up",
  "move-window-down",
  "center-and-show-window",
  "get-current-llm-config",
  "get-available-ollama-models",
  "switch-to-ollama",
  "switch-to-gemini",
  "switch-to-openai-compatible",
  "test-llm-connection"
])

const electronAPI: ElectronAPI = {
  updateContentDimensions: (dimensions) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  startCutScreenshot: () => ipcRenderer.invoke("start-cut-screenshot"),
  readClipboard: () => ipcRenderer.invoke("read-clipboard"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (filePath) => ipcRenderer.invoke("delete-screenshot", filePath),

  onScreenshotTaken: (callback) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      data: { path: string; preview: string; source?: string }
    ) => callback(data)
    ipcRenderer.on("screenshot-taken", subscription)
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription)
    }
  },
  onSolutionsReady: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, solutions: string) =>
      callback(solutions)
    ipcRenderer.on("solutions-ready", subscription)
    return () => {
      ipcRenderer.removeListener("solutions-ready", subscription)
    }
  },
  onResetView: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on("reset-view", subscription)
    return () => {
      ipcRenderer.removeListener("reset-view", subscription)
    }
  },
  onSolutionStart: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, subscription)
    }
  },
  onDebugStart: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_START, subscription)
    }
  },
  // Fixed memory leak: reuse identical subscription reference when removing listener
  onDebugSuccess: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_SUCCESS, subscription)
    }
  },
  onDebugError: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, error: string) =>
      callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    }
  },
  onSolutionError: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, error: string) =>
      callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        subscription
      )
    }
  },
  onProcessingNoScreenshots: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    }
  },
  onProblemExtracted: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: any) =>
      callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.PROBLEM_EXTRACTED,
        subscription
      )
    }
  },
  onSolutionSuccess: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: any) =>
      callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.SOLUTION_SUCCESS,
        subscription
      )
    }
  },
  onUnauthorized: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    }
  },
  onFocusChatInput: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on("focus-chat-input", subscription)
    return () => {
      ipcRenderer.removeListener("focus-chat-input", subscription)
    }
  },
  onOverlayCaptureModeChange: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, active: boolean) =>
      callback(active)
    ipcRenderer.on("overlay-capture-mode-change", subscription)
    return () => {
      ipcRenderer.removeListener("overlay-capture-mode-change", subscription)
    }
  },
  onPerplexityAttachmentReady: (callback) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      data: { path: string; preview: string }
    ) => callback(data)
    ipcRenderer.on("perplexity-attachment-ready", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-attachment-ready", subscription)
    }
  },
  onPerplexityAutoSend: (callback) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      payload: {
        prompt: string
        model: PerplexityModelKey
        shouldStartNewChat?: boolean
        preservePreferences?: boolean
      }
    ) => callback(payload)
    ipcRenderer.on("perplexity-auto-send", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-auto-send", subscription)
    }
  },
  onPerplexityAttachmentError: (callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, error: string) =>
      callback(error)
    ipcRenderer.on("perplexity-attachment-error", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-attachment-error", subscription)
    }
  },
  onPerplexityNewChatStarted: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on("perplexity-new-chat-started", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-new-chat-started", subscription)
    }
  },
  onPerplexityStreamUpdate: (callback) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      update: PerplexityStreamUpdate
    ) => callback(update)
    ipcRenderer.on("perplexity-stream-update", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-stream-update", subscription)
    }
  },
  onModelShortcut: (callback) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      model: PerplexityModelKey
    ) => callback(model)
    ipcRenderer.on("perplexity-model-shortcut", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-model-shortcut", subscription)
    }
  },
  onWebSearchToggle: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on("perplexity-web-search-toggle", subscription)
    return () => {
      ipcRenderer.removeListener("perplexity-web-search-toggle", subscription)
    }
  },
  onTriggerClipboardAsk: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on("trigger-clipboard-ask", subscription)
    return () => {
      ipcRenderer.removeListener("trigger-clipboard-ask", subscription)
    }
  },

  moveWindowLeft: () => ipcRenderer.invoke("move-window-left"),
  moveWindowRight: () => ipcRenderer.invoke("move-window-right"),
  moveWindowUp: () => ipcRenderer.invoke("move-window-up"),
  moveWindowDown: () => ipcRenderer.invoke("move-window-down"),
  centerAndShowWindow: () => ipcRenderer.invoke("center-and-show-window"),
  toggleWindow: () => ipcRenderer.invoke("toggle-window"),
  resetQueues: () => ipcRenderer.invoke("reset-queues"),
  forceOpenPerplexity: () => ipcRenderer.invoke("force-open-perplexity"),
  openExternalUrl: (url) => ipcRenderer.invoke("open-external-url", url),
  enterOverlayCaptureMode: () => ipcRenderer.invoke("overlay-enter-capture-mode"),
  exitOverlayCaptureMode: () => ipcRenderer.invoke("overlay-exit-capture-mode"),
  toggleOverlayCaptureMode: () => ipcRenderer.invoke("overlay-toggle-capture-mode"),
  getOverlayCaptureMode: () => ipcRenderer.invoke("overlay-capture-mode-state"),
  setWindowOpacity: (opacity) => ipcRenderer.invoke("set-window-opacity", opacity),
  getWindowOpacity: () => ipcRenderer.invoke("get-window-opacity"),
  setContentProtection: (enabled) =>
    ipcRenderer.invoke("set-content-protection", enabled),
  getContentProtection: () => ipcRenderer.invoke("get-content-protection"),
  setChatEngine: (engine) => ipcRenderer.invoke("set-chat-engine", engine),
  getChatEngine: () => ipcRenderer.invoke("get-chat-engine"),
  setQuickSolvePrompt: (prompt) =>
    ipcRenderer.invoke("set-quick-solve-prompt", prompt),
  getQuickSolvePrompt: () => ipcRenderer.invoke("get-quick-solve-prompt"),
  analyzeAudioFromBase64: (data, mimeType) =>
    ipcRenderer.invoke("analyze-audio-base64", data, mimeType),
  analyzeAudioFile: (filePath) => ipcRenderer.invoke("analyze-audio-file", filePath),
  analyzeImageFile: (filePath) => ipcRenderer.invoke("analyze-image-file", filePath),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  directAiChat: (message, options) =>
    ipcRenderer.invoke("direct-ai-chat", message, options),
  perplexityChat: (prompt, options) =>
    ipcRenderer.invoke("perplexity-chat", prompt, options),
  perplexitySendPending: (message, options) =>
    ipcRenderer.invoke("perplexity-send-pending", message, options),
  getCurrentLlmConfig: () => ipcRenderer.invoke("get-current-llm-config"),
  getAvailableOllamaModels: (customUrl) =>
    ipcRenderer.invoke("get-available-ollama-models", customUrl),
  switchToOllama: (model, url) => ipcRenderer.invoke("switch-to-ollama", model, url),
  switchToGemini: (apiKey, modelName) =>
    ipcRenderer.invoke("switch-to-gemini", apiKey, modelName),
  switchToOpenAICompatible: (config) =>
    ipcRenderer.invoke("switch-to-openai-compatible", config),
  testLlmConnection: () => ipcRenderer.invoke("test-llm-connection"),
  updatePerplexityPreferences: (preferences) =>
    ipcRenderer.invoke("update-perplexity-preferences", preferences),
  clearPendingAttachment: () => ipcRenderer.invoke("clear-pending-attachment"),
  invoke: (channel, ...args) => {
    if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Blocked unauthorized IPC channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  }
}

contextBridge.exposeInMainWorld("electronAPI", electronAPI)

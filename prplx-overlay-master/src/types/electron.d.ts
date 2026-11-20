export type PerplexityModelKey =
  | "sonar"
  | "gpt-5"
  | "gpt-5-reasoning"
  | "claude-sonnet-4.5-reasoning"

export type LlmProvider = "ollama" | "gemini" | "openai-compatible"
export type ChatEngine = "perplexity" | "direct"

export interface LlmConfigSnapshot {
  provider: LlmProvider
  model: string
  isOllama: boolean
  isMock: boolean
  ollamaUrl: string
  openaiBaseUrl: string
  hasGeminiKey: boolean
  hasOpenaiKey: boolean
}

export interface ClipboardReadResult {
  type: "image" | "text" | "empty"
  text?: string
  imagePath?: string
  imagePreview?: string
}

export interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string; source?: string }) => void
  ) => () => void
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void
  onUnauthorized: (callback: () => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  takeScreenshot: () => Promise<{ path: string; preview: string }>
  startCutScreenshot: () => Promise<{ path: string; preview: string } | null>
  readClipboard: () => Promise<ClipboardReadResult>
  onOverlayCaptureModeChange: (callback: (active: boolean) => void) => () => void
  onPerplexityAttachmentReady: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onPerplexityAttachmentError: (callback: (error: string) => void) => () => void
  onPerplexityNewChatStarted: (callback: () => void) => () => void
  onPerplexityStreamUpdate: (
    callback: (update: {
      requestId: string | null
      response: string
      responses: string[]
      responseHtml: string | null
      responsesHtml: string[] | null
      timestamp: number
    }) => void
  ) => () => void
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
  onFocusChatInput: (callback: () => void) => () => void
  onModelShortcut: (callback: (model: PerplexityModelKey) => void) => () => void
  onWebSearchToggle: (callback: () => void) => () => void
  onTriggerClipboardAsk: (callback: () => void) => () => void
  onPerplexityAutoSend: (
    callback: (payload: {
      prompt: string
      model: PerplexityModelKey
      shouldStartNewChat?: boolean
      preservePreferences?: boolean
    }) => void
  ) => () => void
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
  ) => Promise<{
    prompt: string
    response: string
    responses: string[]
    responseHtml?: string | null
    responsesHtml?: string[]
  }>
  perplexitySendPending: (
    message: string,
    options?: { timeoutSeconds?: number }
  ) => Promise<{
    prompt: string
    response: string
    responses: string[]
    responseHtml?: string | null
    responsesHtml?: string[]
  }>
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

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
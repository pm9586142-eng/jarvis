// ipcHandlers.ts

import fs from "node:fs"
import { ipcMain, app, shell } from "electron"
import { AppState, ChatEngine } from "./main"
import { PerplexityModelKey, sendPerplexityPrompt } from "./PerplexityHelper"
import { ChatHistoryMessage, getErrorMessage } from "./LLMHelper"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export function initializeIpcHandlers(appState: AppState): void {
  ipcMain.handle(
    "update-content-dimensions",
    async (_event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (_event, filePath: string) => {
    return appState.deleteScreenshot(filePath)
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw error
    }
  })

  ipcMain.handle("start-cut-screenshot", async () => {
    const result = await appState.startCutScreenshotFlow()
    if (!result) return null
    return { path: result.screenshotPath, preview: result.preview }
  })

  ipcMain.handle("read-clipboard", async () => {
    return appState.readClipboardContent()
  })

  ipcMain.handle(
    "perplexity-send-pending",
    async (_event, message: string, options?: { timeoutSeconds?: number }) => {
      return appState.sendPendingAttachment(message, options)
    }
  )

  ipcMain.handle(
    "update-perplexity-preferences",
    async (
      _event,
      preferences: Partial<{
        model: PerplexityModelKey
        webSearch: boolean
        shouldStartNewChat: boolean
      }>
    ) => {
      appState.updatePerplexityPreferences(preferences)
    }
  )

  ipcMain.handle("clear-pending-attachment", async () => {
    appState.clearPendingAttachment()
    return { success: true }
  })

  ipcMain.handle("get-screenshots", async () => {
    try {
      const queue =
        appState.getView() === "queue"
          ? appState.getScreenshotQueue()
          : appState.getExtraScreenshotQueue()

      const settled = await Promise.all(
        queue.map(async (filePath) => {
          try {
            const preview = await appState.getImagePreview(filePath)
            return { path: filePath, preview }
          } catch (error) {
            console.warn(`Skipping unreadable screenshot ${filePath}:`, getErrorMessage(error))
            return null
          }
        })
      )

      return settled.filter(
        (item): item is { path: string; preview: string } => item !== null
      )
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  ipcMain.handle("overlay-enter-capture-mode", async () => {
    appState.enterCaptureMode()
    return { active: true }
  })

  ipcMain.handle("overlay-exit-capture-mode", async () => {
    appState.exitCaptureMode()
    return { active: false }
  })

  ipcMain.handle("overlay-toggle-capture-mode", async () => {
    appState.toggleCaptureMode()
    return { active: appState.isCaptureModeActive() }
  })

  ipcMain.handle("overlay-capture-mode-state", async () => {
    return { active: appState.isCaptureModeActive() }
  })

  ipcMain.handle("set-window-opacity", async (_event, opacity: number) => {
    return { opacity: appState.setWindowOpacity(opacity) }
  })

  ipcMain.handle("get-window-opacity", async () => {
    return { opacity: appState.getWindowOpacity() }
  })

  ipcMain.handle("set-content-protection", async (_event, enabled: boolean) => {
    return { enabled: appState.setContentProtection(enabled) }
  })

  ipcMain.handle("get-content-protection", async () => {
    return { enabled: appState.isContentProtectionEnabled() }
  })

  ipcMain.handle("set-chat-engine", async (_event, engine: ChatEngine) => {
    return {
      engine: appState.setChatEngine(engine),
      platform: process.platform
    }
  })

  ipcMain.handle("get-chat-engine", async () => {
    return {
      engine: appState.getChatEngine(),
      platform: process.platform
    }
  })

  ipcMain.handle("set-quick-solve-prompt", async (_event, prompt: string) => {
    return { prompt: appState.setQuickSolvePrompt(prompt) }
  })

  ipcMain.handle("get-quick-solve-prompt", async () => {
    return { prompt: appState.getQuickSolvePrompt() }
  })

  ipcMain.handle("open-external-url", async (_event, url: string) => {
    if (typeof url !== "string") {
      throw new Error("URL must be a string")
    }
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http:// and https:// links can be opened externally")
    }
    await shell.openExternal(parsed.toString())
    return { success: true }
  })

  ipcMain.handle("force-open-perplexity", async () => {
    const url = "https://www.perplexity.ai"
    try {
      if (process.platform === "darwin") {
        await execFileAsync("open", ["-g", "-a", "Safari", url])
      } else {
        await shell.openExternal(url)
      }
      return { success: true }
    } catch (error) {
      console.error("Failed to open Perplexity:", error)
      throw error
    }
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      appState.clearQueues()
      return { success: true }
    } catch (error) {
      console.error("Error resetting queues:", error)
      return { success: false, error: getErrorMessage(error) }
    }
  })

  ipcMain.handle(
    "analyze-audio-base64",
    async (_event, data: string, mimeType: string) => {
      if (!data || typeof data !== "string") {
        throw new Error("Audio base64 payload is required")
      }
      return appState.processingHelper.processAudioBase64(data, mimeType)
    }
  )

  ipcMain.handle("analyze-audio-file", async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== "string" || !fs.existsSync(filePath)) {
      throw new Error("Audio file not found")
    }
    return appState.processingHelper.processAudioFile(filePath)
  })

  ipcMain.handle("analyze-image-file", async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("Image file path is required")
    }
    if (!appState.getScreenshotHelper().isAllowedScreenshotPath(filePath)) {
      throw new Error("Access denied: image path is outside screenshot directory")
    }
    if (!fs.existsSync(filePath)) {
      throw new Error("Image file not found")
    }
    return appState.processingHelper.getLLMHelper().analyzeImageFile(filePath)
  })

  ipcMain.handle("gemini-chat", async (_event, message: string) => {
    return appState.processingHelper.getLLMHelper().chatWithGemini(message)
  })

  ipcMain.handle(
    "direct-ai-chat",
    async (
      _event,
      message: string,
      options?: {
        imagePaths?: string[]
        history?: ChatHistoryMessage[]
        systemPrompt?: string
      }
    ) => {
      const screenshotHelper = appState.getScreenshotHelper()
      const validImagePaths = (options?.imagePaths ?? []).filter((imgPath) => {
        if (!imgPath || !screenshotHelper.isAllowedScreenshotPath(imgPath)) {
          return false
        }
        return fs.existsSync(imgPath)
      })

      const response = await appState.processingHelper
        .getLLMHelper()
        .chatWithContext(message, {
          imagePaths: validImagePaths,
          history: options?.history,
          systemPrompt: options?.systemPrompt
        })

      return {
        response,
        provider: appState.processingHelper.getLLMHelper().getCurrentProvider(),
        model: appState.processingHelper.getLLMHelper().getCurrentModel()
      }
    }
  )

  ipcMain.handle(
    "perplexity-chat",
    async (
      event,
      prompt: string,
      options?: {
        newChat?: boolean
        model?: PerplexityModelKey
        webSearch?: boolean
        requestId?: string
      }
    ) => {
      const { requestId, ...perplexityOptions } = options ?? {}

      return sendPerplexityPrompt(prompt, perplexityOptions, (payload) => {
        try {
          if (!event.sender.isDestroyed()) {
            event.sender.send("perplexity-stream-update", {
              requestId: requestId ?? null,
              response: payload.response,
              responses: payload.responses,
              responseHtml: payload.responseHtml ?? null,
              responsesHtml: payload.responsesHtml ?? null,
              timestamp: payload.timestamp
            })
          }
        } catch (error) {
          console.warn("Failed to forward Perplexity stream update:", error)
        }
      })
    }
  )

  ipcMain.handle("quit-app", () => {
    app.quit()
  })

  // Window movement handlers
  ipcMain.handle("move-window-left", async () => {
    appState.moveWindowLeft()
  })

  ipcMain.handle("move-window-right", async () => {
    appState.moveWindowRight()
  })

  ipcMain.handle("move-window-up", async () => {
    appState.moveWindowUp()
  })

  ipcMain.handle("move-window-down", async () => {
    appState.moveWindowDown()
  })

  ipcMain.handle("center-and-show-window", async () => {
    appState.centerAndShowWindow()
  })

  // LLM Model Management Handlers
  ipcMain.handle("get-current-llm-config", async () => {
    return appState.processingHelper.getLLMHelper().getCurrentConfig()
  })

  ipcMain.handle(
    "get-available-ollama-models",
    async (_event, customUrl?: string) => {
      return appState.processingHelper.getLLMHelper().getOllamaModels(customUrl)
    }
  )

  ipcMain.handle(
    "switch-to-ollama",
    async (_event, model?: string, url?: string) => {
      try {
        await appState.processingHelper.getLLMHelper().switchToOllama(model, url)
        return { success: true }
      } catch (error) {
        console.error("Error switching to Ollama:", error)
        return { success: false, error: getErrorMessage(error) }
      }
    }
  )

  ipcMain.handle(
    "switch-to-gemini",
    async (_event, apiKey?: string, modelName?: string) => {
      try {
        await appState.processingHelper
          .getLLMHelper()
          .switchToGemini(apiKey, modelName)
        return { success: true }
      } catch (error) {
        console.error("Error switching to Gemini:", error)
        return { success: false, error: getErrorMessage(error) }
      }
    }
  )

  ipcMain.handle(
    "switch-to-openai-compatible",
    async (
      _event,
      config: { apiKey?: string; baseUrl?: string; model?: string }
    ) => {
      try {
        await appState.processingHelper
          .getLLMHelper()
          .switchToOpenAICompatible(config ?? {})
        return { success: true }
      } catch (error) {
        console.error("Error switching to OpenAI-compatible API:", error)
        return { success: false, error: getErrorMessage(error) }
      }
    }
  )

  ipcMain.handle("test-llm-connection", async () => {
    try {
      return await appState.processingHelper.getLLMHelper().testConnection()
    } catch (error) {
      console.error("Error testing LLM connection:", error)
      return { success: false, error: getErrorMessage(error) }
    }
  })
}

// ProcessingHelper.ts

import fs from "node:fs"
import { AppState } from "./main"
import { LLMHelper, getErrorMessage } from "./LLMHelper"

// Note: In packaged apps, environment variables are set at build time or via system.
// dotenv is not needed and doesn't work inside .asar archives.

export class ProcessingHelper {
  private appState: AppState
  private llmHelper: LLMHelper
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(appState: AppState) {
    this.appState = appState

    const useOllama = process.env.USE_OLLAMA === "true"
    const ollamaModel = process.env.OLLAMA_MODEL
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434"

    if (useOllama) {
      console.log("[ProcessingHelper] Initializing with Ollama")
      this.llmHelper = new LLMHelper(undefined, true, ollamaModel, ollamaUrl)
    } else {
      const apiKey = process.env.GEMINI_API_KEY
      if (apiKey) {
        console.log("[ProcessingHelper] Initializing with Gemini")
      } else if (process.env.OPENAI_API_KEY) {
        console.log("[ProcessingHelper] Initializing with OpenAI-compatible API")
      } else {
        console.warn(
          "[ProcessingHelper] No Direct AI API key found at boot; Perplexity Safari mode or runtime Settings configuration available."
        )
      }
      this.llmHelper = new LLMHelper(apiKey, false)
    }
  }

  private sendToRenderer(channel: string, payload?: unknown): void {
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }
    if (typeof payload === "undefined") {
      mainWindow.webContents.send(channel)
    } else {
      mainWindow.webContents.send(channel, payload)
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) return

    const view = this.appState.getView()

    if (view === "queue") {
      const screenshotQueue = this.appState.getScreenshotHelper().getScreenshotQueue()
      if (screenshotQueue.length === 0) {
        this.sendToRenderer(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      const lastPath = screenshotQueue[screenshotQueue.length - 1]
      if (!lastPath || !fs.existsSync(lastPath)) {
        this.sendToRenderer(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      const abortController = new AbortController()
      this.currentProcessingAbortController = abortController
      const { signal } = abortController

      this.sendToRenderer(this.appState.PROCESSING_EVENTS.INITIAL_START)
      this.appState.setView("solutions")

      if (/\.(mp3|wav|m4a|ogg|webm|flac)$/i.test(lastPath)) {
        try {
          const audioResult = await this.llmHelper.analyzeAudioFile(lastPath)
          if (signal.aborted) return

          const problemInfo = {
            problem_statement: audioResult.text,
            input_format: { description: "Generated from audio input", parameters: [] as unknown[] },
            output_format: { description: "Generated from audio input", type: "string", subtype: "voice" },
            complexity: { time: "N/A", space: "N/A" },
            test_cases: [] as unknown[],
            validation_type: "manual",
            difficulty: "custom"
          }
          this.appState.setProblemInfo(problemInfo)
          this.sendToRenderer(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problemInfo)
        } catch (error) {
          if (signal.aborted) return
          console.error("Audio processing error:", error)
          this.sendToRenderer(
            this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            getErrorMessage(error)
          )
        } finally {
          if (this.currentProcessingAbortController === abortController) {
            this.currentProcessingAbortController = null
          }
        }
        return
      }

      try {
        const imageResult = await this.llmHelper.analyzeImageFile(lastPath)
        if (signal.aborted) return

        const problemInfo = {
          problem_statement: imageResult.text,
          input_format: { description: "Generated from screenshot", parameters: [] as unknown[] },
          output_format: { description: "Generated from screenshot", type: "string", subtype: "text" },
          complexity: { time: "N/A", space: "N/A" },
          test_cases: [] as unknown[],
          validation_type: "manual",
          difficulty: "custom"
        }
        this.appState.setProblemInfo(problemInfo)
        this.sendToRenderer(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problemInfo)
      } catch (error) {
        if (signal.aborted) return
        console.error("Image processing error:", error)
        this.sendToRenderer(
          this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          getErrorMessage(error)
        )
      } finally {
        if (this.currentProcessingAbortController === abortController) {
          this.currentProcessingAbortController = null
        }
      }
      return
    }

    // Debug mode
    const extraScreenshotQueue = this.appState.getScreenshotHelper().getExtraScreenshotQueue()
    if (extraScreenshotQueue.length === 0) {
      this.sendToRenderer(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
      return
    }

    const abortController = new AbortController()
    this.currentExtraProcessingAbortController = abortController
    const { signal } = abortController

    this.sendToRenderer(this.appState.PROCESSING_EVENTS.DEBUG_START)

    try {
      const problemInfo = this.appState.getProblemInfo()
      if (!problemInfo) {
        throw new Error("No problem info available for debugging")
      }

      const currentSolution = await this.llmHelper.generateSolution(problemInfo)
      if (signal.aborted) return

      const currentCode = currentSolution?.solution?.code ?? ""

      const debugResult = await this.llmHelper.debugSolutionWithImages(
        problemInfo,
        currentCode,
        extraScreenshotQueue
      )
      if (signal.aborted) return

      this.appState.setHasDebugged(true)
      this.sendToRenderer(this.appState.PROCESSING_EVENTS.DEBUG_SUCCESS, debugResult)
    } catch (error) {
      if (signal.aborted) return
      console.error("Debug processing error:", error)
      this.sendToRenderer(
        this.appState.PROCESSING_EVENTS.DEBUG_ERROR,
        getErrorMessage(error)
      )
    } finally {
      if (this.currentExtraProcessingAbortController === abortController) {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  public cancelOngoingRequests(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
    }

    this.appState.setHasDebugged(false)
  }

  public async processAudioBase64(data: string, mimeType: string) {
    return this.llmHelper.analyzeAudioFromBase64(data, mimeType)
  }

  public async processAudioFile(filePath: string) {
    return this.llmHelper.analyzeAudioFile(filePath)
  }

  public getLLMHelper(): LLMHelper {
    return this.llmHelper
  }
}

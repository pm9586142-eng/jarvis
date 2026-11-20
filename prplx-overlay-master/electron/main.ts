import { app, BrowserWindow, clipboard, systemPreferences } from "electron"
import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { ProcessingHelper } from "./ProcessingHelper"
import {
  attachPerplexityImage,
  PerplexityModelKey,
  PerplexityResult,
  sendPerplexityPromptWithAttachments
} from "./PerplexityHelper"
import { SelectionHelper } from "./SelectionHelper"
import { getErrorMessage } from "./LLMHelper"

export type ChatEngine = "perplexity" | "direct"

interface PerplexityPreferences {
  model: PerplexityModelKey
  webSearch: boolean
  shouldStartNewChat: boolean
}

export interface ClipboardReadResult {
  type: "image" | "text" | "empty"
  text?: string
  imagePath?: string
  imagePreview?: string
}

const DEFAULT_QUICK_SOLVE_PROMPT =
  "Solve this step by step. Think carefully and verify your final answer."

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper
  public processingHelper: ProcessingHelper
  private selectionHelper: SelectionHelper
  private hasShownScreenPermissionWarning: boolean = false

  private view: "queue" | "solutions" = "queue"

  private problemInfo: {
    problem_statement: string
    input_format: Record<string, unknown>
    output_format: Record<string, unknown>
    constraints?: Array<Record<string, unknown>>
    test_cases: Array<unknown>
    complexity?: { time: string; space: string }
    validation_type?: string
    difficulty?: string
  } | null = null

  private hasDebugged: boolean = false
  private pendingAttachment: { path: string; preview: string } | null = null
  private chatEngine: ChatEngine = process.platform === "darwin" ? "perplexity" : "direct"
  private quickSolvePrompt: string = DEFAULT_QUICK_SOLVE_PROMPT

  private perplexityPreferences: PerplexityPreferences = {
    model: "sonar",
    webSearch: false,
    shouldStartNewChat: true
  }

  public readonly PROCESSING_EVENTS = {
    // Global states
    UNAUTHORIZED: "processing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",

    // Initial solution states
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",

    // Debugging states
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const

  constructor() {
    this.windowHelper = new WindowHelper(this)
    this.screenshotHelper = new ScreenshotHelper(this.view)
    this.processingHelper = new ProcessingHelper(this)
    this.shortcutsHelper = new ShortcutsHelper(this)
    this.selectionHelper = new SelectionHelper()
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  public getMainWindow(): BrowserWindow | null {
    return this.windowHelper.getMainWindow()
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
    this.screenshotHelper.setView(view)
  }

  public isVisible(): boolean {
    return this.windowHelper.isVisible()
  }

  public getScreenshotHelper(): ScreenshotHelper {
    return this.screenshotHelper
  }

  public getProblemInfo() {
    return this.problemInfo
  }

  public setProblemInfo(problemInfo: AppState["problemInfo"]): void {
    this.problemInfo = problemInfo
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotHelper.getScreenshotQueue()
  }

  public getExtraScreenshotQueue(): string[] {
    return this.screenshotHelper.getExtraScreenshotQueue()
  }

  public getChatEngine(): ChatEngine {
    return this.chatEngine
  }

  public setChatEngine(engine: ChatEngine): ChatEngine {
    if (engine === "perplexity" || engine === "direct") {
      this.chatEngine = engine
    }
    return this.chatEngine
  }

  public getQuickSolvePrompt(): string {
    return this.quickSolvePrompt
  }

  public setQuickSolvePrompt(prompt: string): string {
    const trimmed = (prompt || "").trim()
    this.quickSolvePrompt = trimmed || DEFAULT_QUICK_SOLVE_PROMPT
    return this.quickSolvePrompt
  }

  public setWindowOpacity(opacity: number): number {
    return this.windowHelper.setOpacity(opacity)
  }

  public getWindowOpacity(): number {
    return this.windowHelper.getOpacity()
  }

  public setContentProtection(enabled: boolean): boolean {
    return this.windowHelper.setContentProtection(enabled)
  }

  public isContentProtectionEnabled(): boolean {
    return this.windowHelper.isContentProtectionEnabled()
  }

  public createWindow(): void {
    this.windowHelper.createWindow()
  }

  public hideMainWindow(): void {
    this.windowHelper.hideMainWindow()
  }

  public showMainWindow(options?: { capture?: boolean }): void {
    this.windowHelper.showMainWindow(options ?? {})
  }

  public showPassiveOverlay(): void {
    this.windowHelper.showPassiveOverlay()
  }

  public triggerAutoSend(
    message: string,
    options: {
      model: PerplexityModelKey
      shouldStartNewChat?: boolean
      preservePreferences?: boolean
    }
  ): void {
    const mainWindow = this.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    this.updatePerplexityPreferences({
      model: options.model,
      shouldStartNewChat: options.shouldStartNewChat ?? true
    })

    mainWindow.webContents.send("perplexity-auto-send", {
      prompt: message,
      model: options.model,
      shouldStartNewChat: options.shouldStartNewChat,
      preservePreferences: options.preservePreferences ?? false
    })
  }

  public toggleMainWindow(): void {
    this.windowHelper.toggleMainWindow()
  }

  public setWindowDimensions(width: number, height: number): void {
    this.windowHelper.setWindowDimensions(width, height)
  }

  public clearQueues(): void {
    this.screenshotHelper.clearQueues()
    this.problemInfo = null
    this.setView("queue")
    this.pendingAttachment = null
  }

  public updatePerplexityPreferences(preferences: Partial<PerplexityPreferences>): void {
    this.perplexityPreferences = {
      ...this.perplexityPreferences,
      ...preferences
    }
  }

  public getPerplexityPreferences(): PerplexityPreferences {
    return { ...this.perplexityPreferences }
  }

  public getPendingAttachment(): { path: string; preview: string } | null {
    return this.pendingAttachment ? { ...this.pendingAttachment } : null
  }

  public clearPendingAttachment(): void {
    this.pendingAttachment = null
  }

  public async readClipboardContent(): Promise<ClipboardReadResult> {
    const image = clipboard.readImage()
    if (image && !image.isEmpty()) {
      const pngBuffer = image.toPNG()
      const imagePath = await this.screenshotHelper.saveBufferAsScreenshot(pngBuffer)
      const imagePreview = await this.getImagePreview(imagePath)
      this.pendingAttachment = { path: imagePath, preview: imagePreview }

      if (this.chatEngine === "perplexity" && process.platform === "darwin") {
        try {
          await attachPerplexityImage(imagePath, {
            newChat: this.perplexityPreferences.shouldStartNewChat
          })
        } catch (error) {
          console.warn(
            "[AppState] Clipboard image saved locally; Safari attach skipped:",
            getErrorMessage(error)
          )
        }
      }

      return {
        type: "image",
        imagePath,
        imagePreview
      }
    }

    const text = clipboard.readText()?.trim()
    if (text) {
      return {
        type: "text",
        text
      }
    }

    return { type: "empty" }
  }

  private async ensureScreenCapturePermission(): Promise<void> {
    if (process.platform !== "darwin") {
      return
    }

    const getMediaStatus = (systemPreferences as any).getMediaAccessStatus?.bind(systemPreferences)
    const askForMediaAccess = (systemPreferences as any).askForMediaAccess?.bind(systemPreferences)

    if (typeof getMediaStatus !== "function") {
      return
    }

    let status: string
    try {
      status = getMediaStatus("screen")
    } catch (error) {
      console.warn("Unable to query screen capture permission status:", error)
      return
    }

    if (status === "granted") {
      return
    }

    if (status === "not-determined" && typeof askForMediaAccess === "function") {
      try {
        const granted = await askForMediaAccess("screen")
        if (granted) {
          return
        }
        status = getMediaStatus("screen")
      } catch (error) {
        console.warn("Failed to request screen capture permission:", error)
        status = getMediaStatus("screen")
      }
    }

    if (status !== "granted") {
      const message =
        'Screen recording permission is required. Open System Settings -> Privacy & Security -> Screen Recording and enable "Perplexity Overlay", then restart the app.'

      const mainWindow = this.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("perplexity-attachment-error", message)
      }

      if (!this.hasShownScreenPermissionWarning) {
        this.hasShownScreenPermissionWarning = true
        console.warn(message)
      }

      throw new Error(message)
    }
  }

  public async takeScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available")

    await this.ensureScreenCapturePermission()

    return this.screenshotHelper.takeScreenshot(
      () => this.hideMainWindow(),
      () => this.showMainWindow()
    )
  }

  public async startCutScreenshotFlow(): Promise<{
    screenshotPath: string
    preview: string
  } | null> {
    const mainWindow = this.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.warn("No main window for cut screenshot flow")
      return null
    }

    await this.ensureScreenCapturePermission()

    try {
      const selection = await this.selectionHelper.startSelection()
      if (!selection) {
        return null
      }

      await this.delay(50)

      const screenshotPath = await this.screenshotHelper.captureRegion(selection)
      const preview = await this.getImagePreview(screenshotPath)

      // In Perplexity Safari mode on macOS, attach to Safari BEFORE confirming pending attachment
      if (this.chatEngine === "perplexity" && process.platform === "darwin") {
        await attachPerplexityImage(screenshotPath, {
          newChat: this.perplexityPreferences.shouldStartNewChat
        })

        if (this.perplexityPreferences.shouldStartNewChat) {
          this.perplexityPreferences.shouldStartNewChat = false
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send("perplexity-new-chat-started")
          }
        }
      }

      this.pendingAttachment = { path: screenshotPath, preview }

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("perplexity-attachment-ready", {
          path: screenshotPath,
          preview
        })
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview,
          source: "cut-selection"
        })
      }

      return { screenshotPath, preview }
    } catch (error) {
      this.pendingAttachment = null
      console.error("Cut screenshot flow failed:", error)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          "perplexity-attachment-error",
          getErrorMessage(error)
        )
      }
      throw error
    }
  }

  public async sendPendingAttachment(
    message: string,
    options?: { timeoutSeconds?: number }
  ): Promise<PerplexityResult> {
    const mainWindow = this.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error("Main window not available")
    }

    if (!this.pendingAttachment) {
      throw new Error("No pending attachment to send")
    }

    const normalizedMessage =
      message && message.trim().length > 0 ? message : "[image attached]"
    const result = await sendPerplexityPromptWithAttachments(normalizedMessage, {
      newChat: this.perplexityPreferences.shouldStartNewChat,
      model: this.perplexityPreferences.model,
      webSearch: this.perplexityPreferences.webSearch,
      timeoutSeconds: options?.timeoutSeconds
    })

    this.pendingAttachment = null
    if (this.perplexityPreferences.shouldStartNewChat) {
      this.perplexityPreferences.shouldStartNewChat = false
    }

    return result
  }

  public async getImagePreview(filepath: string): Promise<string> {
    return this.screenshotHelper.getImagePreview(filepath)
  }

  public async deleteScreenshot(
    targetPath: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.screenshotHelper.deleteScreenshot(targetPath)
  }

  public moveWindowLeft(): void {
    this.windowHelper.moveWindowLeft()
  }

  public moveWindowRight(): void {
    this.windowHelper.moveWindowRight()
  }

  public moveWindowDown(): void {
    this.windowHelper.moveWindowDown()
  }

  public moveWindowUp(): void {
    this.windowHelper.moveWindowUp()
  }

  public centerAndShowWindow(): void {
    this.windowHelper.centerAndShowWindow()
  }

  public enterCaptureMode(): void {
    this.windowHelper.enterCaptureMode()
  }

  public exitCaptureMode(options?: {
    refocusSafari?: boolean
    keepVisible?: boolean
  }): void {
    this.windowHelper.exitCaptureMode(options ?? {})
  }

  public toggleCaptureMode(): void {
    this.windowHelper.togglePassiveMode()
  }

  public isCaptureModeActive(): boolean {
    return this.windowHelper.isCaptureModeActive()
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  public setHasDebugged(value: boolean): void {
    this.hasDebugged = value
  }

  public getHasDebugged(): boolean {
    return this.hasDebugged
  }
}

async function initializeApp() {
  const appState = AppState.getInstance()

  initializeIpcHandlers(appState)

  app.whenReady().then(() => {
    console.log("App is ready")
    appState.createWindow()
    appState.shortcutsHelper.registerGlobalShortcuts()
  })

  app.on("activate", () => {
    if (appState.getMainWindow() === null) {
      appState.createWindow()
    }
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })

  if (process.platform === "darwin") {
    try {
      app.setActivationPolicy("regular")
      app.dock?.show()
    } catch (error) {
      console.warn("Failed to set macOS activation policy:", error)
    }
  }
  app.commandLine.appendSwitch("disable-background-timer-throttling")
}

initializeApp().catch(console.error)

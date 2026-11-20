import { globalShortcut, app } from "electron"
import { AppState } from "./main"
import { PerplexityModelKey } from "./PerplexityHelper"

export class ShortcutsHelper {
  private appState: AppState

  constructor(appState: AppState) {
    this.appState = appState
  }

  private emitWhenVisible(channel: string, payload?: unknown): void {
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed() || !this.appState.isVisible()) {
      return
    }
    if (typeof payload === "undefined") {
      mainWindow.webContents.send(channel)
    } else {
      mainWindow.webContents.send(channel, payload)
    }
  }

  private safeRegister(accelerator: string, callback: () => void | Promise<void>): void {
    try {
      globalShortcut.register(accelerator, () => {
        try {
          const result = callback()
          if (result && typeof (result as Promise<void>).catch === "function") {
            ;(result as Promise<void>).catch((error) => {
              console.error(`[ShortcutsHelper] Handler error for ${accelerator}:`, error)
            })
          }
        } catch (error) {
          console.error(`[ShortcutsHelper] Sync error for ${accelerator}:`, error)
        }
      })

      if (!globalShortcut.isRegistered(accelerator)) {
        console.warn(`[ShortcutsHelper] Could not register shortcut: ${accelerator}`)
      }
    } catch (error) {
      console.warn(`[ShortcutsHelper] Invalid or unavailable shortcut "${accelerator}":`, error)
    }
  }

  public registerGlobalShortcuts(): void {
    // Center and show overlay
    this.safeRegister("CommandOrControl+Shift+Space", () => {
      this.appState.centerAndShowWindow()
    })

    // Toggle active / passive overlay focus mode
    this.safeRegister("CommandOrControl+'", () => {
      const isVisible = this.appState.isVisible()
      const isCaptureMode = this.appState.isCaptureModeActive()

      if (!isVisible) {
        this.appState.showMainWindow({ capture: true })
        return
      }

      if (isCaptureMode) {
        this.appState.showPassiveOverlay()
      } else {
        this.appState.enterCaptureMode()
      }
    })

    // Full-screen screenshot
    this.safeRegister("CommandOrControl+H", async () => {
      const mainWindow = this.appState.getMainWindow()
      if (!mainWindow || mainWindow.isDestroyed()) return
      try {
        const screenshotPath = await this.appState.takeScreenshot()
        const preview = await this.appState.getImagePreview(screenshotPath)
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview
          })
        }
      } catch (error) {
        console.error("Error capturing screenshot:", error)
      }
    })

    // Region snip screenshot
    this.safeRegister("CommandOrControl+Enter", async () => {
      try {
        await this.appState.startCutScreenshotFlow()
      } catch (error) {
        console.error("Cut screenshot flow error:", error)
      }
    })

    // Clipboard quick-ask shortcut
    this.safeRegister("CommandOrControl+Shift+C", () => {
      if (!this.appState.isVisible()) {
        this.appState.showMainWindow({ capture: true })
      } else {
        this.appState.enterCaptureMode()
      }
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("trigger-clipboard-ask")
      }
    })

    const captureAndAutoSend = async (
      description: string,
      prompt: string,
      model: PerplexityModelKey
    ) => {
      try {
        console.log(description)
        const capture = await this.appState.startCutScreenshotFlow()
        if (capture) {
          this.appState.triggerAutoSend(prompt, {
            model,
            shouldStartNewChat: true,
            preservePreferences: true
          })
        }
      } catch (error) {
        console.error(`${description} failed:`, error)
      } finally {
        if (this.appState.getChatEngine() === "perplexity") {
          this.appState.showPassiveOverlay()
        } else {
          this.appState.enterCaptureMode()
        }
      }
    }

    this.safeRegister("CommandOrControl+Shift+Enter", async () => {
      await captureAndAutoSend(
        "Cmd/Ctrl+Shift+Enter: capturing and sending via GPT-5.",
        "",
        "gpt-5"
      )
    })

    // Fixed previously invalid accelerator ("CommandOrControl+'+Enter") -> CommandOrControl+Alt+Enter
    this.safeRegister("CommandOrControl+Alt+Enter", async () => {
      await captureAndAutoSend(
        "Cmd/Ctrl+Alt+Enter: capturing and sending with quick-solve reasoning prompt.",
        this.appState.getQuickSolvePrompt(),
        "gpt-5-reasoning"
      )
    })

    this.safeRegister("CommandOrControl+1", async () => {
      await captureAndAutoSend(
        "Cmd/Ctrl+1: quick region capture & ask.",
        "",
        "gpt-5"
      )
    })

    this.safeRegister("CommandOrControl+2", async () => {
      await captureAndAutoSend(
        "Cmd/Ctrl+2: quick region capture & deep-reasoning solve.",
        this.appState.getQuickSolvePrompt(),
        "gpt-5-reasoning"
      )
    })

    // Cancel requests & reset queues
    this.safeRegister("CommandOrControl+R", () => {
      this.appState.processingHelper.cancelOngoingRequests()
      this.appState.clearQueues()
      this.appState.setView("queue")

      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
      }
    })

    // Window movement shortcuts
    this.safeRegister("CommandOrControl+Left", () => {
      if (!this.appState.isVisible()) return
      this.appState.moveWindowLeft()
    })

    this.safeRegister("CommandOrControl+Right", () => {
      if (!this.appState.isVisible()) return
      this.appState.moveWindowRight()
    })

    this.safeRegister("CommandOrControl+Shift+Down", () => {
      if (!this.appState.isVisible()) return
      this.appState.moveWindowDown()
    })

    this.safeRegister("CommandOrControl+Up", () => {
      if (!this.appState.isVisible()) return
      this.appState.moveWindowUp()
    })

    this.safeRegister("CommandOrControl+Down", () => {
      this.appState.toggleMainWindow()
    })

    // Model selection shortcuts (only act when overlay is visible)
    this.safeRegister("CommandOrControl+M", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "sonar")
    })

    this.safeRegister("CommandOrControl+,", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "gpt-5")
    })

    this.safeRegister("CommandOrControl+.", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "gpt-5-reasoning")
    })

    this.safeRegister("CommandOrControl+/", () => {
      this.emitWhenVisible("perplexity-model-shortcut", "claude-sonnet-4.5-reasoning")
    })

    this.safeRegister("CommandOrControl+W", () => {
      this.emitWhenVisible("perplexity-web-search-toggle")
    })

    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}

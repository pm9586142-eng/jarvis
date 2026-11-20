import { BrowserWindow, screen } from "electron"
import { AppState } from "./main"
import path from "node:path"
import { execFile, execFileSync } from "node:child_process"

const isDev = process.env.NODE_ENV === "development"

const startUrl = isDev
  ? "http://localhost:5180"
  : `file://${path.join(__dirname, "../dist/index.html")}`

const SAFE_BUNDLE_ID_REGEX = /^[A-Za-z0-9._-]+$/

export class WindowHelper {
  private mainWindow: BrowserWindow | null = null
  private isWindowVisible: boolean = false
  private windowPosition: { x: number; y: number } | null = null
  private windowSize: { width: number; height: number } | null = null
  private appState: AppState

  private step: number = 120
  private currentX: number = 0
  private currentY: number = 0
  private captureMode: boolean = false
  private safariRefocusTimer: NodeJS.Timeout | null = null
  private previousAppBundleId: string | null = null
  private windowOpacity: number = 0.96
  private contentProtectionEnabled: boolean = true

  constructor(appState: AppState) {
    this.appState = appState
  }

  private getCurrentWorkArea(): Electron.Rectangle {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const display = screen.getDisplayMatching(this.mainWindow.getBounds())
      return display.workArea
    }
    return screen.getPrimaryDisplay().workArea
  }

  public setWindowDimensions(width: number, height: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return
    }

    const [currentX, currentY] = this.mainWindow.getPosition()
    const workArea = this.getCurrentWorkArea()

    const maxAllowedWidth = Math.floor(
      workArea.width * (this.appState.getHasDebugged() ? 0.75 : 0.55)
    )
    const maxAllowedHeight = Math.floor(workArea.height * 0.88)

    const newWidth = Math.max(360, Math.min(Math.ceil(width + 32), maxAllowedWidth))
    const newHeight = Math.max(180, Math.min(Math.ceil(height), maxAllowedHeight))

    const maxX = workArea.x + Math.max(0, workArea.width - newWidth)
    const minX = workArea.x
    const newX = Math.min(Math.max(currentX, minX), maxX)

    const maxY = workArea.y + Math.max(0, workArea.height - newHeight)
    const minY = workArea.y
    const newY = Math.min(Math.max(currentY, minY), maxY)

    this.mainWindow.setBounds({
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    })

    this.windowPosition = { x: newX, y: newY }
    this.windowSize = { width: newWidth, height: newHeight }
    this.currentX = newX
    this.currentY = newY
  }

  public setOpacity(opacity: number): number {
    const clamped = Math.max(0.35, Math.min(1, Number.isFinite(opacity) ? opacity : 1))
    this.windowOpacity = clamped
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setOpacity(clamped)
    }
    return clamped
  }

  public getOpacity(): number {
    return this.windowOpacity
  }

  public setContentProtection(enabled: boolean): boolean {
    this.contentProtectionEnabled = Boolean(enabled)
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setContentProtection(this.contentProtectionEnabled)
    }
    return this.contentProtectionEnabled
  }

  public isContentProtectionEnabled(): boolean {
    return this.contentProtectionEnabled
  }

  public createWindow(): void {
    if (this.mainWindow !== null) return

    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    this.step = Math.max(
      Math.round(Math.min(workArea.width, workArea.height) * 0.1),
      120
    )

    const isMac = process.platform === "darwin"

    const windowSettings: Electron.BrowserWindowConstructorOptions = {
      width: 460,
      height: 600,
      minWidth: 360,
      minHeight: 200,
      webPreferences: {
        // Security hardening: renderer communicates strictly via contextBridge preload API
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      },
      show: false,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      fullscreenable: false,
      hasShadow: false,
      backgroundColor: "#00000000",
      focusable: !isMac,
      resizable: true,
      movable: true,
      acceptFirstMouse: true,
      skipTaskbar: true,
      ...(isMac ? { type: "panel" } : {}),
      x: 100,
      y: 100
    }

    this.mainWindow = new BrowserWindow(windowSettings)
    this.mainWindow.setContentProtection(this.contentProtectionEnabled)
    this.mainWindow.setOpacity(this.windowOpacity)

    if (isMac && this.mainWindow) {
      this.mainWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
      })
      this.mainWindow.setHiddenInMissionControl(true)
      this.mainWindow.setAlwaysOnTop(true, "screen-saver")
      this.mainWindow.setMovable(true)
      this.mainWindow.setFocusable(false)
      this.applyPassiveMode()

      try {
        this.mainWindow.setWindowButtonVisibility?.(false)
      } catch (error) {
        console.warn("Unable to hide window buttons:", error)
      }
    } else if (process.platform === "linux") {
      if (this.mainWindow.setHasShadow) {
        this.mainWindow.setHasShadow(false)
      }
      this.mainWindow.setFocusable(true)
      this.mainWindow.setAlwaysOnTop(true)
    } else {
      this.mainWindow.setAlwaysOnTop(true)
    }

    this.mainWindow.loadURL(startUrl).catch((err) => {
      console.error("Failed to load URL:", err)
    })

    this.mainWindow.once("ready-to-show", () => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        return
      }
      this.centerWindow()
      this.showMainWindow({ capture: true })
    })

    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }
    this.currentX = bounds.x
    this.currentY = bounds.y

    this.setupWindowListeners()
    this.isWindowVisible = true
  }

  private setupWindowListeners(): void {
    if (!this.mainWindow) return

    this.mainWindow.on("move", () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const bounds = this.mainWindow.getBounds()
        this.windowPosition = { x: bounds.x, y: bounds.y }
        this.currentX = bounds.x
        this.currentY = bounds.y
      }
    })

    this.mainWindow.on("blur", () => {
      if (this.captureMode) {
        this.exitCaptureMode()
      }
    })

    this.mainWindow.on("resize", () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const bounds = this.mainWindow.getBounds()
        this.windowSize = { width: bounds.width, height: bounds.height }
      }
    })

    this.mainWindow.on("closed", () => {
      this.clearSafariRefocusTimer()
      this.mainWindow = null
      this.isWindowVisible = false
      this.windowPosition = null
      this.windowSize = null
    })
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  public isVisible(): boolean {
    return this.isWindowVisible
  }

  public hideMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn("Main window does not exist or is destroyed.")
      return
    }

    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }
    if (this.captureMode) {
      this.exitCaptureMode({ refocusSafari: false, keepVisible: false })
    }
    this.mainWindow.hide()
    this.isWindowVisible = false
  }

  public showMainWindow(options: { capture?: boolean } = {}): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn("Main window does not exist or is destroyed.")
      return
    }

    if (this.windowPosition && this.windowSize) {
      this.mainWindow.setBounds({
        x: this.windowPosition.x,
        y: this.windowPosition.y,
        width: this.windowSize.width,
        height: this.windowSize.height
      })
    }

    const shouldCapture = options.capture ?? true

    if (shouldCapture) {
      this.enterCaptureMode()
    } else {
      this.captureMode = false
      this.applyPassiveMode()
      this.showWindowAccordingToMode()
    }
  }

  public toggleMainWindow(): void {
    if (this.isWindowVisible) {
      this.hideMainWindow()
    } else {
      this.showMainWindow({ capture: true })
    }
  }

  public togglePassiveMode(): void {
    if (this.captureMode) {
      this.exitCaptureMode({ keepVisible: true, refocusSafari: false })
    } else {
      this.enterCaptureMode()
    }
  }

  public showPassiveOverlay(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn("Main window does not exist or is destroyed.")
      return
    }

    if (this.captureMode) {
      this.exitCaptureMode({ keepVisible: true, refocusSafari: false })
    }

    this.captureMode = false

    if (process.platform === "darwin") {
      this.previousAppBundleId = this.findCurrentFrontmostApp()
    }

    this.applyPassiveMode()
    this.showWindowAccordingToMode()
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("overlay-capture-mode-change", false)
    }

    if (process.platform === "darwin") {
      this.scheduleSafariRefocus()
    }
  }

  private centerWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    const workArea = this.getCurrentWorkArea()
    const windowBounds = this.mainWindow.getBounds()
    const windowWidth = windowBounds.width || 460
    const windowHeight = windowBounds.height || 600

    const centerX =
      workArea.x +
      Math.max(
        0,
        Math.min(
          workArea.width - windowWidth,
          Math.floor(workArea.width * 0.1)
        )
      )
    const desiredTop =
      workArea.y +
      Math.max(
        0,
        Math.min(
          Math.floor(workArea.height * 0.15),
          workArea.height - windowHeight
        )
      )

    this.mainWindow.setBounds({
      x: centerX,
      y: desiredTop,
      width: windowWidth,
      height: windowHeight
    })

    this.windowPosition = { x: centerX, y: desiredTop }
    this.windowSize = { width: windowWidth, height: windowHeight }
    this.currentX = centerX
    this.currentY = desiredTop
  }

  public centerAndShowWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn("Main window does not exist or is destroyed.")
      return
    }

    this.centerWindow()
    this.showMainWindow({ capture: true })
  }

  public enterCaptureMode(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    if (this.captureMode) {
      return
    }

    this.captureMode = true
    this.clearSafariRefocusTimer()

    if (process.platform === "darwin") {
      this.mainWindow.setIgnoreMouseEvents(false)
      this.mainWindow.setFocusable(true)
      this.mainWindow.setAlwaysOnTop(true, "screen-saver")
      this.mainWindow.show()
      this.mainWindow.focus()
    } else {
      this.mainWindow.setAlwaysOnTop(true)
      this.mainWindow.show()
      this.mainWindow.focus()
    }

    this.mainWindow.setIgnoreMouseEvents(false)
    this.mainWindow.webContents.focus()
    this.mainWindow.webContents.send("focus-chat-input")
    this.mainWindow.webContents.send("overlay-capture-mode-change", true)
    this.isWindowVisible = true
  }

  public exitCaptureMode(
    options: { refocusSafari?: boolean; keepVisible?: boolean } = {}
  ): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    if (!this.captureMode) {
      return
    }

    this.captureMode = false
    const keepVisible = options.keepVisible ?? true

    if (process.platform === "darwin") {
      this.mainWindow.setIgnoreMouseEvents(true, { forward: true })
      this.mainWindow.setAlwaysOnTop(true, "screen-saver")
      this.mainWindow.setFocusable(false)
      if (keepVisible) {
        this.mainWindow.showInactive()
      }
    } else {
      this.mainWindow.blur()
      this.mainWindow.setAlwaysOnTop(true)
      this.mainWindow.setIgnoreMouseEvents(false)
    }

    this.applyPassiveMode()
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("overlay-capture-mode-change", false)
    }
  }

  public toggleCaptureMode(): void {
    if (this.captureMode) {
      this.exitCaptureMode()
    } else {
      this.enterCaptureMode()
    }
  }

  public isCaptureModeActive(): boolean {
    return this.captureMode
  }

  private applyPassiveMode(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    if (process.platform === "darwin") {
      this.mainWindow.setAlwaysOnTop(true, "screen-saver")
      this.mainWindow.setIgnoreMouseEvents(true, { forward: true })
      this.mainWindow.setFocusable(false)
    } else {
      this.mainWindow.setAlwaysOnTop(true)
      this.mainWindow.setIgnoreMouseEvents(false)
    }
  }

  private showWindowAccordingToMode(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    if (this.captureMode) {
      this.enterCaptureMode()
      this.isWindowVisible = true
      return
    }

    if (process.platform === "darwin") {
      this.applyPassiveMode()
      this.mainWindow.showInactive()
    } else {
      this.mainWindow.show()
      this.mainWindow.focus()
      this.mainWindow.webContents.focus()
      this.mainWindow.setAlwaysOnTop(true)
    }

    this.isWindowVisible = true
  }

  private scheduleSafariRefocus(): void {
    if (process.platform !== "darwin") {
      return
    }

    if (this.safariRefocusTimer) {
      clearTimeout(this.safariRefocusTimer)
    }

    this.safariRefocusTimer = setTimeout(() => {
      const candidateBundleId = this.previousAppBundleId
      const safeBundleId =
        candidateBundleId && SAFE_BUNDLE_ID_REGEX.test(candidateBundleId)
          ? candidateBundleId
          : "com.apple.Safari"

      const script =
        safeBundleId === "com.apple.Safari"
          ? 'tell application "Safari" to activate'
          : `tell application id "${safeBundleId}" to activate`

      execFile("osascript", ["-e", script], { timeout: 2000 }, (error) => {
        if (error) {
          console.warn("Failed to refocus application:", error)
        }
      })
      this.previousAppBundleId = null
      this.safariRefocusTimer = null
    }, 120)
  }

  private clearSafariRefocusTimer(): void {
    if (this.safariRefocusTimer) {
      clearTimeout(this.safariRefocusTimer)
      this.safariRefocusTimer = null
    }
  }

  private findCurrentFrontmostApp(): string | null {
    if (process.platform !== "darwin") {
      return null
    }
    try {
      const output = execFileSync(
        "osascript",
        [
          "-e",
          'tell application "System Events" to get bundle identifier of first application process whose frontmost is true'
        ],
        { encoding: "utf8", timeout: 2000 }
      )
      const bundleId = output.trim()
      if (bundleId.length > 0 && SAFE_BUNDLE_ID_REGEX.test(bundleId)) {
        return bundleId
      }
    } catch (error) {
      console.warn("Unable to determine frontmost application:", error)
    }
    return null
  }

  public moveWindowRight(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    const workArea = this.getCurrentWorkArea()
    const windowWidth = this.windowSize?.width || this.mainWindow.getBounds().width
    const halfWidth = windowWidth / 2

    this.currentX = Number(this.currentX) || workArea.x
    this.currentY = Number(this.currentY) || workArea.y

    this.currentX = Math.min(
      workArea.x + workArea.width - halfWidth,
      this.currentX + this.step
    )
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowLeft(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    const workArea = this.getCurrentWorkArea()
    const windowWidth = this.windowSize?.width || this.mainWindow.getBounds().width
    const halfWidth = windowWidth / 2

    this.currentX = Number(this.currentX) || workArea.x
    this.currentY = Number(this.currentY) || workArea.y

    this.currentX = Math.max(workArea.x - halfWidth, this.currentX - this.step)
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowDown(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    const workArea = this.getCurrentWorkArea()
    const windowHeight = this.windowSize?.height || this.mainWindow.getBounds().height
    const halfHeight = windowHeight / 2

    this.currentX = Number(this.currentX) || workArea.x
    this.currentY = Number(this.currentY) || workArea.y

    this.currentY = Math.min(
      workArea.y + workArea.height - halfHeight,
      this.currentY + this.step
    )
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowUp(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    const workArea = this.getCurrentWorkArea()
    const windowHeight = this.windowSize?.height || this.mainWindow.getBounds().height
    const halfHeight = windowHeight / 2

    this.currentX = Number(this.currentX) || workArea.x
    this.currentY = Number(this.currentY) || workArea.y

    this.currentY = Math.max(workArea.y - halfHeight, this.currentY - this.step)
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }
}

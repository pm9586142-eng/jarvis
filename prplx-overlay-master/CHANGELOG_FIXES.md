# Changelog & Bug Fix Report (v1.1.0)

Full audit, bug-fix pass, security hardening, and feature upgrade for **Perplexity Overlay**.

## Security Fixes

1. **Electron BrowserWindow Sandbox Hardening (`electron/WindowHelper.ts`)**:
   - Disabled `nodeIntegration` (`false`) and explicitly enabled `contextIsolation: true` (previously `nodeIntegration: true` alongside a preload script exposed full Node access to the renderer).
2. **Path Traversal Protection (`electron/ScreenshotHelper.ts`, `electron/ipcHandlers.ts`)**:
   - Added `isPathWithinDirectories()` / `isAllowedScreenshotPath()` validation before reading image previews, deleting screenshot files, or analyzing image/audio paths via IPC.
3. **IPC Channel Allowlist (`electron/preload.ts`)**:
   - Restricted generic `electronAPI.invoke(channel, ...)` to an explicit `ALLOWED_INVOKE_CHANNELS` allowlist instead of forwarding arbitrary IPC channel names.
4. **AppleScript Injection Prevention (`electron/WindowHelper.ts`)**:
   - Validated frontmost macOS bundle identifiers against `SAFE_BUNDLE_ID_REGEX` and replaced fragile shell string interpolation with `execFileSync("osascript", ["-e", ...], { timeout: 2000 })`.
5. **Safe External Link Handling (`src/components/ui/RichHtmlContent.tsx`, `src/components/ui/MarkdownContent.tsx`, `electron/ipcHandlers.ts`)**:
   - Allowed only `http:` / `https:` URLs in `open-external-url` and enforced `target="_blank" rel="noopener noreferrer"` on sanitized HTML links.

## Crash, Runtime & Build Fixes

1. **Broken `tailwind.config.js` Syntax**:
   - Fixed mixed ESM `export const content = ...` + CommonJS `module.exports = ...` that crashed PostCSS/Vite builds.
2. **LLM Provider Null-Dereference & Switching Bugs (`electron/LLMHelper.ts`)**:
   - Guarded against `this.model === null` in Ollama and offline mock modes across `extractProblemFromImages`, `generateSolution`, `debugSolutionWithImages`, `analyzeImageFile`, and `analyzeAudioFromBase64`.
   - Fixed `switchToOllama()` and `switchToGemini()` failing to clear `this.useMock = false`.
   - Fixed `getOllamaModels()` returning `[]` when called before switching to Ollama.
   - Upgraded deprecated default `gemini-2.0-flash` to `gemini-2.5-flash` with an automatic fallback chain and added `AbortController` timeouts to all HTTP calls.
3. **`sharp.extract()` Out-of-Bounds Crash (`electron/ScreenshotHelper.ts`)**:
   - Added `clampExtractBounds()` to clamp origin before width/height so `left + width` can never exceed image dimensions.
   - Fixed `deleteScreenshot()` to prune both screenshot queues, ignore `ENOENT`, and ensured screenshot directories use `{ recursive: true }`.
4. **Zombie `osascript` Processes & Non-macOS Crashes (`electron/PerplexityHelper.ts`)**:
   - Added explicit `darwin` platform checks with guidance to switch to Direct AI mode on Windows/Linux.
   - Added Node-side timeout enforcement with `SIGTERM` → `SIGKILL` fallback and null-safe `parsePerplexityStdout()`.
5. **Invalid Accelerator & Unwired Auto-Send (`electron/shortcuts.ts`, `src/_pages/Queue.tsx`)**:
   - Replaced invalid Electron accelerator `CommandOrControl+'+Enter` with `CommandOrControl+Alt+Enter` and wrapped all shortcut registrations in `safeRegister()`.
   - Subscribed `Queue.tsx` to `onPerplexityAutoSend` (so `Cmd/Ctrl + 2` now actually submits the prompt) and replaced the hardcoded Russian prompt with a user-configurable Quick-Solve prompt.
6. **Memory Leaks & Lifecycle Fixes (`electron/preload.ts`, `electron/WindowHelper.ts`, `src/App.tsx`, `src/_pages/Solutions.tsx`)**:
   - Fixed `onDebugSuccess` leaking an IPC listener on every mount because a fresh wrapper function was created on cleanup.
   - Cleared `safariRefocusTimer` on window close, added `isDestroyed()` checks before `webContents.send`, and stopped `MediaStream` audio tracks after recording ends.
   - Removed silent auto-mic recording on Solutions mount, fixed blank `view === "debug"` screen in `App.tsx`, fixed `Solutions.tsx` reading `solution` as a string instead of `.code`, fixed diff padding in `Debug.tsx`, fixed `neutral` toast variant styling, and fixed shared hover state on attachments.
7. **Branding & Metadata Cleanup (`index.html`, `electron/main.ts`, `src/components/ui/card.tsx`, `src/components/Solutions/SolutionCommands.tsx`)**:
   - Replaced leftover `"Free Cluely"` / `"Interview Coder"` strings and stray third-party verification meta tag, implemented the empty 0-byte `card.tsx`, and fixed wrong shortcut badges (`⌘B` → `⌘↓`).

## New Features Added

1. **Cross-Platform Direct AI Engine (`Gemini` + `Ollama Vision` + `OpenAI-Compatible`)**:
   - Live switcher in the overlay header between **Perplexity** (macOS Safari) and **Direct AI** (works on macOS, Windows, and Linux) with multi-turn chat history and vision image attachments.
   - Zero-dependency OpenAI-compatible client with 1-click presets for **Groq**, **OpenRouter**, **OpenAI**, and **LM Studio**.
2. **Quick Prompt Presets Bar**:
   - One-click pills (*Explain*, *Fix Bug*, *Solve*, *Summarize*, *Code Review*, *Translate*) above the input bar.
3. **Clipboard Quick-Ask (`Cmd/Ctrl + Shift + C`)**:
   - Pulls copied text or images from the system clipboard straight into the chat composer or attachment queue.
4. **Voice Input Dictation**:
   - Toggleable microphone recording button in the main overlay bar that transcribes voice queries using the configured AI backend.
5. **Persistent Chat History & Markdown Export**:
   - Searchable local session drawer (`HistoryDrawer`) with up to 50 saved conversations, instant restore, delete/clear, one-click `.md` download, and Copy Code buttons on every fenced code block.
6. **Stealth Mode, Opacity Slider & Quick-Solve Settings (`ModelSelector`)**:
   - Live window opacity control (35%–100%), toggleable `setContentProtection` stealth mode, customizable Quick-Solve prompt, and full dark-glass Settings UI.
7. **Interactive Shortcuts & Quick Actions Modal (`ShortcutsModal`)**:
   - Platform-aware shortcut reference (`⌘` on macOS, `Ctrl` on Windows/Linux) accessible from the header.

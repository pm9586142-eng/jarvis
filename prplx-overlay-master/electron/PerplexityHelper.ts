import { app } from "electron"
import path from "node:path"
import fs from "node:fs"
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import { getErrorMessage } from "./LLMHelper"

const execFileAsync = promisify(execFile)

export type PerplexityModelKey =
  | "sonar"
  | "gpt-5"
  | "gpt-5-reasoning"
  | "claude-sonnet-4.5-reasoning"

export interface PerplexityOptions {
  newChat?: boolean
  timeoutSeconds?: number
  pollIntervalMs?: number
  stablePolls?: number
  model?: PerplexityModelKey
  webSearch?: boolean
  requestId?: string
}

export interface PerplexityResult {
  prompt: string
  response: string
  responses: string[]
  responseHtml?: string | null
  responsesHtml?: string[]
}

export interface PerplexityStreamPayload {
  prompt?: string
  response: string
  responses: string[]
  timestamp: number
  responsesHtml?: string[]
  responseHtml?: string
}

function assertMacOSPlatform(): void {
  if (process.platform !== "darwin") {
    throw new Error(
      "Perplexity Safari automation requires macOS. Switch to Direct AI mode (Gemini, Ollama, or OpenAI-compatible API) in the overlay header to chat on Windows or Linux."
    )
  }
}

function resolveScriptPath(fileName: string): string {
  const appPath = app.getAppPath()
  const resourcesPath = process.resourcesPath ?? appPath

  const candidates = [
    path.join(appPath, "scripts", fileName),
    path.join(resourcesPath, "scripts", fileName),
    path.join(appPath + ".unpacked", "scripts", fileName),
    path.join(path.dirname(appPath), "scripts", fileName),
    path.join(resourcesPath, "..", "Resources", "scripts", fileName)
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      ensureExecutable(candidate)
      return candidate
    }
  }

  throw new Error(
    `Perplexity automation script not found. Expected at scripts/${fileName}. Searched: ${candidates.join(", ")}`
  )
}

function resolveSendScriptPath(): string {
  return resolveScriptPath("perplexity_send.jxa")
}

function resolveAttachmentScriptPath(): string {
  return resolveScriptPath("perplexity_attachments.jxa")
}

function ensureExecutable(filePath: string): void {
  if (process.platform === "win32") {
    return
  }

  try {
    const stats = fs.statSync(filePath)
    const mode = stats.mode & 0o777
    if ((mode & 0o111) === 0) {
      fs.chmodSync(filePath, mode | 0o755)
    }
  } catch (error) {
    console.warn(`Unable to adjust permissions for ${filePath}:`, error)
  }
}

function resolveTimeoutMs(options?: PerplexityOptions): number {
  if (options?.timeoutSeconds && Number.isFinite(options.timeoutSeconds) && options.timeoutSeconds > 0) {
    // Give Node slightly longer than the JXA inner timeout so graceful JXA timeout errors surface first
    return Math.ceil((options.timeoutSeconds + 15) * 1000)
  }
  const isReasoning = Boolean(options?.model && options.model.includes("reasoning"))
  return (isReasoning ? 500 : 100) * 1000
}

async function runJxaScript(
  scriptPath: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  assertMacOSPlatform()
  return execFileAsync("osascript", ["-l", "JavaScript", scriptPath], {
    env,
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024
  })
}

function runJxaScriptWithStream(
  scriptPath: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  onStream?: (payload: PerplexityStreamPayload) => void
): Promise<{ stdout: string; stderr: string }> {
  assertMacOSPlatform()

  return new Promise((resolve, reject) => {
    const child = spawn("osascript", ["-l", "JavaScript", scriptPath], { env })

    let stdout = ""
    let stderr = ""
    let stdoutPending = ""
    let stderrPending = ""
    let settled = false
    let killFollowupTimer: NodeJS.Timeout | null = null

    const clearTimers = () => {
      clearTimeout(timeoutTimer)
      if (killFollowupTimer) {
        clearTimeout(killFollowupTimer)
        killFollowupTimer = null
      }
    }

    const timeoutTimer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        child.kill("SIGTERM")
        killFollowupTimer = setTimeout(() => {
          try {
            child.kill("SIGKILL")
          } catch {
            // already exited
          }
        }, 2500)
      } catch {
        // ignore kill error
      }
      reject(
        new Error(
          `Perplexity automation timed out after ${Math.round(timeoutMs / 1000)}s`
        )
      )
    }, timeoutMs)

    const emitStreamPayload = (raw: string) => {
      if (!raw) return
      try {
        const parsed = JSON.parse(raw) as PerplexityStreamPayload
        onStream?.({
          ...parsed,
          response: typeof parsed.response === "string" ? parsed.response : "",
          responses: Array.isArray(parsed.responses) ? parsed.responses : [],
          timestamp: typeof parsed.timestamp === "number" ? parsed.timestamp : Date.now()
        })
      } catch (error) {
        console.warn("Failed to parse Perplexity stream payload:", raw, error)
      }
    }

    const handleLine = (line: string, source: "stdout" | "stderr") => {
      const trimmed = line.trim()
      if (!trimmed) {
        if (source === "stdout") stdout += "\n"
        else stderr += "\n"
        return
      }
      if (trimmed.startsWith("PX_STREAM:")) {
        emitStreamPayload(trimmed.slice("PX_STREAM:".length))
        return
      }
      if (source === "stdout") stdout += line + "\n"
      else stderr += line + "\n"
    }

    const handleChunk = (chunk: string, source: "stdout" | "stderr") => {
      let buffer = source === "stdout" ? stdoutPending : stderrPending
      buffer += chunk

      let newlineIndex = buffer.indexOf("\n")
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex)
        handleLine(line, source)
        buffer = buffer.slice(newlineIndex + 1)
        newlineIndex = buffer.indexOf("\n")
      }

      if (source === "stdout") stdoutPending = buffer
      else stderrPending = buffer
    }

    child.stdout?.setEncoding("utf8")
    child.stdout?.on("data", (chunk: string) => handleChunk(chunk, "stdout"))
    child.stdout?.on("end", () => {
      if (stdoutPending.length > 0) {
        handleLine(stdoutPending, "stdout")
        stdoutPending = ""
      }
    })

    child.stderr?.setEncoding("utf8")
    child.stderr?.on("data", (chunk: string) => handleChunk(chunk, "stderr"))
    child.stderr?.on("end", () => {
      if (stderrPending.length > 0) {
        handleLine(stderrPending, "stderr")
        stderrPending = ""
      }
    })

    child.on("error", (error) => {
      if (settled) return
      settled = true
      clearTimers()
      reject(error)
    })

    child.on("close", (code, signal) => {
      if (settled) return
      settled = true
      clearTimers()
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        const failure = new Error(
          `Perplexity script exited with code ${code ?? "unknown"}${signal ? ` (signal: ${signal})` : ""}`
        ) as Error & { stdout?: string; stderr?: string }
        failure.stdout = stdout
        failure.stderr = stderr
        reject(failure)
      }
    })
  })
}

export function parsePerplexityStdout(stdout: string): PerplexityResult {
  const trimmed = (stdout || "").trim()
  if (!trimmed) {
    throw new Error("Empty response from Perplexity automation script")
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const lastLine = lines[lines.length - 1]
  if (!lastLine) {
    throw new Error("Empty response from Perplexity automation script")
  }

  try {
    const parsed = JSON.parse(lastLine) as Partial<PerplexityResult>
    const rawResponse = typeof parsed.response === "string" ? parsed.response : ""
    const responses = Array.isArray(parsed.responses)
      ? parsed.responses.map((item) => String(item ?? ""))
      : rawResponse
        ? [rawResponse]
        : []
    const response =
      rawResponse.length > 0
        ? rawResponse
        : responses.length > 0
          ? responses[responses.length - 1]
          : ""
    return {
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      response,
      responses,
      responseHtml: typeof parsed.responseHtml === "string" ? parsed.responseHtml : null,
      responsesHtml: Array.isArray(parsed.responsesHtml) ? parsed.responsesHtml : undefined
    }
  } catch {
    throw new Error(`Failed to parse Perplexity response: ${lastLine.slice(0, 200)}`)
  }
}

export async function sendPerplexityPrompt(
  prompt: string,
  options: PerplexityOptions = {},
  onStream?: (payload: PerplexityStreamPayload) => void
): Promise<PerplexityResult> {
  assertMacOSPlatform()
  if (!prompt.trim()) {
    throw new Error("Prompt is empty")
  }

  const scriptPath = resolveSendScriptPath()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PERPLEXITY_MESSAGE: prompt,
    PERPLEXITY_OUTPUT: "json"
  }

  if (options.newChat) env.PERPLEXITY_NEW_CHAT = "true"
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.PERPLEXITY_DEBUG_LOG_RESPONSES === "true"
  ) {
    env.PERPLEXITY_DEBUG_LOG_RESPONSES = "true"
  }
  if (options.timeoutSeconds) env.PERPLEXITY_TIMEOUT = String(options.timeoutSeconds)
  if (options.pollIntervalMs) env.PERPLEXITY_POLL_INTERVAL_MS = String(options.pollIntervalMs)
  if (options.stablePolls) env.PERPLEXITY_STABLE_POLLS = String(options.stablePolls)
  if (options.model) env.PERPLEXITY_MODEL = options.model
  if (typeof options.webSearch === "boolean") {
    env.PERPLEXITY_WEB_SEARCH = options.webSearch ? "on" : "off"
  }

  try {
    const { stdout, stderr } = await runJxaScriptWithStream(
      scriptPath,
      env,
      resolveTimeoutMs(options),
      onStream
    )
    if (stderr?.trim()) {
      console.warn("Perplexity script stderr:", stderr)
    }
    return parsePerplexityStdout(stdout)
  } catch (error: unknown) {
    const errObj = error as { message?: string; stdout?: string; stderr?: string }
    const stderr = errObj?.stderr?.trim()
    const stdout = errObj?.stdout?.trim()
    const messageParts = ["Perplexity automation failed"]
    const msg = getErrorMessage(error)
    if (msg) messageParts.push(msg)
    if (stdout) messageParts.push(`stdout: ${stdout.slice(0, 300)}`)
    if (stderr) messageParts.push(`stderr: ${stderr.slice(0, 300)}`)
    throw new Error(messageParts.join(" | "))
  }
}

export async function attachPerplexityImage(
  imagePath: string,
  options: { newChat?: boolean } = {}
): Promise<void> {
  assertMacOSPlatform()
  if (!imagePath) {
    throw new Error("Image path is required for attachment")
  }

  const scriptPath = resolveAttachmentScriptPath()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PERPLEXITY_MODE: "attach",
    PERPLEXITY_IMAGE_PATH: imagePath
  }

  if (options.newChat) {
    env.PERPLEXITY_NEW_CHAT = "true"
  }

  const { stdout, stderr } = await runJxaScript(scriptPath, env, 45_000)
  if (stderr?.trim()) {
    console.warn("Perplexity attachment script stderr:", stderr)
  }

  const trimmed = stdout?.trim()
  if (!trimmed) return

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed?.status !== "attached") {
      console.warn("Unexpected attachment script response:", trimmed)
    }
  } catch (error) {
    console.warn("Failed to parse attachment script response:", trimmed, error)
  }
}

export async function sendPerplexityPromptWithAttachments(
  prompt: string,
  options: PerplexityOptions = {}
): Promise<PerplexityResult> {
  assertMacOSPlatform()
  const scriptPath = resolveAttachmentScriptPath()

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PERPLEXITY_MODE: "send",
    PERPLEXITY_MESSAGE: prompt ?? "",
    PERPLEXITY_OUTPUT: "json"
  }

  if (options.newChat) env.PERPLEXITY_NEW_CHAT = "true"
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.PERPLEXITY_DEBUG_LOG_RESPONSES === "true"
  ) {
    env.PERPLEXITY_DEBUG_LOG_RESPONSES = "true"
  }
  if (options.timeoutSeconds) env.PERPLEXITY_TIMEOUT = String(options.timeoutSeconds)
  if (options.pollIntervalMs) env.PERPLEXITY_POLL_INTERVAL_MS = String(options.pollIntervalMs)
  if (options.stablePolls) env.PERPLEXITY_STABLE_POLLS = String(options.stablePolls)
  if (options.model) env.PERPLEXITY_MODEL = options.model
  if (typeof options.webSearch === "boolean") {
    env.PERPLEXITY_WEB_SEARCH = options.webSearch ? "on" : "off"
  }

  try {
    const { stdout, stderr } = await runJxaScript(
      scriptPath,
      env,
      resolveTimeoutMs(options)
    )
    if (stderr?.trim()) {
      console.warn("Perplexity send-with-attachments stderr:", stderr)
    }
    return parsePerplexityStdout(stdout)
  } catch (error: unknown) {
    const errObj = error as { stdout?: string; stderr?: string }
    const stderr = errObj?.stderr?.trim()
    const stdout = errObj?.stdout?.trim()
    const messageParts = ["Perplexity attachment send failed"]
    const msg = getErrorMessage(error)
    if (msg) messageParts.push(msg)
    if (stdout) messageParts.push(`stdout: ${stdout.slice(0, 300)}`)
    if (stderr) messageParts.push(`stderr: ${stderr.slice(0, 300)}`)
    throw new Error(messageParts.join(" | "))
  }
}

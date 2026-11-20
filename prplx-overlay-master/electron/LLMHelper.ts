import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "node:fs"
import path from "node:path"

export type LlmProvider = "ollama" | "gemini" | "openai-compatible"

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

export interface ChatHistoryMessage {
  role: "user" | "assistant"
  text: string
}

export interface ChatWithContextOptions {
  imagePaths?: string[]
  history?: ChatHistoryMessage[]
  systemPrompt?: string
}

interface OllamaGenerateResponse {
  response?: string
  done?: boolean
  error?: string
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  error?: { message?: string }
}

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash"
] as const
const DEFAULT_OLLAMA_URL = "http://localhost:11434"
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
const DEFAULT_FETCH_TIMEOUT_MS = 60_000
const SHORT_FETCH_TIMEOUT_MS = 6_000

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function normalizeBaseUrl(rawUrl: string, fallback: string): string {
  const candidate = (rawUrl || fallback).trim().replace(/\/+$/, "")
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Unsupported URL protocol: ${parsed.protocol}`)
    }
    return candidate
  } catch {
    throw new Error(`Invalid URL: "${rawUrl}". Must start with http:// or https://`)
  }
}

export function detectMimeType(filePath: string, fallback: string): string {
  const ext = path.extname(filePath || "").toLowerCase()
  switch (ext) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".gif":
      return "image/gif"
    case ".mp3":
      return "audio/mp3"
    case ".wav":
      return "audio/wav"
    case ".m4a":
      return "audio/mp4"
    case ".ogg":
      return "audio/ogg"
    case ".webm":
      return "audio/webm"
    case ".flac":
      return "audio/flac"
    default:
      return fallback
  }
}

export function cleanJsonResponse(rawText: string): string {
  const trimmed = (rawText || "").trim()
  if (!trimmed) return trimmed

  // Strip fenced markdown code blocks (handles \r\n, optional spaces, and trailing text)
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim()
  }

  // Extract outermost JSON object or array if prose wraps it
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim()
  }

  return trimmed
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s (${url})`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export class LLMHelper {
  private genAI: GoogleGenerativeAI | null = null
  private model: GenerativeModel | null = null
  private geminiApiKey: string = ""
  private geminiModelName: string = DEFAULT_GEMINI_MODEL

  private provider: LlmProvider = "gemini"
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = DEFAULT_OLLAMA_URL

  private openaiApiKey: string = ""
  private openaiBaseUrl: string = DEFAULT_OPENAI_BASE_URL
  private openaiModel: string = DEFAULT_OPENAI_MODEL

  private useMock: boolean = false
  private ollamaInitPromise: Promise<void> | null = null

  private readonly systemPrompt =
    "You are an intelligent, concise desktop overlay assistant. Analyze text, code, or screenshots directly, give accurate and actionable answers, explain key reasoning clearly, and format code in fenced markdown blocks."

  constructor(
    apiKey?: string,
    useOllama: boolean = false,
    ollamaModel?: string,
    ollamaUrl?: string
  ) {
    this.geminiModelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
    this.ollamaUrl = ollamaUrl
      ? normalizeBaseUrl(ollamaUrl, DEFAULT_OLLAMA_URL)
      : normalizeBaseUrl(process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL, DEFAULT_OLLAMA_URL)

    const envOpenaiKey = process.env.OPENAI_API_KEY?.trim() || ""
    const envOpenaiBase = process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL
    const envOpenaiModel = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL

    if (envOpenaiKey) {
      this.openaiApiKey = envOpenaiKey
      this.openaiBaseUrl = normalizeBaseUrl(envOpenaiBase, DEFAULT_OPENAI_BASE_URL)
      this.openaiModel = envOpenaiModel
    }

    const allowMock =
      process.env.MOCK_LLM === "true" ||
      process.env.ALLOW_NO_LLM === "true" ||
      process.env.NODE_ENV === "development"

    if (useOllama) {
      this.provider = "ollama"
      this.ollamaModel = ollamaModel || "llama3.2"
      this.useMock = false
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaModel}`)
      this.ollamaInitPromise = this.initializeOllamaModel().catch((error) => {
        console.warn("[LLMHelper] Background Ollama init warning:", getErrorMessage(error))
      })
    } else if (apiKey && apiKey.trim().length > 0) {
      this.configureGeminiClient(apiKey.trim(), this.geminiModelName)
      this.provider = "gemini"
      this.useMock = false
      console.log(`[LLMHelper] Using Google Gemini (${this.geminiModelName})`)
    } else if (this.openaiApiKey) {
      this.provider = "openai-compatible"
      this.useMock = false
      console.log(`[LLMHelper] Using OpenAI-compatible API (${this.openaiModel})`)
    } else if (allowMock) {
      this.provider = "gemini"
      this.useMock = true
      console.warn(
        "[LLMHelper] No GEMINI_API_KEY, OPENAI_API_KEY, or Ollama configured. Starting in offline mock mode."
      )
    } else {
      // Instead of crashing the entire Electron app at boot (since Perplexity Safari mode may be used),
      // start safely in unconfigured/offline mode and inform user clearly when Direct AI is invoked.
      this.provider = "gemini"
      this.useMock = true
      console.warn(
        "[LLMHelper] No Direct AI provider configured at startup. Configure Gemini, Ollama, or OpenAI-compatible API in Settings."
      )
    }
  }

  private configureGeminiClient(apiKey: string, modelName: string): void {
    this.geminiApiKey = apiKey
    this.geminiModelName = modelName || DEFAULT_GEMINI_MODEL
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: this.geminiModelName })
  }

  private async fileToGenerativePart(filePath: string, fallbackMime: string = "image/png") {
    const fileData = await fs.promises.readFile(filePath)
    return {
      inlineData: {
        data: fileData.toString("base64"),
        mimeType: detectMimeType(filePath, fallbackMime)
      }
    }
  }

  private async fileToBase64(filePath: string): Promise<{ base64: string; mimeType: string }> {
    const data = await fs.promises.readFile(filePath)
    return {
      base64: data.toString("base64"),
      mimeType: detectMimeType(filePath, "image/png")
    }
  }

  private async generateWithGeminiFallback(
    parts: string | Array<string | { inlineData: { data: string; mimeType: string } }>
  ): Promise<string> {
    if (!this.genAI || !this.model) {
      throw new Error(
        "Gemini API key is not configured. Open Settings to enter your Gemini API key or switch to Ollama / OpenAI-compatible API."
      )
    }

    const triedModels: string[] = []
    const candidates = [
      this.geminiModelName,
      ...GEMINI_FALLBACK_MODELS.filter((m) => m !== this.geminiModelName)
    ]

    let lastError: unknown = null

    for (const candidateModel of candidates) {
      triedModels.push(candidateModel)
      try {
        const activeModel =
          candidateModel === this.geminiModelName && this.model
            ? this.model
            : this.genAI.getGenerativeModel({ model: candidateModel })

        const result = await activeModel.generateContent(parts as any)
        const response = await result.response
        const text = response.text()

        if (candidateModel !== this.geminiModelName) {
          console.log(`[LLMHelper] Switched Gemini model to available fallback: ${candidateModel}`)
          this.geminiModelName = candidateModel
          this.model = activeModel
        }

        return text
      } catch (error) {
        lastError = error
        const msg = getErrorMessage(error).toLowerCase()
        const isModelNotFound =
          msg.includes("404") ||
          msg.includes("not found") ||
          msg.includes("is not supported") ||
          msg.includes("deprecated")
        if (!isModelNotFound) {
          throw error
        }
        console.warn(`[LLMHelper] Gemini model "${candidateModel}" unavailable, trying next fallback...`)
      }
    }

    throw new Error(
      `All Gemini models failed (${triedModels.join(", ")}): ${getErrorMessage(lastError)}`
    )
  }

  private async callOllama(prompt: string, imagesBase64?: string[]): Promise<string> {
    try {
      const payload: Record<string, unknown> = {
        model: this.ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.4,
          top_p: 0.9
        }
      }

      if (imagesBase64 && imagesBase64.length > 0) {
        payload.images = imagesBase64
      }

      const response = await fetchWithTimeout(
        `${this.ollamaUrl}/api/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        },
        DEFAULT_FETCH_TIMEOUT_MS
      )

      if (!response.ok) {
        const errBody = await response.text().catch(() => "")
        throw new Error(
          `Ollama API error (${response.status} ${response.statusText})${errBody ? `: ${errBody.slice(0, 200)}` : ""}`
        )
      }

      const data = (await response.json()) as OllamaGenerateResponse
      if (data.error) {
        throw new Error(`Ollama error: ${data.error}`)
      }
      return data.response ?? ""
    } catch (error) {
      console.error("[LLMHelper] Error calling Ollama:", error)
      throw new Error(
        `Failed to connect to Ollama (${this.ollamaUrl}): ${getErrorMessage(error)}`
      )
    }
  }

  private async callOpenAICompatible(
    userPrompt: string,
    options?: {
      systemPrompt?: string
      history?: ChatHistoryMessage[]
      images?: Array<{ base64: string; mimeType: string }>
    }
  ): Promise<string> {
    if (!this.openaiApiKey && !this.openaiBaseUrl.includes("localhost") && !this.openaiBaseUrl.includes("127.0.0.1")) {
      throw new Error("API key is required for this OpenAI-compatible provider.")
    }

    const messages: Array<Record<string, unknown>> = []
    messages.push({
      role: "system",
      content: options?.systemPrompt || this.systemPrompt
    })

    if (options?.history && options.history.length > 0) {
      for (const turn of options.history.slice(-12)) {
        messages.push({
          role: turn.role,
          content: turn.text
        })
      }
    }

    if (options?.images && options.images.length > 0) {
      const contentParts: Array<Record<string, unknown>> = [
        { type: "text", text: userPrompt }
      ]
      for (const img of options.images) {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`
          }
        })
      }
      messages.push({ role: "user", content: contentParts })
    } else {
      messages.push({ role: "user", content: userPrompt })
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    if (this.openaiApiKey) {
      headers.Authorization = `Bearer ${this.openaiApiKey}`
    }

    const response = await fetchWithTimeout(
      `${this.openaiBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.openaiModel,
          messages,
          temperature: 0.4
        })
      },
      DEFAULT_FETCH_TIMEOUT_MS
    )

    const rawBody = await response.text()
    let parsed: OpenAIChatCompletionResponse = {}
    try {
      parsed = JSON.parse(rawBody) as OpenAIChatCompletionResponse
    } catch {
      if (!response.ok) {
        throw new Error(`OpenAI-compatible API error (${response.status}): ${rawBody.slice(0, 240)}`)
      }
      throw new Error(`Invalid JSON from OpenAI-compatible API: ${rawBody.slice(0, 200)}`)
    }

    if (!response.ok) {
      const detail = parsed.error?.message || rawBody.slice(0, 240)
      throw new Error(`OpenAI-compatible API error (${response.status}): ${detail}`)
    }

    const content = parsed.choices?.[0]?.message?.content
    if (typeof content === "string") {
      return content.trim()
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim()
    }
    return ""
  }

  private async checkOllamaAvailable(targetUrl?: string): Promise<boolean> {
    try {
      const url = targetUrl
        ? normalizeBaseUrl(targetUrl, this.ollamaUrl)
        : this.ollamaUrl
      const response = await fetchWithTimeout(
        `${url}/api/tags`,
        { method: "GET" },
        SHORT_FETCH_TIMEOUT_MS
      )
      return response.ok
    } catch {
      return false
    }
  }

  private async initializeOllamaModel(): Promise<void> {
    try {
      const availableModels = await this.getOllamaModels(this.ollamaUrl)
      if (availableModels.length === 0) {
        console.warn("[LLMHelper] No Ollama models found")
        return
      }

      if (!availableModels.includes(this.ollamaModel)) {
        this.ollamaModel = availableModels[0]
        console.log(`[LLMHelper] Auto-selected first available Ollama model: ${this.ollamaModel}`)
      }
    } catch (error) {
      console.error(`[LLMHelper] Failed to initialize Ollama model: ${getErrorMessage(error)}`)
    }
  }

  private async runTextOrVisionPrompt(
    prompt: string,
    imagePaths: string[] = []
  ): Promise<string> {
    if (this.ollamaInitPromise) {
      await this.ollamaInitPromise
      this.ollamaInitPromise = null
    }

    if (this.provider === "ollama") {
      const images = imagePaths.length
        ? await Promise.all(imagePaths.map((p) => this.fileToBase64(p)))
        : []
      return this.callOllama(
        prompt,
        images.length ? images.map((item) => item.base64) : undefined
      )
    }

    if (this.provider === "openai-compatible") {
      const images = imagePaths.length
        ? await Promise.all(imagePaths.map((p) => this.fileToBase64(p)))
        : []
      return this.callOpenAICompatible(prompt, { images })
    }

    // Gemini provider
    if (imagePaths.length > 0) {
      const imageParts = await Promise.all(
        imagePaths.map((imgPath) => this.fileToGenerativePart(imgPath, "image/png"))
      )
      return this.generateWithGeminiFallback([prompt, ...imageParts])
    }
    return this.generateWithGeminiFallback(prompt)
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    if (this.useMock) {
      return {
        problem_statement: "Mock problem extracted from screenshot (offline mode).",
        context: "Configure Gemini, Ollama, or OpenAI-compatible API in Settings for live extraction.",
        suggested_responses: [
          "Configure an AI provider in Settings",
          "Or switch to Perplexity Safari mode on macOS"
        ],
        reasoning: "Offline mock mode is currently active."
      }
    }

    try {
      const prompt = `${this.systemPrompt}\n\nAnalyze the provided screenshot(s) and extract the following information in strict JSON format:\n{\n  "problem_statement": "A clear statement of the problem or situation depicted in the images.",\n  "context": "Relevant background or context from the images.",\n  "suggested_responses": ["First possible answer or action", "Second possible answer or action"],\n  "reasoning": "Explanation of why these suggestions are appropriate."\n}\nImportant: Return ONLY the JSON object, with no extra markdown or commentary.`

      const rawText = await this.runTextOrVisionPrompt(prompt, imagePaths)
      const cleaned = cleanJsonResponse(rawText)
      return JSON.parse(cleaned)
    } catch (error) {
      console.error("[LLMHelper] Error extracting problem from images:", error)
      throw error
    }
  }

  public async generateSolution(problemInfo: unknown) {
    if (this.useMock) {
      const statement =
        typeof problemInfo === "object" &&
        problemInfo !== null &&
        "problem_statement" in problemInfo
          ? String((problemInfo as Record<string, unknown>).problem_statement)
          : "Problem not provided"
      return {
        solution: {
          code: "// Offline mock mode — configure Gemini, Ollama, or OpenAI-compatible API in Settings",
          thoughts: [
            "Running in offline mock mode.",
            "Configure an AI provider in Settings to generate real solutions."
          ],
          time_complexity: "N/A",
          space_complexity: "N/A",
          problem_statement: statement,
          context: "Mock context (offline mode).",
          suggested_responses: [
            "Set GEMINI_API_KEY, OPENAI_API_KEY, or enable Ollama in Settings"
          ],
          reasoning: "Direct LLM provider is not configured."
        }
      }
    }

    const prompt = `${this.systemPrompt}\n\nGiven this problem or situation:\n${JSON.stringify(problemInfo, null, 2)}\n\nProvide your response in strict JSON format:\n{\n  "solution": {\n    "code": "The complete code or primary answer here.",\n    "thoughts": ["Key reasoning step 1", "Key reasoning step 2"],\n    "time_complexity": "e.g., O(n)",\n    "space_complexity": "e.g., O(1)",\n    "problem_statement": "Restate the problem or situation.",\n    "context": "Relevant background/context.",\n    "suggested_responses": ["First action", "Second action"],\n    "reasoning": "Concise explanation."\n  }\n}\nImportant: Return ONLY the JSON object.`

    try {
      const rawText = await this.runTextOrVisionPrompt(prompt)
      const cleaned = cleanJsonResponse(rawText)
      return JSON.parse(cleaned)
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error)
      throw error
    }
  }

  public async debugSolutionWithImages(
    problemInfo: unknown,
    currentCode: string,
    debugImagePaths: string[]
  ) {
    if (this.useMock) {
      return {
        solution: {
          old_code: currentCode || "// previous code",
          new_code: currentCode || "// offline mock debug result",
          code: currentCode || "// offline mock debug result",
          thoughts: [
            "Offline mock mode active.",
            "Configure Gemini, Ollama (vision), or OpenAI-compatible API in Settings for live debugging."
          ],
          time_complexity: "N/A",
          space_complexity: "N/A",
          reasoning: "LLM provider not configured."
        }
      }
    }

    try {
      const prompt = `${this.systemPrompt}\n\nGiven:\n1. Original problem: ${JSON.stringify(problemInfo, null, 2)}\n2. Current code/approach:\n${currentCode}\n3. Debug screenshots attached.\n\nAnalyze the debug information and return strict JSON:\n{\n  "solution": {\n    "old_code": "Previous code snippet",\n    "new_code": "Fixed and improved code snippet",\n    "code": "Fixed and improved code snippet",\n    "thoughts": ["What was wrong", "What changed"],\n    "time_complexity": "e.g., O(n)",\n    "space_complexity": "e.g., O(n)",\n    "reasoning": "Explanation of fixes."\n  }\n}\nImportant: Return ONLY the JSON object.`

      const rawText = await this.runTextOrVisionPrompt(prompt, debugImagePaths)
      const cleaned = cleanJsonResponse(rawText)
      return JSON.parse(cleaned)
    } catch (error) {
      console.error("[LLMHelper] Error debugging solution with images:", error)
      throw error
    }
  }

  public async analyzeAudioFile(audioPath: string): Promise<{ text: string; timestamp: number }> {
    if (this.useMock) {
      return {
        text: "Offline mock mode: configure a Gemini API key in Settings to transcribe and analyze audio clips.",
        timestamp: Date.now()
      }
    }

    if (this.provider !== "gemini") {
      throw new Error(
        `Audio analysis currently requires Google Gemini (active provider: ${this.provider}). Switch to Gemini in Settings to analyze audio.`
      )
    }

    try {
      const audioPart = await this.fileToGenerativePart(audioPath, "audio/mp3")
      const prompt = `${this.systemPrompt}\n\nTranscribe and answer or summarize this audio clip clearly and concisely. Suggest helpful next steps if relevant.`
      const text = await this.generateWithGeminiFallback([prompt, audioPart])
      return { text, timestamp: Date.now() }
    } catch (error) {
      console.error("[LLMHelper] Error analyzing audio file:", error)
      throw error
    }
  }

  public async analyzeAudioFromBase64(
    data: string,
    mimeType: string
  ): Promise<{ text: string; timestamp: number }> {
    if (this.useMock) {
      return {
        text: "Offline mock mode: configure a Gemini API key in Settings to transcribe and analyze microphone voice input.",
        timestamp: Date.now()
      }
    }

    if (this.provider !== "gemini") {
      throw new Error(
        `Voice audio analysis requires Google Gemini (active provider: ${this.provider}). Switch to Gemini in Settings.`
      )
    }

    try {
      const normalizedMime = (mimeType || "audio/webm").split(";")[0].trim() || "audio/webm"
      const audioPart = {
        inlineData: {
          data,
          mimeType: normalizedMime
        }
      }
      const prompt = `${this.systemPrompt}\n\nListen to this voice recording. First summarize or transcribe what was asked, then give a concise, accurate answer.`
      const text = await this.generateWithGeminiFallback([prompt, audioPart])
      return { text, timestamp: Date.now() }
    } catch (error) {
      console.error("[LLMHelper] Error analyzing audio from base64:", error)
      throw error
    }
  }

  public async analyzeImageFile(
    imagePath: string,
    userPrompt?: string
  ): Promise<{ text: string; timestamp: number }> {
    if (this.useMock) {
      return {
        text: "Offline mock mode: screenshot captured, but no Direct AI provider is configured. Open Settings to configure Gemini, Ollama, or an OpenAI-compatible API.",
        timestamp: Date.now()
      }
    }

    try {
      const prompt = userPrompt?.trim()
        ? `${this.systemPrompt}\n\nUser request regarding this screenshot:\n${userPrompt.trim()}`
        : `${this.systemPrompt}\n\nAnalyze this screenshot concisely. If it shows a question, code, or error, provide the direct answer or fix clearly.`

      const text = await this.runTextOrVisionPrompt(prompt, [imagePath])
      return { text, timestamp: Date.now() }
    } catch (error) {
      console.error("[LLMHelper] Error analyzing image file:", error)
      throw error
    }
  }

  public async chatWithContext(
    message: string,
    options: ChatWithContextOptions = {}
  ): Promise<string> {
    const trimmed = (message || "").trim()
    const imagePaths = options.imagePaths?.filter(Boolean) ?? []
    const history = options.history ?? []

    if (!trimmed && imagePaths.length === 0) {
      throw new Error("Message or screenshot is required.")
    }

    if (this.useMock) {
      return [
        "**Offline Mode Active**",
        "",
        `Received: ${trimmed ? `"${trimmed.slice(0, 140)}"` : "[Screenshot attached]"}`,
        "",
        "Open **Settings** (gear icon) to configure **Google Gemini**, **Local Ollama**, or any **OpenAI-compatible API** (Groq, OpenRouter, OpenAI, LM Studio) — or switch to **Perplexity (Safari)** on macOS."
      ].join("\n")
    }

    const effectivePrompt =
      trimmed || "Analyze the attached screenshot and provide a clear, accurate response."

    if (this.provider === "openai-compatible") {
      const images = imagePaths.length
        ? await Promise.all(imagePaths.map((p) => this.fileToBase64(p)))
        : []
      return this.callOpenAICompatible(effectivePrompt, {
        systemPrompt: options.systemPrompt || this.systemPrompt,
        history,
        images
      })
    }

    const historyTranscript =
      history.length > 0
        ? history
            .slice(-10)
            .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.text}`)
            .join("\n\n") + "\n\n"
        : ""

    const fullPrompt = `${options.systemPrompt || this.systemPrompt}\n\n${historyTranscript}User: ${effectivePrompt}\nAssistant:`

    return this.runTextOrVisionPrompt(fullPrompt, imagePaths)
  }

  public async chatWithGemini(message: string): Promise<string> {
    return this.chatWithContext(message)
  }

  public async chat(message: string): Promise<string> {
    return this.chatWithContext(message)
  }

  public isUsingOllama(): boolean {
    return this.provider === "ollama"
  }

  public async getOllamaModels(customUrl?: string): Promise<string[]> {
    try {
      const baseUrl = customUrl
        ? normalizeBaseUrl(customUrl, this.ollamaUrl)
        : this.ollamaUrl
      const response = await fetchWithTimeout(
        `${baseUrl}/api/tags`,
        { method: "GET" },
        SHORT_FETCH_TIMEOUT_MS
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch Ollama models (${response.status})`)
      }

      const data = (await response.json()) as OllamaTagsResponse
      return (data.models ?? [])
        .map((model) => model.name)
        .filter((name): name is string => Boolean(name && name.trim().length > 0))
    } catch (error) {
      console.error("[LLMHelper] Error fetching Ollama models:", getErrorMessage(error))
      return []
    }
  }

  public getCurrentProvider(): LlmProvider {
    return this.provider
  }

  public getCurrentModel(): string {
    if (this.provider === "ollama") return this.ollamaModel
    if (this.provider === "openai-compatible") return this.openaiModel
    return this.geminiModelName
  }

  public getCurrentConfig(): LlmConfigSnapshot {
    return {
      provider: this.provider,
      model: this.getCurrentModel(),
      isOllama: this.provider === "ollama",
      isMock: this.useMock,
      ollamaUrl: this.ollamaUrl,
      openaiBaseUrl: this.openaiBaseUrl,
      hasGeminiKey: Boolean(this.geminiApiKey),
      hasOpenaiKey: Boolean(this.openaiApiKey)
    }
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    if (url && url.trim().length > 0) {
      this.ollamaUrl = normalizeBaseUrl(url, DEFAULT_OLLAMA_URL)
    }

    const available = await this.checkOllamaAvailable(this.ollamaUrl)
    if (!available) {
      throw new Error(`Ollama server is not reachable at ${this.ollamaUrl}`)
    }

    this.provider = "ollama"
    this.useMock = false

    if (model && model.trim().length > 0) {
      this.ollamaModel = model.trim()
    } else {
      await this.initializeOllamaModel()
    }

    console.log(`[LLMHelper] Switched to Ollama: ${this.ollamaModel} at ${this.ollamaUrl}`)
  }

  public async switchToGemini(apiKey?: string, modelName?: string): Promise<void> {
    const trimmedKey = apiKey?.trim()
    const targetModel = modelName?.trim() || this.geminiModelName || DEFAULT_GEMINI_MODEL

    if (trimmedKey) {
      this.configureGeminiClient(trimmedKey, targetModel)
    } else if (this.geminiApiKey) {
      this.configureGeminiClient(this.geminiApiKey, targetModel)
    } else {
      throw new Error("Please enter a Gemini API key to activate Google Gemini.")
    }

    this.provider = "gemini"
    this.useMock = false
    console.log(`[LLMHelper] Switched to Gemini (${this.geminiModelName})`)
  }

  public async switchToOpenAICompatible(config: {
    apiKey?: string
    baseUrl?: string
    model?: string
  }): Promise<void> {
    const normalizedUrl = normalizeBaseUrl(
      config.baseUrl?.trim() || this.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL,
      DEFAULT_OPENAI_BASE_URL
    )
    const nextModel = config.model?.trim() || this.openaiModel || DEFAULT_OPENAI_MODEL
    const nextKey = config.apiKey?.trim() || this.openaiApiKey

    const isLocalEndpoint =
      normalizedUrl.includes("localhost") || normalizedUrl.includes("127.0.0.1")
    if (!nextKey && !isLocalEndpoint) {
      throw new Error("An API key is required for remote OpenAI-compatible endpoints.")
    }

    this.openaiBaseUrl = normalizedUrl
    this.openaiModel = nextModel
    if (nextKey) {
      this.openaiApiKey = nextKey
    }
    this.provider = "openai-compatible"
    this.useMock = false
    console.log(`[LLMHelper] Switched to OpenAI-compatible API (${this.openaiModel} @ ${this.openaiBaseUrl})`)
  }

  public async testConnection(): Promise<{ success: boolean; error?: string; model?: string }> {
    try {
      if (this.useMock) {
        return {
          success: false,
          error: "Offline mock mode is active. Configure Gemini, Ollama, or OpenAI-compatible API first."
        }
      }

      if (this.provider === "ollama") {
        const available = await this.checkOllamaAvailable(this.ollamaUrl)
        if (!available) {
          return { success: false, error: `Ollama not available at ${this.ollamaUrl}` }
        }
        await this.callOllama("Reply with the single word: OK")
        return { success: true, model: this.ollamaModel }
      }

      if (this.provider === "openai-compatible") {
        const reply = await this.callOpenAICompatible("Reply with the single word: OK")
        return reply
          ? { success: true, model: this.openaiModel }
          : { success: false, error: "Empty response from OpenAI-compatible API" }
      }

      const text = await this.generateWithGeminiFallback("Reply with the single word: OK")
      if (text) {
        return { success: true, model: this.geminiModelName }
      }
      return { success: false, error: "Empty response from Gemini" }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }
}
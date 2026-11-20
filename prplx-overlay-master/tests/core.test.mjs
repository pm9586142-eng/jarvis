import test from "node:test"
import assert from "node:assert/strict"
import Module from "node:module"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

// Stub Electron-only and native image packages so compiled dist-electron pure helpers
// can be tested in a headless Node.js environment without launching Chromium.
const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getPath: () => "/tmp/prplx-test-userdata",
        getAppPath: () => process.cwd()
      },
      screen: {
        getAllDisplays: () => [],
        getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } })
      }
    }
  }
  if (request === "screenshot-desktop") {
    return async () => Buffer.alloc(0)
  }
  if (request === "sharp") {
    return () => ({})
  }
  return originalLoad.call(this, request, parent, isMain)
}

const llmModule = require("../dist-electron/LLMHelper.js")
const screenshotModule = require("../dist-electron/ScreenshotHelper.js")
const perplexityModule = require("../dist-electron/PerplexityHelper.js")

Module._load = originalLoad

const {
  LLMHelper,
  cleanJsonResponse,
  detectMimeType,
  normalizeBaseUrl,
  getErrorMessage
} = llmModule

const { isPathWithinDirectories, clampExtractBounds } = screenshotModule
const { parsePerplexityStdout } = perplexityModule

test("cleanJsonResponse strips markdown fences, CRLF, and surrounding prose", () => {
  const fenced = "Here is the output:\r\n```json\r\n{\"ok\": true, \"count\": 3}\r\n```\r\nDone."
  assert.deepEqual(JSON.parse(cleanJsonResponse(fenced)), { ok: true, count: 3 })

  const proseWrapped = 'Sure! {"problem_statement": "Two Sum", "suggested_responses": ["HashMap"]}'
  assert.deepEqual(JSON.parse(cleanJsonResponse(proseWrapped)), {
    problem_statement: "Two Sum",
    suggested_responses: ["HashMap"]
  })

  assert.equal(cleanJsonResponse(""), "")
})

test("detectMimeType resolves image and audio extensions with fallback", () => {
  assert.equal(detectMimeType("/tmp/shot.PNG", "application/octet-stream"), "image/png")
  assert.equal(detectMimeType("/tmp/photo.jpeg", "image/png"), "image/jpeg")
  assert.equal(detectMimeType("/tmp/frame.webp", "image/png"), "image/webp")
  assert.equal(detectMimeType("/tmp/note.mp3", "audio/wav"), "audio/mp3")
  assert.equal(detectMimeType("/tmp/voice.webm", "audio/mp3"), "audio/webm")
  assert.equal(detectMimeType("/tmp/unknown.bin", "image/png"), "image/png")
})

test("normalizeBaseUrl validates http/https protocols and trims trailing slashes", () => {
  assert.equal(
    normalizeBaseUrl("http://localhost:11434///", "http://localhost:11434"),
    "http://localhost:11434"
  )
  assert.equal(
    normalizeBaseUrl("https://api.groq.com/openai/v1/", "https://api.openai.com/v1"),
    "https://api.groq.com/openai/v1"
  )
  assert.throws(() => normalizeBaseUrl("javascript:alert(1)", "http://localhost:11434"))
  assert.throws(() => normalizeBaseUrl("file:///etc/passwd", "http://localhost:11434"))
  assert.equal(getErrorMessage(new Error("boom")), "boom")
})

test("LLMHelper runs safely in mock mode and resets mock flag on provider switch", async () => {
  const helper = new LLMHelper(undefined, false)
  assert.equal(helper.getCurrentConfig().isMock, true)

  const extracted = await helper.extractProblemFromImages(["/tmp/nonexistent.png"])
  assert.equal(typeof extracted.problem_statement, "string")
  assert.match(extracted.problem_statement, /offline mode/i)

  const solution = await helper.generateSolution(extracted)
  assert.equal(typeof solution.solution.code, "string")

  const debugged = await helper.debugSolutionWithImages(extracted, "const x = 1", [])
  assert.equal(typeof debugged.solution.code, "string")

  const chatReply = await helper.chatWithContext("Hello world")
  assert.match(chatReply, /Offline Mode Active/i)

  // Switching to Gemini with a key must clear useMock=false and update model
  await helper.switchToGemini("test-key-123", "gemini-2.5-flash")
  const geminiSnap = helper.getCurrentConfig()
  assert.equal(geminiSnap.provider, "gemini")
  assert.equal(geminiSnap.isMock, false)
  assert.equal(geminiSnap.hasGeminiKey, true)
  assert.equal(geminiSnap.model, "gemini-2.5-flash")

  // Switching to OpenAI-compatible validates API key for remote endpoints, allows keyless localhost
  await assert.rejects(
    () =>
      helper.switchToOpenAICompatible({
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        apiKey: ""
      }),
    /API key is required/i
  )

  await helper.switchToOpenAICompatible({
    baseUrl: "http://localhost:1234/v1",
    model: "local-model",
    apiKey: ""
  })
  const localSnap = helper.getCurrentConfig()
  assert.equal(localSnap.provider, "openai-compatible")
  assert.equal(localSnap.isMock, false)
  assert.equal(localSnap.model, "local-model")
  assert.equal(localSnap.openaiBaseUrl, "http://localhost:1234/v1")
})

test("isPathWithinDirectories blocks path traversal and unrelated directories", () => {
  const allowed = [
    path.resolve("/tmp/prplx/screenshots"),
    path.resolve("/tmp/prplx/extra_screenshots")
  ]

  assert.equal(
    isPathWithinDirectories("/tmp/prplx/screenshots/abc.png", allowed),
    true
  )
  assert.equal(
    isPathWithinDirectories("/tmp/prplx/extra_screenshots/sub/def.png", allowed),
    true
  )
  assert.equal(
    isPathWithinDirectories("/tmp/prplx/screenshots/../../etc/passwd", allowed),
    false
  )
  assert.equal(isPathWithinDirectories("/etc/passwd", allowed), false)
  assert.equal(isPathWithinDirectories("/tmp/prplx/screenshots", allowed), false)
  assert.equal(isPathWithinDirectories("", allowed), false)
})

test("clampExtractBounds prevents sharp out-of-bounds extract crashes", () => {
  // Normal crop stays intact
  assert.deepEqual(
    clampExtractBounds({ left: 10, top: 20, width: 300, height: 200 }, 1920, 1080),
    { left: 10, top: 20, width: 300, height: 200 }
  )

  // Origin past image edge must clamp so left + width <= maxWidth
  const edge = clampExtractBounds({ left: 2000, top: 1500, width: 500, height: 400 }, 1920, 1080)
  assert.ok(edge.left >= 0 && edge.top >= 0)
  assert.ok(edge.left + edge.width <= 1920)
  assert.ok(edge.top + edge.height <= 1080)
  assert.ok(edge.width >= 2 && edge.height >= 2)

  // Negative origin trims into positive bounds
  const negative = clampExtractBounds({ left: -50, top: -20, width: 100, height: 80 }, 800, 600)
  assert.deepEqual(negative, { left: 0, top: 0, width: 50, height: 60 })
})

test("parsePerplexityStdout safely parses valid, multi-line, and invalid JXA output", () => {
  const validStdout = [
    "some debug log line",
    JSON.stringify({
      prompt: "What is 2+2?",
      response: "4",
      responses: ["4"],
      responseHtml: "<p>4</p>",
      responsesHtml: ["<p>4</p>"]
    })
  ].join("\n")

  const parsed = parsePerplexityStdout(validStdout)
  assert.equal(parsed.prompt, "What is 2+2?")
  assert.equal(parsed.response, "4")
  assert.deepEqual(parsed.responses, ["4"])
  assert.equal(parsed.responseHtml, "<p>4</p>")

  // Missing response field falls back cleanly rather than crashing
  const partial = parsePerplexityStdout(JSON.stringify({ prompt: "Hi", responses: ["Hello"] }))
  assert.equal(partial.response, "Hello")

  // Empty or invalid stdout throws descriptive error
  assert.throws(() => parsePerplexityStdout(""), /Empty response from Perplexity/i)
  assert.throws(() => parsePerplexityStdout("not-json-at-all"), /Failed to parse/i)
})

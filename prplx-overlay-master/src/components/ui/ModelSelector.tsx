import React, { useState, useEffect, useCallback } from "react"
import { RefreshCw, CheckCircle2, AlertCircle, Shield, Sliders, X } from "lucide-react"
import type { LlmConfigSnapshot, LlmProvider } from "../../types/electron"

interface ModelSelectorProps {
  opacity: number
  stealthEnabled: boolean
  quickSolvePrompt: string
  onOpacityChange: (opacity: number) => void
  onStealthChange: (enabled: boolean) => void
  onQuickSolvePromptChange: (prompt: string) => void
  onModelChange?: (provider: LlmProvider, model: string) => void
  onClose?: () => void
}

const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Recommended)" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (Fastest)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Deep Reasoning)" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Legacy)" }
]

const OPENAI_PRESETS = [
  {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile"
  },
  {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemini-2.5-flash"
  },
  {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini"
  },
  {
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    model: "local-model"
  }
]

const ModelSelector: React.FC<ModelSelectorProps> = ({
  opacity,
  stealthEnabled,
  quickSolvePrompt,
  onOpacityChange,
  onStealthChange,
  onQuickSolvePromptChange,
  onModelChange,
  onClose
}) => {
  const [currentConfig, setCurrentConfig] = useState<LlmConfigSnapshot | null>(null)
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshingOllama, setIsRefreshingOllama] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"testing" | "success" | "error" | null>(
    null
  )
  const [statusDetail, setStatusDetail] = useState<string>("")

  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>("gemini")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash")

  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
  const [selectedOllamaModel, setSelectedOllamaModel] = useState("")

  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("https://api.openai.com/v1")
  const [openaiApiKey, setOpenaiApiKey] = useState("")
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini")

  const [promptDraft, setPromptDraft] = useState(quickSolvePrompt)

  const loadOllamaModels = useCallback(async (urlToQuery?: string) => {
    if (!window.electronAPI?.getAvailableOllamaModels) return
    try {
      setIsRefreshingOllama(true)
      const models = await window.electronAPI.getAvailableOllamaModels(urlToQuery)
      setAvailableOllamaModels(models)
      if (models.length > 0) {
        setSelectedOllamaModel((prev) => (prev && models.includes(prev) ? prev : models[0]))
      }
    } catch (error) {
      console.error("Error loading Ollama models:", error)
      setAvailableOllamaModels([])
    } finally {
      setIsRefreshingOllama(false)
    }
  }, [])

  const loadCurrentConfig = useCallback(async () => {
    if (!window.electronAPI?.getCurrentLlmConfig) {
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const config = await window.electronAPI.getCurrentLlmConfig()
      setCurrentConfig(config)
      setSelectedProvider(config.provider)
      setOllamaUrl(config.ollamaUrl || "http://localhost:11434")
      setOpenaiBaseUrl(config.openaiBaseUrl || "https://api.openai.com/v1")

      if (config.provider === "gemini") {
        setGeminiModel(config.model || "gemini-2.5-flash")
      } else if (config.provider === "ollama") {
        setSelectedOllamaModel(config.model || "")
        await loadOllamaModels(config.ollamaUrl)
      } else if (config.provider === "openai-compatible") {
        setOpenaiModel(config.model || "gpt-4o-mini")
      }
    } catch (error) {
      console.error("Error loading current LLM config:", error)
    } finally {
      setIsLoading(false)
    }
  }, [loadOllamaModels])

  useEffect(() => {
    void loadCurrentConfig()
  }, [loadCurrentConfig])

  useEffect(() => {
    setPromptDraft(quickSolvePrompt)
  }, [quickSolvePrompt])

  useEffect(() => {
    if (selectedProvider === "ollama" && availableOllamaModels.length === 0) {
      void loadOllamaModels(ollamaUrl)
    }
  }, [selectedProvider, availableOllamaModels.length, loadOllamaModels, ollamaUrl])

  const testConnection = async () => {
    if (!window.electronAPI?.testLlmConnection) return
    try {
      setConnectionStatus("testing")
      setStatusDetail("Testing connection...")
      const result = await window.electronAPI.testLlmConnection()
      if (result.success) {
        setConnectionStatus("success")
        setStatusDetail(`Connected (${result.model || currentConfig?.model || "ready"})`)
      } else {
        setConnectionStatus("error")
        setStatusDetail(result.error || "Connection failed")
      }
    } catch (error) {
      setConnectionStatus("error")
      setStatusDetail(error instanceof Error ? error.message : String(error))
    }
  }

  const handleProviderSwitch = async () => {
    if (!window.electronAPI) return
    try {
      setConnectionStatus("testing")
      setStatusDetail("Applying configuration...")
      let result: { success: boolean; error?: string }

      if (selectedProvider === "ollama") {
        result = await window.electronAPI.switchToOllama(
          selectedOllamaModel || undefined,
          ollamaUrl
        )
      } else if (selectedProvider === "openai-compatible") {
        result = await window.electronAPI.switchToOpenAICompatible({
          apiKey: openaiApiKey || undefined,
          baseUrl: openaiBaseUrl,
          model: openaiModel
        })
      } else {
        result = await window.electronAPI.switchToGemini(
          geminiApiKey || undefined,
          geminiModel
        )
      }

      if (result.success) {
        await loadCurrentConfig()
        const resolvedModel =
          selectedProvider === "ollama"
            ? selectedOllamaModel
            : selectedProvider === "openai-compatible"
              ? openaiModel
              : geminiModel
        setConnectionStatus("success")
        setStatusDetail(`Active: ${resolvedModel}`)
        onModelChange?.(selectedProvider, resolvedModel)
      } else {
        setConnectionStatus("error")
        setStatusDetail(result.error || "Switch failed")
      }
    } catch (error) {
      setConnectionStatus("error")
      setStatusDetail(error instanceof Error ? error.message : String(error))
    }
  }

  const handleSavePrompt = () => {
    onQuickSolvePromptChange(promptDraft)
    setConnectionStatus("success")
    setStatusDetail("Quick-solve prompt saved")
  }

  return (
    <div className="mb-3 rounded-xl border border-white/15 bg-[rgba(10,16,32,0.88)] p-3 text-xs text-white space-y-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-white">
          <Sliders className="h-3.5 w-3.5 text-blue-400" />
          <span>Direct AI & Overlay Settings</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="overlay-button h-6 w-6 flex items-center justify-center rounded-md"
            title="Close settings"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse text-white/60 py-2">Loading configuration...</div>
      ) : (
        <>
          {currentConfig && (
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px]">
              <span className="text-white/70">Active Direct AI:</span>
              <span className="font-medium text-blue-200">
                {currentConfig.isMock
                  ? "Offline Mock Mode"
                  : `${currentConfig.provider} · ${currentConfig.model}`}
              </span>
            </div>
          )}

          {/* Provider Switcher */}
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "gemini", label: "Gemini" },
                { id: "ollama", label: "Ollama" },
                { id: "openai-compatible", label: "OpenAI / Groq" }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedProvider(tab.id)}
                className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  selectedProvider === tab.id
                    ? "bg-blue-500/35 text-white border border-blue-400/50"
                    : "bg-white/5 text-white/70 hover:bg-white/10 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Provider Form */}
          {selectedProvider === "gemini" && (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-[10px] text-white/70">Gemini Model</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-[rgba(15,23,42,0.9)] px-2.5 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-900">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-white/70">
                  Gemini API Key {currentConfig?.hasGeminiKey ? "(saved in session)" : ""}
                </label>
                <input
                  type="password"
                  placeholder="AIza... (optional if already configured)"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {selectedProvider === "ollama" && (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-[10px] text-white/70">Ollama Server URL</label>
                <input
                  type="url"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-[10px] text-white/70">Local Model (vision supported)</label>
                  <button
                    type="button"
                    onClick={() => void loadOllamaModels(ollamaUrl)}
                    className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isRefreshingOllama ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </button>
                </div>
                {availableOllamaModels.length > 0 ? (
                  <select
                    value={selectedOllamaModel}
                    onChange={(e) => setSelectedOllamaModel(e.target.value)}
                    className="w-full rounded-md border border-white/15 bg-[rgba(15,23,42,0.9)] px-2.5 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                  >
                    {availableOllamaModels.map((model) => (
                      <option key={model} value={model} className="bg-slate-900">
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. llama3.2, qwen2.5vl, gemma3"
                    value={selectedOllamaModel}
                    onChange={(e) => setSelectedOllamaModel(e.target.value)}
                    className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:border-blue-400 focus:outline-none"
                  />
                )}
              </div>
            </div>
          )}

          {selectedProvider === "openai-compatible" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {OPENAI_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setOpenaiBaseUrl(preset.baseUrl)
                      setOpenaiModel(preset.model)
                    }}
                    className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/80 hover:bg-blue-500/30 hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-white/70">Base URL</label>
                <input
                  type="url"
                  value={openaiBaseUrl}
                  onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-white/70">Model ID</label>
                  <input
                    type="text"
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-white/70">
                    API Key {currentConfig?.hasOpenaiKey ? "(set)" : ""}
                  </label>
                  <input
                    type="password"
                    placeholder="sk-... / gsk_..."
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleProviderSwitch}
              disabled={connectionStatus === "testing"}
              className="flex-1 rounded-md bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-[11px] font-medium text-white transition-colors"
            >
              {connectionStatus === "testing" ? "Applying..." : "Apply AI Provider"}
            </button>
            <button
              type="button"
              onClick={testConnection}
              disabled={connectionStatus === "testing"}
              className="rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 px-3 py-1.5 text-[11px] text-white transition-colors"
            >
              Test
            </button>
          </div>

          {connectionStatus && statusDetail && (
            <div
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] ${
                connectionStatus === "success"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : connectionStatus === "error"
                    ? "bg-red-500/15 text-red-300 border border-red-500/30"
                    : "bg-blue-500/15 text-blue-200 border border-blue-500/30"
              }`}
            >
              {connectionStatus === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : connectionStatus === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              ) : null}
              <span className="break-words">{statusDetail}</span>
            </div>
          )}

          {/* Overlay HUD Controls */}
          <div className="space-y-2 border-t border-white/10 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/80">
                Overlay Opacity ({Math.round(opacity * 100)}%)
              </span>
              <input
                type="range"
                min={35}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
                className="w-32 accent-blue-400 cursor-pointer"
                aria-label="Overlay opacity"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-white/80">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                Stealth Mode (Hide from Screen Capture)
              </span>
              <button
                type="button"
                onClick={() => onStealthChange(!stealthEnabled)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  stealthEnabled
                    ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/40"
                    : "bg-white/10 text-white/60 border border-white/10"
                }`}
              >
                {stealthEnabled ? "Protected" : "Visible"}
              </button>
            </div>

            <div>
              <label className="mb-1 block text-[10px] text-white/70">
                Quick-Solve Shortcut Prompt (⌘2 / ⌘⌥↵)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  className="flex-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSavePrompt}
                  className="rounded-md bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[10px] text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ModelSelector
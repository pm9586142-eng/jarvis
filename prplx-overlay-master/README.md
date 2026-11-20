# Perplexity Overlay (v1.1.0)

Stealth-capable, always-on-top Electron AI overlay that sees your screen, captures regions or clipboard items, listens to voice input, and answers in real time via **Perplexity Safari Automation (macOS)** or **Cross-Platform Direct AI APIs** (**Google Gemini**, **Ollama Vision**, and **OpenAI-compatible providers** like Groq, OpenRouter, OpenAI, and LM Studio).

## Key Features

- **Dual AI Engines**:
  - **Perplexity Mode (macOS)**: Automates Perplexity in Safari with live streaming, model switching, web search toggle, and automatic screenshot uploads.
  - **Direct AI Mode (macOS / Windows / Linux)**: Multi-turn conversational chat with vision attachments powered by **Google Gemini** (`gemini-2.5-flash` with automatic fallback), local **Ollama** (including vision models like `llava` / `llama3.2-vision`), or any **OpenAI-compatible endpoint** (Groq, OpenRouter, OpenAI, LM Studio).
- **Screen Capture & Region Snip**:
  - Full-screen capture, click-and-drag region selection (`Cmd/Ctrl + H`), instant attach (`Cmd/Ctrl + 1`), and one-key screenshot + auto-solve (`Cmd/Ctrl + 2`).
- **Clipboard Quick-Ask**:
  - Instantly pull copied text or copied screenshots from the system clipboard (`Cmd/Ctrl + Shift + C` or toolbar Clipboard button).
- **Quick Prompt Presets**:
  - One-click pills for *Explain*, *Fix Bug*, *Solve*, *Summarize*, *Code Review*, and *Translate*.
- **Voice Input Dictation**:
  - Push-to-talk microphone transcription directly inside the overlay (with clean MediaStream track teardown).
- **Persistent Chat History & Markdown Export**:
  - Searchable local session archive (up to 50 conversations), one-click restore, one-click `.md` export, and copy-code buttons on fenced code blocks.
- **Stealth & Display Controls**:
  - Adjustable overlay opacity slider (35%–100%), toggleable screen-capture content protection (`setContentProtection`), and customizable Quick-Solve prompt.

## Keyboard Shortcuts

On Windows/Linux, replace `Cmd` with `Ctrl`.

| Shortcut | Action |
| --- | --- |
| `Cmd + Down` | Show / Hide overlay |
| `Cmd + Arrow Keys` | Move overlay left / right / up |
| `Cmd + Shift + Down` | Move overlay down |
| `Cmd + `` ` `` | Toggle Stealth / Visibility focus mode |
| `Cmd + H` | Capture region screenshot (snip) |
| `Cmd + 1` | Capture screenshot & attach to current chat |
| `Cmd + 2` | Capture screenshot & auto-send Quick-Solve prompt |
| `Cmd + Shift + C` | Pull clipboard text/image into overlay |
| `Cmd + Enter` | Send prompt / Process queued screenshots |
| `Cmd + Alt + Enter` | Send prompt (secondary accelerator) |
| `Cmd + Shift + N` | Start a new chat session |
| `Cmd + W` | Toggle Web Search (Perplexity mode) |
| `Cmd + M` | Select Sonar model (Perplexity mode) |
| `Cmd + ,` | Select GPT-5 (Perplexity mode) |
| `Cmd + .` | Select GPT-5 Reasoning (Perplexity mode) |
| `Cmd + /` | Select Claude Sonnet 4.5 Reasoning (Perplexity mode) |
| `Cmd + L` | Insert extended reasoning prompt |
| `Cmd + R` | Reset overlay queues and view |

## Prerequisites

- **Node.js 20+**
- **For Perplexity Mode (macOS)**: Safari with JavaScript from Apple Events enabled and an active Perplexity account.
- **For Direct AI Mode (macOS / Windows / Linux)**: Any one of:
  - `GEMINI_API_KEY` from Google AI Studio
  - Local [Ollama](https://ollama.com) instance (`USE_OLLAMA=true`, optional `OLLAMA_URL`, `OLLAMA_MODEL`)
  - Any OpenAI-compatible provider (`OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, `OPENAI_MODEL`) — also configurable live in the overlay **Settings** panel.

## Getting Started

```bash
npm install
npm run app:dev
```

Or on macOS:

```bash
./dev.sh
```

## Verification & Build Commands

```bash
# TypeScript checks (Electron main + React strict)
npm run typecheck

# Run automated unit tests
npm test

# Production build (Electron JS + Vite bundle)
npm run build

# Package macOS distributable
npm run app:build
```

See [`CHANGELOG_FIXES.md`](./CHANGELOG_FIXES.md) for the complete list of security patches, bug fixes, and enhancements introduced in v1.1.0.

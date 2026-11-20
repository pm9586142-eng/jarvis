# AM AI (JARVIS) — Multi-AI Brain Infrastructure & Premium Voice Web Platform

Full-stack browser interface and serverless Express backend for **AM AI (JARVIS)**, combining a **10-Phase Multi-AI Brain Infrastructure**, **strict `$0 / ₹0` zero-cost multi-provider orchestration (11+ providers)**, **14 specialist agents**, **smart multi-agent collaboration + self-verification**, a **7-category Shared Memory Vault**, and a **Premium Bilingual Female Voice System (Hindi / English / Hinglish)** with a **Two-Step Automatic Welcome Sequence**.

---

## Core Capabilities

1. **Multi-AI Brain Infrastructure (`/api/brain/*` + Unified 10-Tab Control Center)**
   - **9 Modular Backend Subsystems** (`web/server/brain/`): `ChiefCoordinator`, `ProviderRegistry`, `IntelligentRouter`, `SpecialistAgents` (14 specialists), `CollaborationEngine`, `VerificationEngine`, `UsageMonitor`, `SecurityGuard`, and `brainRoutes`.
   - **11+ AI Providers + Custom OpenAI-Compatible Registration**: Google Gemini, Groq, OpenRouter (`:free` only with live `$0` verification), Mistral AI, Cohere, Cloudflare Workers AI, NVIDIA NIM, SambaNova, Hugging Face, Ollama (local `$0`), and DeepSeek (transparently registered as `paid_only` and strictly blocked under `$0` mode).
   - **Honest Live Probes**: No provider is ever marked `CONNECTED` until a real live connection test succeeds.
   - **Smart Auto-Trigger Collaboration & Self-Verification**: Normal prompts execute quickly on a single optimal free specialist; complex multi-discipline prompts (or explicit `COLLAB: ON`) decompose tasks across parallel free specialists, detect contradictions, self-verify with confidence scoring, and synthesize one verified answer.
   - **Strict `$0` Guard + Security Guard**: Rejects paid providers/models, sanitizes prompt injection attempts, blocks SSRF on custom endpoints, redacts API keys/tokens from responses/logs, and keeps all keys strictly server-side.

2. **AM AI Premium Bilingual Female Voice & Two-Step Welcome Sequence**
   - **Two-Step Automatic Welcome** (plays once per session via single unified `WebVoiceEngine`):
     1. `"Hello Sir! Welcome to AM AI. How are you?"`
     2. `"Sir, all systems are online. I am ready to assist you."` — **honesty-gated** to `/api/health` (only announces systems online after real health verification succeeds with an active AI provider).
   - **Graceful Autoplay Fallback**: If browser autoplay policy pauses initial speech, displays a non-blocking prompt and automatically triggers on the user's first click/tap/keypress.
   - **Premium Female Voice Engine**: Ranks natural/neural soft female voices for both Hindi (`hi-IN`) and English (`en-IN` / `en-US` / `en-GB`), calibrates gentle rate (`0.96x`) and natural warm pitch (`1.04x`), switches per-segment pronunciation seamlessly across Hindi, English, and Hinglish without translating text, and preserves `AM AI`, `JARVIS`, code identifiers, and numbers.
   - **Dedicated 9-Control Voice Settings** (in both **Voice Matrix** and **System Settings**): Female Voice ON/OFF, Voice Selection, Speaking Speed slider, Volume slider, Test Voice button, Welcome Greeting ON/OFF, Replay Welcome button, Hindi/English/Hinglish preference, and Automatic Language Detection ON/OFF — plus persistent storage and a prominent **Stop Speaking** control.

3. **YouTube Data API v3 & Smart Media Control System (`/api/youtube/*`)**
   - **Secure Server-Side YouTube Proxy**: `GET /api/youtube/search` (videos, music, education + pagination + TTL cache + `videos.list` enrichment for durations, views, likes, embeddable status), `GET /api/youtube/video/:videoId`, `GET /api/youtube/playlist/:playlistId`, plus backward-compatible `POST /api/youtube/search`. `YOUTUBE_API_KEY` stays strictly server-side with zero frontend exposure.
   - **Reusable Official YouTube IFrame Player**: Embedded player stage (`YouTubePlayerStage.tsx`) + persistent floating mini-player (`MediaMiniPlayer.tsx`) with Play, Pause, Resume, Stop, Next, Previous, Seek ±10s, Volume Up/Down/Slider, Mute/Unmute, Repeat, Fullscreen, Queue (auto-next), Search History, and honest embed/autoplay fallbacks.
   - **Bilingual Voice Control (English + Hindi Devanagari + Hinglish)**: Integrated into the existing single `WebVoiceEngine` with Soft & Sweet Female Voice responses (`"Search Arijit Singh songs"`, `"पहला वीडियो चलाओ"`, `"वीडियो रोक दो"`, `"दस सेकंड आगे करो"`, `"Video pause karo"`, `"Volume full kar do"`, `"Turn on fullscreen"`).
   - **Android Companion Compatibility**: Dedicated `YouTubeMediaScreen.kt` (Jetpack Compose + official YouTube IFrame WebView + bilingual `YouTubeVoiceCommandParser`) proxying search through `BACKEND_URL` with zero API keys inside the APK.

4. **Preserved Existing Features**
   - Command Center HUD, Neural Chat Matrix (SSE streaming, multimodal uploads, session drawer, export), Research Studio, Smart Automation Hub, Multi-Agent Hub, Stark Security Audit, Telemetry & CLI, Plugin Matrix, Memory Vault, Executive Planner, Insights, Smart Home, Vision Scanner, Orbital Aegis 3D, Lyria Music Core, and Android Companion backend compatibility.

---

## Documentation Index

- **[Architecture Guide](./docs/ARCHITECTURE.md)** — 9-component Multi-AI Brain architecture, data flow, 14 specialist agents, and voice pipeline.
- **[Providers & `$0` Guard Reference](./docs/PROVIDERS.md)** — All 11+ providers, free-tier notes, env vars, custom OpenAI-compatible registration, and why DeepSeek direct is blocked at `$0`.
- **[Deployment Guide](./docs/DEPLOYMENT.md)** — Local development, Vercel serverless deployment, Cloud Run, and Android `BACKEND_URL` integration.
- **[Testing Report](./docs/TESTING_REPORT.md)** — Real observed unit, integration, typecheck, build, and security audit results.

---

## Quick Start

```bash
cd web
cp .env.example .env   # Add GEMINI_API_KEY (and optional GROQ_API_KEY, OPENROUTER_API_KEY, etc.)
npm install
npm run dev            # Vite (:5173) + Express API (:3001)
```

Verify locally:

```bash
npm run typecheck
npm test
npm run build
```

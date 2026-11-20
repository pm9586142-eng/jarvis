# AM AI (JARVIS) — Multi-AI Brain & Voice Architecture

## 1. System Overview

AM AI extends the existing Express + React/Vite JARVIS platform with a modular **9-component Multi-AI Brain Infrastructure** on the backend (`web/server/brain/`) and a **Unified 10-Tab Multi-AI Control Center** (`web/src/views/MultiAiControlCenterView.tsx`) plus a **Single-Engine Premium Bilingual Female Voice System** (`web/src/services/voice.ts`) on the frontend.

```text
Browser / Android App (via BACKEND_URL)
   │
   ├── Standard Fast Chat ─────────────────────────► POST /api/chat/stream (Gemini → Groq → OpenRouter free failover)
   │
   └── Multi-AI Brain API (/api/brain/*)
          │
          ▼
   ┌────────────────────────────────────────────────────────────┐
   │  1. SecurityGuard (SSRF, secret redaction, injection check)│
   └───────────────────────────┬────────────────────────────────┘
                               ▼
   ┌────────────────────────────────────────────────────────────┐
   │  2. ChiefCoordinator (complexity triage & orchestration)   │
   │     ├── Normal tasks ──► Direct Specialist Execution       │
   │     └── Complex tasks ─► Parallel CollaborationEngine      │
   └──────────┬───────────────────────┬─────────────────────────┘
              ▼                       ▼
   ┌────────────────────┐   ┌───────────────────────────────┐
   │ 3. SpecialistAgents│   │ 4. CollaborationEngine        │
   │ (14 domain experts)│   │ (decompose → parallel → merge)│
   └──────────┬─────────┘   └───────────────┬───────────────┘
              ▼                             ▼
   ┌────────────────────┐   ┌───────────────────────────────┐
   │ 5. IntelligentRouter│  │ 6. VerificationEngine         │
   │ (task/speed/vision/ │  │ (contradictions, confidence,  │
   │  free-first policy) │  │  targeted self-correction)    │
   └──────────┬─────────┘   └───────────────┬───────────────┘
              ▼                             ▼
   ┌────────────────────────────────────────────────────────────┐
   │  7. ProviderRegistry (11+ adapters + custom OpenAI-compat) │
   │     • Strictly $0 verified-free allowlist                  │
   │     • Real live probe status (UNCONFIGURED/UNTESTED/LIVE)  │
   │     • Rate-limit cooldown + bounded exponential backoff    │
   └───────────────────────────┬────────────────────────────────┘
                               ▼
   ┌────────────────────────────────────────────────────────────┐
   │  8. UsageMonitor & 9. SharedMemory (7 canonical categories)│
   └────────────────────────────────────────────────────────────┘
```

## 2. Backend Brain Modules (`web/server/brain/`)

| Module | File | Responsibility |
|---|---|---|
| Chief AI Coordinator | `chiefCoordinator.js` | Task intake, complexity classification, direct vs. collaborative execution, shared-memory recall & audit trail |
| AI Provider Manager | `providerRegistry.js` | Registry & adapters for 11+ providers + custom OpenAI-compatible endpoints, real probes, cooldowns, `$0` guard |
| Intelligent AI Router | `intelligentRouter.js` | Scores & orders eligible free provider/model pairs by domain (`coding`, `research`, `reasoning`, `vision`, `fast`), latency, health, and manual overrides |
| Specialist Agent Manager | `specialistAgents.js` | Manages 14 configurable specialist agents with domain prompts, preferred providers/models, temperature & enable toggles |
| AI Collaboration Engine | `collaborationEngine.js` | Decomposes complex tasks into specialist subtasks, runs bounded parallel execution with failover, and synthesizes unified responses |
| Verification Engine | `verificationEngine.js` | Inspects outputs for contradictions, factual uncertainty, code/formatting errors, computes confidence scores, and triggers bounded self-correction |
| Usage Monitoring System | `usageMonitor.js` | Tracks requests, tokens, success/error rates, latency, fallback counts, provider errors, task history, and audit events |
| Security Guard | `securityGuard.js` | Secret redaction, prompt-injection detection, sensitive-action guard, private-IP SSRF protection for custom providers |
| Brain API Router | `brainRoutes.js` | Express sub-router mounted at `/api/brain/*` |

## 3. The 14 Specialist Agents

1. `research` — Research Analyst
2. `coding` — Software Architect & Coder
3. `reasoning` — Deep Reasoning Strategist
4. `mathematics` — Quantitative & Math Specialist
5. `writing` — Editorial & Writing Specialist
6. `vision` — Multimodal Vision Analyst
7. `document_analysis` — Document Intelligence Specialist
8. `security` — AppSec & Threat Auditor
9. `debugging` — Root-Cause Debugger
10. `testing` — QA & Test Engineer
11. `voice` — Conversational Voice Concierge
12. `memory` — Knowledge & Memory Curator
13. `planning` — Project & Roadmap Planner
14. `automation` — Workflow Automation Engineer

## 4. Shared Memory (7 Categories)

`web/src/services/memoryDedupe.js` and `/api/brain/memory/*` maintain backward compatibility with legacy categories while supporting all 7 shared-brain categories:
- `USER_PREFERENCES`
- `IMPORTANT_INSTRUCTIONS`
- `PROJECT_CONTEXT`
- `CONVERSATION_SUMMARIES`
- `LONG_TERM_KNOWLEDGE`
- `TASK_HISTORY`
- `AGENT_EXECUTION_HISTORY`

All writes pass through secret detection (blocking passwords, API keys, private keys, and tokens) and Jaccard + normalized-key deduplication.

## 5. Premium Bilingual Female Voice Pipeline

- **Single Speech Engine**: `web/src/services/voice.ts` (`WebVoiceEngine`) owns the sole Web Speech API queue to prevent duplicate engines and overlapping audio.
- **Voice Ranking & Calibration** (`web/src/services/femaleVoiceCatalog.js`):
  - Ranks natural/neural female voices first for `hi-IN` (e.g., Swara, Lekha, Google हिन्दी) and `en-IN` / `en-US` / `en-GB` (e.g., Neerja, Aria, Jenny, Samantha, Veena).
  - Applies warm, non-robotic calibration (`0.96x` default rate, `1.04x` gentle pitch).
- **Bilingual Hindi / English / Hinglish Segmentation** (`web/src/services/speechFormatter.js`):
  - Strips Markdown syntax while preserving natural pronunciation of `AM AI`, `JARVIS`, technical identifiers, and numbers without ever translating the AI's text.
  - Splits mixed Hindi/English responses into script-aware segments so Devanagari clauses speak with a Hindi female voice and English clauses speak with an English female voice seamlessly.
- **Two-Step Welcome Sequence**:
  - Waits for initial `/api/health` to settle.
  - Plays Step 1 (`"Hello Sir! Welcome to AM AI. How are you?"`), waits for `onend` + 320ms natural pause, then plays Step 2 (`"Sir, all systems are online. I am ready to assist you."` ONLY when backend health + AI config are verified; otherwise speaks an honest standby status).
  - Guarded by `sessionStorage` (`am_ai_welcome_played_session_v1`) to play once per session, with automatic first-interaction playback if browser autoplay blocks initial speech.

# JARVIS AI — Project Audit (Phase 0 & Release 3.0)

## 1. Repository Architecture Overview

| Module | Stack | Purpose |
| --- | --- | --- |
| `/app` | Kotlin, Jetpack Compose (M3), Room (v5), DataStore, Firebase AI Logic / Gemini (`AiRepository`), AlarmManager, Work-free BroadcastReceiver | Primary Android AI Assistant workspace configured as the root AI Studio applet |
| `/web` | React 19, TypeScript, Vite 6, Tailwind CSS v4, Express 4, `@google/genai`, Node `--test` | Full-stack browser & Cloud Run / GitHub Pages HUD client + backend proxy |
| `/.github/workflows` | GitHub Actions (`deploy-pages.yml`) | Builds `/web` static bundle with subpath `VITE_BASE_PATH` and `404.html` SPA fallback |

---

## 2. Structural & Dependency Audit Findings

### 2.1 Android (`/app`)
- **Gradle & Wrapper**: Container uses system `gradle` directly (`gradlew` wrapper is absent/unsupported in the AI Studio Android runtime). `compileSdk = 36`, `targetSdk = 36`, `minSdk = 24`.
- **Persistence**: Room database `JarvisDatabase` upgraded cleanly with explicit non-destructive migrations (`MIGRATION_1_2`, `MIGRATION_2_3`, `MIGRATION_3_4`, `MIGRATION_4_5`) up to **version 5** across 6 entities: `MemoryEntity`, `ConversationEntity`, `ChatSessionEntity`, `TaskEntity`, `SecurityLogEntity`, `CustomAgentEntity`. Settings persist in Jetpack DataStore (`SettingsPreferences`).
- **Permissions (`AndroidManifest.xml`)**: Only `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE` (normal), plus runtime-requested `RECORD_AUDIO`, `CAMERA`, and `POST_NOTIFICATIONS`. Media selection uses `ActivityResultContracts.PickVisualMedia` (zero broad storage permissions). Note: Calendar Provider read access is **not** declared in `AndroidManifest.xml` to follow least-privilege policy.

### 2.2 Web & Express Backend (`/web`)
- **Frontend**: 15 modular views under `web/src/views/` preserving the Cosmic Iron-Man HUD (`QuantumCoreCanvas`, `OpeningScreen`, `BiometricPad`, `HeaderHud`, `SidebarNav`).
- **Backend Proxy (`/web/server/index.js`)**: Express 4 app factored into `createApp(options)` + exported `app` (Vercel compatible) and standalone `0.0.0.0:$PORT` HTTP listener (Cloud Run compatible). Keeps `GEMINI_API_KEY` and `APP_ACCESS_TOKEN` strictly server-side.
- **Root Cause of `ais-pre-*.asia-northeast1.run.app` 404**:
  1. The AI Studio workspace is configured as an **Android** applet (root `build.gradle.kts`, `app/`, `metadata.json`), so AI Studio's hosted preview container runs the Android build/emulator environment rather than `web/server/index.js`.
  2. When deploying `/web` independently to Google Cloud Run, `web/Dockerfile` originally omitted `src/services` in the runner image (fixed) and `/web/server/index.js` needed explicit static MIME/404 guards and `trust proxy` + `pushState` SPA routing in `App.tsx` (all fixed and locally verified).

---

## 3. Final Feature Classification Matrix

| Feature | Classification | Notes |
| --- | --- | --- |
| Multi-Session Neural Chat + Streaming (`AiChatScreen` / `ChatView`) | **Fully implemented and tested** | Markdown rendering, code copy, regenerate, stop generation, edit/resend, Room & localStorage persistence |
| Document & Image Multimodal Q&A | **Fully implemented and tested** | Images, PDF, and text files via `/api/chat/multimodal` & Android `AiRepository`; persisted attachment metadata (Room v4) |
| Long-Term Memory Vault & Auto-Extraction + Deduplication | **Fully implemented and tested** | Token Jaccard + substring deduplication verified by unit tests on both Android and Web |
| Smart Natural-Language Reminders & Tasks | **Fully implemented and tested** | Deterministic parser + Gemini JSON parser; Android `AlarmManager` + `ReminderBroadcastReceiver`; browser notifications |
| Daily Executive Briefing (Dashboard) | **Fully implemented and tested** | Open-Meteo live weather telemetry (with New York fallback), pending tasks count, battery/link status, 1-hour cache |
| Multi-Agent Hub & Custom Agents + Keyword Routing | **Fully implemented and tested** | Built-in personas + user-defined agents (`CustomAgentEntity` / `localStorage`) with color & trigger keywords |
| Usage & Insights Analytics Dashboard | **Fully implemented and tested** | Android Jetpack Compose `Canvas` charts + Web pure-SVG 7-day bar, agent distribution, task donut, modality split |
| Settings & Vault Backup Export/Import (JSON & Markdown) | **Fully implemented and tested** | Jetpack DataStore (Android) & `localStorage` + `sessionStorage` token (Web); validated import preview with dedupe |
| Music Studio (`MusicStudioView` / Lyria routes) | **Requires API credentials** | Web audio playback & queue work; `/api/music/generate` requires a valid `GEMINI_API_KEY` with Lyria model access |
| Gemini Cloud AI Generation & Web Search Grounding | **Requires API credentials** | Requires `GEMINI_API_KEY` configured in AI Studio Secrets (Android) or server env / Cloud Run Secret Manager (Web) |
| External Plugins (GitHub / Trello / Home Assistant Bridges) | **Requires API credentials** | Outbound bridges require user-supplied endpoints/tokens |
| Android Calendar Provider / Email Sending / LinkedIn / Wikipedia | **Not implemented** | No `READ_CALENDAR` permission or external Wikipedia/LinkedIn/SMTP client bundled; avoids spoofed/mock claims |
| Direct Cloud Run Deploy from Sandbox | **Platform restricted** | Sandbox has no user Cloud credentials/repo push access; verified locally on `0.0.0.0:8081` with full `gcloud` deploy guide provided |

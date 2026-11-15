# Changelog — JARVIS AI (Release 3.0)

## [3.0.0] — Features 1–12, Cloud Run Deployment Hardening & Full Test Suite

### Added — Android (`/app`) & Web (`/web`) Productivity, AI & UX
- **Multi-Session Chat & Persistence**: Room `chat_sessions` (v2) + `localStorage` multi-session sidebar drawer, session search, create/rename/delete, and empty/loading states.
- **Settings Persistence**: Jetpack DataStore (`SettingsPreferences`) on Android and `localStorage` preferences + `sessionStorage` optional access token on Web (language, AI agent, voice selection/speed/pitch, auto-speak, web search toggle, memory extraction toggle, accent color, API connection status).
- **Rich Chat Controls**: Markdown rendering, syntax-highlighted code blocks with copy button, regenerate reply, edit & resend prompt, and stop generation / abort stream.
- **Auto Memory Extraction + Deduplication**: Automated durable-fact extraction (`MemoryDeduplicator.kt` / `memoryDedupe.js`) with toast notification & 1-click Undo.
- **Hands-Free Continuous Voice & Local Commands**: Auto-restarting voice loop with `VoiceCommandParser.kt` & `voiceCommands.ts` for instant offline/local controls (`stop`, `open security`, `toggle lockdown`, `what's my battery`, `new chat`).
- **Smart Natural-Language Reminders**: Deterministic + Gemini JSON parser (`ReminderParser.kt` / `reminderParser.js`) scheduling real Android `AlarmManager` + `ReminderBroadcastReceiver` notifications (Room v3 `triggerAtMillis`) and browser notifications.
- **Vault Export & Validated Import**: JSON (`jarvis_backup_v1`) and Markdown backup generation plus schema-validated JSON import preview with duplicate skipping (`JarvisBackupManager.kt` / `backup.ts`).
- **Document & Image Q&A (Multimodal)**: Image, PDF, and text attachment upload & analysis via Gemini on Android (Room v4 attachment columns) and Express `/api/chat/multimodal`.
- **Daily Executive Briefing Card**: Greeting, pending tasks count, live Open-Meteo weather telemetry (with New York fallback), battery/link summary, AI status remark, Refresh, and Read Aloud with 1-hour caching (`briefing.ts`, `/api/briefing`, `MainDashboardScreen.kt`).
- **Custom Agents & Auto-Routing**: Create, edit, and delete custom agents with color picker and comma-separated keyword triggers (`CustomAgentEntity` / Room v5 + `MultiAgentScreen.kt` / `MultiAgentView.tsx`), integrated into chat agent bars.
- **Usage & Insights Dashboard**: KPI tiles and data visualizations using Jetpack Compose `Canvas` (`InsightsScreen.kt`) on Android and pure SVG charts (`InsightsView.tsx`) on Web (7-day activity, agent distribution, task completion donut, voice/text split).

### Security & Cloud Run / GitHub Pages Fixes
- Added `express-rate-limit` (**30 req/min/IP**) and `trust proxy = 1` on `/api/*`.
- Enforced `MAX_PROMPT_CHARS = 8000` validation across all text/multimodal/briefing/reminder/vision/music endpoints.
- Added optional `APP_ACCESS_TOKEN` Bearer auth check using constant-time `crypto.timingSafeEqual`.
- Fixed `/web/Dockerfile` runner stage to include `src/services` alongside `dist/` and `server/`.
- Added `window.history.pushState` / `popstate` SPA routing in `/web/src/App.tsx`, `/favicon.ico` `204` response, and strict `404` for missing `/assets/*` files in `/web/server/index.js`.
- Verified GitHub Pages workflow (`/.github/workflows/deploy-pages.yml`) with dynamic `VITE_BASE_PATH` and `404.html` SPA fallback.

### Upgraded — JARVIS Advanced Command Center Entry Interface (Web & Android)
- **Direct Command Center Entry**: Both Web (`/web/src/App.tsx`) and Android (`JarvisViewModel.kt`) now boot directly into the holographic **Command Center** (`DASHBOARD`), while preserving the **Biometric Lock Gate** (`OPENING`) via header/sidebar access.
- **Sidebar & Navigation**: Left navigation sidebar (desktop + mobile drawer on Web; `ModalNavigationDrawer` on Android) featuring `Command Center`, `AI Core`, `Agents`, `Tasks`, `Calendar`, `Memory`, `Conversations`, `Knowledge Base`, `Tools & Skills`, and `Workflows`, plus collapsible access to all preserved subsystems.
- **Top Header**: Live `SYSTEM STATUS`, auto-updating clock/date bar, interactive Search dialog/bar, Dashboard Layout switcher (`GRID` / `COMPACT` / `FOCUS` on Web), Notifications popover/dialog, Settings button, and `SIR` Operator Profile.
- **Holographic Hero & Telemetry Panels**: Centered glowing `JARVIS / AI CORE` sphere (`QuantumCoreCanvas` / `NeuralIntelligenceCanvas`), `AI Core Overview`, 6 clickable `Active Agents`, `Quick Commands` (`Start New Task`, `Open Calendar`, `Start Voice Chat`, `Run Workflow`), `Live Intelligence Feed`, `Mission Timeline`, honest `System Monitor`, `Memory Insights`, `LLM Status` (`Gemini` live + 8 external providers marked `NOT CONFIGURED`), and sticky `Command Center Bottom Bar` with `AudioWaveVisualizer`, Mic toggle, `TALK TO JARVIS`, and `Executive Briefing`.

### Testing
- Added Web unit & security HTTP tests under `/web/tests/` (`node --test tests/*.test.mjs` — 13/13 passed).
- Added Android JUnit & Robolectric tests (`ReminderParserTest`, `MemoryDeduplicatorTest`, `VoiceCommandParserTest`, `JarvisBackupManagerTest`, `JarvisDatabaseMigrationTest`, `CommandCenterDashboardTest` — 18/18 passed).


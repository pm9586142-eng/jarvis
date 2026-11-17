# JARVIS AI — Bug Report & Verified Fixes

This document records reproducible bugs identified across the Android (`/app`) and Web/Cloud Run (`/web`) stacks and confirms the fixes applied.

---

## BUG-01: Cloud Run Runner Image Missing `src/services` (CRITICAL)
- **Location**: `/web/Dockerfile`
- **Root Cause**: `web/server/index.js` imports ES modules from `../src/services/memoryDedupe.js` and `../src/services/reminderParser.js`, but the multi-stage Docker `runner` stage only copied `dist/` and `server/`, causing Node startup failure (`ERR_MODULE_NOT_FOUND`) in containerized Cloud Run deployments.
- **Fix**: Added `COPY --from=builder /app/src/services ./src/services` to `/web/Dockerfile`.
- **Status**: Fixed and verified in Dockerfile configuration.

## BUG-02: Missing Browser History SPA Routing & Asset 404 Guard on Web Production Server
- **Location**: `/web/src/App.tsx`, `/web/server/index.js`, `/web/index.html`
- **Root Cause**: Navigating directly to subpaths such as `/chat`, `/dashboard`, or `/insights` or refreshing the browser reset to `/` or risked returning `index.html` for missing hashed JS/CSS bundle URLs; `/favicon.ico` also returned HTTP 404.
- **Fix**:
  - Implemented `resolveScreenFromLocation`, `window.history.pushState`, and `popstate` listeners in `/web/src/App.tsx` respecting `import.meta.env.BASE_URL`.
  - Updated `/web/server/index.js` to return `404 text/plain` for missing `/assets/*` and static file extensions, `204` for `/favicon.ico`, and `dist/index.html` (`Cache-Control: no-cache`) for valid SPA routes.
  - Added an inline SVG favicon in `/web/index.html`.
- **Status**: Fixed and verified live against Express on `0.0.0.0:8081` (HTTP 200 on `/`, `/dashboard`, `/chat`, `/insights`; 204 on `/favicon.ico`; 404 on `/assets/missing.js`).

## BUG-03: Deployment URL `ais-pre-vkejvbfeybbdvfbfhv46nz-251268482148.asia-northeast1.run.app` Returning 404
- **Location**: Workspace runtime configuration (`/` vs `/web`)
- **Root Cause**: The root workspace is configured as an Android Gradle project (`build.gradle.kts`, `/app`), not a Node.js web service, so the AI Studio preview container binds port `8080` to the Android tooling runtime rather than `/web/server/index.js`.
- **Fix**: Verified `/web/server/index.js` binds `0.0.0.0:${PORT || 8080}`, set `trust proxy`, verified all HTTP routes locally on `0.0.0.0:8081`, and documented the dedicated Cloud Run web deployment command (`gcloud run deploy jarvis-web --source .`).
- **Status**: Diagnosed accurately; `/web` Cloud Run server verified locally.

## BUG-04: Premature Candidate Slicing in Web Memory Deduplicator
- **Location**: `/web/src/services/memoryDedupe.js`
- **Root Cause**: `sanitizeExtractedCandidates()` truncated results with `.slice(0, 3)` *before* `filterUniqueMemories()` checked for duplicates. If the first 3 extracted candidates contained duplicates of existing facts, valid unique facts at index >= 3 were silently discarded.
- **Fix**: Returned the full sanitized candidate array from `sanitizeExtractedCandidates()` and enforced the maximum of 3 *accepted* unique items inside `filterUniqueMemories()`, aligning behavior with Android's `MemoryDeduplicator.kt`.
- **Status**: Fixed and verified with `node --test`.

## BUG-05: Missing Security Hardening Controls on Express `/api/*` Endpoints
- **Location**: `/web/server/index.js`, `/web/src/services/api.ts`
- **Root Cause**: Server endpoints lacked IP-based rate limiting, had no unified `8000`-character prompt limit across routes, and had no optional shared-secret `APP_ACCESS_TOKEN` Bearer gate or reverse-proxy `trust proxy` configuration.
- **Fix**: Added `express-rate-limit` (30 req/min/IP returning HTTP 429 `RATE_LIMITED`), `MAX_PROMPT_CHARS = 8000` check returning HTTP 400 `PROMPT_TOO_LONG`, constant-time `crypto.timingSafeEqual` Bearer token verification (`APP_ACCESS_TOKEN`), non-sensitive HTTP access logging, and `sessionStorage` token support in Web settings.
- **Status**: Fixed and verified by automated HTTP tests in `/web/tests/serverSecurity.test.mjs`.

## BUG-06: Android Kotlin Compilation Errors in Features 9–11
- **Location**: `/app/src/main/java/com/example/ui/screens/AiChatScreen.kt`, `/app/src/main/java/com/example/ui/screens/InsightsScreen.kt`
- **Root Cause**: Missing `androidx.compose.ui.graphics.Color` import in `AiChatScreen.kt` for custom agent tabs, and reference to non-existent `AtmosphericVioletBright` instead of `SynapticSpark` from `Color.kt` in `InsightsScreen.kt`.
- **Fix**: Added `Color` import in `AiChatScreen.kt` and replaced `AtmosphericVioletBright` with `SynapticSpark` in `InsightsScreen.kt`.
- **Status**: Fixed; Android debug APK compilation (`compile_applet`) succeeded cleanly.

## BUG-07: Room Database Test Failures & Migration Safety Verification
- **Location**: `/app/src/test/java/com/example/JarvisDatabaseMigrationTest.kt`
- **Root Cause**: Initial test draft referenced non-existent `upsert`/`getAllSessions`/`getAllMessages` method names instead of actual DAO methods (`insert`/`getAll`).
- **Fix**: Aligned test calls with `ChatSessionDao`, `ConversationDao`, `MemoryDao`, `TaskDao`, and `CustomAgentDao` signatures and validated full `v1 -> v2 -> v3 -> v4 -> v5` schema migrations.
- **Status**: Verified against `gradle :app:testDebugUnitTest`.

---

## Follow-up Audit & GitHub Archive Smart Merge (2026-11-17)

### BUG-08: Multi-Stage Cloud Run Dockerfile Optimization
- **Location**: `/web/Dockerfile`
- **Root Cause**: Earlier container build ran `npm ci` twice across stages instead of pruning dev dependencies cleanly from the builder stage, and needed explicit documentation for standalone container runs.
- **Fix**: Updated `/web/Dockerfile` to install locked dependencies once (`npm ci`), build the Vite bundle, prune dev dependencies (`npm prune --omit=dev`), copy production `node_modules`, `dist/`, `server/`, and `src/services/` into the slim Node 22 runtime stage, and retain `CMD ["node", "server/index.js"]` for clean `SIGTERM` shutdown in Cloud Run.
- **Status**: Fixed and documented in `README.md` and `web/README.md`.

### BUG-09: Voice Formatter Unit Test Imported TypeScript Directly in Node
- **Location**: `/web/tests/voiceAssistant.test.mjs`, `/web/src/services/speechFormatter.js`, `/web/src/services/speechFormatter.d.ts`, `/web/src/services/voice.ts`
- **Root Cause**: `web/tests/voiceAssistant.test.mjs` imported `speechFormatter.ts` directly, which fails under Node 20 without experimental type-stripping flags.
- **Fix**: Migrated the pure formatter implementation to standard ESM JavaScript (`speechFormatter.js`) with companion TypeScript declarations (`speechFormatter.d.ts`), removed `speechFormatter.ts`, and updated imports in `voice.ts` and `voiceAssistant.test.mjs`.
- **Status**: Fixed and verified cleanly under `npm --prefix web run typecheck`, `npm --prefix web run build`, and `npm --prefix web test` (48/48 passing).

### BUG-10: Generic Gemini HTTP 429 Error Messaging, Retry Storms & Duplicate Requests
- **Location**: `/web/src/services/brainEngine.js`, `/web/server/geminiRetry.js`, `/web/server/index.js`, `/web/src/services/api.ts`, `/web/src/views/ChatView.tsx`, `/app/src/main/java/com/example/ai/JarvisBrainEngine.kt`, `/app/src/main/java/com/example/ai/GeminiBackoffPolicy.kt`, `/app/src/main/java/com/example/ai/AiRepository.kt`, `/app/src/main/java/com/example/ui/JarvisViewModel.kt`
- **Root Cause**: All HTTP 429 responses collapsed into a generic quota string while discarding upstream `QuotaFailure`, `RetryInfo`, `ErrorInfo`, and `Retry-After` payloads; background calls (`/api/briefing`, `/api/memory/extract`) could also compound quota pressure.
- **Fix**: Added granular upstream inspection distinguishing **RPM**, **TPM**, **RPD**, **Billing / Zero Limit**, and **Spend Cap** while surfacing the verbatim Google error message alongside concise Google AI Studio Usage & Limits guidance on non-retryable quota errors; implemented strictly bounded exponential backoff (`max 2 retries` on temporary 429/503 only, `0` retries on RPD/Billing/Spend Cap/4xx); added single-flight caching, smart auto-memory gating, quota cooldown protection, and duplicate-submit guards.
- **Status**: Fixed and verified across Web (48/48 Node tests) and Android (`compile_applet` + `gradle :app:testDebugUnitTest`).

### BUG-11: Duplicate `setAutoSpeakDailySummary` Declaration Caught in Uploaded Archive
- **Location**: `/app/src/main/java/com/example/data/preferences/JarvisPreferencesRepository.kt`
- **Root Cause**: The external follow-up ZIP archive contained two identical `suspend fun setAutoSpeakDailySummary(enabled: Boolean)` definitions in `JarvisPreferencesRepository.kt`, which would fail Kotlin compilation with conflicting overloads.
- **Fix**: Preserved the clean single declaration during the smart merge and verified full Android compilation.
- **Status**: Prevented and verified via `compile_applet`.

# JARVIS AI — Follow-up Fixes & GitHub Archive Smart Merge

This summary records the verified smart merge of follow-up fixes from `https://github.com/pm9586142-eng/jarvis` (`JARVIS-AI-FINAL-AI-STUDIO.zip`) into the live JARVIS AI workspace while preserving the newer Gemini quota, exponential backoff, and duplicate-request prevention architecture.

## Changes Merged & Preserved

1. **Optimized Multi-Stage Cloud Run Container (`web/Dockerfile`)**:
   - Uses Node 22 Alpine with a single locked `npm ci`, builds the Vite production SPA, runs `npm prune --omit=dev`, and ships only production `node_modules`, `dist/`, `server/`, and `src/services/` into the runtime image with `CMD ["node", "server/index.js"]` for clean `SIGTERM` handling.
2. **Pure ESM Voice Speech Formatter (`web/src/services/speechFormatter.js` + `speechFormatter.d.ts`)**:
   - Replaced `speechFormatter.ts` with pure ESM JavaScript plus companion TypeScript declarations and updated imports in `web/src/services/voice.ts` and `web/tests/voiceAssistant.test.mjs`, enabling Node 20+ native `node --test` execution without experimental TypeScript flags.
3. **Granular Gemini Quota Diagnostics, Verbatim Upstream Messages & Bounded Backoff (Web & Android)**:
   - Preserved full upstream `QuotaFailure`, `RetryInfo`, `ErrorInfo`, and `Retry-After` extraction distinguishing **RPM**, **TPM**, **RPD**, **Billing / Zero Quota (`limit: 0`)**, and **Spend Cap** while displaying Google's verbatim error message and diagnostic UI badges.
   - Enriched non-retryable quota categories (`RPD`, `BILLING`, `SPEND_CAP`) with concise operator guidance directing to Google AI Studio Usage & limits, project/billing tier, spend cap settings, or daily quota reset.
   - Preserved strictly bounded exponential backoff (`max 2 retries` on temporary 429/503 only, `0` retries on RPD/Billing/Spend Cap/4xx), single-flight `/api/briefing` & `/api/memory/extract` caching, smart `shouldAutoExtractMemories` gating, quota cooldown protection, and double-submit locks.
4. **Prevented Archive Regression in Android Preferences**:
   - Skipped a duplicate `setAutoSpeakDailySummary` method found inside the external archive's `JarvisPreferencesRepository.kt` that would otherwise fail Kotlin compilation.
5. **Workspace Hygiene**:
   - Removed the stale uploaded `JARVIS-AI-FINAL-AI-STUDIO.zip` archive after completing the merge so builds, exports, and GitHub pushes stay lean.

## Before Deployment
- Configure `GEMINI_API_KEY` in Google AI Studio Secrets (or your hosting provider's secret manager). Never commit a real API key or expose it in any `VITE_*` variable.
- `GEMINI_MODEL` defaults to `gemini-3.8-flash`.
- If `APP_ACCESS_TOKEN` is enabled on the backend, enter the same Bearer token in JARVIS Web Settings.
- Provider-side Gemini quota limits cannot be bypassed by application code; check Google AI Studio Usage & limits if non-retryable quota errors persist.

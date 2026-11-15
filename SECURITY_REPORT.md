# JARVIS AI — Security Assessment & Hardening Report

## 1. Secret Management & Key Isolation
- **Server-Side Gemini Key (`/web/server/index.js`)**: `GEMINI_API_KEY` is read exclusively by Node/Express via `process.env.GEMINI_API_KEY`. No `VITE_GEMINI_API_KEY` or server secret is bundled into `web/dist/`.
- **Optional Shared Access Gate (`APP_ACCESS_TOKEN`)**:
  - When `APP_ACCESS_TOKEN` is set (and not `UNSET`), every `/api/*` request requires `Authorization: Bearer <token>`.
  - Token comparison uses fixed-length `Buffer` + `crypto.timingSafeEqual` to mitigate timing side-channel leaks; unauthorized requests fail closed with HTTP `401` (`{ code: "UNAUTHORIZED" }`).
  - On the Web client, any operator-entered access token is stored strictly in `window.sessionStorage` (never written into `localStorage` or Vite build-time env vars).
- **Android BuildConfig & Secrets**: API keys and optional `BACKEND_URL` / `APP_ACCESS_TOKEN` remain parameterized via `.env.example` / `.env` and Gradle Secrets Plugin (`BuildConfig`) rather than hardcoded literals.

## 2. API Input Validation, Rate Limiting & Payload Protection
- **Rate Limiting**: `express-rate-limit` is mounted on `/api/*` at **30 requests / minute / IP** (`standardHeaders: true`, HTTP `429 RATE_LIMITED`), with `expressApp.set('trust proxy', 1)` enabled so Google Cloud Run and Vercel forwarding headers (`X-Forwarded-For`) resolve client IPs accurately.
- **Prompt Length Cap**: Enforced `MAX_PROMPT_CHARS = 8000` (`isPromptTooLong`) on:
  - `POST /api/chat/stream`
  - `POST /api/chat/multimodal`
  - `POST /api/memory/extract`
  - `POST /api/reminders/parse`
  - `POST /api/briefing`
  - `POST /api/vision`
  - `POST /api/music/generate`
  - Oversized prompts immediately return HTTP `400` (`{ code: "PROMPT_TOO_LONG" }`).
- **Payload & JSON Guards**: `express.json({ limit: '15mb' })` paired with structured `413 PAYLOAD_TOO_LARGE` and `400 BAD_JSON` handlers, plus MIME allow-list (`image/*`, `application/pdf`, `text/*`) and base64 byte-size checks (4 MB serverless / 12 MB container) on `/api/chat/multimodal`.
- **Non-Sensitive Logging**: Middleware logs only `[HTTP] METHOD PATH -> STATUS (DURATIONms)` for `/api/*` and `/health`—request bodies, prompts, tokens, and API keys are never logged.

## 3. CORS & Static Hosting Security
- **CORS (`cors` middleware)**: Configurable via `CORS_ORIGIN` (comma-separated allowlist for production GitHub Pages / Netlify / Firebase Hosting domains, or `*` for open testing), restricted to `['GET', 'POST', 'OPTIONS']` and `['Content-Type', 'Authorization']` headers.
- **Static Asset Integrity**: Missing `/assets/*` and static file extensions return `404 text/plain` rather than `index.html`, preventing browsers from interpreting HTML as executable JS MIME payloads.

## 4. Android Permissions & Storage Security
- **Least-Privilege Manifest (`AndroidManifest.xml`)**:
  - Install-time: `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`.
  - Runtime-gated in Compose: `RECORD_AUDIO`, `CAMERA`, `POST_NOTIFICATIONS`.
  - Broad media permissions (`READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`) are omitted in favor of `ActivityResultContracts.PickVisualMedia` and `OpenDocument`.
- **Data Integrity**: Room uses explicit schema migrations (`MIGRATION_1_2` through `MIGRATION_4_5`) with no destructive fallback; preferences reside in Jetpack `DataStore`.

## 5. Remaining Operational Hardening Notes
- **Rate Limiter Store**: `express-rate-limit` uses in-memory per-instance counters by default; across multi-instance autoscaled Cloud Run revisions, an external Redis store would be required for global cross-instance quota enforcement.
- **Production `CORS_ORIGIN` & `APP_ACCESS_TOKEN`**: Always restrict `CORS_ORIGIN` to the deployed frontend origin(s) and set `APP_ACCESS_TOKEN` in Cloud Run Secrets before exposing a public backend URL widely.

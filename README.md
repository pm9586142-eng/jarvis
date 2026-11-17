# JARVIS AI (Release 3.0)

Dual-platform AI command workspace featuring a native **Android** application (`/app`) built with **Kotlin, Jetpack Compose, Room, and DataStore**, paired with a **Web + Express** platform (`/web`) built with **React 19, TypeScript, Vite 6, Tailwind CSS v4, Express 4, and `@google/genai`**.

---

## 1. Repository Architecture

```text
.
├── app/                         # Android Kotlin + Jetpack Compose + Room v5 app
│   ├── src/main/java/com/example/
│   │   ├── ai/AiRepository.kt
│   │   ├── agents/JarvisAgent.kt
│   │   ├── data/                # Room entities, DAOs, migrations v1→v5, DataStore, JSON/MD backup
│   │   ├── productivity/        # ReminderParser, AlarmManager scheduler & receiver
│   │   ├── ui/                  # ViewModel + 13 Compose HUD screens (incl. InsightsScreen)
│   │   └── voice/               # SpeechRecognizer + TTS + local VoiceCommandParser
│   └── src/test/java/com/example/
│       ├── ExampleRobolectricTest.kt
│       ├── ExampleUnitTest.kt
│       ├── JarvisBackupManagerTest.kt
│       ├── JarvisDatabaseMigrationTest.kt
│       ├── MemoryDeduplicatorTest.kt
│       ├── ReminderParserTest.kt
│       └── VoiceCommandParserTest.kt
├── web/                         # React + Vite SPA + Express Gemini proxy
│   ├── server/index.js          # Rate limit (30/min/IP), 8000-char cap, optional APP_ACCESS_TOKEN, SSE & SPA host
│   ├── src/                     # 15 HUD views, pure-SVG Insights, Daily Briefing, Custom Agents
│   ├── tests/                   # Node built-in test suite (tests/*.test.mjs)
│   └── Dockerfile               # Google Cloud Run multi-stage container build
├── .github/workflows/
│   └── deploy-pages.yml         # GitHub Pages SPA build + 404.html fallback
├── PROJECT_AUDIT.md
├── BUG_REPORT.md
├── TEST_REPORT.md
├── SECURITY_REPORT.md
└── CHANGELOG.md
```

---

## 2. Environment Variables & Secrets

- **Android (`.env` via Secrets Gradle Plugin / AI Studio Secrets panel — see `.env.example`)**:
  - `GEMINI_API_KEY` — Gemini key injected at build time via `BuildConfig` (keep out of source control).
  - `GEMINI_MODEL` — Defaults to `gemini-3.8-flash`.
  - `BACKEND_URL` — Optional HTTPS URL of your deployed `/web` Express server (keeps `GEMINI_API_KEY` off the APK when set).
  - `APP_ACCESS_TOKEN` — Optional shared Bearer token matching the Express server.
- **Web (`web/.env` — see `web/.env.example`)**:
  - `GEMINI_API_KEY` — Server-only Gemini API key.
  - `GEMINI_MODEL` — Defaults to `gemini-3.8-flash`.
  - `PORT` — HTTP port (`8080` in Cloud Run production, `3001` in local dev proxy).
  - `CORS_ORIGIN` — Comma-separated allowed browser origins or `*`.
  - `APP_ACCESS_TOKEN` — Optional server-side Bearer token protecting `/api/*`.
  - `VITE_API_BASE_URL` — Public HTTPS backend URL when hosting static frontend separately (GitHub Pages / Netlify / Firebase Hosting).

---

## 3. Running & Building

### Android (`/app`)
```bash
# Build debug APK (in AI Studio container, use `gradle` rather than `./gradlew`)
gradle assembleDebug

# Run unit + Robolectric tests
gradle :app:testDebugUnitTest
```

### Web & Express (`/web`)
```bash
cd web
npm install
npm run dev          # Local Vite (:5173) + Express API (:3001)
npm run typecheck    # TypeScript check
npm run build        # Production SPA bundle -> web/dist/
npm test             # Unit & Express security tests
PORT=8080 npm start  # Serve production SPA + API on http://0.0.0.0:8080
```

---

## 4. Deployment & Troubleshooting `404` URLs

### Why `https://ais-pre-*.asia-northeast1.run.app` Can Return 404
This root workspace is configured as an **Android** AI Studio project (`build.gradle.kts`, `/app`), so AI Studio's preview runtime binds container port `8080` to the Android build/emulator environment rather than `/web/server/index.js`. To access the Web HUD over a dedicated public HTTPS URL, deploy `/web` directly to **Google Cloud Run** (full-stack) or **GitHub Pages** (static frontend + Cloud Run backend).

### A. Google Cloud Run (`/web` Full-Stack Container)
`web/Dockerfile` builds `dist/` and copies `server/` + `src/services/` into a production Node 22 container listening on `0.0.0.0:$PORT`:

```bash
cd web
gcloud run deploy jarvis-web \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_MODEL=gemini-3.8-flash,CORS_ORIGIN=*" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

After deployment, `/`, direct routes (`/chat`, `/dashboard`, `/insights`, `/settings`), `/health`, and `/api/*` are served over HTTPS from the returned `*.run.app` URL.

### B. GitHub Pages (Static Frontend Only)
`/.github/workflows/deploy-pages.yml` builds `/web/dist` with dynamic subpath `VITE_BASE_PATH` and generates `dist/404.html` for SPA refresh support.
- Set the repository variable `VITE_API_BASE_URL` to your Cloud Run HTTPS URL so AI chat, memory extraction, briefing, vision, and music endpoints connect cleanly.

---

## 5. Permissions Summary

- **Android (`AndroidManifest.xml`)**:
  - Install-time: `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`.
  - Runtime (requested in Compose when triggered): `RECORD_AUDIO`, `CAMERA`, `POST_NOTIFICATIONS`.
  - Zero storage permissions (`PickVisualMedia` / `OpenDocument` used for images & PDF/text attachments).
- **Web Browser**: Microphone (optional voice/STT), Camera (optional Vision Scanner), Geolocation (optional Open-Meteo local weather; falls back to New York coordinates), Notifications (optional reminder alerts).

---

## 6. Documentation Index
- [`PROJECT_AUDIT.md`](./PROJECT_AUDIT.md) — Architecture & Release 3.0 feature status classification
- [`BUG_REPORT.md`](./BUG_REPORT.md) — Verified bugs & Cloud Run/SPA fixes
- [`TEST_REPORT.md`](./TEST_REPORT.md) — Android, Robolectric, Web, and production server test outputs
- [`SECURITY_REPORT.md`](./SECURITY_REPORT.md) — API rate limiting, token auth, prompt caps & permission controls
- [`CHANGELOG.md`](./CHANGELOG.md) — Release 3.0 summary
- [`FIXES_APPLIED.md`](./FIXES_APPLIED.md) — Follow-up smart-merge fixes and verified deployment notes
- [`web/README.md`](./web/README.md) — Web-specific setup and deployment details

### Docker Local Test Build
`web/Dockerfile` provides a multi-stage Node 22 production container for Cloud Run (single `npm ci`, Vite build, `npm prune --omit=dev`, slim runtime with `dist/`, `server/`, and `src/services/`):

```bash
cd web
docker build -t jarvis-web .
docker run --rm -p 8080:8080 -e GEMINI_API_KEY="$GEMINI_API_KEY" jarvis-web
```

Keep `GEMINI_API_KEY` and `APP_ACCESS_TOKEN` in your hosting provider's secret manager; never commit a real `.env` file.

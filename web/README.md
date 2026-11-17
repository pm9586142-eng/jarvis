# JARVIS Cosmic Intelligence — Web Application

Full-stack browser interface for **JARVIS AI**, built with **React 19 + TypeScript + Vite 6 + Tailwind CSS v4** on the frontend and an **Express 4 + `@google/genai` (Gemini 3.8)** backend proxy that keeps `GEMINI_API_KEY` and `APP_ACCESS_TOKEN` strictly on the server.

---

## 1. Project Folder Structure

```text
web/
├── api/
│   └── index.js                # Vercel serverless Express export
├── server/
│   ├── geminiRetry.js          # Bounded exponential backoff & quota cooldown tracker
│   └── index.js                # Production Express API, security middleware, SSE streaming & SPA host
├── src/
│   ├── components/
│   │   ├── AudioWaveVisualizer.tsx
│   │   ├── BiometricPad.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── HeaderHud.tsx
│   │   ├── OpeningScreen.tsx
│   │   ├── QuantumCoreCanvas.tsx
│   │   └── SidebarNav.tsx
│   ├── data/
│   │   └── agents.ts           # Built-in agents + custom agent keyword matcher + languages
│   ├── services/
│   │   ├── api.ts              # /health, SSE streaming, multimodal, briefing, memory & reminder APIs
│   │   ├── backup.ts           # Validated JSON & Markdown vault export/import
│   │   ├── briefing.ts         # Daily Briefing generator + Open-Meteo weather telemetry (1h cache)
│   │   ├── memoryDedupe.js     # Jaccard + substring memory deduplication
│   │   ├── plugins.ts          # External plugin bridges
│   │   ├── reminderParser.js   # Natural-language smart reminder parser
│   │   ├── security.ts         # Browser security posture & DEFCON audit
│   │   ├── speechFormatter.js  # Pure ESM speech formatter + .d.ts declarations (Node 20+ native test safe)
│   │   ├── storage.ts          # localStorage vault (sessions, memories, tasks, custom agents, settings)
│   │   ├── telemetry.ts        # Browser telemetry & CLI execution
│   │   ├── voice.ts            # Web Speech Recognition (STT), TTS & AudioContext visualizer
│   │   └── voiceCommands.ts    # Instant local hands-free voice command triggers
│   ├── views/
│   │   ├── ChatView.tsx
│   │   ├── DashboardView.tsx
│   │   ├── InsightsView.tsx
│   │   ├── MemoryVaultView.tsx
│   │   ├── MultiAgentView.tsx
│   │   ├── MusicStudioView.tsx
│   │   ├── OrbitalGameView.tsx
│   │   ├── PluginsView.tsx
│   │   ├── ProductivityView.tsx
│   │   ├── SecurityView.tsx
│   │   ├── SettingsView.tsx
│   │   ├── SmartHomeView.tsx
│   │   ├── TelemetryCliView.tsx
│   │   ├── VisionScannerView.tsx
│   │   └── VoiceHudView.tsx
│   ├── App.tsx                 # Browser History (pushState / popstate) SPA router & HUD state
│   └── main.tsx
├── tests/
│   ├── memoryDedupe.test.mjs
│   ├── reminderParser.test.mjs
│   └── serverSecurity.test.mjs
├── Dockerfile                  # Cloud Run multi-stage container build (dist + server + src/services)
├── .env.example
└── vite.config.ts
```

---

## 2. Environment Variables

Copy `.env.example` to `.env` inside `web/`:

```env
GEMINI_API_KEY=your_real_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
PORT=8080
CORS_ORIGIN=*
APP_ACCESS_TOKEN=
VITE_API_BASE_URL=
```

- `GEMINI_API_KEY` and `APP_ACCESS_TOKEN` are **server-only** variables—never prefix them with `VITE_`.
- When `APP_ACCESS_TOKEN` is configured on the server, open **Settings → API Connection & Security** in the Web HUD to enter the matching Bearer token (stored in `sessionStorage` for the browser session).

---

## 3. Local Development & Verification

```bash
cd web
npm install
npm run dev          # Vite (:5173) + Express dev API (:3001)
```

Production build, typecheck, and test suite:

```bash
cd web
npm run typecheck
npm run build
npm test             # Node built-in test runner (tests/*.test.mjs)
PORT=8080 npm start  # Serves dist/ SPA + /api/* + /health on 0.0.0.0:8080
```

---

## 4. Deployment Guides

### A. Google Cloud Run (Full-Stack Container — Single HTTPS URL)
The included multi-stage `Dockerfile` installs dependencies once, builds the Vite SPA, prunes dev dependencies, and runs the Express server directly via `node server/index.js` on Cloud Run's injected `PORT` (defaulting to `8080`). Deploy `web/` directly so Cloud Run builds `Dockerfile` and serves both the React SPA (`/`, `/dashboard`, `/chat`, `/insights`, etc.) and Express `/api/*`:

```bash
cd web
gcloud run deploy jarvis-web \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_MODEL=gemini-3.8-flash,CORS_ORIGIN=*" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

### B. GitHub Pages (Static Frontend Only)
`/.github/workflows/deploy-pages.yml` automatically sets `VITE_BASE_PATH` to the repository subpath and copies `dist/index.html` to `dist/404.html` so direct URLs and browser refreshes work on GitHub Pages.
- Because GitHub Pages cannot host Express/Node.js backends, deploy `/web` to Cloud Run (or Vercel) first and set the GitHub repository Variable **`VITE_API_BASE_URL`** to your Cloud Run HTTPS URL.

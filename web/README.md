# JARVIS Cosmic Intelligence — Web Application

Complete full-stack browser conversion of the **JARVIS AI** Android application, built with **React 19 + TypeScript + Vite + Tailwind CSS v4** on the frontend and an **Express + `@google/genai` (Gemini 2.5)** backend proxy that keeps `GEMINI_API_KEY` strictly on the server.

---

## 1. Project Folder Structure

```text
web/
├── api/
│   └── index.js                # Vercel serverless Express export
├── server/
│   └── index.js                # Production Express API + SSE streaming + SPA host
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
│   │   └── agents.ts           # JARVIS, VERONICA, DUM-E, FRIDAY, HOMER & languages
│   ├── services/
│   │   ├── api.ts              # /health check, SSE chat stream, /api/vision client
│   │   ├── plugins.ts          # Trello Kanban, GitHub & Home Assistant plugin bridges
│   │   ├── security.ts         # Browser security posture & DEFCON audit
│   │   ├── storage.ts          # localStorage vault (memories, tasks, logs, settings)
│   │   ├── telemetry.ts        # Navigator, Battery, Heap & CLI execution
│   │   └── voice.ts            # Web Speech Recognition (STT), TTS & AudioContext RMS
│   ├── styles/
│   │   └── index.css
│   ├── types/
│   │   └── jarvis.ts
│   ├── views/
│   │   ├── ChatView.tsx
│   │   ├── DashboardView.tsx
│   │   ├── MemoryVaultView.tsx
│   │   ├── MultiAgentView.tsx
│   │   ├── PluginsView.tsx
│   │   ├── ProductivityView.tsx
│   │   ├── SecurityView.tsx
│   │   ├── SettingsView.tsx
│   │   ├── SmartHomeView.tsx
│   │   ├── TelemetryCliView.tsx
│   │   ├── VisionScannerView.tsx
│   │   └── VoiceHudView.tsx
│   ├── App.tsx
│   └── main.tsx
├── .dockerignore
├── .env.example
├── Dockerfile                  # Cloud Run multi-stage container build
├── firebase.json               # Firebase Hosting SPA rewrite config
├── index.html
├── netlify.toml                # Netlify SPA build & routing config
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json                 # Vercel SPA + /api rewrite config
└── vite.config.ts
```

---

## 2. Environment Variables Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cd web
   cp .env.example .env
   ```
2. Set your Google Gemini API key in `.env`:
   ```env
   GEMINI_API_KEY=your_real_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   PORT=8080
   CORS_ORIGIN=*
   ```
   > `GEMINI_API_KEY` is read **only by the Node/Express server (`server/index.js`)** and is never bundled into the React client.

---

## 3. Run Locally

```bash
cd web
npm install
npm run dev
```

- Frontend (Vite dev server): `http://localhost:5173` (proxies `/api` and `/health` to `:3001`)
- Backend (Express dev API): `http://localhost:3001` (production `npm start` and Cloud Run use `PORT` / `8080`)

---

## 4. Production Build & Verify Locally

```bash
cd web
npm run typecheck
npm run build
npm start
```

Open `http://localhost:8080` in Chrome, Edge, or Firefox.

---

## 5. Deployment Guides

### A. Google Cloud Run (Recommended Full-Stack Container)
```bash
cd web
gcloud run deploy jarvis-cosmic-web \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_MODEL=gemini-2.5-flash" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

### B. Vercel (Frontend + Serverless Express `/api`)
1. Import the `web/` directory as the Root Directory in Vercel.
2. `vercel.json` automatically builds `dist/` and routes `/api/*` and `/health` through `api/index.js`.
3. Add `GEMINI_API_KEY` in Vercel Project Settings → Environment Variables.

### C. Netlify / Firebase Hosting (Static Frontend + Cloud Run Backend — `VITE_API_BASE_URL` Required)
- `netlify.toml` and `firebase.json` configure the static Vite SPA build (`dist/`), and `netlify.toml` explicitly excludes `/api/*` from rewriting to `index.html`.
- Because **Netlify** and **Firebase Hosting** only serve static frontend assets (`dist/`) and do not run the Express backend, **both Netlify and Firebase Hosting require `VITE_API_BASE_URL`** to be set at build time (for example, `VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_URL`).
- Deploy the backend container (`web/`) to Google Cloud Run first, then set `VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_URL` when building/deploying to Netlify or Firebase Hosting, and configure `CORS_ORIGIN` on Cloud Run to your hosting domain so `GEMINI_API_KEY` remains strictly server-side.

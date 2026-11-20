# AM AI (JARVIS) — Deployment & Verification Guide

## 1. Local Full-Stack Development

```bash
cd web
cp .env.example .env
# Edit web/.env and add at least GEMINI_API_KEY (plus optional GROQ_API_KEY, OPENROUTER_API_KEY, etc.)
npm install
npm run dev
```

- Frontend Vite dev server: `http://localhost:5173`
- Backend Express API proxy: `http://localhost:3001`
- Health check: `GET http://localhost:3001/api/health`
- Multi-AI Brain status: `GET http://localhost:3001/api/brain/status`

---

## 2. Production Build & Preview Server

```bash
cd web
npm run typecheck
npm test
npm run build
PORT=3000 node server/index.js --preview
```

`server/index.js` serves both the built React SPA from `web/dist/` and all `/api/*` + `/api/brain/*` routes from a single origin.

---

## 3. Deploying to Vercel (GitHub → Vercel)

The repository includes `vercel.json` and `web/api/index.js` exporting the Express app for Vercel Serverless Functions.

1. Push the repository to GitHub.
2. Import the repository in **Vercel → New Project** and set **Root Directory** to `web`.
3. Set **Environment Variables** in Vercel Project Settings (Server-side only — never prefix secrets with `VITE_`):
   - `GEMINI_API_KEY` *(recommended primary)*
   - `GROQ_API_KEY` *(recommended free fallback #1)*
   - `OPENROUTER_API_KEY` *(recommended free fallback #2 — `:free` models only)*
   - Optional additional free providers: `MISTRAL_API_KEY`, `COHERE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `NVIDIA_API_KEY`, `SAMBANOVA_API_KEY`, `HUGGINGFACE_API_KEY`
   - `STRICT_ZERO_COST=true`
   - Optional: `APP_ACCESS_TOKEN` (if set, enter the matching Bearer token in **Settings → API Connection** in the HUD)
4. Deploy. Verify:
   - `GET https://<your-app>.vercel.app/api/health`
   - `GET https://<your-app>.vercel.app/api/brain/status`

> **Note on Vercel Serverless Persistence**: In-memory runtime stats (`UsageMonitor`, cooldown timers, and default in-memory workspace store) reset across serverless cold starts. Use **Settings → Export Backup** or **Shared Memory → Export JSON** for durable snapshots, and note that local `OLLAMA_BASE_URL` requires a self-hosted server reachable from your deployment.

---

## 4. Android Companion App Compatibility

The Android Kotlin/Compose app in `/app` connects seamlessly to the upgraded backend:
- Point `BACKEND_URL` in the Android environment / **Secrets panel in AI Studio** to your deployed HTTPS backend URL (e.g., your Vercel or Cloud Run URL).
- Do not hardcode provider API keys into Android source code or commit secrets to Git; configure secrets via the **Secrets panel in AI Studio**.
- The upgraded backend preserves 100% of existing `/api/health`, `/api/chat/stream`, `/api/memories`, `/api/tasks`, `/api/notes`, `/api/automations`, and `/api/workspace/sync` endpoints used by Android.

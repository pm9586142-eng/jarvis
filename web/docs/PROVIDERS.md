# Multi-AI Provider Registry & Strict `$0` Budget Guard

AM AI supports **11 built-in AI providers** plus **custom OpenAI-compatible endpoints**, governed by a strict server-side **`$0 / ₹0` zero-cost allowlist**.

---

## Provider Matrix

| # | Provider ID | Adapter Type | Server Env Variable(s) | Free Tier Status | Strict `$0` Mode |
|---|---|---|---|---|---|
| 1 | `gemini` | Google GenAI SDK | `GEMINI_API_KEY` | Free Tier (AI Studio) | Allowed (verified free models only) |
| 2 | `groq` | OpenAI-Compatible | `GROQ_API_KEY` | Free Developer Tier | Allowed (allowlisted free models) |
| 3 | `openrouter` | OpenAI-Compatible | `OPENROUTER_API_KEY` | Free `:free` Models | Allowed (live `$0.00` prompt & completion verified) |
| 4 | `mistral` | OpenAI-Compatible | `MISTRAL_API_KEY` | Experiment Free Tier | Allowed (allowlisted free models) |
| 5 | `cohere` | Cohere v2 REST | `COHERE_API_KEY` | Free Trial Key (rate-limited) | Allowed (trial allowlist) |
| 6 | `cloudflare` | Cloudflare Workers AI REST | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Free Daily Neurons | Allowed (free catalog) |
| 7 | `nvidia` | OpenAI-Compatible (NIM) | `NVIDIA_API_KEY` | Free Developer Credits | Allowed (free NIM catalog) |
| 8 | `sambanova` | OpenAI-Compatible | `SAMBANOVA_API_KEY` | Free Developer Tier | Allowed (free catalog, incl. DeepSeek R1 Distill) |
| 9 | `huggingface` | OpenAI-Compatible Router | `HUGGINGFACE_API_KEY` | Free Inference Credits | Allowed (open-weight catalog) |
| 10 | `ollama` | Local Ollama OpenAI-Compat | `OLLAMA_BASE_URL` | `$0` Local Hardware | Allowed (when server can reach Ollama host) |
| 11 | `deepseek` | OpenAI-Compatible | `DEEPSEEK_API_KEY` | **Paid Only (No Free Tier)** | **BLOCKED (`403` / `PAID_PROVIDER_BLOCKED`)** |

---

## Zero-Cost Enforcement Rules

1. **No Paid Fallback Ever**: Even when all configured free providers hit HTTP `429` rate limits, the router stops cleanly and asks the user to retry after cooldown instead of escalating to any paid model or enabling billing.
2. **DeepSeek Policy Transparency**: Direct `api.deepseek.com` is a paid-only API and is strictly blocked under `STRICT_ZERO_COST=true`. To run DeepSeek R1 open-weight models at `$0`, configure **SambaNova**, **NVIDIA NIM**, **Cloudflare Workers AI**, **OpenRouter `:free`**, or local **Ollama**.
3. **Live OpenRouter Pricing Verification**: Before executing any OpenRouter model, the backend verifies both `pricing.prompt === 0` and `pricing.completion === 0` against OpenRouter's model catalog and rejects non-`:free` or unknown paid IDs.
4. **Honest Connection State Machine**:
   - `UNCONFIGURED` — Required server env var is missing.
   - `UNTESTED` — Key is present, but no live connection probe has been run yet.
   - `CONNECTED` — Real live provider probe succeeded.
   - `COOLDOWN` — Temporarily cooling down after HTTP `429` / quota exhaustion.
   - `AUTH_ERROR` / `ERROR` — Live probe or request failed authentication or network check.
   - `PAID_BLOCKED` — Blocked by strict `$0` guard (`deepseek`).
5. **Custom OpenAI-Compatible Providers**:
   - Can be registered via `POST /api/brain/providers/custom` (or the **Providers (11+)** tab in the Multi-AI Control Center).
   - Must explicitly declare `verifiedZeroCost: true` and pass SSRF host validation (blocking cloud metadata IPs like `169.254.169.254` and private non-Ollama subnets).
6. **Zero Frontend Secrets**:
   - API keys are read exclusively from `process.env` on the Node.js/Vercel server.
   - API responses never echo raw keys (`configured: boolean` only), and `SecurityGuard.redactSecrets()` scrubs accidental key patterns from logs and outputs.

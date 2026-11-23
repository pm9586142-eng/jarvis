# OpenJarvis Standalone Python Service (AM AI Extension)

Provides Python-native OpenJarvis capabilities for local PC workstations or dedicated Cloud Run / Docker hosts without modifying or replacing AM AI's existing AI API integration:

- **SQLite FTS5** persistent chunk storage + pure-Python **Okapi BM25** + **128-d Cosine Vector** + **ColBERT MaxSim**
- Optional **FAISS (`faiss-cpu`)** and **RAGatouille ColBERT** auto-detected at runtime and reported honestly via `GET /health`
- Hardware & GPU (`nvidia-smi`, `psutil`) telemetry feeding AM AI's Intelligence Catalog
- Local engine adapters (**Ollama**, **llama.cpp**, **vLLM**, **SGLang**) + **AM AI Cloud Adapter** forwarding to `AM_AI_BACKEND_URL/api/chat`

## Quick Start (Zero-Config Stdlib Mode)

```bash
export AM_AI_BACKEND_URL=https://jarvis-gray-three-59.vercel.app
export OPENJARVIS_AUTH_TOKEN=replace_with_long_random_secret
python3 -m openjarvis_service.server
```

Install optional heavy ML dependencies on a workstation/GPU host:

```bash
pip install -r openjarvis_service/requirements.txt
# Uncomment faiss-cpu / ragatouille / openjarvis in requirements.txt if needed
```

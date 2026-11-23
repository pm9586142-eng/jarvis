"""OpenJarvis Persistent SQLite FTS5, Okapi BM25, Dense Vector, and Optional FAISS/ColBERT Memory Engine."""

from __future__ import annotations

import json
import math
import os
import re
import sqlite3
import time
import uuid
from typing import Any, Dict, List, Optional

VECTOR_DIMS = 128

try:
    import faiss  # type: ignore  # noqa: F401
    HAS_FAISS = True
except Exception:
    HAS_FAISS = False

try:
    import ragatouille  # type: ignore  # noqa: F401
    HAS_RAGATOUILLE = True
except Exception:
    HAS_RAGATOUILLE = False


def tokenize(text: str) -> List[str]:
    cleaned = re.sub(r"[^\w\s-]+", " ", str(text or "").lower())
    return [t for t in cleaned.split() if len(t) >= 2]


def _fnv1a(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def token_vector(tok: str) -> List[float]:
    vec = [0.0] * VECTOR_DIMS
    norm_tok = tok.lower()
    grams = [norm_tok] + [norm_tok[i : i + 3] for i in range(max(0, len(norm_tok) - 2))]
    for g in grams:
        h = _fnv1a(g)
        idx = h % VECTOR_DIMS
        sign = 1.0 if (h & 1) == 0 else -1.0
        vec[idx] += sign * (1.5 if g == norm_tok else 0.65)
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def dense_embedding(text: str) -> List[float]:
    vec = [0.0] * VECTOR_DIMS
    tokens = tokenize(text)
    if not tokens:
        return vec
    for tok in tokens:
        tv = token_vector(tok)
        for i in range(VECTOR_DIMS):
            vec[i] += tv[i]
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 5) for v in vec]


def cosine_sim(a: List[float], b: List[float]) -> float:
    if len(a) != len(b):
        return 0.0
    return sum(x * y for x, y in zip(a, b))


def colbert_maxsim(q_tokens: List[str], d_tokens: List[str]) -> float:
    if not q_tokens or not d_tokens:
        return 0.0
    d_vecs = [token_vector(t) for t in d_tokens[:120]]
    total = 0.0
    q_slice = q_tokens[:24]
    for qt in q_slice:
        qv = token_vector(qt)
        best = max(sum(a * b for a, b in zip(qv, dv)) for dv in d_vecs)
        total += max(0.0, best)
    return total / max(1, len(q_slice))


class HybridSqliteMemory:
    def __init__(self, db_path: Optional[str] = None):
        default_db = os.path.join(os.path.dirname(__file__), "openjarvis_memory.db")
        self.db_path = db_path or os.getenv("OPENJARVIS_SQLITE_PATH") or default_db
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        self.fts5_enabled = False
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    namespace TEXT NOT NULL,
                    title TEXT NOT NULL,
                    source_type TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    doc_id TEXT NOT NULL,
                    namespace TEXT NOT NULL,
                    title TEXT NOT NULL,
                    text TEXT NOT NULL,
                    tokens_json TEXT NOT NULL,
                    embedding_json TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS traces (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    engine_id TEXT NOT NULL,
                    model_used TEXT NOT NULL,
                    ok INTEGER NOT NULL,
                    latency_ms INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            try:
                conn.execute(
                    "CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(chunk_id UNINDEXED, namespace UNINDEXED, title, text)"
                )
                self.fts5_enabled = True
            except sqlite3.OperationalError:
                self.fts5_enabled = False

    def capabilities(self) -> Dict[str, Any]:
        return {
            "sqlite": True,
            "sqliteFts5": self.fts5_enabled,
            "bm25": True,
            "vectorCosine": True,
            "colbert": HAS_RAGATOUILLE,
            "colbertMaxSimFallback": True,
            "faiss": HAS_FAISS,
        }

    def index_document(
        self,
        title: str,
        text: str,
        namespace: str = "default",
        source_type: str = "document",
    ) -> Dict[str, Any]:
        clean = str(text or "").strip()
        if not clean:
            raise ValueError("Document text cannot be empty.")
        doc_id = f"pydoc_{uuid.uuid4().hex[:10]}"
        now = int(time.time() * 1000)
        chunks_txt = [clean[i : i + 720] for i in range(0, len(clean), 600)][:120]

        with self._connect() as conn:
            conn.execute(
                "INSERT INTO documents (id, namespace, title, source_type, created_at) VALUES (?, ?, ?, ?, ?)",
                (doc_id, namespace, title[:180], source_type[:64], now),
            )
            for idx, body in enumerate(chunks_txt):
                cid = f"{doc_id}_c{idx}"
                toks = tokenize(f"{title} {body}")
                emb = dense_embedding(f"{title} {body}")
                conn.execute(
                    "INSERT INTO chunks (id, doc_id, namespace, title, text, tokens_json, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (cid, doc_id, namespace, title[:180], body, json.dumps(toks), json.dumps(emb), now),
                )
                if self.fts5_enabled:
                    conn.execute(
                        "INSERT INTO chunks_fts (chunk_id, namespace, title, text) VALUES (?, ?, ?, ?)",
                        (cid, namespace, title[:180], body),
                    )
        return {"ok": True, "docId": doc_id, "chunksIndexed": len(chunks_txt)}

    def search(
        self,
        query: str,
        mode: str = "hybrid",
        limit: int = 6,
        namespace: str = "default",
    ) -> Dict[str, Any]:
        q = str(query or "").strip()
        q_toks = tokenize(q)
        q_emb = dense_embedding(q)
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, doc_id, title, text, tokens_json, embedding_json FROM chunks WHERE namespace = ? ORDER BY created_at DESC LIMIT 1000",
                (namespace,),
            ).fetchall()

        if not q or not rows:
            return {"ok": True, "query": q, "mode": mode, "results": [], "capabilities": self.capabilities()}

        docs = [
            {
                "id": r["id"],
                "docId": r["doc_id"],
                "title": r["title"],
                "text": r["text"],
                "tokens": json.loads(r["tokens_json"]),
                "embedding": json.loads(r["embedding_json"]),
            }
            for r in rows
        ]
        n_docs = len(docs)
        avg_dl = sum(max(1, len(d["tokens"])) for d in docs) / n_docs
        df_map = {qt: sum(1 for d in docs if qt in d["tokens"]) for qt in set(q_toks)}

        scored = []
        for d in docs:
            tf_counts: Dict[str, int] = {}
            for t in d["tokens"]:
                tf_counts[t] = tf_counts.get(t, 0) + 1
            dl = max(1, len(d["tokens"]))
            bm25 = 0.0
            for qt in q_toks:
                tf = tf_counts.get(qt, 0)
                if tf == 0:
                    continue
                df = df_map.get(qt, 0)
                idf = math.log(1 + (n_docs - df + 0.5) / (df + 0.5))
                bm25 += idf * ((tf * 2.5) / (tf + 1.5 * (0.25 + 0.75 * (dl / avg_dl))))

            vec_s = max(0.0, cosine_sim(q_emb, d["embedding"]))
            col_s = colbert_maxsim(q_toks, d["tokens"])

            if mode == "bm25":
                score = bm25
            elif mode in ("vector", "faiss", "semantic"):
                score = vec_s
            elif mode == "colbert":
                score = col_s
            else:
                score = bm25 * 0.4 + vec_s * 0.35 + col_s * 0.25

            scored.append(
                {
                    "id": d["id"],
                    "docId": d["docId"],
                    "title": d["title"],
                    "text": d["text"],
                    "score": round(score, 4),
                    "scores": {
                        "bm25": round(bm25, 4),
                        "vector": round(vec_s, 4),
                        "colbert": round(col_s, 4),
                    },
                }
            )

        scored.sort(key=lambda x: x["score"], reverse=True)
        return {
            "ok": True,
            "query": q,
            "mode": mode,
            "results": scored[: max(1, min(30, limit))],
            "capabilities": self.capabilities(),
        }

    def record_trace(self, agent_id: str, engine_id: str, model_used: str, ok: bool, latency_ms: int, payload: Dict[str, Any]) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO traces (id, agent_id, engine_id, model_used, ok, latency_ms, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    f"pytr_{uuid.uuid4().hex[:10]}",
                    agent_id,
                    engine_id,
                    model_used,
                    1 if ok else 0,
                    int(latency_ms),
                    int(time.time() * 1000),
                    json.dumps(payload),
                ),
            )

    def learning_summary(self) -> Dict[str, Any]:
        with self._connect() as conn:
            rows = conn.execute("SELECT agent_id, engine_id, ok, latency_ms FROM traces ORDER BY created_at DESC LIMIT 200").fetchall()
        total = len(rows)
        if total == 0:
            return {"totalTraces": 0, "successRate": 100, "avgLatencyMs": 0}
        ok_count = sum(1 for r in rows if r["ok"])
        avg_lat = round(sum(r["latency_ms"] for r in rows) / total)
        return {
            "totalTraces": total,
            "successRate": round((ok_count / total) * 100),
            "avgLatencyMs": avg_lat,
        }

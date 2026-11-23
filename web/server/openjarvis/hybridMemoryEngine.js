import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { sanitizeUserNamespace } from '../memoryStore.js';

const VECTOR_DIMS = 128;

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * Deterministic hashed char/token dense embedding (128-dim L2-normalized)
 * enabling real zero-dependency cosine similarity & ColBERT-style token MaxSim in JS.
 * When Python OpenJarvis service is connected, FAISS & ColBERT backends can supplement this.
 */
export function computeTokenVector(token) {
  const vec = new Float32Array(VECTOR_DIMS);
  const normalized = String(token || '').toLowerCase();
  if (!normalized) return vec;

  const grams = [normalized];
  for (let i = 0; i <= normalized.length - 3; i++) {
    grams.push(normalized.slice(i, i + 3));
  }
  for (const gram of grams) {
    let hash = 2166136261;
    for (let i = 0; i < gram.length; i++) {
      hash ^= gram.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const idx = Math.abs(hash) % VECTOR_DIMS;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vec[idx] += sign * (gram === normalized ? 1.5 : 0.65);
  }
  let norm = 0;
  for (let i = 0; i < VECTOR_DIMS; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < VECTOR_DIMS; i++) vec[i] /= norm;
  return vec;
}

export function computeDenseEmbedding(text) {
  const vec = new Float32Array(VECTOR_DIMS);
  const tokens = tokenize(text);
  if (tokens.length === 0) return Array.from(vec);
  for (const tok of tokens) {
    const tVec = computeTokenVector(tok);
    for (let i = 0; i < VECTOR_DIMS; i++) vec[i] += tVec[i];
  }
  let norm = 0;
  for (let i = 0; i < VECTOR_DIMS; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < VECTOR_DIMS; i++) vec[i] = Number((vec[i] / norm).toFixed(5));
  return Array.from(vec);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function colbertMaxSimScore(queryTokens, docTokens) {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;
  const limitedDoc = docTokens.slice(0, 120);
  const docVecs = limitedDoc.map((dt) => computeTokenVector(dt));
  let sum = 0;
  for (const qt of queryTokens.slice(0, 24)) {
    const qVec = computeTokenVector(qt);
    let best = 0;
    for (const dVec of docVecs) {
      let dot = 0;
      for (let i = 0; i < VECTOR_DIMS; i++) dot += qVec[i] * dVec[i];
      if (dot > best) best = dot;
    }
    sum += best;
  }
  return sum / Math.max(1, Math.min(24, queryTokens.length));
}

export function chunkDocumentText(text, chunkSize = 720, overlap = 120) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  const chunks = [];
  let cursor = 0;
  const safeStep = Math.max(200, chunkSize - overlap);
  while (cursor < clean.length && chunks.length < 160) {
    const slice = clean.slice(cursor, cursor + chunkSize).trim();
    if (slice) chunks.push(slice);
    if (cursor + chunkSize >= clean.length) break;
    cursor += safeStep;
  }
  return chunks;
}

/**
 * OpenJarvis Persistent Tools & Hybrid Memory Engine:
 * - Atomic namespace-isolated document/chunk/knowledge persistence (SQLite-schema compatible JSON store)
 * - Real Okapi BM25 lexical scoring
 * - Dense vector cosine semantic scoring
 * - ColBERT token-level MaxSim scoring
 * - Hybrid Reciprocal Rank Fusion (RRF) bridging both indexed docs AND AM AI MemoryStore!
 */
export function createOpenJarvisMemoryEngine({
  baseDir = process.cwd(),
  filePath = null,
  memoryStore = null,
} = {}) {
  const defaultPath = process.env.VERCEL
    ? path.join(os.tmpdir(), 'openjarvis-hybrid-index.json')
    : path.resolve(baseDir, 'data', 'openjarvis-hybrid-index.json');
  const resolvedBase = filePath || defaultPath;
  const caches = new Map();

  function pathForNamespace(namespace = 'default') {
    const ns = sanitizeUserNamespace(namespace);
    if (ns === 'default') return resolvedBase;
    const ext = path.extname(resolvedBase) || '.json';
    const base = path.basename(resolvedBase, ext);
    return path.join(path.dirname(resolvedBase), `${base}.${ns}${ext}`);
  }

  function loadStore(namespace = 'default') {
    const ns = sanitizeUserNamespace(namespace);
    if (caches.has(ns)) return caches.get(ns);
    const target = pathForNamespace(ns);
    try {
      if (fs.existsSync(target)) {
        const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          const state = {
            documents: Array.isArray(parsed.documents) ? parsed.documents : [],
            chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
            researchHistory: Array.isArray(parsed.researchHistory) ? parsed.researchHistory : [],
            updatedAt: Number(parsed.updatedAt) || Date.now(),
          };
          caches.set(ns, state);
          return state;
        }
      }
    } catch {
      // Recover cleanly with empty store
    }
    const empty = { documents: [], chunks: [], researchHistory: [], updatedAt: Date.now() };
    caches.set(ns, empty);
    return empty;
  }

  function saveStore(state, namespace = 'default') {
    const ns = sanitizeUserNamespace(namespace);
    const next = { ...state, updatedAt: Date.now() };
    const target = pathForNamespace(ns);
    const tryWrite = (dest) => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
      fs.renameSync(tmp, dest);
    };
    try {
      tryWrite(target);
      caches.set(ns, next);
      return { ok: true, path: target };
    } catch {
      const tmpDest = path.join(os.tmpdir(), `openjarvis-hybrid-index.${ns}.json`);
      try {
        tryWrite(tmpDest);
        caches.set(ns, next);
        return { ok: true, path: tmpDest };
      } catch (err) {
        return { ok: false, error: err?.message || 'Failed to persist OpenJarvis index.' };
      }
    }
  }

  function indexDocument({
    title,
    text,
    sourceType = 'document',
    sourceUri = '',
    tags = [],
    namespace = 'default',
  }) {
    const cleanText = String(text || '').trim();
    const cleanTitle = String(title || 'Untitled Document').trim().slice(0, 180);
    if (!cleanText) {
      return { ok: false, error: 'Document text cannot be empty for indexing.' };
    }

    const state = loadStore(namespace);
    const docId = `ojdoc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const chunksText = chunkDocumentText(cleanText);
    const now = Date.now();

    const newChunks = chunksText.map((chunkBody, idx) => {
      const tokens = tokenize(`${cleanTitle} ${chunkBody}`);
      return {
        id: `${docId}_c${idx}`,
        docId,
        title: cleanTitle,
        chunkIndex: idx,
        sourceType,
        sourceUri: String(sourceUri || '').slice(0, 300),
        text: chunkBody,
        tokens,
        embedding: computeDenseEmbedding(`${cleanTitle} ${chunkBody}`),
        createdAt: now,
      };
    });

    const docRecord = {
      id: docId,
      title: cleanTitle,
      sourceType,
      sourceUri: String(sourceUri || '').slice(0, 300),
      tags: Array.isArray(tags) ? tags.slice(0, 12).map(String) : [],
      charCount: cleanText.length,
      wordCount: cleanText.split(/\s+/).filter(Boolean).length,
      chunkCount: newChunks.length,
      excerpt: cleanText.slice(0, 260),
      createdAt: now,
    };

    const nextState = {
      ...state,
      documents: [docRecord, ...state.documents].slice(0, 150),
      chunks: [...newChunks, ...state.chunks].slice(0, 2000),
    };
    const saved = saveStore(nextState, namespace);
    return {
      ok: saved.ok,
      document: docRecord,
      chunksIndexed: newChunks.length,
      error: saved.error || null,
    };
  }

  function deleteDocument(docId, namespace = 'default') {
    const state = loadStore(namespace);
    const existed = state.documents.some((d) => d.id === docId);
    if (!existed) return { ok: false, found: false };
    const nextState = {
      ...state,
      documents: state.documents.filter((d) => d.id !== docId),
      chunks: state.chunks.filter((c) => c.docId !== docId),
    };
    saveStore(nextState, namespace);
    return { ok: true, found: true };
  }

  function listDocuments(namespace = 'default') {
    return loadStore(namespace).documents;
  }

  function saveResearchReport(report, namespace = 'default') {
    const state = loadStore(namespace);
    const entry = {
      id: report.id || `ojres_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      query: String(report.query || '').slice(0, 400),
      summary: String(report.summary || '').slice(0, 12000),
      citations: Array.isArray(report.citations) ? report.citations.slice(0, 20) : [],
      mode: report.mode || 'deep_research',
      createdAt: report.createdAt || Date.now(),
    };
    const nextState = {
      ...state,
      researchHistory: [entry, ...state.researchHistory].slice(0, 80),
    };
    saveStore(nextState, namespace);
    return entry;
  }

  function listResearchHistory(namespace = 'default') {
    return loadStore(namespace).researchHistory;
  }

  /**
   * Executes real BM25, Dense Cosine Vector, ColBERT MaxSim, or Hybrid RRF search
   * across both indexed OpenJarvis documents AND AM AI's existing MemoryStore.
   */
  function hybridSearch({
    query,
    mode = 'hybrid',
    limit = 8,
    includeMemories = true,
    includeDocuments = true,
    namespace = 'default',
  }) {
    const cleanQuery = String(query || '').trim();
    const qTokens = tokenize(cleanQuery);
    const qEmbedding = computeDenseEmbedding(cleanQuery);
    const state = loadStore(namespace);

    const corpus = [];
    if (includeDocuments) {
      for (const ch of state.chunks) {
        corpus.push({
          id: ch.id,
          docId: ch.docId,
          kind: 'document_chunk',
          title: ch.title,
          text: ch.text,
          sourceType: ch.sourceType,
          sourceUri: ch.sourceUri,
          tokens: Array.isArray(ch.tokens) ? ch.tokens : tokenize(ch.text),
          embedding: Array.isArray(ch.embedding) ? ch.embedding : computeDenseEmbedding(ch.text),
          createdAt: ch.createdAt,
        });
      }
    }

    if (includeMemories && memoryStore) {
      const mems = memoryStore.getAll({ namespace });
      for (const m of mems) {
        const body = `[${m.category}] ${m.key}: ${m.content}`;
        corpus.push({
          id: `mem_${m.id}`,
          docId: m.id,
          kind: 'memory',
          title: m.key,
          category: m.category,
          importance: m.importance || 3,
          text: m.content,
          sourceType: 'am_memory_vault',
          sourceUri: '',
          tokens: tokenize(body),
          embedding: computeDenseEmbedding(body),
          createdAt: m.updatedAt || m.createdAt || 0,
        });
      }
    }

    if (!cleanQuery || corpus.length === 0) {
      return {
        query: cleanQuery,
        mode,
        totalCorpusItems: corpus.length,
        results: corpus.slice(0, limit).map((item) => ({
          id: item.id,
          docId: item.docId,
          kind: item.kind,
          title: item.title,
          text: item.text,
          sourceType: item.sourceType,
          sourceUri: item.sourceUri,
          score: 0,
          scores: { bm25: 0, vector: 0, colbert: 0, hybrid: 0 },
        })),
      };
    }

    // Okapi BM25 stats
    const N = corpus.length;
    const avgDl = corpus.reduce((acc, d) => acc + Math.max(1, d.tokens.length), 0) / N;
    const k1 = 1.5;
    const b = 0.75;
    const dfMap = new Map();
    for (const qt of new Set(qTokens)) {
      let df = 0;
      for (const doc of corpus) {
        if (doc.tokens.includes(qt)) df += 1;
      }
      dfMap.set(qt, df);
    }

    const scored = corpus.map((doc) => {
      // BM25
      let bm25 = 0;
      const dl = Math.max(1, doc.tokens.length);
      const tfCounts = new Map();
      for (const t of doc.tokens) tfCounts.set(t, (tfCounts.get(t) || 0) + 1);
      for (const qt of qTokens) {
        const tf = tfCounts.get(qt) || 0;
        if (tf === 0) continue;
        const df = dfMap.get(qt) || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        bm25 += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDl))));
      }

      const vector = Math.max(0, cosineSimilarity(qEmbedding, doc.embedding));
      const colbert = colbertMaxSimScore(qTokens, doc.tokens);
      return { doc, bm25, vector, colbert };
    });

    // Rank lists for RRF when mode === 'hybrid'
    const byBm25 = [...scored].sort((a, b2) => b2.bm25 - a.bm25);
    const byVec = [...scored].sort((a, b2) => b2.vector - a.vector);
    const byColbert = [...scored].sort((a, b2) => b2.colbert - a.colbert);

    const rankBm25 = new Map(byBm25.map((x, idx) => [x.doc.id, idx + 1]));
    const rankVec = new Map(byVec.map((x, idx) => [x.doc.id, idx + 1]));
    const rankCol = new Map(byColbert.map((x, idx) => [x.doc.id, idx + 1]));

    const finalScored = scored.map((item) => {
      const rB = rankBm25.get(item.doc.id) || N;
      const rV = rankVec.get(item.doc.id) || N;
      const rC = rankCol.get(item.doc.id) || N;
      const rrf = 1 / (40 + rB) + 1 / (40 + rV) + 1 / (40 + rC);
      const activeScore =
        mode === 'bm25'
          ? item.bm25
          : mode === 'vector' || mode === 'semantic' || mode === 'faiss'
            ? item.vector
            : mode === 'colbert'
              ? item.colbert
              : rrf * 20 + item.bm25 * 0.25 + item.vector * 0.5 + item.colbert * 0.35;

      return {
        id: item.doc.id,
        docId: item.doc.docId,
        kind: item.doc.kind,
        title: item.doc.title,
        text: item.doc.text,
        sourceType: item.doc.sourceType,
        sourceUri: item.doc.sourceUri,
        score: Number(activeScore.toFixed(4)),
        scores: {
          bm25: Number(item.bm25.toFixed(4)),
          vector: Number(item.vector.toFixed(4)),
          colbert: Number(item.colbert.toFixed(4)),
          hybrid: Number(activeScore.toFixed(4)),
        },
      };
    });

    finalScored.sort((a, b2) => b2.score - a.score);

    return {
      query: cleanQuery,
      mode,
      totalCorpusItems: corpus.length,
      results: finalScored.slice(0, Math.max(1, Math.min(30, limit))),
      backends: {
        bm25: { available: true, runtime: 'node-native-okapi-bm25' },
        vector: { available: true, runtime: 'node-128d-cosine-embedding' },
        colbert: { available: true, runtime: 'node-token-maxsim-approximation' },
        sqlite: { available: false, note: 'SQLite FTS5 runs in openjarvis_service Python backend; Node uses atomic JSON store.' },
        faiss: { available: false, note: 'Optional faiss-cpu runs in openjarvis_service Python backend.' },
      },
    };
  }

  return {
    indexDocument,
    deleteDocument,
    listDocuments,
    saveResearchReport,
    listResearchHistory,
    hybridSearch,
    getStats(namespace = 'default') {
      const state = loadStore(namespace);
      const memCount = memoryStore ? memoryStore.getAll({ namespace }).length : 0;
      return {
        documentsCount: state.documents.length,
        chunksCount: state.chunks.length,
        memoriesBridgedCount: memCount,
        researchHistoryCount: state.researchHistory.length,
      };
    },
  };
}

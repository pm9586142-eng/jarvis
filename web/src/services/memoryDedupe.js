const ALLOWED_CATEGORIES = new Set(['PREFERENCE', 'PROJECT', 'INSTRUCTION', 'FACT']);

export function normalizeMemoryText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeMemoryText(text) {
  const norm = normalizeMemoryText(text);
  if (!norm) return new Set();
  return new Set(norm.split(' ').filter((w) => w.length > 1));
}

export function jaccardSimilarity(a, b) {
  const setA = tokenizeMemoryText(a);
  const setB = tokenizeMemoryText(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function sanitizeExtractedCandidates(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const results = [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const key = String(item.key || '').trim().slice(0, 64);
    const content = String(item.content || '').trim().slice(0, 260);
    if (!key || !content) continue;
    const rawCat = String(item.category || 'FACT').trim().toUpperCase();
    const category = ALLOWED_CATEGORIES.has(rawCat) ? rawCat : 'FACT';
    const rawImp = Number(item.importance);
    const importance = Number.isFinite(rawImp)
      ? Math.min(5, Math.max(1, Math.round(rawImp)))
      : 3;
    results.push({ key, category, content, importance });
  }
  return results.slice(0, 3);
}

export function isNearDuplicateMemory(candidate, existingList) {
  const candContent = normalizeMemoryText(candidate?.content);
  const candKey = normalizeMemoryText(candidate?.key);
  if (!candContent) return true;
  const candCombined = `${candKey} ${candContent}`.trim();

  for (const existing of existingList || []) {
    const exContent = normalizeMemoryText(existing?.content);
    const exKey = normalizeMemoryText(existing?.key);
    if (!exContent) continue;

    if (candContent === exContent) return true;
    if (
      candContent.length >= 12 &&
      exContent.length >= 12 &&
      (candContent.includes(exContent) || exContent.includes(candContent))
    ) {
      return true;
    }

    const combinedSim = jaccardSimilarity(candCombined, `${exKey} ${exContent}`.trim());
    if (combinedSim >= 0.62) return true;

    if (candKey && exKey && candKey === exKey) {
      const contentSim = jaccardSimilarity(candContent, exContent);
      if (contentSim >= 0.45) return true;
    }
  }
  return false;
}

export function filterUniqueMemories(candidates, existingList) {
  const sanitized = sanitizeExtractedCandidates(candidates);
  const accepted = [];
  const pool = [...(existingList || [])];
  for (const cand of sanitized) {
    if (!isNearDuplicateMemory(cand, pool)) {
      accepted.push(cand);
      pool.push(cand);
    }
  }
  return accepted;
}

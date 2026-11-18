/**
 * Real Live Web Search Service — Gemini Google Search Grounding + Optional Tavily Search API.
 * Never fabricates search results, citations, or URLs.
 */

export async function fetchTavilyResults(query, apiKey, fetchImpl = fetch) {
  const trimmedKey = String(apiKey || '').trim();
  if (!trimmedKey || trimmedKey === 'UNSET' || trimmedKey === 'your_tavily_api_key_here') {
    return { used: false, sources: [], answer: '', error: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetchImpl('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: trimmedKey,
        query: String(query || '').trim().slice(0, 400),
        search_depth: 'basic',
        include_answer: true,
        max_results: 6,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        used: false,
        sources: [],
        answer: '',
        error: `Tavily API returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const sources = Array.isArray(data?.results)
      ? data.results
          .filter((r) => r && typeof r.url === 'string' && /^https?:\/\//i.test(r.url))
          .map((r) => ({
            title: String(r.title || r.url).trim().slice(0, 160),
            uri: r.url.trim(),
            snippet: String(r.content || '').trim().slice(0, 320),
            provider: 'tavily',
          }))
      : [];

    return {
      used: true,
      sources,
      answer: typeof data?.answer === 'string' ? data.answer.trim() : '',
      error: null,
    };
  } catch (err) {
    return {
      used: false,
      sources: [],
      answer: '',
      error: err instanceof Error ? err.message : 'Tavily search request failed.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function mergeVerifiedSources(geminiSources = [], tavilySources = []) {
  const seen = new Map();
  for (const src of [...tavilySources, ...geminiSources]) {
    if (!src || typeof src.uri !== 'string' || !/^https?:\/\//i.test(src.uri)) continue;
    const key = src.uri.trim();
    if (!seen.has(key)) {
      seen.set(key, {
        title: String(src.title || key).trim().slice(0, 180),
        uri: key,
        snippet: String(src.snippet || '').trim().slice(0, 320),
        provider: src.provider || 'google_search',
      });
    } else if (!seen.get(key).snippet && src.snippet) {
      seen.get(key).snippet = String(src.snippet).trim().slice(0, 320);
    }
  }
  return Array.from(seen.values()).slice(0, 12);
}

export function extractGroundingSourcesFromResponse(response) {
  const sources = [];
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  for (const cand of candidates) {
    const chunks = cand?.groundingMetadata?.groundingChunks;
    if (!Array.isArray(chunks)) continue;
    for (const chunk of chunks) {
      if (chunk?.web?.uri && /^https?:\/\//i.test(chunk.web.uri)) {
        sources.push({
          title: String(chunk.web.title || chunk.web.uri).trim(),
          uri: chunk.web.uri.trim(),
          snippet: '',
          provider: 'google_search',
        });
      }
    }
  }
  return sources;
}

export function parseStructuredResearchMarkdown(rawText = '') {
  const text = String(rawText || '').trim();
  const verifiedFacts = [];
  const uncertainNotes = [];
  let section = 'summary';

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#{1,3}\s*verified/i.test(line) || /^\*\*verified/i.test(line)) {
      section = 'verified';
      continue;
    }
    if (/^#{1,3}\s*(uncertain|caveat|unverified|limitations)/i.test(line) || /^\*\*(uncertain|caveat)/i.test(line)) {
      section = 'uncertain';
      continue;
    }
    const bulletMatch = line.match(/^[-*•\d.)]+\s+(.+)$/);
    if (bulletMatch) {
      if (section === 'verified') verifiedFacts.push(bulletMatch[1].trim());
      else if (section === 'uncertain') uncertainNotes.push(bulletMatch[1].trim());
    }
  }

  return {
    summary: text,
    verifiedFacts: verifiedFacts.slice(0, 8),
    uncertainNotes: uncertainNotes.slice(0, 6),
  };
}

export const ALLOWED_MEMORY_CATEGORIES = new Set([
  'PREFERENCE',
  'PROJECT',
  'INSTRUCTION',
  'TOPIC',
  'DECISION',
  'COMMAND',
  'FACT',
]);

export function normalizeMemoryCategory(raw) {
  const cat = String(raw || 'FACT').trim().toUpperCase();
  if (cat === 'STYLE' || cat === 'LANGUAGE') return 'PREFERENCE';
  if (cat === 'TASK' || cat === 'GOALS') return 'PROJECT';
  return ALLOWED_MEMORY_CATEGORIES.has(cat) ? cat : 'FACT';
}

export function normalizeMemoryText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
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

const SECRET_PATTERNS = [
  { label: 'API key', regex: /\b(?:AIza[0-9A-Za-z\-_]{20,}|sk-[A-Za-z0-9\-_]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9\-]{10,}|glpat-[A-Za-z0-9\-_]{15,})\b/i },
  { label: 'JWT or Bearer token', regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]{5,})?\b/ },
  { label: 'Bearer token', regex: /\bBearer\s+[A-Za-z0-9\-_.=]{16,}\b/i },
  { label: 'Password or PIN', regex: /\b(?:password|passcode|passphrase|pin\s*code|atm\s*pin|secret\s*key|private\s*key|access\s*token|api\s*key|auth\s*token|cvv|cvc)\s*(?:is|hai|=|:)\s*\S+/i },
  { label: 'Private key block', regex: /-----BEGIN\s+(?:RSA|EC|OPENSSH|PRIVATE)\s+KEY-----/i },
  { label: 'Payment card number', regex: /\b(?:\d[ -]*?){13,16}\b/ },
];

export function containsSensitiveSecret(text) {
  const raw = String(text || '').trim();
  if (!raw) return { blocked: false };
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(raw)) {
      return {
        blocked: true,
        reason: `Sensitive credential detected (${pattern.label}). JARVIS never stores passwords, PINs, API keys, tokens, or payment numbers in Memory Vault.`,
      };
    }
  }
  return { blocked: false };
}

export function sanitizeExtractedCandidates(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const results = [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const key = String(item.key || '').trim().slice(0, 64);
    const content = String(item.content || '').trim().slice(0, 320);
    if (!key || !content) continue;
    if (containsSensitiveSecret(`${key} ${content}`).blocked) continue;
    const category = normalizeMemoryCategory(item.category);
    const rawImp = Number(item.importance);
    const importance = Number.isFinite(rawImp)
      ? Math.min(5, Math.max(1, Math.round(rawImp)))
      : 3;
    results.push({ key, category, content, importance });
  }
  return results;
}

const DOMAIN_GROUPS = [
  ['preferred language', 'response language', 'language preference', 'language', 'bhasha'],
  ['response style', 'communication style', 'tone', 'style preference', 'answer style'],
  ['primary project', 'current project', 'active project', 'project focus', 'my project'],
  ['tech stack', 'coding stack', 'programming stack', 'preferred stack'],
  ['user name', 'owner name', 'my name', 'name'],
  ['role', 'profession', 'occupation', 'job'],
];

function getDomainGroup(key) {
  const norm = normalizeMemoryText(key);
  if (!norm) return null;
  for (let i = 0; i < DOMAIN_GROUPS.length; i++) {
    if (DOMAIN_GROUPS[i].some((alias) => norm === alias || norm.includes(alias))) {
      return i;
    }
  }
  return null;
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
    if (combinedSim >= 0.7) return true;

    if (candKey && exKey && candKey === exKey) {
      const contentSim = jaccardSimilarity(candContent, exContent);
      if (contentSim >= 0.65) return true;
    }
  }
  return false;
}

export function findConflictingMemory(candidate, existingList) {
  const candKey = normalizeMemoryText(candidate?.key);
  const candContent = normalizeMemoryText(candidate?.content);
  if (!candKey || !candContent) return null;
  const candGroup = getDomainGroup(candKey);

  for (const existing of existingList || []) {
    const exKey = normalizeMemoryText(existing?.key);
    const exContent = normalizeMemoryText(existing?.content);
    if (!exKey || !exContent) continue;
    if (candContent === exContent) continue;

    const exGroup = getDomainGroup(exKey);
    const sameDomain = candGroup !== null && exGroup === candGroup;
    const sameExactKey = candKey === exKey;
    const highKeySim = jaccardSimilarity(candKey, exKey) >= 0.78;

    if (sameExactKey || sameDomain || (highKeySim && candidate?.category === existing?.category)) {
      return existing;
    }
  }
  return null;
}

export function upsertOrMergeMemory(candidate, existingList, now = Date.now()) {
  const key = String(candidate?.key || '').trim().slice(0, 64);
  const content = String(candidate?.content || '').trim().slice(0, 320);
  if (!key || !content) {
    return { status: 'invalid', reason: 'Memory key and content are required.' };
  }

  const secretCheck = containsSensitiveSecret(`${key} ${content}`);
  if (secretCheck.blocked) {
    return { status: 'blocked_secret', reason: secretCheck.reason };
  }

  const category = normalizeMemoryCategory(candidate?.category);
  const rawImp = Number(candidate?.importance);
  const importance = Number.isFinite(rawImp) ? Math.min(5, Math.max(1, Math.round(rawImp))) : 3;
  const cleanCandidate = { key, category, content, importance };

  if (isNearDuplicateMemory(cleanCandidate, existingList)) {
    const match = (existingList || []).find((ex) => {
      const exC = normalizeMemoryText(ex?.content);
      return exC === normalizeMemoryText(content) || normalizeMemoryText(ex?.key) === normalizeMemoryText(key);
    });
    return {
      status: 'duplicate',
      memory: match || null,
    };
  }

  const conflicting = findConflictingMemory(cleanCandidate, existingList);
  if (conflicting) {
    const updatedMemory = {
      ...conflicting,
      key: cleanCandidate.key,
      category: cleanCandidate.category,
      content: cleanCandidate.content,
      importance: Math.max(Number(conflicting.importance) || 3, cleanCandidate.importance),
      createdAt: conflicting.createdAt || now,
      updatedAt: now,
    };
    return {
      status: 'updated',
      memory: updatedMemory,
      replacedMemory: conflicting,
    };
  }

  const createdMemory = {
    id:
      typeof candidate?.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : `mem_${now}_${Math.random().toString(36).slice(2, 7)}`,
    key: cleanCandidate.key,
    category: cleanCandidate.category,
    content: cleanCandidate.content,
    importance: cleanCandidate.importance,
    createdAt: Number(candidate?.createdAt) || now,
    updatedAt: Number(candidate?.updatedAt) || now,
  };
  return {
    status: 'created',
    memory: createdMemory,
  };
}

export function filterUniqueMemories(candidates, existingList) {
  const sanitized = sanitizeExtractedCandidates(candidates);
  const accepted = [];
  const pool = [...(existingList || [])];
  for (const cand of sanitized) {
    if (!isNearDuplicateMemory(cand, pool)) {
      accepted.push(cand);
      pool.push(cand);
      if (accepted.length >= 3) break;
    }
  }
  return accepted;
}

export function retrieveRelevantMemories(query, memories, limit = 6, now = Date.now()) {
  const list = Array.isArray(memories) ? memories.filter(Boolean) : [];
  if (list.length === 0) return [];

  const qNorm = normalizeMemoryText(query);
  const qTokens = tokenizeMemoryText(query);

  const scored = list.map((mem) => {
    const keyNorm = normalizeMemoryText(mem.key);
    const contentNorm = normalizeMemoryText(mem.content);
    const combined = `${keyNorm} ${contentNorm}`.trim();

    let relevance = 0;
    if (qTokens.size > 0 && combined) {
      const mTokens = tokenizeMemoryText(combined);
      let hits = 0;
      for (const tok of qTokens) {
        if (mTokens.has(tok)) hits += 1;
        else if (combined.includes(tok) && tok.length >= 4) hits += 0.6;
      }
      relevance += (hits / Math.max(1, Math.min(qTokens.size, 6))) * 5.5;
    }

    if (qNorm && keyNorm && (qNorm.includes(keyNorm) || keyNorm.includes(qNorm))) {
      relevance += 2.5;
    }

    const cat = normalizeMemoryCategory(mem.category);
    const coreBonus =
      cat === 'INSTRUCTION' || cat === 'PREFERENCE'
        ? 1.4
        : cat === 'PROJECT' || cat === 'DECISION'
          ? 1.0
          : 0.4;

    const importanceWeight = (Math.min(5, Math.max(1, Number(mem.importance) || 3)) / 5) * 1.6;

    const lastTouch = Number(mem.updatedAt || mem.createdAt || now);
    const ageDays = Math.max(0, (now - lastTouch) / (1000 * 60 * 60 * 24));
    const recencyWeight = Math.max(0, 1.0 - Math.min(ageDays, 60) / 60);

    const score = relevance + coreBonus + importanceWeight + recencyWeight;
    return { mem, score, relevance };
  });

  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
    return (b.mem.updatedAt || b.mem.createdAt || 0) - (a.mem.updatedAt || a.mem.createdAt || 0);
  });

  return scored.slice(0, Math.max(1, limit)).map((s) => s.mem);
}

export function retrieveRelevantConversations(query, sessions, options = {}) {
  const { activeSessionId = '', limit = 3, now = Date.now() } = options;
  const list = Array.isArray(sessions) ? sessions : [];
  if (list.length === 0) return [];

  const qLower = String(query || '').toLowerCase();
  const wantsYesterday = /\b(yesterday|kal|last night|pichle din)\b/i.test(qLower);
  const wantsEarlier = /\b(earlier|last time|previously|before|pehle|pichli)\b/i.test(qLower);
  const qTokens = tokenizeMemoryText(query);

  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const yesterdayStart = startOfToday.getTime() - dayMs;
  const yesterdayEnd = startOfToday.getTime() - 1;

  const candidates = [];
  for (const session of list) {
    if (!session || !Array.isArray(session.messages) || session.messages.length === 0) continue;
    if (session.id === activeSessionId && !wantsYesterday) continue;

    const updatedAt = Number(session.updatedAt || session.createdAt || 0);
    const inYesterday = updatedAt >= yesterdayStart && updatedAt <= yesterdayEnd;
    if (wantsYesterday && !inYesterday && list.some((s) => (s.updatedAt || 0) >= yesterdayStart && (s.updatedAt || 0) <= yesterdayEnd)) {
      continue;
    }

    const validMsgs = session.messages.filter((m) => m && !m.isError && typeof m.text === 'string' && m.text.trim());
    if (validMsgs.length === 0) continue;

    const matchingMsgs = validMsgs.filter((m) => {
      if (qTokens.size === 0) return false;
      const mTokens = tokenizeMemoryText(m.text);
      for (const tok of qTokens) {
        if (mTokens.has(tok)) return true;
      }
      return false;
    });

    const summaryText = String(session.contextSummary || '').trim();
    const score =
      (inYesterday && wantsYesterday ? 6 : 0) +
      (wantsEarlier ? 1.5 : 0) +
      matchingMsgs.length * 1.4 +
      (summaryText ? jaccardSimilarity(query, summaryText) * 5 : 0) +
      jaccardSimilarity(query, session.title || '') * 3;

    if (score > 0.25 || wantsYesterday || wantsEarlier) {
      const excerptMsgs = (matchingMsgs.length > 0 ? matchingMsgs : validMsgs).slice(-4);
      candidates.push({
        sessionId: session.id,
        title: session.title || 'Past Session',
        updatedAt,
        contextSummary: summaryText,
        excerpts: excerptMsgs.map((m) => ({
          role: m.role,
          text: m.text.trim().slice(0, 260),
          timestamp: m.timestamp,
        })),
        score,
      });
    }
  }

  candidates.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
    return b.updatedAt - a.updatedAt;
  });

  return candidates.slice(0, Math.max(1, limit));
}

function inferMemoryKeyAndCategory(rawFact) {
  const text = rawFact.trim();
  const lower = text.toLowerCase();

  if (/\b(prefer|favorite|favourite|pasand|like|love|hate|hindi|english|hinglish|gujarati|concise|brief|detailed|dark mode|voice)\b/i.test(lower)) {
    if (/\b(hindi|english|hinglish|gujarati|language|bhasha)\b/i.test(lower)) {
      return { key: 'Preferred Language', category: 'PREFERENCE', importance: 5 };
    }
    if (/\b(style|concise|short|brief|detailed|format|bullet|tone)\b/i.test(lower)) {
      return { key: 'Response Style', category: 'PREFERENCE', importance: 4 };
    }
    return { key: 'User Preference', category: 'PREFERENCE', importance: 4 };
  }

  if (/\b(project|app|repo|startup|working on|building|stack|kotlin|react|vite|backend|deadline)\b/i.test(lower)) {
    return { key: 'Active Project', category: 'PROJECT', importance: 4 };
  }

  if (/\b(decided|decision|architecture|finalize|chosen|use .* instead)\b/i.test(lower)) {
    return { key: 'Key Decision', category: 'DECISION', importance: 4 };
  }

  if (/\b(always|never|must|whenever|hamesha|yaad rakhna|instruct|address me)\b/i.test(lower)) {
    return { key: 'Standing Instruction', category: 'INSTRUCTION', importance: 5 };
  }

  const labelSnippet = text.split(/\s+/).slice(0, 4).join(' ').slice(0, 40);
  return { key: labelSnippet || 'Remembered Fact', category: 'FACT', importance: 3 };
}

/**
 * Parses explicit user memory commands in English, Hindi, and Hinglish.
 * Returns null if the message is a normal conversational query.
 */
export function parseMemoryCommand(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;

  // 1. Recall past conversations (e.g. "What did we discuss yesterday?")
  if (
    /^(?:what\s+did\s+we\s+(?:discuss|talk\s+about|cover)|(?:kal|yesterday|last\s+time|earlier)\s+(?:humne|we)?\s*(?:kya|what)\s*(?:discuss|baat)|show\s+(?:our\s+)?(?:yesterday|previous|earlier)\s+(?:discussion|chat|conversation))/i.test(
      text
    )
  ) {
    return {
      type: 'RECALL_CONVERSATIONS',
      query: text,
    };
  }

  // 2. Recall stored memories (e.g. "What do you remember about me?", "Show my important memories")
  if (
    /^(?:what\s+do\s+you\s+remember(?:\s+about\s+me)?|show\s+(?:me\s+)?(?:all\s+)?(?:my\s+)?(?:important\s+|saved\s+)?memories|list\s+(?:my\s+)?memories|what\s+have\s+you\s+saved\s+about\s+me|mere\s+baare\s+mein\s+kya\s+yaad\s+hai|meri\s+(?:important\s+|saved\s+)?memories\s+(?:dikhao|batao)|tumhe\s+kya\s+yaad\s+hai)\??$/i.test(
      text
    ) ||
    /what\s+do\s+you\s+remember\s+about\s+me/i.test(text) ||
    /(?:mere\s+baare\s+mein\s+kya\s+yaad|meri\s+memories\s+dikhao|show\s+my\s+important\s+memories)/i.test(text)
  ) {
    const importantOnly = /\bimportant\b|\bzaroori\b/i.test(text);
    return {
      type: 'RECALL_MEMORIES',
      importantOnly,
    };
  }

  // 3. Forget / Delete memory commands
  const forgetMatch =
    text.match(/^(?:please\s+)?(?:forget|delete|remove|erase)\s+(?:the\s+|my\s+)?(?:previous\s+|saved\s+|old\s+)?(?:memory\s+(?:about|of)\s+|about\s+)?(.+?)[.!?]*$/i) ||
    text.match(/^(?:bhool\s+jao|hata\s+do|delete\s+karo)\s+(?:meri\s+|mera\s+|my\s+)?(.+?)[.!?]*$/i);

  if (forgetMatch) {
    const target = forgetMatch[1].trim();
    if (!target || /^(?:it|this|that|something|anything|memory|preference|saved preference)$/i.test(target)) {
      return {
        type: 'CLARIFY',
        action: 'FORGET',
        message: 'Could you specify which saved memory or preference you would like me to forget, Sir? For example: "Forget my previous project preference about MongoDB."',
      };
    }
    return {
      type: 'FORGET',
      query: target,
    };
  }

  // 4. Update memory commands
  const updateMatch =
    text.match(/^(?:please\s+)?(?:update|change|modify)\s+(?:my\s+)?(?:saved\s+)?(?:(.+?)\s+(?:to|as|with|:)\s+(.+)|(.+))$/i) ||
    text.match(/^(?:mera|meri)\s+(?:saved\s+)?(.+?)\s+(?:update|change)\s+karo\s*(?:to|as|:)?\s*(.*)$/i);

  if (updateMatch) {
    const fieldPart = (updateMatch[1] || '').trim();
    const newValue = (updateMatch[2] || '').trim();
    const singlePart = (updateMatch[3] || '').trim();

    if (!newValue && (!singlePart || /^(?:preference|preferences|saved preference|memory|details|project preference)$/i.test(singlePart))) {
      return {
        type: 'CLARIFY',
        action: 'UPDATE',
        message: 'Which saved memory should I update, and what is the new value, Sir? For example: "Update my preferred language to Hinglish."',
      };
    }

    const content = newValue || singlePart;
    const secretCheck = containsSensitiveSecret(content);
    if (secretCheck.blocked) {
      return { type: 'REJECT_SECRET', message: secretCheck.reason };
    }

    const inferred = inferMemoryKeyAndCategory(fieldPart ? `${fieldPart} ${content}` : content);
    return {
      type: 'UPDATE',
      key: fieldPart ? fieldPart.replace(/^(?:my|saved|previous)\s+/i, '').slice(0, 64) : inferred.key,
      category: inferred.category,
      content,
      importance: Math.max(4, inferred.importance),
    };
  }

  // 5. Explicit Remember / Save commands
  const rememberMatch =
    text.match(/^(?:please\s+)?remember(?:\s+that)?[:,\s]+(.+)$/i) ||
    text.match(/^(?:save\s+(?:this\s+)?(?:to|in)\s+memory|note\s+this\s+for\s+later)[:,\s]+(.+)$/i) ||
    text.match(/^(?:yaad\s+rakho|yaad\s+rakhna)(?:\s+ki)?[:,\s]+(.+)$/i);

  if (rememberMatch) {
    const payload = rememberMatch[1].trim().replace(/[.]+$/, '').trim();
    const vagueOnly =
      !payload ||
      /^(?:this|that|it|my\s+project\s+details?|my\s+preference|my\s+details|everything)$/i.test(payload);

    if (vagueOnly) {
      return {
        type: 'CLARIFY',
        action: 'SAVE',
        message: 'I am ready to save that, Sir—please tell me the specific details you want me to remember (for example: "Remember my project is a Kotlin + React AI platform using Gemini 2.5").',
      };
    }

    const secretCheck = containsSensitiveSecret(payload);
    if (secretCheck.blocked) {
      return { type: 'REJECT_SECRET', message: secretCheck.reason };
    }

    const cleanFact = payload
      .replace(/^that\s+/i, '')
      .replace(/^(?:ki)\s+/i, '')
      .trim();

    const colonIdx = cleanFact.indexOf(':');
    let key;
    let content;
    let inferred;
    if (colonIdx > 1 && colonIdx < 36) {
      key = cleanFact.slice(0, colonIdx).trim();
      content = cleanFact.slice(colonIdx + 1).trim();
      inferred = inferMemoryKeyAndCategory(cleanFact);
    } else {
      content = cleanFact;
      inferred = inferMemoryKeyAndCategory(cleanFact);
      key = inferred.key;
    }

    if (!content) {
      return {
        type: 'CLARIFY',
        action: 'SAVE',
        message: 'Could you share the exact preference or detail to store, Sir?',
      };
    }

    return {
      type: 'SAVE',
      key,
      category: inferred.category,
      content,
      importance: inferred.importance,
    };
  }

  return null;
}

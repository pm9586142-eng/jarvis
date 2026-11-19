import { assessSensitiveAction, redactSecrets } from './securityGuard.js';

const CODE_BLOCK_REGEX = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;

function checkBraceBalance(code) {
  let curly = 0;
  let round = 0;
  let square = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (!inDouble && !inBacktick && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      continue;
    }
    if (inSingle || inDouble || inBacktick) continue;

    if (ch === '{') curly++;
    else if (ch === '}') curly--;
    else if (ch === '(') round++;
    else if (ch === ')') round--;
    else if (ch === '[') square++;
    else if (ch === ']') square--;
  }

  return curly === 0 && round === 0 && square === 0;
}

/**
 * Validates code snippets within an AI answer for common defects:
 * unclosed fences, placeholder stubs, exposed secrets, unsafe eval/shell patterns, and unbalanced brackets.
 */
export function validateCodeSuggestions(answerText) {
  const text = String(answerText || '');
  const issues = [];
  let blockCount = 0;

  const totalFences = (text.match(/```/g) || []).length;
  if (totalFences % 2 !== 0) {
    issues.push({ severity: 'medium', type: 'code_fence', detail: 'Unclosed Markdown code fence detected.' });
  }

  let match;
  CODE_BLOCK_REGEX.lastIndex = 0;
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    blockCount += 1;
    const lang = (match[1] || 'code').toLowerCase();
    const body = match[2] || '';

    if (/\b(?:TODO|FIXME|implement\s+here|placeholder\s+logic)\b/i.test(body)) {
      issues.push({
        severity: 'low',
        type: 'code_stub',
        detail: `Code block #${blockCount} (${lang}) contains TODO/placeholder markers.`,
      });
    }
    if (/\b(?:AIza[0-9A-Za-z\-_]{20,}|gsk_[0-9A-Za-z\-_]{16,}|sk-or-v1-[0-9A-Za-z\-_]{16,})\b/.test(body)) {
      issues.push({
        severity: 'high',
        type: 'hardcoded_secret',
        detail: `Code block #${blockCount} appears to embed a live API key literal.`,
      });
    }
    if (/\beval\s*\(|new\s+Function\s*\(|dangerouslySetInnerHTML|rm\s+-rf\s+\//i.test(body)) {
      issues.push({
        severity: 'medium',
        type: 'unsafe_code_pattern',
        detail: `Code block #${blockCount} (${lang}) contains a potentially unsafe execution pattern (eval/raw HTML/destructive shell).`,
      });
    }
    if (['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript', 'java', 'kotlin', 'json', 'c', 'cpp', 'go', 'rust'].includes(lang)) {
      if (!checkBraceBalance(body)) {
        issues.push({
          severity: 'medium',
          type: 'syntax_balance',
          detail: `Code block #${blockCount} (${lang}) has unbalanced braces/parentheses.`,
        });
      }
    }
  }

  return { codeBlocksChecked: blockCount, issues };
}

/**
 * Compares multiple specialist agent responses to detect contradictions and disagreements.
 */
export function detectContradictions(agentResults = []) {
  const valid = (Array.isArray(agentResults) ? agentResults : []).filter(
    (r) => r && r.status === 'fulfilled' && typeof r.output === 'string' && r.output.trim()
  );
  if (valid.length < 2) return [];

  const contradictions = [];

  // 1. Security vs implementation verdict contradiction
  const securityRes = valid.find((r) => r.agentId === 'security');
  const otherRes = valid.filter((r) => r.agentId !== 'security');
  if (securityRes && /\b(critical|unsafe|vulnerable|do\s+not\s+use|block|reject|high\s+risk)\b/i.test(securityRes.output)) {
    for (const other of otherRes) {
      if (/\b(safe\s+to\s+use|production\s+ready|no\s+issues|recommended\s+as\s+is)\b/i.test(other.output)) {
        contradictions.push({
          agents: [securityRes.agentName, other.agentName],
          severity: 'high',
          summary: `${securityRes.agentName} flagged high-risk security concerns while ${other.agentName} marked the approach ready as-is.`,
        });
      }
    }
  }

  // 2. Affirmative vs negative recommendation conflict
  const affirmativeAgents = [];
  const negativeAgents = [];
  for (const r of valid) {
    const head = r.output.slice(0, 600);
    const hasNeg = /\b(do\s+not\s+recommend|should\s+not|avoid\s+using|impossible|invalid|incorrect)\b/i.test(head);
    const hasPos = /\b(strongly\s+recommend|best\s+approach|is\s+valid|is\s+correct|should\s+use)\b/i.test(head);
    if (hasNeg && !hasPos) negativeAgents.push(r.agentName);
    else if (hasPos && !hasNeg) affirmativeAgents.push(r.agentName);
  }
  if (affirmativeAgents.length > 0 && negativeAgents.length > 0) {
    contradictions.push({
      agents: [...affirmativeAgents, ...negativeAgents],
      severity: 'medium',
      summary: `Directional disagreement between ${affirmativeAgents.join(', ')} (affirmative) and ${negativeAgents.join(', ')} (cautionary/negative).`,
    });
  }

  // 3. Divergent explicit final numeric conclusions (e.g., Math vs Reasoning)
  const numericConclusions = [];
  for (const r of valid) {
    const numMatch = r.output.match(/(?:final\s+answer|result|equals|total)\s*[:=]\s*([-+]?\d+(?:\.\d+)?)/i);
    if (numMatch) {
      numericConclusions.push({ agentName: r.agentName, value: numMatch[1] });
    }
  }
  if (numericConclusions.length >= 2) {
    const distinct = new Set(numericConclusions.map((n) => n.value));
    if (distinct.size > 1) {
      contradictions.push({
        agents: numericConclusions.map((n) => n.agentName),
        severity: 'high',
        summary: `Numeric mismatch across specialists: ${numericConclusions.map((n) => `${n.agentName}=${n.value}`).join(' vs ')}.`,
      });
    }
  }

  return contradictions;
}

/**
 * Checks whether major explicit prompt requirements or requested sections are missing from the answer.
 */
export function detectMissingInformation(prompt, answerText) {
  const p = String(prompt || '').toLowerCase();
  const a = String(answerText || '').toLowerCase();
  const missing = [];

  if (!a.trim() || a.trim().length < 20) {
    missing.push('Answer is unexpectedly brief or empty.');
    return missing;
  }

  const wantsCode = /\b(write\s+(?:the\s+)?code|implement|code\s+example|snippet|function)\b/i.test(p);
  if (wantsCode && !answerText.includes('```') && !/\bfunction\b|\bconst\b|\bclass\b|\bdef\b/.test(a)) {
    missing.push('Prompt requested code implementation, but no code block was produced.');
  }

  const wantsTests = /\b(unit\s+test|test\s+cases|write\s+tests)\b/i.test(p);
  if (wantsTests && !/\btest\b|\bassert\b|\bexpect\b/.test(a)) {
    missing.push('Prompt requested tests, but test assertions were omitted.');
  }

  const wantsSteps = /\b(step[- ]by[- ]step|roadmap|phases)\b/i.test(p);
  if (wantsSteps && !/(?:^|\n)\s*(?:1\.|step\s+1|phase\s+1|- )/i.test(answerText)) {
    missing.push('Prompt requested step-by-step structure, but numbered steps were omitted.');
  }

  return missing;
}

/**
 * Phase 7 — Self-Verification & Self-Correction Engine.
 * Verifies single or multi-agent answers, validates code suggestions, flags contradictions
 * and missing requirements, verifies tool outputs, and produces a transparent confidence indicator.
 */
export function createVerificationEngine({ usageMonitor = null } = {}) {
  return {
    verifyResponse({ prompt = '', answer = '', agentResults = [], toolOutputs = [] } = {}) {
      const cleanAnswer = redactSecrets(String(answer || ''));
      const codeCheck = validateCodeSuggestions(cleanAnswer);
      const contradictions = detectContradictions(agentResults);
      const missingInfo = detectMissingInformation(prompt, cleanAnswer);
      const sensitiveAction = assessSensitiveAction(cleanAnswer);

      const toolWarnings = [];
      for (const tool of Array.isArray(toolOutputs) ? toolOutputs : []) {
        if (!tool || tool.ok === false) {
          toolWarnings.push(`Tool "${tool?.name || 'unknown'}" reported failure or incomplete output.`);
        }
      }

      const failedAgents = (Array.isArray(agentResults) ? agentResults : []).filter(
        (r) => r && r.status === 'rejected'
      );

      let score = 92;
      for (const issue of codeCheck.issues) {
        if (issue.severity === 'high') score -= 24;
        else if (issue.severity === 'medium') score -= 12;
        else score -= 5;
      }
      for (const c of contradictions) {
        score -= c.severity === 'high' ? 18 : 10;
      }
      score -= missingInfo.length * 14;
      score -= toolWarnings.length * 10;
      score -= failedAgents.length * 8;

      if (agentResults.filter((r) => r?.status === 'fulfilled').length >= 2 && contradictions.length === 0) {
        score = Math.min(98, score + 4); // Multi-specialist consensus boost
      }

      const confidenceScore = Math.max(15, Math.min(99, Math.round(score)));
      const confidenceLevel =
        confidenceScore >= 80 ? 'HIGH' : confidenceScore >= 58 ? 'MEDIUM' : 'NEEDS_REVIEW';

      const retryRecommended =
        confidenceScore < 58 ||
        codeCheck.issues.some((i) => i.severity === 'high') ||
        missingInfo.length >= 2;

      const report = {
        verifiedAt: Date.now(),
        confidenceScore,
        confidenceLevel,
        codeBlocksChecked: codeCheck.codeBlocksChecked,
        codeIssues: codeCheck.issues,
        contradictions,
        missingInfo,
        toolWarnings,
        failedAgentsCount: failedAgents.length,
        requiresUserConfirmation: sensitiveAction.requiresConfirmation,
        sensitiveReasons: sensitiveAction.reasons,
        retryRecommended,
        summary:
          contradictions.length > 0
            ? `Detected ${contradictions.length} specialist contradiction(s) requiring reconciliation; confidence ${confidenceScore}%.`
            : codeCheck.issues.length > 0 || missingInfo.length > 0
              ? `Verification flagged ${codeCheck.issues.length} code note(s) and ${missingInfo.length} coverage gap(s); confidence ${confidenceScore}%.`
              : `Passed automated verification checks (${codeCheck.codeBlocksChecked} code block(s) checked); confidence ${confidenceScore}%.`,
      };

      if (confidenceLevel === 'NEEDS_REVIEW') {
        usageMonitor?.recordError({
          category: 'verification_warning',
          code: 'VERIFICATION_LOW_CONFIDENCE',
          message: report.summary,
        });
      }

      return report;
    },
  };
}

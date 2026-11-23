import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { fetchTavilyResults } from '../searchService.js';
import { redactSecrets } from '../brain/securityGuard.js';

const ALLOWED_TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.csv', '.yaml', '.yml',
  '.xml', '.html', '.css', '.js', '.mjs', '.ts', '.tsx', '.py', '.kt', '.java', '.log',
]);

const SENSITIVE_FILENAME_PATTERNS = [
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.jks$/i,
  /\.keystore$/i,
  /google-services\.json/i,
  /id_rsa|id_ed25519/i,
  /secret|credential|password|token/i,
];

const MAX_WORKSPACE_READ_BYTES = 200 * 1024;

/**
 * Pure safe recursive-descent mathematical expression evaluator (ZERO eval / Function).
 */
export function evaluateMathExpression(rawExpr) {
  const expr = String(rawExpr || '').trim();
  if (!expr || expr.length > 300) {
    throw new Error('Math expression must be 1–300 characters.');
  }

  let pos = 0;
  const skipWs = () => {
    while (pos < expr.length && /\s/.test(expr[pos])) pos += 1;
  };
  const peek = () => {
    skipWs();
    return expr[pos] || '';
  };

  const MATH_FUNCS = {
    sqrt: Math.sqrt,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    log: Math.log10,
    ln: Math.log,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  };
  const CONSTS = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2,
  };

  function parseExpression() {
    let val = parseTerm();
    while (true) {
      const ch = peek();
      if (ch === '+') {
        pos += 1;
        val += parseTerm();
      } else if (ch === '-') {
        pos += 1;
        val -= parseTerm();
      } else {
        break;
      }
    }
    return val;
  }

  function parseTerm() {
    let val = parsePower();
    while (true) {
      const ch = peek();
      if (ch === '*') {
        pos += 1;
        val *= parsePower();
      } else if (ch === '/') {
        pos += 1;
        const rhs = parsePower();
        if (rhs === 0) throw new Error('Division by zero.');
        val /= rhs;
      } else if (ch === '%') {
        pos += 1;
        const rhs = parsePower();
        if (rhs === 0) throw new Error('Modulo by zero.');
        val %= rhs;
      } else {
        break;
      }
    }
    return val;
  }

  function parsePower() {
    let base = parseUnary();
    if (peek() === '^') {
      pos += 1;
      const exp = parsePower();
      base = Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary() {
    const ch = peek();
    if (ch === '+') {
      pos += 1;
      return parseUnary();
    }
    if (ch === '-') {
      pos += 1;
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const ch = peek();
    if (ch === '(') {
      pos += 1;
      const inner = parseExpression();
      if (peek() !== ')') throw new Error('Unclosed parenthesis.');
      pos += 1;
      return inner;
    }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      const start = pos;
      let seenDot = false;
      while (pos < expr.length) {
        const c = expr[pos];
        if (c >= '0' && c <= '9') {
          pos += 1;
        } else if (c === '.' && !seenDot) {
          seenDot = true;
          pos += 1;
        } else {
          break;
        }
      }
      const num = Number(expr.slice(start, pos));
      if (!Number.isFinite(num)) throw new Error('Invalid number literal.');
      return num;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const start = pos;
      while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) pos += 1;
      const ident = expr.slice(start, pos).toLowerCase();
      if (peek() === '(') {
        const fn = MATH_FUNCS[ident];
        if (!fn) throw new Error(`Unsupported math function "${ident}".`);
        pos += 1;
        const args = [];
        if (peek() !== ')') {
          args.push(parseExpression());
          while (peek() === ',') {
            pos += 1;
            args.push(parseExpression());
          }
        }
        if (peek() !== ')') throw new Error(`Expected ")" after arguments to ${ident}().`);
        pos += 1;
        const res = fn(...args);
        if (!Number.isFinite(res)) throw new Error(`Math function ${ident} returned non-finite value.`);
        return res;
      }
      if (ident in CONSTS) return CONSTS[ident];
      throw new Error(`Unknown symbol "${ident}".`);
    }

    throw new Error(`Unexpected token "${ch || 'EOF'}" at position ${pos}.`);
  }

  const result = parseExpression();
  skipWs();
  if (pos < expr.length) {
    throw new Error(`Unexpected trailing character "${expr[pos]}" at position ${pos}.`);
  }
  return result;
}

/**
 * Resolves the strictly confined OpenJarvis workspace directory and guarantees
 * zero path-traversal escape or symlink bypass.
 */
export function resolveWorkspaceRoot(customRoot = null) {
  const defaultRoot = process.env.VERCEL
    ? path.join(os.tmpdir(), 'openjarvis_workspace')
    : path.resolve(process.cwd(), 'openjarvis_workspace');
  const rootPath = path.resolve(customRoot || process.env.OPENJARVIS_WORKSPACE_DIR || defaultRoot);
  fs.mkdirSync(rootPath, { recursive: true });
  return fs.realpathSync(rootPath);
}

export function resolveConfinedWorkspacePath(relativePath, workspaceRoot) {
  const raw = String(relativePath || '').trim();
  if (!raw) throw new Error('Relative file path is required.');
  if (path.isAbsolute(raw) || raw.includes('\0')) {
    throw new Error('Absolute paths and null bytes are forbidden inside workspace confinement.');
  }
  const baseName = path.basename(raw);
  if (SENSITIVE_FILENAME_PATTERNS.some((rx) => rx.test(baseName))) {
    throw new Error(`Access denied: "${baseName}" matches sensitive credential file policy.`);
  }
  const rootReal = fs.realpathSync(workspaceRoot);
  const candidate = path.resolve(rootReal, raw);
  if (candidate !== rootReal && !candidate.startsWith(rootReal + path.sep)) {
    throw new Error('Path traversal blocked: target lies outside the OpenJarvis sandbox workspace.');
  }
  if (fs.existsSync(candidate)) {
    const realTarget = fs.realpathSync(candidate);
    if (realTarget !== rootReal && !realTarget.startsWith(rootReal + path.sep)) {
      throw new Error('Symlink traversal blocked outside sandbox workspace.');
    }
    return realTarget;
  }
  return candidate;
}

/**
 * Creates the built-in OpenJarvis Tool Registry:
 * calculator, think, web_search, file_list, file_read, file_write (confirmed),
 * document_index, document_retrieve, sandbox_js_eval.
 */
export function createOpenJarvisToolRegistry({
  hybridMemoryEngine,
  fetchImpl = globalThis.fetch,
  env = process.env,
  workspaceRoot = null,
} = {}) {
  const resolvedRoot = resolveWorkspaceRoot(workspaceRoot);

  // Ensure a tiny safe README exists so workspace listing works immediately out of the box
  const welcomeFile = path.join(resolvedRoot, 'README.md');
  if (!fs.existsSync(welcomeFile)) {
    try {
      fs.writeFileSync(
        welcomeFile,
        '# OpenJarvis Confined Workspace\n\nPlace text, Markdown, JSON, CSV, or code files here for confined reading and hybrid semantic indexing.\n',
        'utf8'
      );
    } catch {
      // Ignore read-only edge failures
    }
  }

  const tools = new Map();

  tools.set('calculator', {
    id: 'calculator',
    name: 'Calculator',
    source: 'openjarvis.tools.calculator',
    description: 'Safe recursive-descent math & scientific evaluator (no eval).',
    requiresConfirmation: false,
    parameters: { expression: 'string' },
    async execute({ expression }) {
      const value = evaluateMathExpression(expression);
      return { ok: true, expression, result: value, text: `${expression} = ${value}` };
    },
  });

  tools.set('think', {
    id: 'think',
    name: 'Think Scratchpad',
    source: 'openjarvis.tools.think',
    description: 'Records structured multi-step reasoning notes cleanly in trace.',
    requiresConfirmation: false,
    parameters: { thought: 'string' },
    async execute({ thought }) {
      const clean = redactSecrets(String(thought || '').trim()).slice(0, 2000);
      if (!clean) throw new Error('Thought content is required.');
      return { ok: true, recordedThought: clean, text: `[Thought recorded]: ${clean}` };
    },
  });

  tools.set('web_search', {
    id: 'web_search',
    name: 'Web Search',
    source: 'openjarvis.tools.web_search',
    description: 'Real web search via configured Tavily API (or transparent status when unconfigured).',
    requiresConfirmation: false,
    parameters: { query: 'string' },
    async execute({ query }) {
      const cleanQ = String(query || '').trim();
      if (!cleanQ) throw new Error('Search query is required.');
      const tavily = await fetchTavilyResults(cleanQ, env.TAVILY_API_KEY, fetchImpl);
      if (tavily.used) {
        return {
          ok: true,
          query: cleanQ,
          provider: 'tavily',
          answer: tavily.answer,
          sources: tavily.sources,
          text:
            tavily.answer ||
            tavily.sources.map((s, idx) => `${idx + 1}. ${s.title} (${s.uri}): ${s.snippet}`).join('\n'),
        };
      }
      return {
        ok: true,
        query: cleanQ,
        provider: 'none',
        sources: [],
        warning:
          tavily.error ||
          'TAVILY_API_KEY is not configured; web_search cannot query external search indexes directly.',
        text: `No live external Tavily results available (${tavily.error || 'TAVILY_API_KEY unset'}). Relying on verified local knowledge & AM AI search endpoint.`,
      };
    },
  });

  tools.set('file_list', {
    id: 'file_list',
    name: 'Workspace File List',
    source: 'openjarvis.tools.files',
    description: 'Lists files strictly inside the confined OpenJarvis workspace directory.',
    requiresConfirmation: false,
    parameters: { subdir: 'string (optional)' },
    async execute({ subdir = '.' } = {}) {
      const targetDir =
        String(subdir || '.').trim() === '.'
          ? resolvedRoot
          : resolveConfinedWorkspacePath(subdir, resolvedRoot);
      const entries = fs.readdirSync(targetDir, { withFileTypes: true }).slice(0, 100);
      const files = entries
        .filter((e) => !SENSITIVE_FILENAME_PATTERNS.some((rx) => rx.test(e.name)))
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
        }));
      return {
        ok: true,
        workspaceRoot: path.basename(resolvedRoot),
        files,
        text: files.map((f) => `${f.type === 'directory' ? '[DIR]' : '[FILE]'} ${f.name}`).join('\n') || '(empty)',
      };
    },
  });

  tools.set('file_read', {
    id: 'file_read',
    name: 'Confined File Reader',
    source: 'openjarvis.tools.files',
    description: 'Reads allowlisted text files strictly inside the confined OpenJarvis workspace.',
    requiresConfirmation: false,
    parameters: { path: 'string' },
    async execute({ path: relPath }) {
      const safeTarget = resolveConfinedWorkspacePath(relPath, resolvedRoot);
      const ext = path.extname(safeTarget).toLowerCase();
      if (!ALLOWED_TEXT_EXTENSIONS.has(ext)) {
        throw new Error(`Extension "${ext || '(none)'}" is not allowlisted for text file reading.`);
      }
      if (!fs.existsSync(safeTarget)) {
        throw new Error(`File "${relPath}" not found in sandbox workspace.`);
      }
      const stat = fs.statSync(safeTarget);
      if (stat.size > MAX_WORKSPACE_READ_BYTES) {
        throw new Error(`File exceeds ${MAX_WORKSPACE_READ_BYTES / 1024}KB read limit.`);
      }
      const content = redactSecrets(fs.readFileSync(safeTarget, 'utf8'));
      return {
        ok: true,
        file: path.relative(resolvedRoot, safeTarget),
        bytes: stat.size,
        content,
        text: content,
      };
    },
  });

  tools.set('file_write', {
    id: 'file_write',
    name: 'Confined File Writer',
    source: 'openjarvis.tools.files',
    description: 'Writes allowlisted text notes/reports inside workspace (requires explicit user confirmation).',
    requiresConfirmation: true,
    parameters: { path: 'string', content: 'string' },
    async execute({ path: relPath, content = '', confirmed = false }) {
      if (!confirmed) {
        return {
          ok: false,
          requiresConfirmation: true,
          error: 'Explicit user confirmation is required before writing workspace files.',
        };
      }
      const safeTarget = resolveConfinedWorkspacePath(relPath, resolvedRoot);
      const ext = path.extname(safeTarget).toLowerCase();
      if (!ALLOWED_TEXT_EXTENSIONS.has(ext)) {
        throw new Error(`Extension "${ext || '(none)'}" is not allowlisted for workspace writing.`);
      }
      const text = String(content || '').slice(0, MAX_WORKSPACE_READ_BYTES);
      fs.mkdirSync(path.dirname(safeTarget), { recursive: true });
      fs.writeFileSync(safeTarget, text, 'utf8');
      return {
        ok: true,
        file: path.relative(resolvedRoot, safeTarget),
        bytes: Buffer.byteLength(text, 'utf8'),
        text: `Wrote ${Buffer.byteLength(text, 'utf8')} bytes to ${path.relative(resolvedRoot, safeTarget)}.`,
      };
    },
  });

  tools.set('document_retrieve', {
    id: 'document_retrieve',
    name: 'Hybrid Document & Memory Retriever',
    source: 'openjarvis.tools.retrieval',
    description: 'Runs BM25 + Vector + ColBERT MaxSim hybrid retrieval over indexed docs and memories.',
    requiresConfirmation: false,
    parameters: { query: 'string', mode: 'hybrid|bm25|vector|colbert', limit: 'number' },
    async execute({ query, mode = 'hybrid', limit = 6, namespace = 'default' }) {
      const searchRes = hybridMemoryEngine.hybridSearch({
        query,
        mode,
        limit: Number(limit) || 6,
        namespace,
      });
      return {
        ok: true,
        ...searchRes,
        text:
          searchRes.results
            .map((r, i) => `[${i + 1}] (${r.kind} | score=${r.score}) ${r.title}: ${r.text}`)
            .join('\n') || 'No matching indexed chunks or memories found.',
      };
    },
  });

  tools.set('sandbox_js_eval', {
    id: 'sandbox_js_eval',
    name: 'Isolated Sandbox JS Evaluator',
    source: 'openjarvis.sandbox.eval',
    description:
      'Executes pure algorithmic JavaScript expressions inside a frozen Node VM isolate (300ms timeout, zero fs/process/network).',
    requiresConfirmation: false,
    parameters: { code: 'string' },
    async execute({ code }) {
      const snippet = String(code || '').trim();
      if (!snippet || snippet.length > 2000) {
        throw new Error('Sandbox snippet must be 1–2000 characters.');
      }
      if (/\b(require|import|process|globalThis|fetch|eval|Function|Buffer|child_process)\b/.test(snippet)) {
        throw new Error('Disallowed host identifier in sandbox snippet.');
      }
      const logs = [];
      const sandbox = Object.freeze({
        Math,
        JSON,
        Number,
        String,
        Array,
        Object,
        Date,
        console: Object.freeze({
          log: (...args) => logs.push(args.map((a) => String(a)).join(' ')),
        }),
      });
      const context = vm.createContext(sandbox);
      const script = new vm.Script(`"use strict";\n${snippet}`);
      const value = script.runInContext(context, { timeout: 300 });
      const formatted =
        value === undefined
          ? logs.join('\n') || '(completed with undefined return)'
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
      return {
        ok: true,
        result: value ?? null,
        logs,
        text: redactSecrets(formatted).slice(0, 4000),
      };
    },
  });

  return {
    workspaceRoot: resolvedRoot,
    listTools: () =>
      Array.from(tools.values()).map((t) => ({
        id: t.id,
        name: t.name,
        source: t.source,
        description: t.description,
        requiresConfirmation: t.requiresConfirmation,
        parameters: t.parameters,
      })),
    hasTool: (id) => tools.has(id),
    async executeTool(toolId, args = {}) {
      const tool = tools.get(toolId);
      if (!tool) {
        throw new Error(`Unknown OpenJarvis tool "${toolId}".`);
      }
      return tool.execute(args);
    },
  };
}

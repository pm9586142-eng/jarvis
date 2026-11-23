import crypto from 'crypto';
import { redactSecrets, validateCustomProviderUrl } from '../brain/securityGuard.js';

const MCP_TIMEOUT_MS = 6000;

/**
 * OpenJarvis MCP (Model Context Protocol) Integration Registry & JSON-RPC Client.
 * Strictly enforces SSRF URL checks, per-server tool allowlists, and confirmation gates
 * for mutating MCP tool calls.
 */
export function createOpenJarvisMcpManager({ fetchImpl = globalThis.fetch, auditLogger = null } = {}) {
  const servers = new Map();

  function serializeServer(s) {
    return {
      id: s.id,
      name: s.name,
      transport: s.transport,
      url: s.url,
      enabled: s.enabled,
      status: s.status,
      allowedTools: [...s.allowedTools],
      requireConfirmation: s.requireConfirmation,
      discoveredTools: [...s.discoveredTools],
      lastMessage: s.lastMessage,
      lastCheckedAt: s.lastCheckedAt,
    };
  }

  function registerServer({
    id,
    name,
    url,
    transport = 'http',
    allowedTools = [],
    requireConfirmation = true,
  } = {}) {
    const cleanName = String(name || '').trim().slice(0, 80);
    if (!cleanName) return { ok: false, error: 'MCP server name is required.' };

    const urlCheck = validateCustomProviderUrl(url);
    if (!urlCheck.valid) {
      return { ok: false, code: 'SSRF_OR_INVALID_URL', error: urlCheck.reason };
    }

    const serverId =
      String(id || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .slice(0, 48) || `mcp_${crypto.randomBytes(3).toString('hex')}`;

    const entry = {
      id: serverId,
      name: cleanName,
      transport: transport === 'sse' ? 'sse' : 'http',
      url: urlCheck.normalizedUrl,
      enabled: true,
      status: 'untested',
      allowedTools: Array.isArray(allowedTools)
        ? allowedTools.map((t) => String(t).trim()).filter(Boolean).slice(0, 40)
        : [],
      requireConfirmation: requireConfirmation !== false,
      discoveredTools: [],
      lastMessage: 'Registered; click Discover Tools to probe live JSON-RPC endpoint.',
      lastCheckedAt: null,
    };
    servers.set(serverId, entry);
    auditLogger?.record({
      category: 'OPENJARVIS_MCP',
      severity: 'INFO',
      action: `Registered MCP server ${cleanName}`,
      detail: `Endpoint: ${entry.url}`,
    });
    return { ok: true, server: serializeServer(entry) };
  }

  function removeServer(serverId) {
    const existed = servers.delete(serverId);
    return { ok: existed, found: existed };
  }

  async function discoverTools(serverId) {
    const s = servers.get(serverId);
    if (!s) return { ok: false, error: `Unknown MCP server "${serverId}".` };

    if (process.env.VERCEL && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(s.url)) {
      s.status = 'local_only_unavailable_in_vercel';
      s.lastCheckedAt = Date.now();
      s.lastMessage = 'Loopback MCP server cannot be reached from Vercel serverless.';
      return { ok: false, server: serializeServer(s), error: s.lastMessage };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);
    try {
      const resp = await fetchImpl(s.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `list_${Date.now()}`,
          method: 'tools/list',
          params: {},
        }),
        signal: controller.signal,
      });
      const raw = await resp.text().catch(() => '');
      s.lastCheckedAt = Date.now();
      if (!resp.ok) {
        s.status = 'unreachable';
        s.lastMessage = redactSecrets(`MCP tools/list HTTP ${resp.status}`);
        return { ok: false, server: serializeServer(s), error: s.lastMessage };
      }
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed?.result?.tools) ? parsed.result.tools : [];
      s.discoveredTools = list.map((t) => ({
        name: String(t?.name || ''),
        description: String(t?.description || '').slice(0, 240),
      })).filter((t) => t.name);
      s.status = 'connected';
      s.lastMessage = `Discovered ${s.discoveredTools.length} MCP tool(s).`;
      return { ok: true, server: serializeServer(s), tools: s.discoveredTools };
    } catch (err) {
      s.status = 'unreachable';
      s.lastCheckedAt = Date.now();
      s.lastMessage = redactSecrets(`MCP connection failed: ${err?.message || 'error'}`);
      return { ok: false, server: serializeServer(s), error: s.lastMessage };
    } finally {
      clearTimeout(timer);
    }
  }

  async function invokeTool(serverId, { toolName, arguments: toolArgs = {}, confirmed = false } = {}) {
    const s = servers.get(serverId);
    if (!s || !s.enabled) {
      return { ok: false, error: `MCP server "${serverId}" not found or disabled.` };
    }
    const cleanTool = String(toolName || '').trim();
    if (!cleanTool) {
      return { ok: false, error: 'MCP toolName is required.' };
    }
    if (s.allowedTools.length > 0 && !s.allowedTools.includes(cleanTool)) {
      return {
        ok: false,
        code: 'MCP_TOOL_NOT_ALLOWLISTED',
        error: `Tool "${cleanTool}" is not in the allowlist for ${s.name}.`,
      };
    }
    if (s.requireConfirmation && !confirmed) {
      return {
        ok: false,
        requiresConfirmation: true,
        code: 'CONFIRMATION_REQUIRED',
        error: `Explicit confirmation is required before invoking external MCP tool "${cleanTool}".`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);
    try {
      const resp = await fetchImpl(s.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `call_${Date.now()}`,
          method: 'tools/call',
          params: { name: cleanTool, arguments: toolArgs },
        }),
        signal: controller.signal,
      });
      const raw = await resp.text().catch(() => '');
      if (!resp.ok) {
        return { ok: false, error: redactSecrets(`MCP tools/call HTTP ${resp.status}`) };
      }
      const parsed = JSON.parse(raw);
      if (parsed?.error) {
        return { ok: false, error: redactSecrets(parsed.error.message || 'MCP tool error') };
      }
      auditLogger?.record({
        category: 'OPENJARVIS_MCP',
        severity: 'INFO',
        action: `Executed MCP tool ${s.name}/${cleanTool}`,
        detail: 'Completed via JSON-RPC tools/call.',
      });
      return { ok: true, result: parsed?.result || null };
    } catch (err) {
      return { ok: false, error: redactSecrets(err?.message || 'MCP invocation failed.') };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    listServers: () => Array.from(servers.values()).map(serializeServer),
    registerServer,
    removeServer,
    discoverTools,
    invokeTool,
  };
}

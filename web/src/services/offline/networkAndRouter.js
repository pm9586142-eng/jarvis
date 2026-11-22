/**
 * Resolves AI execution plan cleanly according to confirmed Hybrid preference:
 * - Hybrid: Cloud first (when online & backend reachable & configured), else Opt-in Ollama or Local PC AI
 * - Online Only: Cloud AI strictly
 * - Local Only: Opt-in Ollama or Local PC AI strictly
 * - Offline Command: Deterministic command execution only
 */
export function resolveAiProviderPlan(mode, net) {
  const cloudReady = Boolean(net.browserOnline && net.backendReachable && net.cloudAiConfigured);

  if (mode === 'offline_command') {
    return {
      target: 'offline_guidance',
      attribution: 'Offline Command Engine',
      reason: 'Offline Command mode is active — executing deterministic commands only.',
      allowFallbackToLocal: false,
    };
  }

  if (mode === 'local_only') {
    if (net.ollamaEnabled) {
      return {
        target: 'ollama',
        attribution: 'Ollama (Opt-In)',
        reason: 'Local-Only mode with opt-in Ollama enabled.',
        allowFallbackToLocal: Boolean(net.localModelInstalled),
      };
    }
    if (net.localModelInstalled) {
      return {
        target: 'local_pc',
        attribution: 'Local PC AI',
        reason: 'Local-Only mode using installed browser Transformers.js model.',
        allowFallbackToLocal: false,
      };
    }
    return {
      target: 'offline_guidance',
      attribution: 'Offline Command Engine',
      reason: 'No local PC AI model is installed yet. Open Settings > Local Model Manager to download one.',
      allowFallbackToLocal: false,
    };
  }

  if (mode === 'online_only') {
    if (cloudReady) {
      return {
        target: 'cloud',
        attribution: 'Cloud AI',
        reason: 'Online-Only mode via free Cloud AI backend.',
        allowFallbackToLocal: false,
      };
    }
    return {
      target: 'offline_guidance',
      attribution: 'Offline Command Engine',
      reason: !net.browserOnline
        ? 'Device is offline and Online-Only mode is selected.'
        : 'Cloud AI backend is unavailable or unconfigured.',
      allowFallbackToLocal: false,
    };
  }

  // Default: Hybrid (Cloud first with automatic local fallback)
  if (cloudReady) {
    return {
      target: 'cloud',
      attribution: 'Cloud AI',
      reason: 'Hybrid mode: using Cloud AI with local fallback ready.',
      allowFallbackToLocal: Boolean(net.localModelInstalled || net.ollamaEnabled),
    };
  }

  if (net.ollamaEnabled) {
    return {
      target: 'ollama',
      attribution: 'Ollama (Opt-In)',
      reason: 'Cloud unavailable — falling back to opt-in local Ollama.',
      allowFallbackToLocal: Boolean(net.localModelInstalled),
    };
  }

  if (net.localModelInstalled) {
    return {
      target: 'local_pc',
      attribution: 'Local PC AI',
      reason: 'Cloud unavailable — automatically routed to Local PC AI.',
      allowFallbackToLocal: false,
    };
  }

  return {
    target: 'offline_guidance',
    attribution: 'Offline Command Engine',
    reason: !net.browserOnline
      ? 'You are offline and no local AI model is installed. Offline commands, tasks, notes, and memory still work.'
      : 'Cloud AI is currently unreachable and no local PC model is installed yet.',
    allowFallbackToLocal: false,
  };
}

export function deriveNetworkSnapshot(params) {
  return {
    browserOnline: Boolean(params.browserOnline),
    backendReachable: params.connectionState === 'online' || params.connectionState === 'key_missing',
    cloudAiConfigured: params.connectionState === 'online',
    localModelInstalled: Boolean(params.localModelInstalled),
    ollamaEnabled: Boolean(params.ollamaEnabled),
  };
}

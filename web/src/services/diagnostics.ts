import { checkBackendHealth } from './api';
import { isSpeechRecognitionSupported, isSpeechSynthesisSupported } from './voice';
import { BackendHealth, ConnectionState } from '../types/jarvis';
import { AMReactorSubsystemArc, AMSubsystemArcStatus } from '../components/AMReactor';

export type DiagnosticProbeStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN' | 'UNSUPPORTED';

export interface DiagnosticProbeItem {
  id: 'network' | 'backend' | 'ai' | 'tts' | 'stt' | 'microphone' | 'storage';
  label: string;
  status: DiagnosticProbeStatus;
  detail: string;
  latencyMs?: number;
}

export interface PreflightDiagnosticsReport {
  overallStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  connectionState: ConnectionState;
  backendHealth: BackendHealth | null;
  checkedAt: number;
  items: DiagnosticProbeItem[];
  terminalLines: string[];
}

export function probeLocalStorageAvailability(): DiagnosticProbeItem {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      id: 'storage',
      label: 'Local Vault',
      status: 'UNSUPPORTED',
      detail: 'localStorage API unavailable in this environment',
    };
  }
  const probeKey = '__am_preflight_probe__';
  try {
    window.localStorage.setItem(probeKey, '1');
    const read = window.localStorage.getItem(probeKey);
    window.localStorage.removeItem(probeKey);
    if (read === '1') {
      return {
        id: 'storage',
        label: 'Local Vault',
        status: 'ONLINE',
        detail: 'Persistent browser storage read/write verified',
      };
    }
    return {
      id: 'storage',
      label: 'Local Vault',
      status: 'DEGRADED',
      detail: 'Storage write succeeded but readback mismatch occurred',
    };
  } catch {
    return {
      id: 'storage',
      label: 'Local Vault',
      status: 'OFFLINE',
      detail: 'Browser storage blocked or quota exceeded',
    };
  }
}

export async function probeMicrophonePermission(): Promise<DiagnosticProbeItem> {
  if (typeof navigator === 'undefined') {
    return {
      id: 'microphone',
      label: 'Microphone',
      status: 'UNSUPPORTED',
      detail: 'Navigator API unavailable',
    };
  }
  if (!navigator.mediaDevices?.getUserMedia && !isSpeechRecognitionSupported()) {
    return {
      id: 'microphone',
      label: 'Microphone',
      status: 'UNSUPPORTED',
      detail: 'Audio capture API unavailable in this browser',
    };
  }
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      if (status.state === 'granted') {
        return {
          id: 'microphone',
          label: 'Microphone',
          status: 'ONLINE',
          detail: 'Permission granted for hands-free capture',
        };
      }
      if (status.state === 'denied') {
        return {
          id: 'microphone',
          label: 'Microphone',
          status: 'OFFLINE',
          detail: 'Permission blocked in browser settings',
        };
      }
      return {
        id: 'microphone',
        label: 'Microphone',
        status: 'DEGRADED',
        detail: 'Awaiting user gesture / browser permission prompt',
      };
    }
  } catch {
    // Some browsers (e.g. Safari/Firefox) do not expose microphone in Permissions API
  }
  return {
    id: 'microphone',
    label: 'Microphone',
    status: 'UNKNOWN',
    detail: 'Permission status checked on mic activation',
  };
}

export async function runPreflightDiagnostics(
  timeoutMs = 4500
): Promise<PreflightDiagnosticsReport> {
  const checkedAt = Date.now();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const conn =
    typeof navigator !== 'undefined'
      ? (navigator as unknown as { connection?: { effectiveType?: string } }).connection
      : undefined;

  const networkItem: DiagnosticProbeItem = {
    id: 'network',
    label: 'Network Link',
    status: isOnline ? 'ONLINE' : 'OFFLINE',
    detail: isOnline
      ? `Active${conn?.effectiveType ? ` (${conn.effectiveType.toUpperCase()})` : ''}`
      : 'Browser reports offline',
  };

  const ttsSupported = isSpeechSynthesisSupported();
  const voiceCount =
    ttsSupported && typeof window !== 'undefined'
      ? window.speechSynthesis.getVoices().length
      : 0;
  const ttsItem: DiagnosticProbeItem = {
    id: 'tts',
    label: 'Vocal Synthesis',
    status: ttsSupported ? 'ONLINE' : 'UNSUPPORTED',
    detail: ttsSupported
      ? voiceCount > 0
        ? `Ready (${voiceCount} browser voices)`
        : 'SpeechSynthesis ready (voices hydrate on activation)'
      : 'Web Speech Synthesis unsupported',
  };

  const sttSupported = isSpeechRecognitionSupported();
  const sttItem: DiagnosticProbeItem = {
    id: 'stt',
    label: 'Voice Recognition',
    status: sttSupported ? 'ONLINE' : 'UNSUPPORTED',
    detail: sttSupported
      ? 'Web SpeechRecognition engine available'
      : 'Unsupported in this browser — typed input ready',
  };

  const storageItem = probeLocalStorageAvailability();

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const [micItem, healthResult] = await Promise.all([
    probeMicrophonePermission(),
    checkBackendHealth(timeoutMs)
      .then((data) => ({
        ok: true as const,
        data,
        latencyMs: Math.max(
          1,
          Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
        ),
      }))
      .catch((err: unknown) => ({
        ok: false as const,
        message: err instanceof Error ? err.message : 'Backend unreachable',
        latencyMs: Math.max(
          1,
          Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
        ),
      })),
  ]);

  let backendItem: DiagnosticProbeItem;
  let aiItem: DiagnosticProbeItem;
  let connectionState: ConnectionState;
  let backendHealth: BackendHealth | null = null;

  if (healthResult.ok) {
    backendHealth = healthResult.data;
    const aiReady = Boolean(
      healthResult.data.aiConfigured ??
        (healthResult.data.geminiConfigured ||
          healthResult.data.groqConfigured ||
          healthResult.data.openrouterConfigured)
    );
    connectionState = aiReady ? 'online' : 'key_missing';
    backendItem = {
      id: 'backend',
      label: 'AM AI Core API',
      status: 'ONLINE',
      latencyMs: healthResult.latencyMs,
      detail: `HTTP 200 • ${healthResult.latencyMs}ms • v${healthResult.data.uptimeSeconds}s uptime`,
    };
    const activeLabel =
      healthResult.data.activeProviderLabel ||
      healthResult.data.activeProvider ||
      'Gemini Free Tier';
    aiItem = aiReady
      ? {
          id: 'ai',
          label: 'AI Matrix',
          status: 'ONLINE',
          detail: `${activeLabel} (${healthResult.data.activeModel || healthResult.data.model})`,
        }
      : {
          id: 'ai',
          label: 'AI Matrix',
          status: 'DEGRADED',
          detail: 'Server reachable, but no free AI provider key configured',
        };
  } else {
    connectionState = 'offline';
    backendItem = {
      id: 'backend',
      label: 'AM AI Core API',
      status: 'OFFLINE',
      latencyMs: healthResult.latencyMs,
      detail: healthResult.message,
    };
    aiItem = {
      id: 'ai',
      label: 'AI Matrix',
      status: 'UNKNOWN',
      detail: 'Cannot verify AI providers while backend is offline',
    };
  }

  const items: DiagnosticProbeItem[] = [
    networkItem,
    backendItem,
    aiItem,
    ttsItem,
    sttItem,
    micItem,
    storageItem,
  ];

  const overallStatus: PreflightDiagnosticsReport['overallStatus'] =
    !isOnline || backendItem.status === 'OFFLINE'
      ? 'OFFLINE'
      : aiItem.status === 'DEGRADED' ||
          micItem.status === 'OFFLINE' ||
          storageItem.status !== 'ONLINE'
        ? 'DEGRADED'
        : 'ONLINE';

  const terminalLines = [
    '[BOOT] Mounting AM AI – Cosmic Intelligence kernel...',
    `[NET]  ${networkItem.label}: ${networkItem.status} — ${networkItem.detail}`,
    `[CORE] ${backendItem.label}: ${backendItem.status} — ${backendItem.detail}`,
    `[LLM]  ${aiItem.label}: ${aiItem.status} — ${aiItem.detail}`,
    `[TTS]  ${ttsItem.label}: ${ttsItem.status} — ${ttsItem.detail}`,
    `[STT]  ${sttItem.label}: ${sttItem.status} — ${sttItem.detail}`,
    `[MIC]  ${micItem.label}: ${micItem.status} — ${micItem.detail}`,
    `[DISK] ${storageItem.label}: ${storageItem.status} — ${storageItem.detail}`,
    `[DONE] Preflight status: ${overallStatus}`,
  ];

  return {
    overallStatus,
    connectionState,
    backendHealth,
    checkedAt,
    items,
    terminalLines,
  };
}

function toArcStatus(status: DiagnosticProbeStatus): AMSubsystemArcStatus {
  if (status === 'ONLINE') return 'online';
  if (status === 'DEGRADED') return 'degraded';
  if (status === 'OFFLINE') return 'offline';
  return 'unknown';
}

export function buildReactorSubsystemArcs(params: {
  connectionState: ConnectionState;
  diagnostics?: PreflightDiagnosticsReport | null;
  speechRecognitionSupported: boolean;
  speechSynthesisSupported: boolean;
  memoriesCount: number;
  mediaActive: boolean;
}): AMReactorSubsystemArc[] {
  const findStatus = (id: DiagnosticProbeItem['id']) =>
    params.diagnostics?.items.find((i) => i.id === id)?.status;

  const coreStatus: AMSubsystemArcStatus =
    params.connectionState === 'offline'
      ? 'offline'
      : params.connectionState === 'connecting'
        ? 'degraded'
        : 'online';

  const aiStatus: AMSubsystemArcStatus =
    params.connectionState === 'online'
      ? 'online'
      : params.connectionState === 'key_missing' || params.connectionState === 'connecting'
        ? 'degraded'
        : 'offline';

  const sttDiag = findStatus('stt');
  const micDiag = findStatus('microphone');
  const voiceStatus: AMSubsystemArcStatus =
    micDiag === 'OFFLINE'
      ? 'offline'
      : params.speechRecognitionSupported || params.speechSynthesisSupported
        ? micDiag === 'DEGRADED' || sttDiag === 'UNSUPPORTED'
          ? 'degraded'
          : 'online'
        : 'offline';

  const storageDiag = findStatus('storage');
  const memoryStatus: AMSubsystemArcStatus = storageDiag
    ? toArcStatus(storageDiag)
    : params.memoriesCount >= 0
      ? 'online'
      : 'unknown';

  const mediaStatus: AMSubsystemArcStatus = params.mediaActive
    ? 'online'
    : params.connectionState === 'offline'
      ? 'degraded'
      : 'online';

  return [
    { id: 'core', label: 'AM CORE', status: coreStatus },
    { id: 'ai', label: 'AI BRAIN', status: aiStatus },
    { id: 'voice', label: 'VOICE', status: voiceStatus },
    { id: 'memory', label: 'MEMORY', status: memoryStatus },
    { id: 'media', label: 'MEDIA', status: mediaStatus },
  ];
}

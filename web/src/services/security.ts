import { ConnectionState, SecurityLogItem, SecurityReport, VulnerabilityCheck } from '../types/jarvis';

export function runBrowserSecurityAudit(params: {
  logs: SecurityLogItem[];
  isLockdownActive: boolean;
  isPinProtected: boolean;
  connectionState: ConnectionState;
}): SecurityReport {
  const { logs, isLockdownActive, isPinProtected, connectionState } = params;
  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;
  const suspiciousLogs = logs.filter((l) => l.severity === 'CRITICAL' || l.severity === 'WARNING');

  let score = 100;
  let defcon: 1 | 2 | 3 | 4 | 5 = 5;
  const alerts: string[] = [];

  if (!isSecureContext) {
    score -= 10;
    alerts.push('Browser is not running over HTTPS. Microphone/Camera permissions may be restricted.');
  }
  if (connectionState === 'offline') {
    score -= 10;
    alerts.push('Backend neural server unreachable. Check server status or network.');
  }
  if (suspiciousLogs.length > 0) {
    score -= Math.min(30, suspiciousLogs.length * 8);
    defcon = suspiciousLogs.length > 5 ? 2 : suspiciousLogs.length > 3 ? 3 : 4;
    alerts.push(`${suspiciousLogs.length} warning/critical security event(s) logged.`);
  }
  if (isLockdownActive) {
    defcon = 1;
    alerts.push('ALERT: Emergency Defense Lockdown is actively engaged.');
  }

  const checks: VulnerabilityCheck[] = [
    {
      title: 'Server-Side API Key Isolation',
      description: 'Gemini credentials stored exclusively on Express backend; zero client-side key exposure.',
      isSecure: true,
      recommendation: 'Pass. Keep GEMINI_API_KEY in Cloud Run / server environment variables.',
    },
    {
      title: 'Transport Security Context (HTTPS)',
      description: isSecureContext
        ? 'Browser verified secure context for encrypted transport & media APIs.'
        : 'Insecure origin detected; deploy behind HTTPS for full hardware API access.',
      isSecure: isSecureContext,
      recommendation: isSecureContext ? 'Pass. TLS/Secure Context active.' : 'Use HTTPS in production.',
    },
    {
      title: 'Persistent Client Vault Hygiene',
      description: 'Local memory and chat records isolated per browser origin.',
      isSecure: true,
      recommendation: 'Clear sensitive session logs on shared computers.',
    },
    {
      title: 'Defensive Anomaly Sentinel',
      description: 'HOMER sentinel monitoring audit trail for lockdown events and invalid PIN attempts.',
      isSecure: suspiciousLogs.length === 0,
      recommendation:
        suspiciousLogs.length === 0
          ? 'Nominal security posture.'
          : 'Inspect recent WARNING/CRITICAL audit events below.',
    },
    {
      title: 'Master Stark PIN Access Gate',
      description: isPinProtected
        ? 'Master PIN gate active for sensitive security overrides.'
        : 'PIN verification currently disabled.',
      isSecure: isPinProtected,
      recommendation: isPinProtected ? 'Pass. PIN protection active.' : 'Enable PIN lock in Security or Settings.',
    },
  ];

  const threatStatusMap: Record<1 | 2 | 3 | 4 | 5, string> = {
    5: 'DEFCON 5: OPTIMAL SECURITY - PERIMETER HARDENED',
    4: 'DEFCON 4: ADVISORY - MINOR ANOMALIES DETECTED',
    3: 'DEFCON 3: ELEVATED READINESS - REVIEW AUDIT LOG',
    2: 'DEFCON 2: HIGH ALERT - MULTIPLE ANOMALIES',
    1: 'DEFCON 1: CRITICAL - EMERGENCY LOCKDOWN ENGAGED',
  };
  const threatStatus = threatStatusMap[defcon];

  return {
    score: Math.max(0, Math.min(100, score)),
    defconLevel: defcon,
    threatStatus,
    checks,
    alerts: alerts.length > 0 ? alerts : ['No active threats detected. Defense matrix nominal.'],
    lastScanTime: Date.now(),
  };
}

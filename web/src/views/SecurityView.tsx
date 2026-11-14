import React from 'react';
import { AlertTriangle, CheckCircle2, Lock, Shield, ShieldAlert } from 'lucide-react';
import { SecurityLogItem, SecurityReport } from '../types/jarvis';

interface SecurityViewProps {
  report: SecurityReport;
  logs: SecurityLogItem[];
  isLockdownActive: boolean;
  isPinProtected: boolean;
  onRunScan: () => void;
  onToggleLockdown: () => void;
  onTogglePinProtection: () => void;
}

export const SecurityView: React.FC<SecurityViewProps> = ({
  report,
  logs,
  isLockdownActive,
  isPinProtected,
  onRunScan,
  onToggleLockdown,
  onTogglePinProtection,
}) => {
  return (
    <div className="space-y-6">
      <div
        className={`glass-panel rounded-2xl p-5 space-y-3 border ${
          report.defconLevel === 1 ? 'border-rose-500/70' : 'border-emerald-500/40'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono-hud text-xs text-slate-400">READINESS POSTURE</span>
          <span className="font-mono-hud text-sm font-bold text-emerald-400">
            INDEX: {report.score}/100
          </span>
        </div>

        <p
          className={`font-mono-hud text-sm sm:text-base font-bold ${
            report.defconLevel === 1 ? 'text-rose-400' : 'text-cyan-300'
          }`}
        >
          {report.threatStatus}
        </p>

        <div className="space-y-1">
          {report.alerts.map((al, i) => (
            <p key={i} className="text-xs text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{al}</span>
            </p>
          ))}
        </div>

        <button
          type="button"
          onClick={onRunScan}
          className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
        >
          <Shield className="w-4 h-4" />
          <span>RUN COMPREHENSIVE SECURITY AUDIT</span>
        </button>
      </div>

      {/* Controls */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-100">Emergency Defense Lockdown</p>
            <p className="text-xs text-slate-400">
              Forces DEFCON 1, logs critical security event, and highlights defense alert banner
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleLockdown}
            className={`px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold cursor-pointer border ${
              isLockdownActive
                ? 'bg-rose-500 text-white border-rose-400'
                : 'bg-[#040812] text-slate-300 border-slate-700 hover:border-rose-400'
            }`}
          >
            {isLockdownActive ? 'DISENGAGE' : 'ENGAGE'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-cyan-400" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Master Stark PIN Protection</p>
              <p className="text-xs text-slate-400">Configured via System Settings</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTogglePinProtection}
            className={`px-3.5 py-1.5 rounded-lg font-mono-hud text-xs font-bold cursor-pointer border ${
              isPinProtected
                ? 'bg-cyan-400/20 text-cyan-300 border-cyan-400/50'
                : 'bg-[#040812] text-slate-400 border-slate-700'
            }`}
          >
            {isPinProtected ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </div>

      {/* Vulnerability Checklist */}
      <div className="space-y-2.5">
        <h3 className="font-mono-hud text-xs font-semibold text-slate-400 tracking-widest">
          SUBSYSTEM INTEGRITY AUDIT
        </h3>
        {report.checks.map((chk) => (
          <div key={chk.title} className="glass-panel rounded-xl p-4 flex items-start gap-3">
            {chk.isSecure ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-100">{chk.title}</p>
              <p className="text-xs text-slate-400">{chk.description}</p>
              <p className={`font-mono-hud text-[11px] ${chk.isSecure ? 'text-emerald-400' : 'text-amber-300'}`}>
                {chk.recommendation}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Audit Log Trail */}
      <div className="space-y-2.5">
        <h3 className="font-mono-hud text-xs font-semibold text-slate-400 tracking-widest">
          SECURITY AUDIT LOGS
        </h3>
        {logs.slice(0, 15).map((log) => (
          <div key={log.id} className="glass-panel rounded-xl p-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-mono-hud text-[11px]">
                <span
                  className={
                    log.severity === 'CRITICAL'
                      ? 'text-rose-400 font-bold'
                      : log.severity === 'WARNING'
                        ? 'text-amber-300 font-bold'
                        : 'text-cyan-300 font-bold'
                  }
                >
                  [{log.eventType}]
                </span>
                <span className="text-slate-400">{log.sourceAgent}</span>
              </div>
              <p className="text-xs text-slate-200 mt-1">{log.description}</p>
            </div>
            <span className="font-mono-hud text-[10px] text-slate-500 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

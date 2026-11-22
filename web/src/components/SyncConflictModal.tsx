import React from 'react';
import { AlertTriangle, Cloud, Copy, Laptop, X } from 'lucide-react';
import { SyncConflictItem } from '../types/jarvis';

interface SyncConflictModalProps {
  conflicts: SyncConflictItem[];
  onResolve: (
    conflict: SyncConflictItem,
    choice: 'keep_local' | 'keep_cloud' | 'keep_both'
  ) => void;
  onDismiss: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  conflicts,
  onResolve,
  onDismiss,
}) => {
  if (conflicts.length === 0) return null;

  const active = conflicts[0];

  return (
    <div
      role="dialog"
      aria-label="Sync Conflict Resolution"
      data-testid="sync-conflict-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="glass-panel-glow rounded-2xl max-w-xl w-full p-5 space-y-4 border border-amber-400/50 bg-[#040B17]/95">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-display text-sm font-bold tracking-wider">
              OFFLINE SYNC CONFLICT ({conflicts.length} REMAINING)
            </h3>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss sync conflict dialog"
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Your offline edit for{' '}
          <strong className="text-cyan-200 uppercase">
            [{active.entityType}] {active.label}
          </strong>{' '}
          differs from the cloud copy. Choose which version to preserve:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#071326] border border-cyan-500/35 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 font-mono-hud text-[10px] font-bold text-cyan-300">
              <Laptop className="w-3.5 h-3.5" />
              <span>LOCAL DEVICE COPY</span>
            </div>
            <p className="text-xs text-slate-200 break-words">{active.localPreview || '—'}</p>
            <p className="font-mono-hud text-[9px] text-slate-400">
              Updated {new Date(active.localUpdatedAt).toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl bg-[#071326] border border-sky-500/35 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 font-mono-hud text-[10px] font-bold text-sky-300">
              <Cloud className="w-3.5 h-3.5" />
              <span>CLOUD WORKSPACE COPY</span>
            </div>
            <p className="text-xs text-slate-200 break-words">{active.cloudPreview || '—'}</p>
            <p className="font-mono-hud text-[9px] text-slate-400">
              Updated {new Date(active.cloudUpdatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            data-testid="conflict-keep-local-btn"
            onClick={() => onResolve(active, 'keep_local')}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/60 hover:bg-cyan-500/30 font-mono-hud text-xs font-bold text-cyan-100 cursor-pointer"
          >
            KEEP LOCAL
          </button>
          <button
            type="button"
            data-testid="conflict-keep-cloud-btn"
            onClick={() => onResolve(active, 'keep_cloud')}
            className="px-3.5 py-2 rounded-xl bg-sky-500/20 border border-sky-400/60 hover:bg-sky-500/30 font-mono-hud text-xs font-bold text-sky-100 cursor-pointer"
          >
            KEEP CLOUD
          </button>
          <button
            type="button"
            data-testid="conflict-keep-both-btn"
            onClick={() => onResolve(active, 'keep_both')}
            className="px-3.5 py-2 rounded-xl bg-[#00E5FF] hover:brightness-110 font-mono-hud text-xs font-bold text-[#02050B] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>KEEP BOTH</span>
          </button>
        </div>
      </div>
    </div>
  );
};

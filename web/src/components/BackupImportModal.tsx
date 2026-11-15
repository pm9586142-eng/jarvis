import React from 'react';
import { AlertTriangle, CheckCircle2, FileJson, X } from 'lucide-react';
import { BackupImportPreview } from '../services/backup';

interface BackupImportModalProps {
  preview: BackupImportPreview | null;
  filename?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const BackupImportModal: React.FC<BackupImportModalProps> = ({
  preview,
  filename,
  onConfirm,
  onClose,
}) => {
  if (!preview) return null;

  const totalImportable =
    preview.sessionsToAdd.length + preview.memoriesToAdd.length + preview.tasksToAdd.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Backup Import Validation Preview"
    >
      <div className="glass-panel-glow rounded-2xl p-6 max-w-lg w-full space-y-4 border border-cyan-500/40 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileJson className="w-5 h-5 text-cyan-300 shrink-0" />
            <div>
              <h3 className="font-display text-sm font-bold text-slate-100 tracking-wider">
                BACKUP IMPORT PREVIEW
              </h3>
              {filename && (
                <p className="font-mono-hud text-[11px] text-slate-400 truncate max-w-xs">
                  {filename}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import preview"
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Validation Status */}
        <div
          className={`rounded-xl px-3.5 py-2.5 border flex items-center gap-2 font-mono-hud text-xs ${
            preview.valid
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          {preview.valid ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>
            {preview.valid
              ? totalImportable > 0
                ? 'Backup verified and ready to merge.'
                : 'Backup valid, but all items already exist in local storage.'
              : 'Backup validation failed.'}
          </span>
        </div>

        {preview.exportedAt && (
          <p className="font-mono-hud text-[11px] text-slate-400">
            Backup Timestamp: {new Date(preview.exportedAt).toLocaleString()}
          </p>
        )}

        {/* Item Counts */}
        {preview.valid && (
          <div className="grid grid-cols-3 gap-2.5 font-mono-hud text-xs">
            <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
              <p className="text-[10px] text-slate-400">CHAT SESSIONS</p>
              <p className="text-cyan-300 text-base font-bold mt-0.5">
                +{preview.sessionsToAdd.length}
              </p>
              {preview.skippedSessionsCount > 0 && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {preview.skippedSessionsCount} skipped
                </p>
              )}
            </div>
            <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
              <p className="text-[10px] text-slate-400">MEMORIES</p>
              <p className="text-emerald-300 text-base font-bold mt-0.5">
                +{preview.memoriesToAdd.length}
              </p>
              {preview.duplicateMemoriesCount > 0 && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {preview.duplicateMemoriesCount} dupes skipped
                </p>
              )}
            </div>
            <div className="rounded-xl bg-[#040812] border border-slate-800 p-3">
              <p className="text-[10px] text-slate-400">TASKS</p>
              <p className="text-amber-300 text-base font-bold mt-0.5">
                +{preview.tasksToAdd.length}
              </p>
              {preview.skippedTasksCount > 0 && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {preview.skippedTasksCount} skipped
                </p>
              )}
            </div>
          </div>
        )}

        {preview.errors.length > 0 && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 space-y-1 max-h-28 overflow-y-auto">
            {preview.errors.map((err, i) => (
              <p key={i} className="font-mono-hud text-[11px] text-rose-300">
                • {err}
              </p>
            ))}
          </div>
        )}

        {preview.warnings.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-1 max-h-28 overflow-y-auto">
            <p className="font-mono-hud text-[10px] font-bold text-amber-300">WARNINGS</p>
            {preview.warnings.slice(0, 6).map((w, i) => (
              <p key={i} className="font-mono-hud text-[11px] text-amber-200">
                • {w}
              </p>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 font-mono-hud text-xs text-slate-300 hover:border-slate-500 cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            disabled={!preview.valid || totalImportable === 0}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-[#02040A] font-display text-xs font-bold tracking-wider cursor-pointer"
          >
            CONFIRM IMPORT ({totalImportable})
          </button>
        </div>
      </div>
    </div>
  );
};

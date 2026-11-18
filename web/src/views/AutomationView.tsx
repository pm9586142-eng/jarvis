import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FilePlus2,
  Globe,
  Play,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  APPROVED_WEBSITES,
  buildAutomationRecord,
  openApprovedWebsiteSafely,
  requiresUserConfirmation,
  validateSafeWebUrl,
} from '../services/automation';
import {
  AutomationHistoryItem,
  QuickActionItem,
  ScreenId,
} from '../types/jarvis';

interface AutomationViewProps {
  history: AutomationHistoryItem[];
  quickActions: QuickActionItem[];
  onRecordAutomation: (item: AutomationHistoryItem) => void;
  onUpdateQuickActions: (next: QuickActionItem[]) => void;
  onQuickCreateNote: (title: string, content: string) => void;
  onQuickCreateReminder: (naturalText: string) => Promise<void>;
  onDispatchPrompt: (prompt: string) => void;
  onNavigate: (screen: ScreenId) => void;
}

interface PendingConfirmation {
  title: string;
  description: string;
  severityLabel: string;
  onConfirm: () => void;
  onCancelRecord: () => void;
}

export const AutomationView: React.FC<AutomationViewProps> = ({
  history,
  quickActions,
  onRecordAutomation,
  onUpdateQuickActions,
  onQuickCreateNote,
  onQuickCreateReminder,
  onDispatchPrompt,
  onNavigate,
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

  // Quick Note & Reminder forms
  const [quickNoteTitle, setQuickNoteTitle] = useState('');
  const [quickNoteBody, setQuickNoteBody] = useState('');
  const [quickReminderText, setQuickReminderText] = useState('');

  // Custom Quick Action builder
  const [newActionLabel, setNewActionLabel] = useState('');
  const [newActionType, setNewActionType] = useState<QuickActionItem['type']>('WEBSITE');
  const [newActionValue, setNewActionValue] = useState('');
  const [newActionConfirm, setNewActionConfirm] = useState(false);

  // Authorized Draft / Form Automation helper
  const [draftRecipient, setDraftRecipient] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');

  const flashNotice = (msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => {
      setStatusNotice((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const executeWebsiteOpen = (name: string, url: string, confirmedByUser: boolean) => {
    const res = openApprovedWebsiteSafely(url);
    onRecordAutomation(
      buildAutomationRecord({
        actionType: 'OPEN_WEBSITE',
        label: `Open ${name}`,
        target: url,
        status: res.opened ? 'EXECUTED' : 'BLOCKED',
        confirmedByUser,
        detail: res.opened ? `Launched ${url} in a new browser tab.` : res.error || 'Blocked by browser.',
      })
    );
    if (!res.opened && res.error) {
      setUrlError(res.error);
    } else {
      setUrlError(null);
      flashNotice(`Opened ${name} in a new tab.`);
    }
  };

  const handleOpenCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateSafeWebUrl(customUrl);
    if (!validation.ok || !validation.url) {
      setUrlError(validation.error || 'Invalid URL.');
      return;
    }
    const targetUrl = validation.url;
    setPendingConfirm({
      title: 'Confirm External Website Navigation',
      description: `Open external URL "${targetUrl}" in a new browser tab?`,
      severityLabel: 'USER AUTHORIZATION',
      onConfirm: () => {
        executeWebsiteOpen(new URL(targetUrl).hostname, targetUrl, true);
        setCustomUrl('');
      },
      onCancelRecord: () => {
        onRecordAutomation(
          buildAutomationRecord({
            actionType: 'OPEN_WEBSITE',
            label: `Open ${targetUrl}`,
            target: targetUrl,
            status: 'CANCELLED',
            confirmedByUser: false,
            detail: 'User declined external navigation confirmation.',
          })
        );
      },
    });
  };

  const handleRunQuickAction = (action: QuickActionItem) => {
    const needsConfirm = requiresUserConfirmation(
      `${action.label} ${action.value}`,
      Boolean(action.requiresConfirmation)
    );

    const runAction = (confirmed: boolean) => {
      if (action.type === 'WEBSITE') {
        executeWebsiteOpen(action.label, action.value, confirmed);
        return;
      }
      if (action.type === 'NAVIGATE') {
        onRecordAutomation(
          buildAutomationRecord({
            actionType: 'QUICK_COMMAND',
            label: action.label,
            target: action.value,
            status: 'EXECUTED',
            confirmedByUser: confirmed,
            detail: `Navigated to module "${action.value}".`,
          })
        );
        onNavigate(action.value as ScreenId);
        return;
      }
      onRecordAutomation(
        buildAutomationRecord({
          actionType: 'QUICK_COMMAND',
          label: action.label,
          target: 'chat',
          status: 'EXECUTED',
          confirmedByUser: confirmed,
          detail: `Dispatched quick command prompt to JARVIS Brain.`,
        })
      );
      onDispatchPrompt(action.value);
    };

    if (needsConfirm) {
      setPendingConfirm({
        title: `Authorize Quick Action: ${action.label}`,
        description: `Execute "${action.label}" (${action.type}: ${action.value})?`,
        severityLabel: 'CONFIRMATION REQUIRED',
        onConfirm: () => runAction(true),
        onCancelRecord: () => {
          onRecordAutomation(
            buildAutomationRecord({
              actionType: 'QUICK_COMMAND',
              label: action.label,
              status: 'CANCELLED',
              confirmedByUser: false,
              detail: 'Cancelled by user at confirmation prompt.',
            })
          );
        },
      });
    } else {
      runAction(true);
    }
  };

  const handlePrepareAuthorizedEmailDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftRecipient.trim() || !draftBody.trim()) return;
    setPendingConfirm({
      title: 'Confirm Sensitive Communication Action',
      description: `Open your system email client with a pre-filled draft to "${draftRecipient.trim()}" (Subject: "${draftSubject.trim() || 'JARVIS Draft'}")? JARVIS will NEVER send messages automatically without your final click.`,
      severityLabel: 'SENSITIVE ACTION GUARD',
      onConfirm: () => {
        const mailto = `mailto:${encodeURIComponent(draftRecipient.trim())}?subject=${encodeURIComponent(
          draftSubject.trim()
        )}&body=${encodeURIComponent(draftBody.trim())}`;
        window.open(mailto, '_blank', 'noopener,noreferrer');
        onRecordAutomation(
          buildAutomationRecord({
            actionType: 'DRAFT_ACTION',
            label: `Email Draft to ${draftRecipient.trim()}`,
            target: draftRecipient.trim(),
            status: 'DRAFT_READY',
            confirmedByUser: true,
            detail: 'Opened authorized email draft in user mail client (manual send required).',
          })
        );
        flashNotice('Authorized email draft opened for your final review & send.');
      },
      onCancelRecord: () => {
        onRecordAutomation(
          buildAutomationRecord({
            actionType: 'DRAFT_ACTION',
            label: `Email Draft to ${draftRecipient.trim()}`,
            status: 'CANCELLED',
            confirmedByUser: false,
            detail: 'User cancelled sensitive email draft action.',
          })
        );
      },
    });
  };

  const handleAddQuickAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionLabel.trim() || !newActionValue.trim()) return;
    const item: QuickActionItem = {
      id: `qa_${Date.now()}`,
      label: newActionLabel.trim(),
      type: newActionType,
      value: newActionValue.trim(),
      requiresConfirmation: newActionConfirm,
    };
    onUpdateQuickActions([item, ...quickActions]);
    setNewActionLabel('');
    setNewActionValue('');
    setNewActionConfirm(false);
    flashNotice(`Saved custom quick action "${item.label}".`);
  };

  return (
    <div className="space-y-6">
      {/* Honest Capability & Safety Disclosure */}
      <div className="glass-panel-glow rounded-2xl p-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-300" />
            <h2 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
              SMART AUTOMATION & AUTHORIZED ACTIONS
            </h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Execute approved website launches, quick commands, notes, reminders, daily summaries, and pre-filled drafts. Sensitive actions always require explicit confirmation.
          </p>
          <p className="font-mono-hud text-[10px] text-amber-300 pt-1">
            SANDBOX DISCLOSURE: Browser web apps operate inside OS security sandboxes and cannot silently launch local desktop executables, delete OS files, or submit third-party forms without explicit user interaction. Android app shortcuts are available in the native Android app.
          </p>
        </div>
        {statusNotice && (
          <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 font-mono-hud text-xs text-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}
      </div>

      {/* Customizable Quick Actions */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
            CUSTOMIZABLE QUICK ACTIONS ({quickActions.length})
          </h3>
          <button
            type="button"
            onClick={() => {
              onRecordAutomation(
                buildAutomationRecord({
                  actionType: 'DAILY_SUMMARY',
                  label: 'Generate Daily Summary',
                  status: 'EXECUTED',
                  confirmedByUser: true,
                  detail: 'Dispatched daily executive briefing generation.',
                })
              );
              onDispatchPrompt('Generate my structured daily summary covering key priorities, reminders, and suggested focus blocks.');
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#02040A] font-display text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>DAILY SUMMARY</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {quickActions.map((qa) => (
            <div
              key={qa.id}
              className="p-3 rounded-xl bg-[#040812] border border-slate-800 hover:border-cyan-400/50 flex items-center justify-between gap-2"
            >
              <button
                type="button"
                onClick={() => handleRunQuickAction(qa)}
                className="flex-1 min-w-0 text-left cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span className="text-xs font-semibold text-slate-100 truncate">{qa.label}</span>
                </div>
                <p className="font-mono-hud text-[10px] text-slate-400 truncate mt-0.5">
                  {qa.type} {qa.requiresConfirmation ? '• CONFIRM' : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onUpdateQuickActions(quickActions.filter((item) => item.id !== qa.id))}
                aria-label={`Remove quick action ${qa.label}`}
                className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddQuickAction} className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            value={newActionLabel}
            onChange={(e) => setNewActionLabel(e.target.value)}
            placeholder="Quick action label..."
            className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
          />
          <select
            value={newActionType}
            onChange={(e) => setNewActionType(e.target.value as QuickActionItem['type'])}
            aria-label="Quick action type"
            className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
          >
            <option value="WEBSITE">OPEN WEBSITE</option>
            <option value="PROMPT">RUN AI COMMAND</option>
            <option value="NAVIGATE">OPEN MODULE</option>
          </select>
          <input
            type="text"
            value={newActionValue}
            onChange={(e) => setNewActionValue(e.target.value)}
            placeholder={
              newActionType === 'WEBSITE'
                ? 'https://example.com'
                : newActionType === 'NAVIGATE'
                  ? 'research, memory, productivity...'
                  : 'Prompt directive...'
            }
            className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 font-mono-hud text-[10px] text-slate-300 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={newActionConfirm}
                onChange={(e) => setNewActionConfirm(e.target.checked)}
                className="accent-cyan-400"
              />
              Confirm
            </label>
            <button
              type="submit"
              disabled={!newActionLabel.trim() || !newActionValue.trim()}
              className="flex-1 py-2 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] font-display text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD</span>
            </button>
          </div>
        </form>
      </div>

      {/* Approved Websites Launcher + Custom URL */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-300" />
          <h3 className="font-mono-hud text-xs font-bold text-sky-300 tracking-wider">
            APPROVED WEBSITES DIRECTORY
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {APPROVED_WEBSITES.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => executeWebsiteOpen(site.name, site.url, true)}
              className="p-3 rounded-xl bg-[#040812] border border-slate-800 hover:border-cyan-400/60 text-left space-y-1 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100">{site.name}</span>
                <ExternalLink className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2">{site.description}</p>
            </button>
          ))}
        </div>

        <form onSubmit={handleOpenCustomUrl} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
          <input
            type="text"
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            placeholder="Open any verified HTTPS website (e.g. docs.python.org)..."
            className="flex-1 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!customUrl.trim()}
            className="px-4 py-2 rounded-xl bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 disabled:opacity-40 font-mono-hud text-xs text-cyan-200 cursor-pointer"
          >
            LAUNCH WITH CONFIRMATION
          </button>
        </form>
        {urlError && <p className="font-mono-hud text-xs text-rose-400">{urlError}</p>}
      </div>

      {/* Quick Create Note / Reminder + Authorized Email Draft */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FilePlus2 className="w-4 h-4 text-emerald-400" />
            <h3 className="font-mono-hud text-xs font-bold text-emerald-400 tracking-wider">
              INSTANT NOTE & REMINDER COMMANDS
            </h3>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!quickNoteTitle.trim() || !quickNoteBody.trim()) return;
              onQuickCreateNote(quickNoteTitle.trim(), quickNoteBody.trim());
              onRecordAutomation(
                buildAutomationRecord({
                  actionType: 'NOTE',
                  label: `Create Note: ${quickNoteTitle.trim()}`,
                  status: 'EXECUTED',
                  confirmedByUser: true,
                  detail: 'Saved note to workspace and synced to server.',
                })
              );
              setQuickNoteTitle('');
              setQuickNoteBody('');
              flashNotice('Note created & synced.');
            }}
            className="space-y-2"
          >
            <input
              type="text"
              value={quickNoteTitle}
              onChange={(e) => setQuickNoteTitle(e.target.value)}
              placeholder="Quick note title..."
              className="w-full bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <textarea
              rows={2}
              value={quickNoteBody}
              onChange={(e) => setQuickNoteBody(e.target.value)}
              placeholder="Note content..."
              className="w-full bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!quickNoteTitle.trim() || !quickNoteBody.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-[#02040A] font-display text-xs font-bold cursor-pointer"
            >
              CREATE NOTE
            </button>
          </form>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!quickReminderText.trim()) return;
              const txt = quickReminderText.trim();
              await onQuickCreateReminder(txt);
              onRecordAutomation(
                buildAutomationRecord({
                  actionType: 'REMINDER',
                  label: `Reminder: ${txt.slice(0, 40)}`,
                  status: 'EXECUTED',
                  confirmedByUser: true,
                  detail: 'Parsed and scheduled smart reminder.',
                })
              );
              setQuickReminderText('');
              flashNotice('Smart reminder scheduled.');
            }}
            className="pt-3 border-t border-slate-800 flex gap-2"
          >
            <input
              type="text"
              value={quickReminderText}
              onChange={(e) => setQuickReminderText(e.target.value)}
              placeholder='Quick reminder (e.g. "Review architecture in 30 minutes")...'
              className="flex-1 bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!quickReminderText.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] font-display text-xs font-bold cursor-pointer"
            >
              SCHEDULE
            </button>
          </form>
        </div>

        {/* User-Confirmed Sensitive Action Draft */}
        <form onSubmit={handlePrepareAuthorizedEmailDraft} className="glass-panel rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-300" />
            <h3 className="font-mono-hud text-xs font-bold text-amber-300 tracking-wider">
              USER-AUTHORIZED MESSAGE DRAFT (CONFIRMATION GUARDED)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Prepares a pre-filled email draft and opens your mail client only after explicit approval. Never auto-sends.
          </p>
          <input
            type="email"
            value={draftRecipient}
            onChange={(e) => setDraftRecipient(e.target.value)}
            placeholder="Recipient email address..."
            className="w-full bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
          />
          <input
            type="text"
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            placeholder="Subject line..."
            className="w-full bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
          />
          <textarea
            rows={2}
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="Message body..."
            className="w-full bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draftRecipient.trim() || !draftBody.trim()}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-[#02040A] font-display text-xs font-bold cursor-pointer"
          >
            PREPARE AUTHORIZED DRAFT
          </button>
        </form>
      </div>

      {/* Persistent Automation History */}
      <div className="glass-panel rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-300" />
            <h3 className="font-mono-hud text-xs font-bold text-violet-300 tracking-wider">
              AUTOMATION EXECUTION HISTORY ({history.length})
            </h3>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No automation events logged yet. Launch an approved website, quick command, or draft above.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#040812] border border-slate-800 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono-hud text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-200">
                      {item.actionType}
                    </span>
                    <span className="text-xs font-semibold text-slate-100">{item.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.detail}</p>
                </div>
                <div className="flex items-center gap-2 font-mono-hud text-[10px] shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded ${
                      item.status === 'EXECUTED' || item.status === 'DRAFT_READY'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : item.status === 'CANCELLED'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {item.status}
                  </span>
                  <span className="text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mandatory Sensitive Action Confirmation Modal */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="glass-panel-glow rounded-2xl p-6 max-w-md w-full space-y-4 border border-amber-400/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-mono-hud text-[10px] tracking-wider">{pendingConfirm.severityLabel}</p>
                  <h3 className="font-display text-sm font-bold text-slate-100">{pendingConfirm.title}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  pendingConfirm.onCancelRecord();
                  setPendingConfirm(null);
                }}
                aria-label="Cancel confirmation"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">{pendingConfirm.description}</p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  pendingConfirm.onCancelRecord();
                  setPendingConfirm(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-700 font-mono-hud text-xs text-slate-300 cursor-pointer"
              >
                DENY / CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = pendingConfirm.onConfirm;
                  setPendingConfirm(null);
                  fn();
                }}
                className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold cursor-pointer"
              >
                AUTHORIZE & EXECUTE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  AlarmClock,
  Bell,
  BellOff,
  CalendarCheck,
  CheckSquare,
  Clock,
  Loader2,
  Pin,
  Plus,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  Wand2,
} from 'lucide-react';
import { SmartTaskSuggestion } from '../services/api';
import { NoteItem, TaskItem } from '../types/jarvis';

interface ProductivityViewProps {
  tasks: TaskItem[];
  notes?: NoteItem[];
  initialFilter?: 'ALL' | 'PENDING' | 'COMPLETED';
  onAddTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'isCompleted'>) => void;
  onCreateSmartReminder: (naturalText: string) => Promise<void>;
  onSnoozeTask: (id: string, minutes?: number) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onAddNote?: (note: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onTogglePinNote?: (id: string) => void;
  onDeleteNote?: (id: string) => void;
  onFetchSmartSuggestions?: () => Promise<SmartTaskSuggestion[]>;
  onRequestFridayBriefing: () => void;
}

export const ProductivityView: React.FC<ProductivityViewProps> = ({
  tasks,
  notes = [],
  initialFilter = 'ALL',
  onAddTask,
  onCreateSmartReminder,
  onSnoozeTask,
  onToggleTask,
  onDeleteTask,
  onAddNote,
  onTogglePinNote,
  onDeleteNote,
  onFetchSmartSuggestions,
  onRequestFridayBriefing,
}) => {
  const [naturalInput, setNaturalInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueTime, setDueTime] = useState('Today 18:00');
  const [priority, setPriority] = useState<TaskItem['priority']>('MEDIUM');
  const [category, setCategory] = useState<TaskItem['category']>('TASK');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>(initialFilter);

  // Notes state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');

  // AI Smart Task Suggestions
  const [suggestions, setSuggestions] = useState<SmartTaskSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  React.useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const requestBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifPermission('unsupported');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } catch {
      // Ignore permission request failure
    }
  };

  const handleSmartReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = naturalInput.trim();
    if (!cleaned || isParsing) return;
    setParseError(null);
    setIsParsing(true);
    try {
      if (notifPermission === 'default') {
        await requestBrowserNotifications();
      }
      await onCreateSmartReminder(cleaned);
      setNaturalInput('');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Unable to parse reminder right now.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTask({
      title: title.trim(),
      description: description.trim() || 'Stark Operations Directive',
      dueTime: dueTime.trim() || 'Scheduled',
      priority,
      category,
    });
    setTitle('');
    setDescription('');
  };

  const visibleTasks = tasks.filter((t) => {
    if (filter === 'PENDING') return !t.isCompleted;
    if (filter === 'COMPLETED') return t.isCompleted;
    return true;
  });

  const pendingCount = tasks.filter((t) => !t.isCompleted).length;

  return (
    <div className="space-y-6">
      {/* Header Strip with FRIDAY AI Briefing Trigger */}
      <div className="glass-panel-glow rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="font-mono-hud text-xs font-bold text-emerald-400 tracking-wider">
              EXECUTIVE PLANNER & SMART REMINDERS
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            {pendingCount} pending item(s) across tasks, scheduled alerts, and Stark operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notifPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={requestBrowserNotifications}
              className={`px-3 py-2 rounded-xl border font-mono-hud text-[11px] flex items-center gap-1.5 cursor-pointer ${
                notifPermission === 'granted'
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                  : notifPermission === 'denied'
                    ? 'bg-rose-500/15 border-rose-400/50 text-rose-300'
                    : 'bg-[#0D1527] border-cyan-400/50 text-cyan-200 hover:border-cyan-300'
              }`}
            >
              {notifPermission === 'denied' ? (
                <BellOff className="w-3.5 h-3.5" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              <span>
                {notifPermission === 'granted'
                  ? 'ALERTS ENABLED'
                  : notifPermission === 'denied'
                    ? 'ALERTS BLOCKED'
                    : 'ENABLE ALERTS'}
              </span>
            </button>
          )}

          {onFetchSmartSuggestions && (
            <button
              type="button"
              disabled={loadingSuggestions}
              onClick={async () => {
                setSuggestionsError(null);
                setLoadingSuggestions(true);
                try {
                  const res = await onFetchSmartSuggestions();
                  setSuggestions(res);
                } catch (err) {
                  setSuggestionsError(
                    err instanceof Error ? err.message : 'Unable to generate smart task suggestions.'
                  );
                } finally {
                  setLoadingSuggestions(false);
                }
              }}
              className="px-3.5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-400/50 hover:bg-violet-500/30 text-violet-200 font-display text-xs font-bold tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              {loadingSuggestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              <span>{loadingSuggestions ? 'THINKING...' : 'SMART SUGGESTIONS'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRequestFridayBriefing}
            className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>GENERATE FRIDAY BRIEFING</span>
          </button>
        </div>
      </div>

      {/* Smart Task Suggestions Panel */}
      {(suggestions.length > 0 || suggestionsError) && (
        <div className="glass-panel rounded-2xl p-4 space-y-3 border border-violet-400/40">
          <div className="flex items-center justify-between">
            <h4 className="font-mono-hud text-xs font-bold text-violet-300 tracking-wider">
              AI SMART TASK SUGGESTIONS
            </h4>
            <button
              type="button"
              onClick={() => {
                setSuggestions([]);
                setSuggestionsError(null);
              }}
              className="font-mono-hud text-[10px] text-slate-400 hover:text-white cursor-pointer"
            >
              DISMISS
            </button>
          </div>
          {suggestionsError && (
            <p className="font-mono-hud text-xs text-rose-300">{suggestionsError}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {suggestions.map((sug, idx) => (
              <div
                key={`${sug.title}-${idx}`}
                className="p-3 rounded-xl bg-[#040812] border border-slate-800 flex flex-col justify-between gap-2"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-100">{sug.title}</p>
                  <p className="text-[11px] text-slate-400">{sug.description}</p>
                  <p className="font-mono-hud text-[10px] text-cyan-300">
                    {sug.priority} • {sug.dueTime}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAddTask({
                      title: sug.title,
                      description: sug.description,
                      dueTime: sug.dueTime,
                      priority: sug.priority,
                      category: sug.category,
                    });
                    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="w-full py-1.5 rounded-lg bg-cyan-400/20 border border-cyan-400/50 hover:bg-cyan-400/30 font-mono-hud text-[10px] font-bold text-cyan-200 cursor-pointer"
                >
                  + ADD TO TASKS
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Natural Language Gemini Reminder Parser */}
      <form onSubmit={handleSmartReminderSubmit} className="glass-panel rounded-2xl p-5 space-y-3 border border-cyan-400/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-cyan-300" />
            <h4 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
              NATURAL-LANGUAGE SMART REMINDER (GEMINI JSON)
            </h4>
          </div>
          <span className="font-mono-hud text-[10px] text-slate-400">
            Tab-open timer + Notification API
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={naturalInput}
            onChange={(e) => setNaturalInput(e.target.value)}
            placeholder='e.g. "remind me to call Raj tomorrow at 5 pm" or "check reactor cooling in 10 minutes"'
            className="flex-1 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!naturalInput.trim() || isParsing}
            className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>PARSING...</span>
              </>
            ) : (
              <>
                <AlarmClock className="w-4 h-4" />
                <span>SCHEDULE SMART REMINDER</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            'Remind me to call Raj tomorrow at 5 pm',
            'Review flight logs in 1 minute',
            'Submit board report tonight at 8 pm',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setNaturalInput(preset)}
              className="px-2.5 py-1 rounded-lg bg-[#070D18] border border-slate-800 hover:border-cyan-400/50 font-mono-hud text-[10px] text-slate-300 cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        {parseError && (
          <p className="font-mono-hud text-xs text-rose-400">{parseError}</p>
        )}
      </form>

      {/* Manual Add Task Form */}
      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-5 space-y-3">
        <h4 className="font-mono-hud text-xs font-bold text-cyan-300">MANUAL DIRECTIVE / TASK</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task or meeting title..."
            className="bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <input
            type="text"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            placeholder="Due window (e.g. Today 17:00)"
            className="bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional context notes..."
            className="sm:col-span-1 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskItem['category'])}
            aria-label="Task category"
            className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2.5 font-mono-hud text-xs text-cyan-200 focus:outline-none"
          >
            <option value="TASK">TASK</option>
            <option value="REMINDER">REMINDER</option>
            <option value="SCHEDULE">SCHEDULE</option>
            <option value="NOTE">NOTE</option>
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskItem['priority'])}
            aria-label="Task priority"
            className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2.5 font-mono-hud text-xs text-amber-200 focus:outline-none"
          >
            <option value="HIGH">HIGH PRIORITY</option>
            <option value="MEDIUM">MEDIUM PRIORITY</option>
            <option value="LOW">LOW PRIORITY</option>
          </select>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!title.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 disabled:opacity-40 text-cyan-200 font-display text-xs font-bold tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ADD TO QUEUE</span>
          </button>
        </div>
      </form>

      {/* Filter Bar */}
      <div className="flex gap-2">
        {(['ALL', 'PENDING', 'COMPLETED'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-3.5 py-1.5 rounded-lg font-mono-hud text-xs border cursor-pointer ${
              filter === tab
                ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                : 'bg-[#070D18] border-slate-800 text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-2.5">
        {visibleTasks.map((task) => (
          <div
            key={task.id}
            className={`glass-panel rounded-2xl p-4 flex items-start justify-between gap-3 ${
              task.isCompleted ? 'opacity-65' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onToggleTask(task.id)}
              className="flex items-start gap-3 text-left flex-1 cursor-pointer"
            >
              {task.isCompleted ? (
                <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Square className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      task.isCompleted ? 'line-through text-slate-400' : 'text-slate-100'
                    }`}
                  >
                    {task.title}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono-hud text-[10px] ${
                      task.priority === 'HIGH'
                        ? 'bg-rose-500/20 text-rose-300'
                        : task.priority === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-sky-500/20 text-sky-300'
                    }`}
                  >
                    {task.priority}
                  </span>
                  <span className="font-mono-hud text-[10px] text-slate-400">[{task.category}]</span>
                  {task.triggerAtMillis && !task.isCompleted && (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 font-mono-hud text-[10px] text-cyan-200 flex items-center gap-1">
                      <AlarmClock className="w-3 h-3" />
                      <span>
                        {new Date(task.triggerAtMillis).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{task.description}</p>
                <p className="font-mono-hud text-[11px] text-cyan-300">Due: {task.dueTime}</p>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {!task.isCompleted && (
                <button
                  type="button"
                  onClick={() => onSnoozeTask(task.id, 10)}
                  title="Snooze 10 minutes"
                  className="px-2 py-1 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-amber-400/60 font-mono-hud text-[10px] text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3 h-3" />
                  <span>+10m</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onDeleteTask(task.id)}
                aria-label={`Delete task ${task.title}`}
                className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {visibleTasks.length === 0 && (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-slate-400">
            No items in this queue view, Sir.
          </div>
        )}
      </div>

      {/* Synced Structured Notes Dashboard */}
      {onAddNote && (
        <div className="glass-panel rounded-2xl p-5 space-y-4 border border-cyan-500/25">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-cyan-300" />
              <h4 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                WORKSPACE NOTES ({notes.length})
              </h4>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!noteTitle.trim() || !noteContent.trim()) return;
              onAddNote({
                title: noteTitle.trim(),
                content: noteContent.trim(),
                tags: noteTags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 6),
                pinned: false,
              });
              setNoteTitle('');
              setNoteContent('');
              setNoteTags('');
            }}
            className="space-y-2.5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title..."
                className="sm:col-span-2 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <input
                type="text"
                value={noteTags}
                onChange={(e) => setNoteTags(e.target.value)}
                placeholder="Tags (comma-separated)..."
                className="bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>
            <textarea
              rows={2}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write structured meeting notes, study snippets, or ideas..."
              className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!noteTitle.trim() || !noteContent.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] font-display text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>SAVE NOTE</span>
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...notes]
              .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt)
              .map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl bg-[#040812] border border-slate-800 p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-sm font-semibold text-slate-100">{note.title}</h5>
                    <div className="flex items-center gap-1 shrink-0">
                      {onTogglePinNote && (
                        <button
                          type="button"
                          onClick={() => onTogglePinNote(note.id)}
                          aria-label={`Pin note ${note.title}`}
                          className={`p-1 cursor-pointer ${
                            note.pinned ? 'text-amber-300' : 'text-slate-500 hover:text-cyan-300'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteNote && (
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.id)}
                          aria-label={`Delete note ${note.title}`}
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded bg-cyan-500/15 font-mono-hud text-[10px] text-cyan-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Database,
  Download,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { MemoryCategory, MemoryItem } from '../types/jarvis';

const MEMORY_CATEGORIES: MemoryCategory[] = [
  'USER_PREFERENCES',
  'IMPORTANT_INSTRUCTIONS',
  'PROJECT_CONTEXT',
  'CONVERSATION_SUMMARIES',
  'LONG_TERM_KNOWLEDGE',
  'TASK_HISTORY',
  'AGENT_EXECUTION_HISTORY',
  'PREFERENCE',
  'PROJECT',
  'INSTRUCTION',
  'TOPIC',
  'DECISION',
  'COMMAND',
  'FACT',
];

const CATEGORY_BADGE_COLORS: Record<MemoryCategory, string> = {
  USER_PREFERENCES: 'bg-cyan-400/15 border-cyan-400/40 text-cyan-300',
  IMPORTANT_INSTRUCTIONS: 'bg-amber-400/15 border-amber-400/40 text-amber-300',
  PROJECT_CONTEXT: 'bg-violet-400/15 border-violet-400/40 text-violet-300',
  CONVERSATION_SUMMARIES: 'bg-sky-400/15 border-sky-400/40 text-sky-300',
  LONG_TERM_KNOWLEDGE: 'bg-emerald-400/15 border-emerald-400/40 text-emerald-300',
  TASK_HISTORY: 'bg-fuchsia-400/15 border-fuchsia-400/40 text-fuchsia-300',
  AGENT_EXECUTION_HISTORY: 'bg-indigo-400/15 border-indigo-400/40 text-indigo-300',
  PREFERENCE: 'bg-cyan-400/15 border-cyan-400/40 text-cyan-300',
  PROJECT: 'bg-violet-400/15 border-violet-400/40 text-violet-300',
  INSTRUCTION: 'bg-amber-400/15 border-amber-400/40 text-amber-300',
  TOPIC: 'bg-sky-400/15 border-sky-400/40 text-sky-300',
  DECISION: 'bg-emerald-400/15 border-emerald-400/40 text-emerald-300',
  COMMAND: 'bg-fuchsia-400/15 border-fuchsia-400/40 text-fuchsia-300',
  FACT: 'bg-slate-400/15 border-slate-500/40 text-slate-300',
};

interface MemoryVaultViewProps {
  memories: MemoryItem[];
  backendSynced?: boolean;
  memoryEnabled?: boolean;
  userNamespace?: string;
  onToggleMemoryEnabled?: () => void;
  onSyncNow?: () => Promise<void> | void;
  onAddMemory: (item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ ok: boolean; message?: string }> | void;
  onUpdateMemory: (
    id: string,
    patch: Partial<Pick<MemoryItem, 'key' | 'category' | 'content' | 'importance'>>
  ) => Promise<{ ok: boolean; message?: string }> | void;
  onDeleteMemory: (id: string) => void;
  onClearAllMemories: () => void;
  onExportBackup: (format: 'json' | 'md') => void;
  onInspectBackupFile: (rawJson: string, filename: string) => void;
}

export const MemoryVaultView: React.FC<MemoryVaultViewProps> = ({
  memories,
  backendSynced = false,
  memoryEnabled = true,
  userNamespace = 'default',
  onToggleMemoryEnabled,
  onSyncNow,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  onClearAllMemories,
  onExportBackup,
  onInspectBackupFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | MemoryCategory>('ALL');
  const [viewMode, setViewMode] = useState<'ALL' | 'RECENT'>('ALL');
  const [keyInput, setKeyInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<MemoryCategory>('PREFERENCE');
  const [contentInput, setContentInput] = useState('');
  const [importanceInput, setImportanceInput] = useState(4);
  const [vaultAlert, setVaultAlert] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editCategory, setEditCategory] = useState<MemoryCategory>('PREFERENCE');
  const [editContent, setEditContent] = useState('');
  const [editImportance, setEditImportance] = useState(3);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const stats = useMemo(() => {
    const highPriority = memories.filter((m) => m.importance >= 4).length;
    const recentlyUpdatedCount = memories.filter(
      (m) => (m.updatedAt || m.createdAt) >= Date.now() - 24 * 60 * 60 * 1000
    ).length;
    return { highPriority, recentlyUpdatedCount };
  }, [memories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = memories.filter((m) => {
      const catMatch = categoryFilter === 'ALL' || m.category === categoryFilter;
      const textMatch =
        !q ||
        m.key.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q);
      return catMatch && textMatch;
    });

    return [...list].sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt;
      const timeB = b.updatedAt || b.createdAt;
      if (viewMode === 'RECENT') {
        return timeB - timeA;
      }
      if (b.importance !== a.importance) return b.importance - a.importance;
      return timeB - timeA;
    });
  }, [memories, search, categoryFilter, viewMode]);

  const showAlert = (type: 'error' | 'success', text: string) => {
    setVaultAlert({ type, text });
    window.setTimeout(() => {
      setVaultAlert((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim() || !contentInput.trim()) return;
    const res = await onAddMemory({
      key: keyInput.trim(),
      category: categoryInput,
      content: contentInput.trim(),
      importance: importanceInput,
    });
    if (res && !res.ok) {
      showAlert('error', res.message || 'Unable to store memory entry.');
      return;
    }
    if (res?.message) {
      showAlert('success', res.message);
    }
    setKeyInput('');
    setContentInput('');
    setImportanceInput(4);
  };

  const startEdit = (mem: MemoryItem) => {
    setEditingId(mem.id);
    setEditKey(mem.key);
    setEditCategory(mem.category);
    setEditContent(mem.content);
    setEditImportance(mem.importance);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editKey.trim() || !editContent.trim()) return;
    const res = await onUpdateMemory(editingId, {
      key: editKey.trim(),
      category: editCategory,
      content: editContent.trim(),
      importance: editImportance,
    });
    if (res && !res.ok) {
      showAlert('error', res.message || 'Unable to update memory.');
      return;
    }
    setEditingId(null);
    showAlert('success', res?.message || 'Memory updated cleanly.');
  };

  return (
    <div className="space-y-6">
      {/* Memory Status Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-3.5 flex items-center gap-3">
          <Database className="w-5 h-5 text-cyan-300 shrink-0" />
          <div className="min-w-0">
            <p className="font-mono-hud text-[10px] text-slate-400">STORED MEMORIES</p>
            <p className="font-display text-lg font-bold text-slate-100">{memories.length}</p>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-3.5 flex items-center gap-3">
          <Star className="w-5 h-5 text-amber-300 shrink-0" />
          <div className="min-w-0">
            <p className="font-mono-hud text-[10px] text-slate-400">HIGH PRIORITY (★4-5)</p>
            <p className="font-display text-lg font-bold text-amber-300">{stats.highPriority}</p>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-3.5 flex items-center gap-3">
          <Clock className="w-5 h-5 text-violet-300 shrink-0" />
          <div className="min-w-0">
            <p className="font-mono-hud text-[10px] text-slate-400">UPDATED (24H)</p>
            <p className="font-display text-lg font-bold text-violet-300">
              {stats.recentlyUpdatedCount}
            </p>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-3.5 flex items-center gap-3">
          <ShieldCheck
            className={`w-5 h-5 shrink-0 ${backendSynced ? 'text-emerald-400' : 'text-sky-300'}`}
          />
          <div className="min-w-0">
            <p className="font-mono-hud text-[10px] text-slate-400">VAULT SYNC & PRIVACY</p>
            <p className="font-mono-hud text-xs font-bold text-emerald-300 truncate">
              {backendSynced ? `SYNCED (${userNamespace})` : `LOCAL (${userNamespace})`}
            </p>
          </div>
        </div>
      </div>

      {/* Master Memory Privacy & Sync Control Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 border border-cyan-500/30">
        <div className="space-y-0.5">
          <p className="font-mono-hud text-xs font-bold text-cyan-300">
            PERSISTENT MEMORY PERSONALIZATION: {memoryEnabled ? 'ON' : 'OFF (PAUSED)'}
          </p>
          <p className="text-xs text-slate-400">
            {memoryEnabled
              ? `JARVIS uses approved vault facts for personalized responses (Namespace: ${userNamespace}). Passwords and API keys are automatically blocked.`
              : 'Memory injection and automatic memory extraction are paused. Existing memories remain untouched until re-enabled.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onSyncNow && (
            <button
              type="button"
              onClick={() => void onSyncNow()}
              className="px-3 py-2 rounded-xl bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 font-mono-hud text-xs text-cyan-200 cursor-pointer"
            >
              SYNC NOW
            </button>
          )}
          {onToggleMemoryEnabled && (
            <button
              type="button"
              role="switch"
              aria-checked={memoryEnabled}
              onClick={onToggleMemoryEnabled}
              className={`px-3.5 py-2 rounded-xl border font-mono-hud text-xs font-bold cursor-pointer ${
                memoryEnabled
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'bg-amber-500/20 border-amber-400 text-amber-200'
              }`}
            >
              {memoryEnabled ? 'MEMORY ON' : 'MEMORY OFF'}
            </button>
          )}
        </div>
      </div>

      {vaultAlert && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 font-mono-hud text-xs ${
            vaultAlert.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
              : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {vaultAlert.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
            ) : (
              <Check className="w-4 h-4 shrink-0 text-emerald-300" />
            )}
            <span>{vaultAlert.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setVaultAlert(null)}
            aria-label="Dismiss vault notification"
            className="p-1 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add Memory Form */}
      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
              STORE LONG-TERM NEURAL MEMORY
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onExportBackup('json')}
              className="px-2.5 py-1.5 rounded-lg bg-[#040812] border border-slate-700 hover:border-cyan-400 font-mono-hud text-[11px] text-cyan-200 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={() => onExportBackup('md')}
              className="px-2.5 py-1.5 rounded-lg bg-[#040812] border border-slate-700 hover:border-cyan-400 font-mono-hud text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>MD</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/50 hover:bg-emerald-500/25 font-mono-hud text-[11px] text-emerald-200 flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>IMPORT</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              aria-label="Import backup into memory vault"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => onInspectBackupFile(String(reader.result || ''), file.name);
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Smart Memory deduplicates repeats, updates conflicting preferences automatically, blocks passwords/API keys, and retrieves only relevant facts per query.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Memory Title / Key (e.g. Preferred Language)"
            className="sm:col-span-2 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <select
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value as MemoryCategory)}
            aria-label="Memory category"
            className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2.5 font-mono-hud text-xs text-cyan-200 focus:outline-none"
          >
            {MEMORY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <textarea
          rows={2}
          value={contentInput}
          onChange={(e) => setContentInput(e.target.value)}
          placeholder="Memory detail or permanent directive for JARVIS..."
          className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono-hud text-xs text-slate-400">Importance:</span>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setImportanceInput(lvl)}
                aria-label={`Set importance ${lvl}`}
                className="p-1 cursor-pointer"
              >
                <Star
                  className={`w-4 h-4 ${
                    lvl <= importanceInput ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                  }`}
                />
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!keyInput.trim() || !contentInput.trim()}
            className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>COMMIT TO VAULT</span>
          </button>
        </div>
      </form>

      {/* Search, Sort & Category Chips */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memory vault..."
              className="w-full bg-[#070D18] border border-slate-800 focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode((v) => (v === 'ALL' ? 'RECENT' : 'ALL'))}
              className={`px-3.5 py-2.5 rounded-xl border font-mono-hud text-xs flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'RECENT'
                  ? 'bg-violet-500/20 border-violet-400 text-violet-200'
                  : 'bg-[#070D18] border-slate-800 text-slate-300 hover:border-cyan-400/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{viewMode === 'RECENT' ? 'RECENTLY UPDATED' : 'PRIORITY SORT'}</span>
            </button>

            {memories.length > 0 && (
              confirmClearAll ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllMemories();
                      setConfirmClearAll(false);
                      showAlert('success', 'All application memories cleared.');
                    }}
                    className="px-3 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-mono-hud text-xs font-bold cursor-pointer"
                  >
                    CONFIRM CLEAR ALL
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="px-3 py-2.5 rounded-xl border border-slate-700 font-mono-hud text-xs text-slate-300 cursor-pointer"
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 hover:bg-rose-500/20 font-mono-hud text-xs text-rose-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>CLEAR ALL</span>
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg border font-mono-hud text-[11px] cursor-pointer ${
              categoryFilter === 'ALL'
                ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                : 'bg-[#070D18] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ALL ({memories.length})
          </button>
          {MEMORY_CATEGORIES.map((cat) => {
            const count = memories.filter((m) => m.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg border font-mono-hud text-[11px] cursor-pointer ${
                  categoryFilter === cat
                    ? CATEGORY_BADGE_COLORS[cat]
                    : 'bg-[#070D18] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Memories List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((mem) => {
          const isEditing = editingId === mem.id;
          const updatedAt = mem.updatedAt || mem.createdAt;
          const wasUpdated = mem.updatedAt && mem.updatedAt > mem.createdAt + 1000;

          return (
            <div key={mem.id} className="glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3">
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                      aria-label="Edit memory title"
                      className="bg-[#040812] border border-cyan-400/70 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none"
                    />
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
                      aria-label="Edit memory category"
                      className="bg-[#040812] border border-slate-700 rounded-lg px-2.5 py-2 font-mono-hud text-xs text-cyan-200 focus:outline-none"
                    >
                      {MEMORY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    aria-label="Edit memory detail"
                    className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setEditImportance(lvl)}
                          aria-label={`Edit importance ${lvl}`}
                          className="p-0.5 cursor-pointer"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              lvl <= editImportance ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded-lg border border-slate-700 font-mono-hud text-[10px] text-slate-300 cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        disabled={!editKey.trim() || !editContent.trim()}
                        className="px-3 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 font-mono-hud text-[10px] font-bold text-[#02040A] cursor-pointer"
                      >
                        SAVE UPDATE
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded border font-mono-hud text-[10px] ${
                          CATEGORY_BADGE_COLORS[mem.category] || CATEGORY_BADGE_COLORS.FACT
                        }`}
                      >
                        {mem.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-hud text-[10px] text-amber-300 mr-1">
                          {'★'.repeat(mem.importance)}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEdit(mem)}
                          aria-label={`Edit memory ${mem.key}`}
                          className="p-1 text-slate-400 hover:text-cyan-300 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMemory(mem.id)}
                          aria-label={`Delete memory ${mem.key}`}
                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-100">{mem.key}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{mem.content}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono-hud text-[10px] text-slate-500">
                    <span>Stored {new Date(mem.createdAt).toLocaleDateString()}</span>
                    {wasUpdated && (
                      <span className="text-violet-300">
                        Updated {new Date(updatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="md:col-span-2 glass-panel rounded-2xl p-8 text-center text-sm text-slate-400">
            No matching memories found in vault.
          </div>
        )}
      </div>
    </div>
  );
};

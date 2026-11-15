import React, { useMemo, useRef, useState } from 'react';
import { Database, Download, Plus, Search, Star, Trash2, Upload } from 'lucide-react';
import { MemoryItem } from '../types/jarvis';

interface MemoryVaultViewProps {
  memories: MemoryItem[];
  onAddMemory: (item: Omit<MemoryItem, 'id' | 'createdAt'>) => void;
  onDeleteMemory: (id: string) => void;
  onExportBackup: (format: 'json' | 'md') => void;
  onInspectBackupFile: (rawJson: string, filename: string) => void;
}

export const MemoryVaultView: React.FC<MemoryVaultViewProps> = ({
  memories,
  onAddMemory,
  onDeleteMemory,
  onExportBackup,
  onInspectBackupFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | MemoryItem['category']>('ALL');
  const [keyInput, setKeyInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<MemoryItem['category']>('PREFERENCE');
  const [contentInput, setContentInput] = useState('');
  const [importanceInput, setImportanceInput] = useState(4);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return memories.filter((m) => {
      const catMatch = categoryFilter === 'ALL' || m.category === categoryFilter;
      const textMatch =
        !q ||
        m.key.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [memories, search, categoryFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim() || !contentInput.trim()) return;
    onAddMemory({
      key: keyInput.trim(),
      category: categoryInput,
      content: contentInput.trim(),
      importance: importanceInput,
    });
    setKeyInput('');
    setContentInput('');
    setImportanceInput(4);
  };

  return (
    <div className="space-y-6">
      {/* Add Memory Form */}
      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-300" />
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
          Facts stored here are persisted locally and injected into JARVIS system context for every Gemini conversation.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Memory Title / Key (e.g. Coding Stack)"
            className="sm:col-span-2 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <select
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value as MemoryItem['category'])}
            aria-label="Memory category"
            className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2.5 font-mono-hud text-xs text-cyan-200 focus:outline-none"
          >
            <option value="PREFERENCE">PREFERENCE</option>
            <option value="PROJECT">PROJECT</option>
            <option value="INSTRUCTION">INSTRUCTION</option>
            <option value="COMMAND">COMMAND</option>
            <option value="FACT">FACT</option>
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

      {/* Search & Filter */}
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

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | MemoryItem['category'])}
          aria-label="Filter memory category"
          className="bg-[#070D18] border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono-hud text-xs text-cyan-200 focus:outline-none"
        >
          <option value="ALL">ALL CATEGORIES ({memories.length})</option>
          <option value="PREFERENCE">PREFERENCE</option>
          <option value="PROJECT">PROJECT</option>
          <option value="INSTRUCTION">INSTRUCTION</option>
          <option value="COMMAND">COMMAND</option>
          <option value="FACT">FACT</option>
        </select>
      </div>

      {/* Memories List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((mem) => (
          <div key={mem.id} className="glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-cyan-400/15 border border-cyan-400/30 font-mono-hud text-[10px] text-cyan-300">
                  {mem.category}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono-hud text-[10px] text-amber-300">
                    {'★'.repeat(mem.importance)}
                  </span>
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
            <span className="font-mono-hud text-[10px] text-slate-500">
              Stored {new Date(mem.createdAt).toLocaleDateString()}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 glass-panel rounded-2xl p-8 text-center text-sm text-slate-400">
            No matching memories found in vault.
          </div>
        )}
      </div>
    </div>
  );
};

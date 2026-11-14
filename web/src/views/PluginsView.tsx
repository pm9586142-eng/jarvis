import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Info, Play, Plus, Puzzle } from 'lucide-react';
import {
  JarvisPlugin,
  KanbanCard,
  TrelloKanbanPlugin,
} from '../services/plugins';

interface PluginsViewProps {
  plugins: JarvisPlugin[];
  onTogglePlugin: (pluginId: string) => void;
  onExecutePluginTool: (pluginId: string, toolId: string, params: Record<string, string>) => Promise<void>;
  lastToolOutput: string | null;
}

export const PluginsView: React.FC<PluginsViewProps> = ({
  plugins,
  onTogglePlugin,
  onExecutePluginTool,
  lastToolOutput,
}) => {
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardColumn, setNewCardColumn] = useState<KanbanCard['column']>('To Do');
  const [busyToolKey, setBusyToolKey] = useState<string | null>(null);

  const trelloPlugin = plugins.find((p) => p.id === 'plugin_trello_asana') as
    | TrelloKanbanPlugin
    | undefined;

  const handleRunTool = async (
    pluginId: string,
    toolId: string,
    params: Record<string, string> = {}
  ) => {
    const key = `${pluginId}:${toolId}`;
    setBusyToolKey(key);
    try {
      await onExecutePluginTool(pluginId, toolId, params);
    } finally {
      setBusyToolKey(null);
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim() || !trelloPlugin) return;
    await handleRunTool(trelloPlugin.id, 'create_card', {
      title: newCardTitle.trim(),
      column: newCardColumn,
    });
    setNewCardTitle('');
  };

  const nextColumn = (col: KanbanCard['column']): KanbanCard['column'] => {
    if (col === 'To Do') return 'In Progress';
    if (col === 'In Progress') return 'Done';
    return 'To Do';
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-4 flex items-start gap-3 border border-cyan-500/30">
        <Info className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-mono-hud font-bold text-cyan-300">MODULAR PLUGIN MATRIX</p>
          <p>
            Plugins below demonstrate modular JARVIS tool registration and interactive state updates. External GitHub & Home Assistant endpoints run in local demo mode until external API webhooks/tokens are connected.
          </p>
        </div>
      </div>

      {/* Plugin Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {plugins.map((plugin) => (
          <div key={plugin.id} className="glass-panel rounded-2xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Puzzle className="w-4 h-4 text-violet-300" />
                    <h3 className="text-sm font-semibold text-slate-100">{plugin.name}</h3>
                  </div>
                  <p className="font-mono-hud text-[10px] text-slate-400 mt-0.5">
                    v{plugin.version} • {plugin.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onTogglePlugin(plugin.id)}
                  className={`px-2.5 py-1 rounded-lg font-mono-hud text-[10px] font-bold border cursor-pointer ${
                    plugin.isEnabled
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-[#040812] border-slate-700 text-slate-400'
                  }`}
                >
                  {plugin.isEnabled ? 'ACTIVE' : 'DISABLED'}
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{plugin.description}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <p className="font-mono-hud text-[10px] text-cyan-300 uppercase">Registered Tools:</p>
              <div className="flex flex-wrap gap-2">
                {plugin.getDeclaredTools().map((tool) => {
                  const key = `${plugin.id}:${tool.id}`;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      disabled={!plugin.isEnabled || busyToolKey === key}
                      onClick={() => handleRunTool(plugin.id, tool.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 disabled:opacity-40 text-[11px] font-mono-hud text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-cyan-400" />
                      <span>{tool.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Last Plugin Execution Output */}
      {lastToolOutput && (
        <div className="glass-panel rounded-2xl p-4 border border-emerald-500/40">
          <div className="flex items-center gap-2 font-mono-hud text-xs font-bold text-emerald-400 mb-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>PLUGIN TOOL OUTPUT</span>
          </div>
          <pre className="font-mono-hud text-xs text-slate-200 whitespace-pre-wrap">{lastToolOutput}</pre>
        </div>
      )}

      {/* Interactive Trello & Asana Kanban Board */}
      {trelloPlugin && trelloPlugin.isEnabled && (
        <div className="glass-panel rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                STARK SPRINT KANBAN BOARD (INTERACTIVE PLUGIN)
              </h3>
              <p className="text-xs text-slate-400">
                Create cards and advance workflow columns directly through the TrelloKanbanPlugin API
              </p>
            </div>
          </div>

          <form onSubmit={handleAddCard} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="New sprint card title..."
              className="flex-1 min-w-[200px] bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <select
              value={newCardColumn}
              onChange={(e) => setNewCardColumn(e.target.value as KanbanCard['column'])}
              aria-label="Select board column"
              className="bg-[#040812] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-hud text-cyan-200 focus:outline-none"
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
            <button
              type="submit"
              disabled={!newCardTitle.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] font-display text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ADD CARD</span>
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['To Do', 'In Progress', 'Done'] as const).map((col) => {
              const cards = trelloPlugin.boardCards.filter((c) => c.column === col);
              return (
                <div key={col} className="rounded-xl bg-[#040812] border border-slate-800 p-3 space-y-2.5">
                  <div className="flex items-center justify-between font-mono-hud text-xs">
                    <span className="font-bold text-slate-200">{col.toUpperCase()}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300">{cards.length}</span>
                  </div>

                  <div className="space-y-2">
                    {cards.map((card) => (
                      <div
                        key={card.id}
                        className="rounded-lg bg-[#0D1527] border border-slate-800 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-hud text-[10px] text-cyan-400">{card.id}</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleRunTool(trelloPlugin.id, 'move_card', {
                                card_id: card.id,
                                column: nextColumn(card.column),
                              })
                            }
                            className="font-mono-hud text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
                          >
                            <span>MOVE</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-200">{card.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

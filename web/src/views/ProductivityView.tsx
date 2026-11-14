import React, { useState } from 'react';
import { CalendarCheck, CheckSquare, Plus, Sparkles, Square, Trash2 } from 'lucide-react';
import { TaskItem } from '../types/jarvis';

interface ProductivityViewProps {
  tasks: TaskItem[];
  onAddTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'isCompleted'>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onRequestFridayBriefing: () => void;
}

export const ProductivityView: React.FC<ProductivityViewProps> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onRequestFridayBriefing,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueTime, setDueTime] = useState('Today 18:00');
  const [priority, setPriority] = useState<TaskItem['priority']>('MEDIUM');
  const [category, setCategory] = useState<TaskItem['category']>('TASK');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

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
              EXECUTIVE PLANNER & PROTOCOL QUEUE
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            {pendingCount} pending item(s) across tasks, reminders, and Stark schedules.
          </p>
        </div>

        <button
          type="button"
          onClick={onRequestFridayBriefing}
          className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>GENERATE FRIDAY BRIEFING</span>
        </button>
      </div>

      {/* Add Task Form */}
      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-5 space-y-3">
        <h4 className="font-mono-hud text-xs font-bold text-cyan-300">ADD DIRECTIVE / REMINDER</h4>
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
            className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-1.5 cursor-pointer"
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
                </div>
                <p className="text-xs text-slate-400">{task.description}</p>
                <p className="font-mono-hud text-[11px] text-cyan-300">Due: {task.dueTime}</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onDeleteTask(task.id)}
              aria-label={`Delete task ${task.title}`}
              className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {visibleTasks.length === 0 && (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-slate-400">
            No items in this queue view, Sir.
          </div>
        )}
      </div>
    </div>
  );
};

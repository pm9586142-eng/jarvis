import React, { useMemo, useState } from 'react';
import { Download, FileCode2, FileJson, FileSpreadsheet, X } from 'lucide-react';
import { AgentDescriptor, ChatMessage } from '../types/jarvis';

interface ChatExportModalProps {
  messages: ChatMessage[];
  agent: AgentDescriptor;
  onClose: () => void;
  onExported: (format: 'json' | 'csv' | 'md') => void;
}

export const ChatExportModal: React.FC<ChatExportModalProps> = ({
  messages,
  agent,
  onClose,
  onExported,
}) => {
  const [selectedExportFormat, setSelectedExportFormat] = useState<'json' | 'csv' | 'md'>('json');

  const buildTranscriptPayload = (format: 'json' | 'csv' | 'md') => {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes()
    ).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    if (format === 'json') {
      const content = JSON.stringify(
        {
          system: 'AM AI — Cosmic Intelligence',
          exportedAt: now.toISOString(),
          activeAgent: agent.codename,
          messageCount: messages.length,
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            sender: m.role === 'user' ? 'Sir' : m.agentCodename,
            agentCodename: m.agentCodename,
            timestamp: m.timestamp,
            isoTime: new Date(m.timestamp).toISOString(),
            isVoice: Boolean(m.isVoice),
            isError: Boolean(m.isError),
            text: m.text,
            sources: m.sources ?? [],
          })),
        },
        null,
        2
      );
      return {
        content,
        mimeType: 'application/json;charset=utf-8',
        filename: `am-ai-transcript-${stamp}.json`,
      };
    }

    if (format === 'csv') {
      const csvCell = (val: string | number | boolean) =>
        `"${String(val).replace(/"/g, '""')}"`;

      const headerRow = [
        'id',
        'timestamp',
        'iso_time',
        'role',
        'sender',
        'agent_codename',
        'is_voice',
        'is_error',
        'text',
        'sources',
      ]
        .map(csvCell)
        .join(',');

      const rows = messages.map((m) =>
        [
          m.id,
          m.timestamp,
          new Date(m.timestamp).toISOString(),
          m.role,
          m.role === 'user' ? 'Sir' : m.agentCodename,
          m.agentCodename,
          Boolean(m.isVoice),
          Boolean(m.isError),
          m.text,
          (m.sources ?? []).map((s) => `${s.title} (${s.uri})`).join(' | '),
        ]
          .map(csvCell)
          .join(',')
      );

      return {
        content: `\uFEFF${headerRow}\n${rows.join('\n')}\n`,
        mimeType: 'text/csv;charset=utf-8',
        filename: `am-ai-transcript-${stamp}.csv`,
      };
    }

    const mdHeader = [
      '# AM AI — Neural Chat Transcript',
      '',
      `- **Exported:** ${now.toLocaleString()}`,
      `- **Active Agent:** ${agent.codename} (${agent.designation})`,
      `- **Messages:** ${messages.length}`,
      '',
      '---',
      '',
    ].join('\n');

    const mdBody = messages
      .map((m) => {
        const timeStr = new Date(m.timestamp).toLocaleString();
        const sender = m.role === 'user' ? 'Sir' : m.agentCodename;
        const badges = [
          m.isVoice ? '`VOICE`' : null,
          m.isError ? '`ERROR`' : null,
        ]
          .filter(Boolean)
          .join(' ');
        const badgeSuffix = badges ? ` ${badges}` : '';
        const sourcesSection =
          m.sources && m.sources.length > 0
            ? '\n\n**Verified Sources:**\n' +
              m.sources.map((s) => `- [${s.title}](${s.uri})`).join('\n')
            : '';
        return `### ${sender}${badgeSuffix}\n*${timeStr}*\n\n${m.text}${sourcesSection}`;
      })
      .join('\n\n---\n\n');

    return {
      content: `${mdHeader}${mdBody}\n`,
      mimeType: 'text/markdown;charset=utf-8',
      filename: `am-ai-transcript-${stamp}.md`,
    };
  };

  const previewText = useMemo(() => {
    if (messages.length === 0) return '';
    const { content } = buildTranscriptPayload(selectedExportFormat);
    const lines = content.split('\n').slice(0, 9);
    const truncated = lines.join('\n');
    return content.split('\n').length > 9 ? `${truncated}\n...` : truncated;
  }, [selectedExportFormat, messages, agent]);

  const handleDownload = () => {
    if (messages.length === 0) return;
    const { content, mimeType, filename } = buildTranscriptPayload(selectedExportFormat);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExported(selectedExportFormat);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-options-title"
        className="glass-panel-glow rounded-2xl p-5 sm:p-6 max-w-lg w-full space-y-4 border border-cyan-500/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="export-options-title"
              className="font-display text-base sm:text-lg font-semibold text-cyan-300 tracking-wide"
            >
              EXPORT OPTIONS
            </h2>
            <p className="font-mono-hud text-[11px] text-slate-400 mt-0.5">
              Select format for {messages.length} message{messages.length === 1 ? '' : 's'} • Agent: {agent.codename}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export options"
            className="p-1.5 rounded-lg border border-slate-800 bg-[#0D1527] text-slate-400 hover:text-cyan-300 hover:border-cyan-400/50 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(
            [
              { id: 'json', label: 'JSON', ext: '.json', desc: 'Structured payload & metadata', Icon: FileJson },
              { id: 'csv', label: 'CSV', ext: '.csv', desc: 'Spreadsheet-ready rows', Icon: FileSpreadsheet },
              { id: 'md', label: 'Markdown', ext: '.md', desc: 'Readable formatted doc', Icon: FileCode2 },
            ] as const
          ).map(({ id, label, ext, desc, Icon }) => {
            const isSelected = selectedExportFormat === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedExportFormat(id)}
                className={`flex flex-col items-start text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_16px_rgba(34,211,238,0.18)]'
                    : 'bg-[#0D1527]/90 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`} />
                  <span
                    className={`font-mono-hud text-[10px] px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/40'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {ext}
                  </span>
                </div>
                <span className="font-display text-sm font-semibold">{label}</span>
                <span className="text-[11px] text-slate-400 mt-0.5 leading-snug">{desc}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono-hud text-[10px] text-cyan-300 uppercase tracking-wider">
              LIVE PREVIEW (.{selectedExportFormat.toUpperCase()})
            </span>
            <span className="font-mono-hud text-[10px] text-slate-500">UTF-8 Transcript</span>
          </div>
          <pre className="bg-[#040812] border border-slate-800/90 rounded-xl p-3 font-mono-hud text-[11px] leading-relaxed text-slate-300 max-h-40 overflow-auto whitespace-pre-wrap break-words">
            {previewText}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 bg-[#0D1527] hover:border-slate-500 font-mono-hud text-xs text-slate-300 cursor-pointer transition-colors"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 font-mono-hud text-xs font-semibold text-[#02040A] cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOWNLOAD .{selectedExportFormat.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

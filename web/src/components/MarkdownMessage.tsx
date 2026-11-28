import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownMessageProps {
  content: string;
  searchQuery?: string;
}

type BlockNode =
  | { type: 'code'; language: string; code: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; alt: string; url: string }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string };

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') && !trimmed.includes('-')) return false;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function parseMarkdownBlocks(raw: string): BlockNode[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = trimmed.match(/^```([a-zA-Z0-9_+-]*)/);
    if (fenceMatch) {
      const language = fenceMatch[1] || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++;
      }
      blocks.push({ type: 'code', language, code: codeLines.join('\n') });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Standalone Markdown image: ![alt](url)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      blocks.push({
        type: 'image',
        alt: imageMatch[1] || 'Visual asset',
        url: imageMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // Table
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph (consume until blank line or next block syntax)
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      const nextTrimmed = next.trim();
      if (
        !nextTrimmed ||
        nextTrimmed.startsWith('```') ||
        /^#{1,4}\s+/.test(nextTrimmed) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrimmed) ||
        nextTrimmed.startsWith('>') ||
        /^\s*[-*+]\s+/.test(next) ||
        /^\s*\d+\.\s+/.test(next) ||
        (nextTrimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(next);
      i++;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
  }

  return blocks;
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:')
  );
}

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/')
  );
}

function highlightQuery(text: string, query?: string): React.ReactNode {
  const trimmed = query?.trim();
  if (!trimmed) return text;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <mark
        key={idx}
        className="bg-cyan-400/35 text-cyan-100 rounded px-0.5 border-b border-cyan-300"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function renderInline(text: string, searchQuery?: string): React.ReactNode {
  // Matches: `code`, [label](url), **bold**, __bold__, *italic*, _italic_
  const tokenRegex =
    /(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-[#040812] border border-cyan-500/30 font-mono-hud text-[0.85em] text-cyan-200"
        >
          {highlightQuery(part.slice(1, -1), searchQuery)}
        </code>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, rawUrl] = linkMatch;
      if (isSafeUrl(rawUrl)) {
        return (
          <a
            key={idx}
            href={rawUrl.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 underline decoration-cyan-400/60 hover:text-cyan-100 break-words"
          >
            {highlightQuery(label, searchQuery)}
          </a>
        );
      }
      return <span key={idx}>{highlightQuery(label, searchQuery)}</span>;
    }

    if (
      (part.startsWith('**') && part.endsWith('**') && part.length > 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length > 4)
    ) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {highlightQuery(part.slice(2, -2), searchQuery)}
        </strong>
      );
    }

    if (
      (part.startsWith('*') && part.endsWith('*') && part.length > 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length > 2)
    ) {
      return (
        <em key={idx} className="italic text-slate-200">
          {highlightQuery(part.slice(1, -1), searchQuery)}
        </em>
      );
    }

    return <React.Fragment key={idx}>{highlightQuery(part, searchQuery)}</React.Fragment>;
  });
}

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard permission failure
    }
  };

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-cyan-500/30 bg-[#030712]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#091224] border-b border-slate-800">
        <span className="font-mono-hud text-[10px] uppercase tracking-wider text-cyan-300">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          aria-label="Copy code block"
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 font-mono-hud text-[10px] text-slate-200 hover:text-cyan-200 cursor-pointer transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-300">COPIED</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>COPY CODE</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono-hud text-xs leading-relaxed text-cyan-100">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, searchQuery }) => {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-3 text-[15px] sm:text-base leading-[1.7] text-slate-100 break-words">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'code':
            return <CodeBlock key={idx} language={block.language} code={block.code} />;

          case 'image':
            return isSafeImageUrl(block.url) ? (
              <figure
                key={idx}
                className="my-3 rounded-xl overflow-hidden border border-cyan-500/25 bg-[#040812]/80 inline-block max-w-full"
              >
                <img
                  src={block.url}
                  alt={block.alt}
                  loading="lazy"
                  className="max-h-96 w-auto max-w-full object-contain block"
                />
                {block.alt && block.alt !== 'Visual asset' && (
                  <figcaption className="px-3 py-1.5 font-mono-hud text-[11px] text-slate-400 border-t border-slate-800/80">
                    {block.alt}
                  </figcaption>
                )}
              </figure>
            ) : null;

          case 'heading': {
            const sizeClass =
              block.level === 1
                ? 'text-lg sm:text-xl font-bold text-cyan-200'
                : block.level === 2
                  ? 'text-base sm:text-lg font-bold text-cyan-300'
                  : 'text-[15px] sm:text-base font-semibold text-cyan-300';
            return (
              <p key={idx} className={`font-display tracking-wide pt-1.5 ${sizeClass}`}>
                {renderInline(block.text, searchQuery)}
              </p>
            );
          }

          case 'hr':
            return <hr key={idx} className="border-slate-700/80 my-2" />;

          case 'blockquote':
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-cyan-400/70 pl-3 py-0.5 text-slate-300 italic space-y-1 bg-cyan-500/5 rounded-r-lg"
              >
                {block.lines.map((line, lineIdx) => (
                  <p key={lineIdx}>{renderInline(line, searchQuery)}</p>
                ))}
              </blockquote>
            );

          case 'ul':
            return (
              <ul key={idx} className="list-disc list-inside space-y-1 pl-1">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="text-slate-100">
                    {renderInline(item, searchQuery)}
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={idx} className="list-decimal list-inside space-y-1 pl-1">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="text-slate-100">
                    {renderInline(item, searchQuery)}
                  </li>
                ))}
              </ol>
            );

          case 'table':
            return (
              <div
                key={idx}
                className="overflow-x-auto rounded-xl border border-cyan-500/30 bg-[#040812]/80 my-1"
              >
                <table className="min-w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0B162C] border-b border-slate-700">
                      {block.headers.map((header, hIdx) => (
                        <th
                          key={hIdx}
                          className="px-3 py-2 font-mono-hud font-semibold text-cyan-200 whitespace-nowrap"
                        >
                          {renderInline(header, searchQuery)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-slate-800/80 last:border-b-0 hover:bg-white/[0.02]"
                      >
                        {block.headers.map((_, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 text-slate-200 align-top">
                            {renderInline(row[cIdx] ?? '', searchQuery)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'paragraph':
          default:
            return (
              <p key={idx} className="whitespace-pre-wrap">
                {renderInline(block.text, searchQuery)}
              </p>
            );
        }
      })}
    </div>
  );
};

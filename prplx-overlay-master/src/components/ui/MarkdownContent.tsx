import React, { useState } from "react"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import clsx from "clsx"
import { Check, Copy } from "lucide-react"

interface MarkdownContentProps {
  content: string
  className?: string
}

const CodeBlock: React.FC<{ language: string; value: string }> = ({
  language,
  value
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch (error) {
      console.error("Failed to copy code block:", error)
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-white/10 bg-[rgba(10,15,28,0.72)]">
      <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-1 text-[10px] text-white/60">
        <span className="font-mono uppercase tracking-wider">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-white/75 hover:bg-white/10 hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={dracula as any}
        wrapLongLines
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "0.65rem 0.75rem",
          fontSize: "0.75rem"
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className
}) => {
  if (!content?.trim()) {
    return null
  }

  const components: Components = {
    code({ inline, className: codeClassName, children, ...props }: any) {
      const languageMatch = /language-([\w-]+)/.exec(codeClassName ?? "")
      const rawValue = String(children).replace(/\n$/, "")
      if (!inline && (languageMatch || rawValue.includes("\n"))) {
        return <CodeBlock language={languageMatch?.[1] || "text"} value={rawValue} />
      }

      return (
        <code className="rounded bg-white/10 px-[4px] py-[1px] font-mono text-[11px]" {...props}>
          {children}
        </code>
      )
    },
    a({ href, children, ...props }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (href && /^https?:\/\//i.test(href) && window.electronAPI?.openExternalUrl) {
              e.preventDefault()
              void window.electronAPI.openExternalUrl(href)
            }
          }}
          className="text-blue-300 underline decoration-blue-400/50 hover:text-blue-200"
          {...props}
        >
          {children}
        </a>
      )
    },
    table({ children, ...props }) {
      return (
        <div className="my-2 overflow-x-auto rounded-md border border-white/10">
          <table className="w-full text-left text-xs text-gray-100" {...props}>
            {children}
          </table>
        </div>
      )
    },
    th({ children, ...props }) {
      return (
        <th
          className="bg-white/5 px-2.5 py-1.5 font-medium text-gray-50"
          {...props}
        >
          {children}
        </th>
      )
    },
    td({ children, ...props }) {
      return (
        <td className="border-t border-white/5 px-2.5 py-1.5 text-gray-100/90" {...props}>
          {children}
        </td>
      )
    },
    p({ children, ...props }) {
      return (
        <p className="mb-2 last:mb-0 text-gray-100/95" {...props}>
          {children}
        </p>
      )
    },
    ul({ children, ...props }) {
      return (
        <ul
          className="mb-2 ml-4 list-disc space-y-1 text-gray-100/90"
          {...props}
        >
          {children}
        </ul>
      )
    },
    ol({ children, ...props }) {
      return (
        <ol
          className="mb-2 ml-4 list-decimal space-y-1 text-gray-100/90"
          {...props}
        >
          {children}
        </ol>
      )
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote
          className="my-2 border-l-2 border-blue-400/50 pl-3 text-gray-100/80"
          {...props}
        >
          {children}
        </blockquote>
      )
    }
  }

  return (
    <ReactMarkdown
      className={clsx(
        "prose prose-invert prose-sm max-w-none text-xs leading-[1.5] prose-headings:text-white prose-strong:text-white prose-a:text-blue-300 hover:prose-a:text-blue-200 prose-code:bg-white/10 prose-code:text-white prose-code:px-[3px] prose-code:py-[1px] prose-code:rounded prose-code:font-medium prose-blockquote:border-l-blue-500/50 prose-li:marker:text-blue-300",
        className
      )}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
}

export default MarkdownContent

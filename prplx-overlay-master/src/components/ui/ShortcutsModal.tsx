import React from "react"
import { Keyboard, X, Camera, Scissors, Crosshair, Trash2, Power } from "lucide-react"

interface ShortcutsModalProps {
  open: boolean
  isMac: boolean
  onClose: () => void
  onSnipScreen: () => void
  onFullScreenshot: () => void
  onCenterWindow: () => void
  onResetQueues: () => void
  onQuit: () => void
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  open,
  isMac,
  onClose,
  onSnipScreen,
  onFullScreenshot,
  onCenterWindow,
  onResetQueues,
  onQuit
}) => {
  if (!open) return null

  const mod = isMac ? "⌘" : "Ctrl+"

  const shortcuts = [
    { keys: `${mod}↓`, desc: "Show / Hide overlay window" },
    { keys: `${mod}⇧Space`, desc: "Center and focus overlay" },
    { keys: `${mod}'`, desc: "Toggle active / click-through passive mode" },
    { keys: `${mod}← / → / ↑`, desc: "Move overlay left, right, or up" },
    { keys: `${mod}⇧↓`, desc: "Move overlay down" },
    { keys: `${mod}↵`, desc: "Snip screen region & attach screenshot" },
    { keys: `${mod}H`, desc: "Capture full-screen screenshot" },
    { keys: `${mod}1 / ${mod}⇧↵`, desc: "Quick region snip & auto-send" },
    { keys: `${mod}2 / ${mod}⌥↵`, desc: "Quick region snip & deep-solve prompt" },
    { keys: `${mod}⇧C`, desc: "Paste clipboard text or image & ask" },
    { keys: `${mod}⇧N`, desc: "Start a fresh chat" },
    { keys: `${mod}L`, desc: "Toggle extended thinking suffix" },
    { keys: `${mod}W`, desc: "Toggle Perplexity web search" },
    { keys: `${mod}M / , / . / /`, desc: "Switch Sonar / GPT-5 / Reasoning / Claude" },
    { keys: `${mod}R`, desc: "Cancel active requests & reset queues" }
  ]

  return (
    <div className="mb-3 rounded-xl border border-white/15 bg-[rgba(10,16,32,0.92)] p-3 text-xs text-white space-y-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 font-semibold">
          <Keyboard className="h-3.5 w-3.5 text-blue-400" />
          <span>Shortcuts & Quick Actions</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="overlay-button h-6 w-6 flex items-center justify-center rounded-md"
          title="Close shortcuts"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            onClose()
            onSnipScreen()
          }}
          className="overlay-button inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
        >
          <Scissors className="h-3 w-3" /> Snip Region
        </button>
        <button
          type="button"
          onClick={() => {
            onClose()
            onFullScreenshot()
          }}
          className="overlay-button inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
        >
          <Camera className="h-3 w-3" /> Full Screen
        </button>
        <button
          type="button"
          onClick={onCenterWindow}
          className="overlay-button inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
        >
          <Crosshair className="h-3 w-3" /> Center
        </button>
        <button
          type="button"
          onClick={onResetQueues}
          className="overlay-button inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
        >
          <Trash2 className="h-3 w-3" /> Reset Queue
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="inline-flex items-center gap-1 rounded-md bg-red-500/20 hover:bg-red-500/35 px-2 py-1 text-[10px] text-red-200 transition-colors"
        >
          <Power className="h-3 w-3" /> Quit App
        </button>
      </div>

      {/* Shortcuts Grid */}
      <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
        {shortcuts.map((item) => (
          <div
            key={item.keys}
            className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1"
          >
            <span className="text-[11px] text-white/80">{item.desc}</span>
            <kbd className="shrink-0 rounded border border-white/15 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-blue-200">
              {item.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ShortcutsModal

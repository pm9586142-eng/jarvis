import React, { useState, useEffect, useRef } from "react"
import { IoLogOutOutline } from "react-icons/io5"

interface SolutionCommandsProps {
  extraScreenshots: Array<{ path: string; preview: string }>
  onTooltipVisibilityChange?: (visible: boolean, height: number) => void
  onBackToChat?: () => void
}

const SolutionCommands: React.FC<SolutionCommandsProps> = ({
  extraScreenshots,
  onTooltipVisibilityChange,
  onBackToChat
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (onTooltipVisibilityChange) {
      let tooltipHeight = 0
      if (tooltipRef.current && isTooltipVisible) {
        tooltipHeight = tooltipRef.current.offsetHeight + 10
      }
      onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
    }
  }, [isTooltipVisible, onTooltipVisibilityChange])

  const handleToggleWindow = () => {
    void window.electronAPI?.toggleWindow?.()
  }

  const handleScreenshot = () => {
    void window.electronAPI?.takeScreenshot?.()
  }

  const handleStartOver = async () => {
    await window.electronAPI?.resetQueues?.()
    onBackToChat?.()
  }

  return (
    <div>
      <div className="pt-1.5 w-fit">
        <div className="overlay-section text-xs text-white/90 rounded-lg py-1.5 px-3 flex flex-wrap items-center justify-center gap-3">
          {onBackToChat && (
            <button
              type="button"
              onClick={onBackToChat}
              className="overlay-button rounded-md px-2 py-1 text-[11px] leading-none"
            >
              ← Chat
            </button>
          )}

          {/* Show/Hide */}
          <button
            type="button"
            onClick={handleToggleWindow}
            className="flex items-center gap-2 whitespace-nowrap hover:text-white"
            title="Show or hide overlay (⌘↓)"
          >
            <span className="text-[11px] leading-none">Show/Hide</span>
            <span className="flex gap-1">
              <span className="overlay-pill rounded-md px-1.5 py-1 text-[11px] leading-none">
                ⌘
              </span>
              <span className="overlay-pill rounded-md px-1.5 py-1 text-[11px] leading-none">
                ↓
              </span>
            </span>
          </button>

          {/* Screenshot */}
          <button
            type="button"
            onClick={handleScreenshot}
            className="flex items-center gap-2 whitespace-nowrap hover:text-white"
            title="Take screenshot (⌘H)"
          >
            <span className="text-[11px] leading-none truncate">
              {extraScreenshots.length === 0 ? "Screenshot" : `Screenshots (${extraScreenshots.length})`}
            </span>
            <span className="flex gap-1">
              <span className="overlay-pill rounded-md px-1.5 py-1 text-[11px] leading-none">
                ⌘
              </span>
              <span className="overlay-pill rounded-md px-1.5 py-1 text-[11px] leading-none">
                H
              </span>
            </span>
          </button>

          {/* Start Over */}
          <button
            type="button"
            onClick={handleStartOver}
            className="flex items-center gap-2 whitespace-nowrap hover:text-white"
            title="Reset and start over (⌘R)"
          >
            <span className="text-[11px] leading-none">Start over</span>
            <span className="flex gap-1">
              <span className="overlay-pill rounded-md px-1.5 py-1 text-[11px] leading-none">
                ⌘
              </span>
              <span className="overlay-pill rounded-md px-1.5 py-1 text-[11px] leading-none">
                R
              </span>
            </span>
          </button>

          {/* Question Mark with Tooltip */}
          <div
            className="relative inline-block"
            onMouseEnter={() => setIsTooltipVisible(true)}
            onMouseLeave={() => setIsTooltipVisible(false)}
          >
            <div className="overlay-pill w-6 h-6 rounded-full transition-colors flex items-center justify-center cursor-help z-10">
              <span className="text-xs text-white/80">?</span>
            </div>

            {isTooltipVisible && (
              <div
                ref={tooltipRef}
                className="absolute top-full right-0 mt-2 w-72"
                style={{ zIndex: 100 }}
              >
                <div className="overlay-tooltip p-3 text-xs border border-white/15">
                  <div className="space-y-3">
                    <h3 className="font-medium whitespace-nowrap">
                      Keyboard Shortcuts
                    </h3>
                    <div className="space-y-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span>Toggle Window</span>
                        <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">⌘↓</kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Full Screenshot</span>
                        <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">⌘H</kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Region Snip</span>
                        <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">⌘↵</kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Start Over</span>
                        <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">⌘R</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="text-red-500/80 hover:text-red-400 transition-colors hover:cursor-pointer"
            title="Quit App"
            onClick={() => void window.electronAPI?.quitApp?.()}
          >
            <IoLogOutOutline className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SolutionCommands

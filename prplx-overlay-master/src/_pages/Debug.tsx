// Debug.tsx
import React, { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "react-query"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { ComplexitySection, ContentSection } from "./Solutions"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import {
  Toast,
  ToastDescription,
  ToastMessage,
  ToastTitle,
  ToastVariant
} from "../components/ui/toast"
import ExtraScreenshotsQueueHelper from "../components/Solutions/SolutionCommands"
import { diffLines } from "diff"

type DiffLine = {
  value: string
  added?: boolean
  removed?: boolean
}

const CodeComparisonSection = ({
  oldCode,
  newCode,
  isLoading
}: {
  oldCode: string | null
  newCode: string | null
  isLoading: boolean
}) => {
  const computeDiff = () => {
    if (!oldCode || !newCode) return { leftLines: [], rightLines: [] }

    const normalizeCode = (code: string) =>
      code.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()

    const normalizedOldCode = normalizeCode(oldCode)
    const normalizedNewCode = normalizeCode(newCode)

    const diff = diffLines(normalizedOldCode, normalizedNewCode, {
      newlineIsToken: true,
      ignoreWhitespace: true
    })

    const leftLines: DiffLine[] = []
    const rightLines: DiffLine[] = []

    diff.forEach((part) => {
      if (part.added) {
        const addedLines = part.value.split("\n").filter((line) => line.length > 0)
        leftLines.push(...Array(addedLines.length).fill({ value: "" }))
        rightLines.push(...addedLines.map((line) => ({ value: line, added: true })))
      } else if (part.removed) {
        const removedLines = part.value.split("\n").filter((line) => line.length > 0)
        leftLines.push(...removedLines.map((line) => ({ value: line, removed: true })))
        rightLines.push(...Array(removedLines.length).fill({ value: "" }))
      } else {
        const lines = part.value.split("\n").filter((line) => line.length > 0)
        leftLines.push(...lines.map((line) => ({ value: line })))
        rightLines.push(...lines.map((line) => ({ value: line })))
      }
    })

    return { leftLines, rightLines }
  }

  const { leftLines, rightLines } = computeDiff()

  return (
    <div className="space-y-1.5">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        Code Comparison
      </h2>
      {isLoading ? (
        <div className="space-y-1">
          <div className="mt-3 flex">
            <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
              Loading code comparison...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-row gap-0.5 bg-[#161b22] rounded-lg overflow-hidden">
          <div className="w-1/2 border-r border-gray-700">
            <div className="bg-[#2d333b] px-3 py-1.5">
              <h3 className="text-[11px] font-medium text-gray-200">
                Previous Version
              </h3>
            </div>
            <div className="p-3 overflow-x-auto">
              <SyntaxHighlighter
                language="python"
                style={dracula}
                customStyle={{
                  maxWidth: "100%",
                  margin: 0,
                  padding: "1rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all"
                }}
                wrapLines={true}
                showLineNumbers={true}
                lineProps={(lineNumber) => {
                  const line = leftLines[lineNumber - 1]
                  return {
                    style: {
                      display: "block",
                      backgroundColor: line?.removed
                        ? "rgba(139, 0, 0, 0.25)"
                        : "transparent"
                    }
                  }
                }}
              >
                {leftLines.map((line) => line.value).join("\n")}
              </SyntaxHighlighter>
            </div>
          </div>

          <div className="w-1/2">
            <div className="bg-[#2d333b] px-3 py-1.5">
              <h3 className="text-[11px] font-medium text-gray-200">
                New Version
              </h3>
            </div>
            <div className="p-3 overflow-x-auto">
              <SyntaxHighlighter
                language="python"
                style={dracula}
                customStyle={{
                  maxWidth: "100%",
                  margin: 0,
                  padding: "1rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all"
                }}
                wrapLines={true}
                showLineNumbers={true}
                lineProps={(lineNumber) => {
                  const line = rightLines[lineNumber - 1]
                  return {
                    style: {
                      display: "block",
                      backgroundColor: line?.added
                        ? "rgba(0, 139, 0, 0.25)"
                        : "transparent"
                    }
                  }
                }}
              >
                {rightLines.map((line) => line.value).join("\n")}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface DebugProps {
  isProcessing: boolean
  setIsProcessing: (isProcessing: boolean) => void
  onBackToChat?: () => void
}

const Debug: React.FC<DebugProps> = ({
  isProcessing,
  setIsProcessing,
  onBackToChat
}) => {
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const [oldCode, setOldCode] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(null)
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(null)

  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral"
  })

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)

  const { data: extraScreenshots = [], refetch } = useQuery<
    Array<{ path: string; preview: string }>,
    Error
  >({
    queryKey: ["extras"],
    queryFn: async () => {
      if (!window.electronAPI?.getScreenshots) return []
      try {
        return await window.electronAPI.getScreenshots()
      } catch (error) {
        console.error("Error loading extra screenshots:", error)
        return []
      }
    },
    staleTime: Infinity,
    cacheTime: Infinity
  })

  const showToast = (title: string, description: string, variant: ToastVariant) => {
    setToastMessage({ title, description, variant })
    setToastOpen(true)
  }

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index]
    if (!screenshotToDelete) return

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )
      if (response.success) {
        void refetch()
      } else {
        console.error("Failed to delete extra screenshot:", response.error)
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error)
    }
  }

  useEffect(() => {
    const api = window.electronAPI
    const newSolution = queryClient.getQueryData<{
      old_code?: string
      new_code?: string
      code?: string
      thoughts?: string[]
      time_complexity?: string
      space_complexity?: string
    }>(["new_solution"])

    if (newSolution) {
      setOldCode(newSolution.old_code || null)
      setNewCode(newSolution.new_code || newSolution.code || null)
      setThoughtsData(newSolution.thoughts || null)
      setTimeComplexityData(newSolution.time_complexity || null)
      setSpaceComplexityData(newSolution.space_complexity || null)
      setIsProcessing(false)
    }

    const cleanupFunctions = api
      ? [
          api.onScreenshotTaken(() => void refetch()),
          api.onResetView(() => void refetch()),
          api.onDebugSuccess((data) => {
            const sol = data?.solution
            if (sol) {
              setOldCode(sol.old_code || null)
              setNewCode(sol.new_code || sol.code || null)
              setThoughtsData(sol.thoughts || null)
              setTimeComplexityData(sol.time_complexity || null)
              setSpaceComplexityData(sol.space_complexity || null)
            }
            setIsProcessing(false)
          }),
          api.onDebugStart(() => {
            setIsProcessing(true)
          }),
          api.onDebugError((error: string) => {
            showToast(
              "Processing Failed",
              error || "There was an error debugging your code.",
              "error"
            )
            setIsProcessing(false)
          })
        ]
      : []

    const updateDimensions = () => {
      if (contentRef.current && api) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (isTooltipVisible) {
          contentHeight += tooltipHeight
        }
        void api.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [queryClient, isTooltipVisible, tooltipHeight, refetch, setIsProcessing])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  return (
    <div ref={contentRef} className="relative space-y-3 px-4 py-3 liquid-glass m-2">
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        variant={toastMessage.variant}
        duration={3000}
      >
        <ToastTitle>{toastMessage.title}</ToastTitle>
        <ToastDescription>{toastMessage.description}</ToastDescription>
      </Toast>

      <div className="bg-transparent w-fit">
        <div className="pb-3">
          <div className="space-y-3 w-fit">
            <ScreenshotQueue
              screenshots={extraScreenshots}
              onDeleteScreenshot={handleDeleteExtraScreenshot}
              isLoading={isProcessing}
            />
          </div>
        </div>
      </div>

      <ExtraScreenshotsQueueHelper
        extraScreenshots={extraScreenshots}
        onTooltipVisibilityChange={handleTooltipVisibilityChange}
        onBackToChat={onBackToChat}
      />

      <div className="w-full text-sm text-white px-3 py-2 space-y-4">
        <ContentSection
          title="What Changed"
          content={
            thoughtsData && (
              <div className="space-y-3">
                <div className="space-y-1">
                  {thoughtsData.map((thought, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                      <div>{thought}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
          isLoading={!thoughtsData}
        />

        <CodeComparisonSection
          oldCode={oldCode}
          newCode={newCode}
          isLoading={!oldCode || !newCode}
        />

        <ComplexitySection
          timeComplexity={timeComplexityData}
          spaceComplexity={spaceComplexityData}
          isLoading={!timeComplexityData || !spaceComplexityData}
        />
      </div>
    </div>
  )
}

export default Debug

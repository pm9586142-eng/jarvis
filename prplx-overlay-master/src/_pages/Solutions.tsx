// Solutions.tsx
import React, { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "react-query"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import MarkdownContent from "../components/ui/MarkdownContent"

import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import {
  Toast,
  ToastDescription,
  ToastMessage,
  ToastTitle,
  ToastVariant
} from "../components/ui/toast"
import { ProblemStatementData } from "../types/solutions"
import { AudioResult } from "../types/audio"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import Debug from "./Debug"

interface CachedSolutionData {
  code?: string
  thoughts?: string[]
  time_complexity?: string
  space_complexity?: string
}

export const ContentSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">{title}</h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Extracting problem statement...
        </p>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 max-w-[600px]">
        {typeof content === "string" ? <MarkdownContent content={content} /> : content}
      </div>
    )}
  </div>
)

const SolutionSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">{title}</h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <div className="mt-4 flex">
          <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
            Loading solutions...
          </p>
        </div>
      </div>
    ) : (
      <div className="w-full">
        <SyntaxHighlighter
          showLineNumbers
          language="python"
          style={dracula}
          customStyle={{
            maxWidth: "100%",
            margin: 0,
            padding: "0.25rem 0",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "transparent",
            boxShadow: "none"
          }}
          wrapLongLines={true}
        >
          {typeof content === "string" ? content : String(content ?? "")}
        </SyntaxHighlighter>
      </div>
    )}
  </div>
)

export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading
}: {
  timeComplexity: string | null
  spaceComplexity: string | null
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      Complexity
    </h2>
    {isLoading ? (
      <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
        Calculating complexity...
      </p>
    ) : (
      <div className="space-y-1">
        <div className="flex items-start gap-2 text-[13px] leading-[1.4] text-gray-100">
          <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
          <div>
            <strong>Time:</strong> {timeComplexity}
          </div>
        </div>
        <div className="flex items-start gap-2 text-[13px] leading-[1.4] text-gray-100">
          <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
          <div>
            <strong>Space:</strong> {spaceComplexity}
          </div>
        </div>
      </div>
    )}
  </div>
)

interface SolutionsProps {
  setView: React.Dispatch<React.SetStateAction<"queue" | "solutions" | "debug">>
}

const Solutions: React.FC<SolutionsProps> = ({ setView }) => {
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const [debugProcessing, setDebugProcessing] = useState(false)
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null)
  const [solutionData, setSolutionData] = useState<string | null>(null)
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
  const [isResetting, setIsResetting] = useState(false)

  const { data: extraScreenshots = [], refetch } = useQuery<
    Array<{ path: string; preview: string }>,
    Error
  >(
    ["extras"],
    async () => {
      if (!window.electronAPI?.getScreenshots) return []
      try {
        return await window.electronAPI.getScreenshots()
      } catch (error) {
        console.error("Error loading extra screenshots:", error)
        return []
      }
    },
    {
      staleTime: Infinity,
      cacheTime: Infinity
    }
  )

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
    if (!api) return

    const updateDimensions = () => {
      if (contentRef.current) {
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

    let resetTimer: ReturnType<typeof setTimeout> | null = null

    const cleanupFunctions = [
      api.onScreenshotTaken(() => void refetch()),
      api.onResetView(() => {
        setIsResetting(true)
        queryClient.removeQueries(["solution"])
        queryClient.removeQueries(["new_solution"])
        void refetch()
        resetTimer = setTimeout(() => {
          setIsResetting(false)
        }, 0)
      }),
      api.onSolutionStart(() => {
        // Reset UI cleanly without silently hijacking the user's microphone
        setSolutionData(null)
        setThoughtsData(null)
        setTimeComplexityData(null)
        setSpaceComplexityData(null)
      }),
      api.onSolutionError((error: string) => {
        showToast(
          "Processing Failed",
          error || "There was an error processing your screenshots.",
          "error"
        )
        const solution = queryClient.getQueryData<CachedSolutionData>(["solution"]) ?? null
        if (!solution) {
          setView("queue")
        }
        setSolutionData(solution?.code || null)
        setThoughtsData(solution?.thoughts || null)
        setTimeComplexityData(solution?.time_complexity || null)
        setSpaceComplexityData(solution?.space_complexity || null)
      }),
      api.onSolutionSuccess((data) => {
        if (!data?.solution) {
          console.warn("Received empty or invalid solution data")
          return
        }

        const parsedSolution: CachedSolutionData = {
          code: data.solution.code,
          thoughts: data.solution.thoughts,
          time_complexity: data.solution.time_complexity,
          space_complexity: data.solution.space_complexity
        }

        queryClient.setQueryData(["solution"], parsedSolution)
        setSolutionData(parsedSolution.code || null)
        setThoughtsData(parsedSolution.thoughts || null)
        setTimeComplexityData(parsedSolution.time_complexity || null)
        setSpaceComplexityData(parsedSolution.space_complexity || null)
      }),
      api.onDebugStart(() => {
        setDebugProcessing(true)
      }),
      api.onDebugSuccess((data) => {
        queryClient.setQueryData(["new_solution"], data?.solution ?? null)
        setDebugProcessing(false)
      }),
      api.onDebugError((error: string) => {
        showToast(
          "Processing Failed",
          error || "There was an error debugging your code.",
          "error"
        )
        setDebugProcessing(false)
      }),
      api.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no extra screenshots to process.",
          "neutral"
        )
      })
    ]

    return () => {
      if (resetTimer) clearTimeout(resetTimer)
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight, queryClient, refetch, setView])

  useEffect(() => {
    setProblemStatementData(
      queryClient.getQueryData<ProblemStatementData>(["problem_statement"]) || null
    )
    // Fixed bug: previously passed whole cached object instead of .code into solutionData
    const cachedSolution =
      queryClient.getQueryData<CachedSolutionData>(["solution"]) || null
    setSolutionData(cachedSolution?.code ?? null)
    setThoughtsData(cachedSolution?.thoughts ?? null)
    setTimeComplexityData(cachedSolution?.time_complexity ?? null)
    setSpaceComplexityData(cachedSolution?.space_complexity ?? null)

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        setProblemStatementData(
          queryClient.getQueryData<ProblemStatementData>(["problem_statement"]) || null
        )
        const audioResult = queryClient.getQueryData<AudioResult>(["audio_result"])
        if (audioResult) {
          setProblemStatementData({
            problem_statement: audioResult.text,
            input_format: {
              description: "Generated from audio input",
              parameters: []
            },
            output_format: {
              description: "Generated from audio input",
              type: "string",
              subtype: "voice"
            },
            complexity: {
              time: "N/A",
              space: "N/A"
            },
            test_cases: [],
            validation_type: "manual",
            difficulty: "custom"
          })
          setSolutionData(null)
          setThoughtsData(null)
          setTimeComplexityData(null)
          setSpaceComplexityData(null)
        }
      }
      if (event?.query.queryKey[0] === "solution") {
        const solution =
          queryClient.getQueryData<CachedSolutionData>(["solution"]) || null
        setSolutionData(solution?.code ?? null)
        setThoughtsData(solution?.thoughts ?? null)
        setTimeComplexityData(solution?.time_complexity ?? null)
        setSpaceComplexityData(solution?.space_complexity ?? null)
      }
    })
    return () => unsubscribe()
  }, [queryClient])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  return (
    <>
      {!isResetting && queryClient.getQueryData(["new_solution"]) ? (
        <Debug
          isProcessing={debugProcessing}
          setIsProcessing={setDebugProcessing}
          onBackToChat={() => setView("queue")}
        />
      ) : (
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

          {solutionData && (
            <div className="bg-transparent w-fit">
              <div className="pb-3">
                <div className="space-y-3 w-fit">
                  <ScreenshotQueue
                    isLoading={debugProcessing}
                    screenshots={extraScreenshots}
                    onDeleteScreenshot={handleDeleteExtraScreenshot}
                  />
                </div>
              </div>
            </div>
          )}

          <SolutionCommands
            extraScreenshots={extraScreenshots}
            onTooltipVisibilityChange={handleTooltipVisibilityChange}
            onBackToChat={() => setView("queue")}
          />

          <div className="w-full text-sm text-white px-3 py-2 space-y-4">
            {problemStatementData?.validation_type === "manual" ? (
              <ContentSection
                title={
                  problemStatementData?.output_format?.subtype === "voice"
                    ? "Audio Result"
                    : "Screenshot Result"
                }
                content={problemStatementData.problem_statement}
                isLoading={false}
              />
            ) : (
              <>
                <ContentSection
                  title={
                    problemStatementData?.output_format?.subtype === "voice"
                      ? "Voice Input"
                      : "Problem Statement"
                  }
                  content={problemStatementData?.problem_statement}
                  isLoading={!problemStatementData}
                />
                {problemStatementData && !solutionData && (
                  <div className="mt-3">
                    <p className="text-xs text-white/70">
                      {problemStatementData?.output_format?.subtype === "voice"
                        ? "Processing voice input..."
                        : "Generating solutions..."}
                    </p>
                  </div>
                )}
                {solutionData && (
                  <>
                    <ContentSection
                      title="Analysis"
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
                    <SolutionSection
                      title={
                        problemStatementData?.output_format?.subtype === "voice"
                          ? "Response"
                          : "Solution"
                      }
                      content={solutionData}
                      isLoading={!solutionData}
                    />
                    {problemStatementData?.output_format?.subtype !== "voice" && (
                      <ComplexitySection
                        timeComplexity={timeComplexityData}
                        spaceComplexity={spaceComplexityData}
                        isLoading={!timeComplexityData || !spaceComplexityData}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Solutions

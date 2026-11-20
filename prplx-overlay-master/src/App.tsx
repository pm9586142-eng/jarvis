import { ToastProvider } from "./components/ui/toast"
import Queue from "./_pages/Queue"
import { ToastViewport } from "@radix-ui/react-toast"
import { useEffect, useState } from "react"
import Solutions from "./_pages/Solutions"
import Debug from "./_pages/Debug"
import { QueryClient, QueryClientProvider } from "react-query"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      cacheTime: Infinity
    }
  }
})

const App: React.FC = () => {
  const [view, setView] = useState<"queue" | "solutions" | "debug">("queue")
  const [debugProcessing, setDebugProcessing] = useState(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const cleanupFunctions = [
      api.onSolutionStart(() => {
        setView("solutions")
      }),

      api.onUnauthorized(() => {
        queryClient.removeQueries(["screenshots"])
        queryClient.removeQueries(["solution"])
        queryClient.removeQueries(["new_solution"])
        queryClient.removeQueries(["problem_statement"])
        setView("queue")
      }),

      api.onResetView(() => {
        queryClient.removeQueries(["screenshots"])
        queryClient.removeQueries(["solution"])
        queryClient.removeQueries(["new_solution"])
        queryClient.removeQueries(["problem_statement"])
        queryClient.invalidateQueries(["screenshots"])
        setDebugProcessing(false)
        setView("queue")
      }),

      api.onProblemExtracted((data: unknown) => {
        queryClient.setQueryData(["problem_statement"], data)
      })
    ]

    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [])

  return (
    <div className="min-h-0">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {view === "queue" ? (
            <Queue setView={setView} />
          ) : view === "solutions" ? (
            <Solutions setView={setView} />
          ) : (
            <Debug
              isProcessing={debugProcessing}
              setIsProcessing={setDebugProcessing}
              onBackToChat={() => setView("queue")}
            />
          )}
          <ToastViewport />
        </ToastProvider>
      </QueryClientProvider>
    </div>
  )
}

export default App

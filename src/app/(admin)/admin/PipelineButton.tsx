"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

type RunStatus = "idle" | "fetch" | "predict" | "done" | "failed"

const STEP_LABEL: Record<string, string> = {
  fetch: "Fetching papers…",
  predict: "Scoring papers…",
}

export function PipelineButton() {
  const [status, setStatus] = useState<RunStatus>("idle")
  const router = useRouter()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  const startPolling = (runId: number) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/pipeline/${runId}`)
        const data = await res.json()
        if (data.status === "DONE") {
          stopPolling()
          setStatus("done")
          router.refresh()
        } else if (data.status === "FAILED") {
          stopPolling()
          setStatus("failed")
        } else if (data.step) {
          setStatus(data.step as RunStatus)
        }
      } catch {
        stopPolling()
        setStatus("failed")
      }
    }, 2000)
  }

  const run = async () => {
    setStatus("fetch")
    try {
      const res = await fetch("/api/pipeline", { method: "POST" })
      if (!res.ok) { setStatus("failed"); return }
      const { id } = await res.json()
      startPolling(id)
    } catch {
      setStatus("failed")
    }
  }

  const reset = () => { stopPolling(); setStatus("idle") }

  if (status === "done") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-success text-sm">Pipeline complete — queue updated</span>
        <button className="btn btn-xs btn-ghost" onClick={reset}>Run again</button>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-error text-sm">Pipeline failed</span>
        <button className="btn btn-xs btn-ghost" onClick={reset}>Retry</button>
      </div>
    )
  }

  if (status !== "idle") {
    return (
      <button className="btn btn-primary btn-sm" disabled>
        <span className="loading loading-spinner loading-xs" />
        {STEP_LABEL[status] ?? "Running…"}
      </button>
    )
  }

  return (
    <button className="btn btn-primary btn-sm" onClick={run}>
      Fetch + Predict
    </button>
  )
}

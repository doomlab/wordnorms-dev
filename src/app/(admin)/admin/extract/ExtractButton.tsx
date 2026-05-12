"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function ExtractButton({ paperId }: { paperId: number }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const router = useRouter()

  const run = async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId }),
      })
      setStatus(res.ok ? "done" : "error")
      if (res.ok) router.refresh()
    } catch {
      setStatus("error")
    }
  }

  if (status === "done") return <span className="text-success text-sm">Extracted</span>
  if (status === "error") return <span className="text-error text-sm">Failed — retry?</span>

  return (
    <button
      className="btn btn-xs btn-primary"
      onClick={run}
      disabled={status === "loading"}
    >
      {status === "loading" ? <span className="loading loading-spinner loading-xs" /> : "Extract"}
    </button>
  )
}

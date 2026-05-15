"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function AddPdfUrl({ paperId }: { paperId: number }) {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const router = useRouter()

  const run = async () => {
    if (!url.trim()) return
    setStatus("loading")
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, pdfUrl: url.trim() }),
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
    <div className="flex gap-2">
      <input
        type="url"
        placeholder="PDF URL"
        className="input input-xs input-bordered w-52"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={status === "loading"}
      />
      <button
        className="btn btn-xs btn-primary"
        onClick={run}
        disabled={status === "loading" || !url.trim()}
      >
        {status === "loading" ? <span className="loading loading-spinner loading-xs" /> : "Extract"}
      </button>
    </div>
  )
}

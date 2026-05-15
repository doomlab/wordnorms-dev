"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import approveExtraction from "../../mutations/approveExtraction"

type State = "new" | "no-pdf" | "needs-review"

export function ExtractionActions({ paperId, state }: { paperId: number; state: State }) {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [approve] = useMutation(approveExtraction)
  const router = useRouter()

  const extract = async (pdfUrl?: string) => {
    setStatus("loading")
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, ...(pdfUrl ? { pdfUrl } : {}) }),
      })
      if (res.ok) {
        router.push("/admin/extract")
        router.refresh()
      } else {
        setStatus("error")
      }
    } catch {
      setStatus("error")
    }
  }

  const handleApprove = async () => {
    setStatus("loading")
    try {
      await approve({ paperId })
      router.push("/admin/extract")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-error text-sm">Something went wrong — try again</span>
        <button className="btn btn-xs btn-ghost" onClick={() => setStatus("idle")}>Retry</button>
      </div>
    )
  }

  if (state === "new") {
    return (
      <button
        className="btn btn-primary btn-wide"
        onClick={() => extract()}
        disabled={status === "loading"}
      >
        {status === "loading" ? <span className="loading loading-spinner" /> : "Extract"}
      </button>
    )
  }

  if (state === "no-pdf") {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-base-content/60">Paste a direct PDF link to extract.</p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="PDF URL"
            className="input input-bordered w-72"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={status === "loading"}
          />
          <button
            className="btn btn-primary"
            onClick={() => extract(url)}
            disabled={status === "loading" || !url.trim()}
          >
            {status === "loading" ? <span className="loading loading-spinner" /> : "Extract"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 justify-center">
      <button
        className="btn btn-success btn-wide"
        onClick={handleApprove}
        disabled={status === "loading"}
      >
        {status === "loading" ? <span className="loading loading-spinner" /> : "Approve"}
      </button>
      <button
        className="btn btn-ghost btn-outline btn-wide"
        onClick={() => extract()}
        disabled={status === "loading"}
      >
        Re-extract
      </button>
    </div>
  )
}

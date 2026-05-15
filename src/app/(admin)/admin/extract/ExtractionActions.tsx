"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import approveExtraction from "../../mutations/approveExtraction"

type State = "new" | "no-pdf" | "needs-review"

export function ExtractionActions({
  paperId,
  state,
  hasGroqKey,
}: {
  paperId: number
  state: State
  hasGroqKey: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [approve] = useMutation(approveExtraction)
  const router = useRouter()

  const extract = async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId }),
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

  const extractFromFile = async () => {
    if (!file) return
    setStatus("loading")
    try {
      const form = new FormData()
      form.append("paperId", String(paperId))
      form.append("file", file)
      const res = await fetch("/api/extract", { method: "POST", body: form })
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

  if (!hasGroqKey) {
    return (
      <p className="text-sm text-base-content/50">
        Add a <a href="/dashboard/profile" className="link">Groq API key</a> in your profile to run extraction.
      </p>
    )
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
        onClick={extract}
        disabled={status === "loading"}
      >
        {status === "loading" ? <span className="loading loading-spinner" /> : "Extract"}
      </button>
    )
  }

  if (state === "no-pdf") {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-base-content/60">Upload a PDF to extract.</p>
          <div className="flex gap-2 items-center">
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="file-input file-input-bordered file-input-sm w-72"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={status === "loading"}
            />
            <button
              className="btn btn-primary"
              onClick={extractFromFile}
              disabled={status === "loading" || !file}
            >
              {status === "loading" ? <span className="loading loading-spinner" /> : "Extract"}
            </button>
          </div>
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

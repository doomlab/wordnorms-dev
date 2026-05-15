"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import applyEditSuggestion from "../../../mutations/applyEditSuggestion"
import dismissEditSuggestion from "../../../mutations/dismissEditSuggestion"

export function SuggestionActions({ suggestionId }: { suggestionId: number }) {
  const router = useRouter()
  const [apply] = useMutation(applyEditSuggestion)
  const [dismiss] = useMutation(dismissEditSuggestion)
  const [status, setStatus] = useState<"idle" | "applying" | "dismissing" | "error">("idle")

  const handleApply = async () => {
    setStatus("applying")
    try {
      await apply({ suggestionId })
      router.push("/admin/reports?tab=metadata")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  const handleDismiss = async () => {
    setStatus("dismissing")
    try {
      await dismiss({ suggestionId })
      router.push("/admin/reports?tab=metadata")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  const busy = status === "applying" || status === "dismissing"

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-error text-sm">Something went wrong</span>
        <button className="btn btn-xs btn-ghost" onClick={() => setStatus("idle")}>Retry</button>
      </div>
    )
  }

  return (
    <div className="flex gap-3 justify-center">
      <button className="btn btn-secondary btn-wide" onClick={handleDismiss} disabled={busy}>
        {status === "dismissing" ? <span className="loading loading-spinner loading-xs" /> : "Dismiss"}
      </button>
      <button className="btn btn-success btn-wide" onClick={handleApply} disabled={busy}>
        {status === "applying" ? <span className="loading loading-spinner loading-xs" /> : "Apply Changes"}
      </button>
    </div>
  )
}

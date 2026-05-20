"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import resolveReport from "../../mutations/resolveReport"
import reclassifyPaper from "../../mutations/reclassifyPaper"

export function ReportActions({
  reportId,
  paperId,
  currentStatus,
  nextHref,
}: {
  reportId: number
  paperId: number
  currentStatus: "ACCEPTED" | "EXCLUDED"
  nextHref: string
}) {
  const router = useRouter()
  const [resolve] = useMutation(resolveReport)
  const [reclassify] = useMutation(reclassifyPaper)
  const [status, setStatus] = useState<"idle" | "dismissing" | "reclassifying" | "error">("idle")

  const newStatus = currentStatus === "ACCEPTED" ? "EXCLUDED" : "ACCEPTED"
  const reclassifyLabel = currentStatus === "ACCEPTED" ? "Change to Excluded" : "Change to Included"

  const handleDismiss = async () => {
    setStatus("dismissing")
    try {
      await resolve({ reportId })
      router.push(nextHref as any)
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  const handleReclassify = async () => {
    setStatus("reclassifying")
    try {
      await reclassify({ reportId, paperId, newStatus })
      router.push(nextHref as any)
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  const busy = status === "dismissing" || status === "reclassifying"

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
      <button
        className="btn btn-secondary btn-wide"
        onClick={handleDismiss}
        disabled={busy}
      >
        {status === "dismissing" ? <span className="loading loading-spinner loading-xs" /> : "Dismiss"}
      </button>
      <button
        className="btn btn-warning btn-wide"
        onClick={handleReclassify}
        disabled={busy}
      >
        {status === "reclassifying" ? <span className="loading loading-spinner loading-xs" /> : reclassifyLabel}
      </button>
      <a href={nextHref} className="btn btn-ghost btn-outline">Skip →</a>
    </div>
  )
}

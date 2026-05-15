"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import resolveReport from "../../mutations/resolveReport"

export function MetadataReportActions({
  reportId,
  paperId,
  hasExtraction,
}: {
  reportId: number
  paperId: number
  hasExtraction: boolean
}) {
  const router = useRouter()
  const [resolve] = useMutation(resolveReport)
  const [dismissing, setDismissing] = useState(false)
  const [error, setError] = useState(false)

  const handleDismiss = async () => {
    setDismissing(true)
    try {
      await resolve({ reportId })
      router.push("/admin/reports?tab=metadata")
      router.refresh()
    } catch {
      setError(true)
      setDismissing(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-error text-sm">Something went wrong</span>
        <button className="btn btn-xs btn-ghost btn-outline" onClick={() => setError(false)}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-3 justify-center">
      <button
        className="btn btn-secondary btn-wide"
        onClick={handleDismiss}
        disabled={dismissing}
      >
        {dismissing ? <span className="loading loading-spinner loading-xs" /> : "Dismiss"}
      </button>
      {hasExtraction && (
        <a href={`/admin/metadata/${paperId}`} className="btn btn-warning btn-wide">
          Edit Metadata
        </a>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import pullCitedPaper from "../../mutations/pullCitedPaper"
import reviewCitation from "../../mutations/reviewCitation"

type Props = {
  citedOpenAlexId: string
  title: string
  authors: string[]
  year: number | null
  journal: string | null
  reviewed: boolean
}

export function CitationActions({ citedOpenAlexId, title, authors, year, journal, reviewed }: Props) {
  const [pull] = useMutation(pullCitedPaper)
  const [review] = useMutation(reviewCitation)
  const router = useRouter()
  const [pullState, setPullState] = useState<"idle" | "loading" | "done" | "duplicate" | "error">("idle")
  const [dismissing, setDismissing] = useState(false)

  const handlePull = async () => {
    setPullState("loading")
    try {
      const result = await pull({ citedOpenAlexId, title, authors, year, journal })
      setPullState(result.type === "duplicate" ? "duplicate" : "done")
      router.refresh()
    } catch {
      setPullState("error")
    }
  }

  const handleDismiss = async () => {
    setDismissing(true)
    try {
      await review({ citedOpenAlexId, reviewed: !reviewed })
      router.refresh()
    } catch {
      setDismissing(false)
    }
  }

  if (pullState === "done") return <span className="text-sm text-success">Added</span>
  if (pullState === "duplicate") return <span className="text-sm text-base-content/40">Already in DB</span>
  if (pullState === "error") return <span className="text-sm text-error">Failed</span>

  return (
    <div className="flex gap-2">
      <button
        className="btn btn-xs btn-outline"
        onClick={handlePull}
        disabled={pullState === "loading"}
      >
        {pullState === "loading" ? <span className="loading loading-spinner loading-xs" /> : "Pull"}
      </button>
      <button
        className="btn btn-xs btn-ghost text-base-content/40"
        onClick={handleDismiss}
        disabled={dismissing}
        title={reviewed ? "Mark as unreviewed" : "Dismiss"}
      >
        {reviewed ? "Undo" : "Dismiss"}
      </button>
    </div>
  )
}

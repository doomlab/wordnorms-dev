"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import resolveArticleSuggestion from "../../mutations/resolveArticleSuggestion"

export function ResolveArticleSuggestionButton({ suggestionId }: { suggestionId: number }) {
  const router = useRouter()
  const [resolving, setResolving] = useState(false)
  const [resolve] = useMutation(resolveArticleSuggestion)

  const handleResolve = async () => {
    setResolving(true)
    try {
      await resolve({ suggestionId })
      router.refresh()
    } finally {
      setResolving(false)
    }
  }

  return (
    <button onClick={handleResolve} disabled={resolving} className="btn btn-primary btn-xs">
      {resolving ? "…" : "Resolve"}
    </button>
  )
}

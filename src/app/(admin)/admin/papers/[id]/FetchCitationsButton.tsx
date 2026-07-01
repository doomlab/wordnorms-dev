"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import refetchCitations from "../../../mutations/refetchCitations"

export function FetchCitationsButton({
  paperId,
  size = "sm",
}: {
  paperId: number
  size?: "xs" | "sm"
}) {
  const [refetch] = useMutation(refetchCitations)
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [result, setResult] = useState<string | null>(null)

  const handleClick = async () => {
    setState("loading")
    setResult(null)
    try {
      const { count } = await refetch({ paperId })
      setResult(count > 0 ? `${count} citations stored` : "No new citations found")
      setState("done")
      router.refresh()
    } catch (e: any) {
      setResult(e.message ?? "Failed")
      setState("error")
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        className={`btn btn-${size} btn-outline`}
        onClick={handleClick}
        disabled={state === "loading"}
      >
        {state === "loading" ? (
          <span className="loading loading-spinner loading-xs" />
        ) : null}
        Fetch citations
      </button>
      {result && (
        <span className={`text-sm ${state === "error" ? "text-error" : "text-base-content/60"}`}>
          {result}
        </span>
      )}
    </div>
  )
}

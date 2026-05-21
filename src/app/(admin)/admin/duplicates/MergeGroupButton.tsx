"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import mergeGroup from "src/app/(admin)/mutations/mergeGroup"

type Props = { canonicalId: number; duplicateIds: number[] }

export function MergeGroupButton({ canonicalId, duplicateIds }: Props) {
  const [run] = useMutation(mergeGroup)
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "done">("idle")

  const handleClick = async () => {
    if (!confirm(`Merge ${duplicateIds.length} other paper(s) into #${canonicalId}?`)) return
    setState("loading")
    try {
      await run({ canonicalId, duplicateIds })
      setState("done")
      router.refresh()
    } catch (e: any) {
      alert(e.message)
      setState("idle")
    }
  }

  if (state === "done") return <span className="text-xs text-success">Merged ✓</span>

  return (
    <button
      className="btn btn-warning btn-xs"
      onClick={handleClick}
      disabled={state === "loading"}
    >
      {state === "loading" ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        "Make canonical"
      )}
    </button>
  )
}

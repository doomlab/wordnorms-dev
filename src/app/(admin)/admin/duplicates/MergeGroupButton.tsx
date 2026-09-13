"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import mergeGroup from "src/app/(admin)/mutations/mergeGroup"

type Props = {
  canonicalId: number
  duplicateIds: number[]
  label?: string
  confirmMessage?: string
  className?: string
}

export function MergeGroupButton({
  canonicalId,
  duplicateIds,
  label = "Make canonical",
  confirmMessage,
  className = "btn-warning btn-xs",
}: Props) {
  const [run] = useMutation(mergeGroup)
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "done">("idle")

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!confirm(confirmMessage ?? `Merge ${duplicateIds.length} other paper(s) into #${canonicalId}?`)) return
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
    <button className={`btn ${className}`} onClick={handleClick} disabled={state === "loading"}>
      {state === "loading" ? <span className="loading loading-spinner loading-xs" /> : label}
    </button>
  )
}

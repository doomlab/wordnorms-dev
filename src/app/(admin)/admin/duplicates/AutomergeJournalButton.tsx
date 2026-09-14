"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import automergePreprintDuplicates from "src/app/(admin)/mutations/automergePreprintDuplicates"

export function AutomergeJournalButton({ groupCount }: { groupCount: number }) {
  const [run] = useMutation(automergePreprintDuplicates)
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ merged: number; groups: number } | null>(null)

  const handleClick = async () => {
    if (
      !confirm(
        `Auto-merge ${groupCount} preprint/repository duplicate groups (figshare, OSF, arXiv, SSRN, Zenodo, Open Research Europe, bioRxiv, medRxiv, techRxiv, HAL) into their journal version or the copy with a DOI?`
      )
    )
      return
    setPending(true)
    try {
      const res = await run({})
      setResult(res)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  if (result !== null) {
    return (
      <span className="text-sm text-success">
        ✓ Merged {result.merged} papers across {result.groups} groups
      </span>
    )
  }

  return (
    <button className="btn btn-warning btn-sm" onClick={handleClick} disabled={pending}>
      {pending ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        `Merge ${groupCount} preprint/journal groups`
      )}
    </button>
  )
}

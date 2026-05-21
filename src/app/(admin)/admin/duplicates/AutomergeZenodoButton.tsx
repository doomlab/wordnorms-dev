"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import automergeZenodoVersions from "src/app/(admin)/mutations/automergeZenodoVersions"

export function AutomergeZenodoButton({ groupCount }: { groupCount: number }) {
  const [run] = useMutation(automergeZenodoVersions)
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ merged: number; groups: number } | null>(null)

  const handleClick = async () => {
    if (
      !confirm(
        `Auto-merge ${groupCount} Zenodo version groups? Within each group, the earliest version (lowest record number) becomes canonical.`
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
        `Merge ${groupCount} Zenodo groups`
      )}
    </button>
  )
}

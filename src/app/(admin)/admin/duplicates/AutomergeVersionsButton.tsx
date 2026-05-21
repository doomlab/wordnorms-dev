"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import automergeVersionedDois from "src/app/(admin)/mutations/automergeVersionedDois"

export function AutomergeVersionsButton({ count }: { count: number }) {
  const [run] = useMutation(automergeVersionedDois)
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<number | null>(null)

  const handleClick = async () => {
    if (!confirm(`Merge ${count} versioned DOI duplicates into their canonical papers?`)) return
    setPending(true)
    try {
      const { merged } = await run({})
      setResult(merged)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  if (result !== null) {
    return <span className="text-sm text-success">✓ Merged {result} pairs</span>
  }

  return (
    <button className="btn btn-warning btn-sm" onClick={handleClick} disabled={pending}>
      {pending ? <span className="loading loading-spinner loading-xs" /> : `Merge ${count} version pairs`}
    </button>
  )
}

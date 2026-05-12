"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import resolveReport from "../../mutations/resolveReport"

export function ResolveButton({ reportId }: { reportId: number }) {
  const router = useRouter()
  const [resolving, setResolving] = useState(false)
  const [resolve] = useMutation(resolveReport)

  const handleResolve = async () => {
    setResolving(true)
    try {
      await resolve({ reportId })
      router.refresh()
    } finally {
      setResolving(false)
    }
  }

  return (
    <button onClick={handleResolve} disabled={resolving} className="btn btn-ghost btn-xs">
      {resolving ? "…" : "Resolve"}
    </button>
  )
}

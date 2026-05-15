"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import unmergePaper from "../../mutations/unmergePaper"

export function UnmergeButton({
  paperId,
  redirectTo,
}: {
  paperId: number
  redirectTo?: string
}) {
  const [unmerge] = useMutation(unmergePaper)
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleUnmerge = async () => {
    setPending(true)
    try {
      await unmerge({ paperId })
      if (redirectTo) {
        router.push(redirectTo)
      }
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      className="btn btn-error btn-outline btn-sm"
      disabled={pending}
      onClick={handleUnmerge}
    >
      {pending ? "Undoing…" : "Undo merge"}
    </button>
  )
}

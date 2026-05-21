"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import reviewPaper from "../../mutations/reviewPaper"

export function BorderlineActions({ paperId, nextHref }: { paperId: number; nextHref: string }) {
  const [review] = useMutation(reviewPaper)
  const router = useRouter()
  const [pending, setPending] = useState<"ACCEPTED" | "EXCLUDED" | null>(null)

  const act = async (status: "ACCEPTED" | "EXCLUDED") => {
    setPending(status)
    try {
      await review({ paperId, status })
      setPending(null)
      router.push(nextHref as any)
    } catch {
      setPending(null)
    }
  }

  const busy = !!pending

  return (
    <div className="flex gap-4 justify-center">
      <button
        className="btn btn-primary btn-wide"
        onClick={() => act("ACCEPTED")}
        disabled={busy}
      >
        {pending === "ACCEPTED" ? <span className="loading loading-spinner loading-xs" /> : "Accept"}
      </button>
      <button
        className="btn btn-ghost btn-outline btn-wide"
        onClick={() => act("EXCLUDED")}
        disabled={busy}
      >
        {pending === "EXCLUDED" ? <span className="loading loading-spinner loading-xs" /> : "Confirm Excluded"}
      </button>
      <a href={nextHref} className="btn btn-ghost">Skip →</a>
    </div>
  )
}

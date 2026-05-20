"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import reviewPaper from "../../mutations/reviewPaper"

export function PaperActions({ paperId, nextHref }: { paperId: number; nextHref: string }) {
  const [review] = useMutation(reviewPaper)
  const router = useRouter()

  const act = async (status: string) => {
    await review({ paperId, status: status as any })
    router.push(nextHref as any)
    router.refresh()
  }

  return (
    <div className="flex gap-4 justify-center">
      <button className="btn btn-primary btn-wide" onClick={() => act("ACCEPTED")}>
        Accept
      </button>
      <button className="btn btn-error btn-wide" onClick={() => act("EXCLUDED")}>
        Exclude
      </button>
      <a href={nextHref} className="btn btn-ghost btn-outline">
        Skip →
      </a>
    </div>
  )
}

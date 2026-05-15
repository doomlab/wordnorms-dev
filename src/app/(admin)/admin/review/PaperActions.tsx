"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import reviewPaper from "../../mutations/reviewPaper"

export function PaperActions({ paperId, isPdf }: { paperId: number; isPdf?: boolean }) {
  const [review] = useMutation(reviewPaper)
  const router = useRouter()

  const act = async (status: string) => {
    await review({ paperId, status: status as any })
    router.push("/admin/review")
    router.refresh()
  }

  if (isPdf) {
    return (
      <div className="flex gap-2">
        <button className="btn btn-success btn-xs" onClick={() => act("ACCEPTED")}>
          Extract
        </button>
        <button className="btn btn-ghost btn-xs" onClick={() => act("ADDED_TO_TRAINING")}>
          Add to training
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-4 justify-center">
      <button className="btn btn-primary btn-wide" onClick={() => act("ACCEPTED")}>
        Accept
      </button>
      <button className="btn btn-error btn-wide" onClick={() => act("EXCLUDED")}>
        Exclude
      </button>
    </div>
  )
}

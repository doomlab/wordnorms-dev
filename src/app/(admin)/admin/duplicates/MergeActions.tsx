"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import mergePapers from "../../mutations/mergePapers"

export function MergeActions({ idA, idB, nextHref }: { idA: number; idB: number; nextHref?: string }) {
  const [merge] = useMutation(mergePapers)
  const router = useRouter()
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const afterHref = nextHref ?? "/admin/duplicates"

  const handleMerge = async (canonicalId: number, duplicateId: number) => {
    setError(null)
    setPending(canonicalId)
    try {
      await merge({ canonicalId, duplicateId })
      setPending(null)
      router.push(afterHref as any)
    } catch (e: any) {
      setError(e.message ?? "Merge failed")
      setPending(null)
    }
  }

  return (
    <div className="border-t border-base-200 pt-8">
      {error && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}
      <p className="text-sm text-base-content/60 mb-4 text-center">
        Which paper should be the canonical (kept) version?
      </p>
      <div className="flex gap-4 justify-center">
        <button
          className="btn btn-primary"
          disabled={pending !== null}
          onClick={() => handleMerge(idA, idB)}
        >
          {pending === idA ? "Merging…" : `Keep A (#${idA})`}
        </button>
        <button
          className="btn btn-primary"
          disabled={pending !== null}
          onClick={() => handleMerge(idB, idA)}
        >
          {pending === idB ? "Merging…" : `Keep B (#${idB})`}
        </button>
        {nextHref ? (
          <a href={nextHref} className="btn btn-ghost btn-outline">
            Skip →
          </a>
        ) : (
          <a href="/admin/duplicates" className="btn btn-ghost btn-outline">
            Cancel
          </a>
        )}
      </div>
      <p className="text-xs text-base-content/40 text-center mt-3">
        The other paper will be marked as a duplicate pointing to the one you keep.
      </p>
    </div>
  )
}

"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import linkDataset from "src/app/(admin)/mutations/linkDataset"
import unlinkDataset from "src/app/(admin)/mutations/unlinkDataset"

export function DatasetLinkActions({
  bibtex,
  currentPaperId,
  linkPaperId,
}: {
  bibtex: string
  currentPaperId: number | null
  linkPaperId?: number
}) {
  const [doLink] = useMutation(linkDataset)
  const [doUnlink] = useMutation(unlinkDataset)
  const router = useRouter()
  const [pending, setPending] = useState(false)

  // Unlink button — only shown in the "currently linked" alert area (no linkPaperId)
  if (!linkPaperId) {
    if (!currentPaperId) return null
    return (
      <button
        className="btn btn-outline btn-sm btn-error"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          try {
            await doUnlink({ bibtex })
            router.refresh()
          } finally {
            setPending(false)
          }
        }}
      >
        {pending ? <span className="loading loading-spinner loading-xs" /> : "Unlink"}
      </button>
    )
  }

  // Link button — shown in search results table
  const isLinked = currentPaperId === linkPaperId
  return (
    <button
      className={`btn btn-xs ${isLinked ? "btn-success" : "btn-outline"}`}
      disabled={pending || isLinked}
      onClick={async () => {
        setPending(true)
        try {
          await doLink({ bibtex, paperId: linkPaperId })
          router.refresh()
        } finally {
          setPending(false)
        }
      }}
    >
      {pending ? <span className="loading loading-spinner loading-xs" /> : isLinked ? "Linked ✓" : "Link"}
    </button>
  )
}

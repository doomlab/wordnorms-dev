"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import dismissDuplicateGroup from "src/app/(admin)/mutations/dismissDuplicateGroup"

type Props = { groupKey: string; groupType: string; label: string; isDismissed?: boolean }

export function DismissGroupButton({ groupKey, groupType, label, isDismissed = false }: Props) {
  const [run] = useMutation(dismissDuplicateGroup)
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  return (
    <button
      className="btn btn-outline btn-xs"
      disabled={loading}
      onClick={async (e) => {
        e.stopPropagation()
        e.preventDefault()
        setLoading(true)
        try {
          await run({ groupKey, groupType, label, dismiss: !isDismissed })
          router.refresh()
        } catch (err: any) {
          alert(err.message)
          setLoading(false)
        }
      }}
    >
      {loading ? (
        <span className="loading loading-spinner loading-xs" />
      ) : isDismissed ? (
        "Restore"
      ) : (
        "Dismiss"
      )}
    </button>
  )
}

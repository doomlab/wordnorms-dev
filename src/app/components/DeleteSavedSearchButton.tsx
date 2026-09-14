"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import deleteSavedSearch from "../(dashboard)/mutations/deleteSavedSearch"

export function DeleteSavedSearchButton({ id }: { id: number }) {
  const router = useRouter()
  const [remove] = useMutation(deleteSavedSearch)
  const [pending, setPending] = useState(false)

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        try {
          await remove({ id })
          router.refresh()
        } finally {
          setPending(false)
        }
      }}
    >
      {pending ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
    </button>
  )
}

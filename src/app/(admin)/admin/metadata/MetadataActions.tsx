"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import verifyExtraction from "../../mutations/verifyExtraction"

export function MetadataActions({ paperId }: { paperId: number }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [verify] = useMutation(verifyExtraction)
  const router = useRouter()

  const handleVerify = async () => {
    setStatus("loading")
    try {
      await verify({ paperId })
      router.push("/admin/metadata")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-error text-sm">Something went wrong</span>
        <button className="btn btn-xs btn-ghost btn-outline" onClick={() => setStatus("idle")}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <button
      className="btn btn-success btn-wide"
      onClick={handleVerify}
      disabled={status === "loading"}
    >
      {status === "loading" ? <span className="loading loading-spinner" /> : "Verify"}
    </button>
  )
}

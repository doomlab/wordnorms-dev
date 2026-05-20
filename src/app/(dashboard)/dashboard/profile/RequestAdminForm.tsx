"use client"

import { useState } from "react"
import { useMutation } from "@blitzjs/rpc"
import requestAdminAccess from "../../mutations/requestAdminAccess"

export function RequestAdminForm() {
  const [request] = useMutation(requestAdminAccess)
  const [reason, setReason] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("sending")
    try {
      await request({ reason: reason.trim() || undefined })
      setStatus("sent")
    } catch {
      setStatus("error")
    }
  }

  if (status === "sent") {
    return <p className="text-sm text-success">Request sent &mdash; you&apos;ll hear back by email.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-base-content/50 text-sm">
        Admin access lets you review papers, manage extractions, and run the pipeline.
      </p>
      <textarea
        className="textarea textarea-bordered w-full text-sm"
        placeholder="Briefly describe why you need access (optional)"
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value)
          if (status === "error") setStatus("idle")
        }}
        disabled={status === "sending"}
      />
      <button
        type="submit"
        className="btn btn-primary btn-sm self-start"
        disabled={status === "sending"}
      >
        {status === "sending" ? <span className="loading loading-spinner loading-xs" /> : "Request access"}
      </button>
      {status === "error" && <p className="text-sm text-error">Failed to send. Please try again.</p>}
    </form>
  )
}

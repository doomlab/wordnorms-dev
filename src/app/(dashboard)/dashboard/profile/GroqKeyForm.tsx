"use client"

import { useState } from "react"
import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import saveGroqApiKey from "../../mutations/saveGroqApiKey"

export function GroqKeyForm({ hasKey }: { hasKey: boolean }) {
  const [save] = useMutation(saveGroqApiKey)
  const router = useRouter()
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("saving")
    try {
      await save({ apiKey: value })
      setValue("")
      setStatus("saved")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  return (
    <div>
      <p className="text-base-content/50 text-sm mb-4">
        Used when running the extraction pipeline. Your key is never shown again after saving.
      </p>

      {hasKey && status !== "saved" && (
        <p className="text-sm text-success mb-3">✓ API key is saved</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          className="input input-bordered w-full"
          placeholder={hasKey ? "Enter new key to replace" : "gsk_…"}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (status !== "idle") setStatus("idle")
          }}
          disabled={status === "saving"}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm self-start"
          disabled={!value.trim() || status === "saving"}
        >
          {status === "saving" ? <span className="loading loading-spinner loading-xs" /> : hasKey ? "Replace key" : "Save key"}
        </button>
        {status === "saved" && <p className="text-sm text-success">Key saved.</p>}
        {status === "error" && <p className="text-sm text-error">Failed to save. Try again.</p>}
      </form>
    </div>
  )
}

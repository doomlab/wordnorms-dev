"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import verifyExtraction from "../../mutations/verifyExtraction"
import updateExtraction from "../../mutations/updateExtraction"

type ExtractionData = {
  language: string[]
  participantCount: number | null
  participantType: string | null
  stimuliType: string[]
  stimuliCount: number | null
  normsCollected: string[]
  instructions: string | null
  confidence: number | null
  extractedBy: string | null
}

export function MetadataForm({
  paperId,
  extraction,
}: {
  paperId: number
  extraction: ExtractionData
}) {
  const router = useRouter()
  const [verify] = useMutation(verifyExtraction)
  const [update] = useMutation(updateExtraction)
  const [status, setStatus] = useState<"idle" | "saving" | "verifying" | "saved" | "error">("idle")

  const [fields, setFields] = useState({
    language: extraction.language.join(", "),
    participantCount: extraction.participantCount?.toString() ?? "",
    participantType: extraction.participantType ?? "",
    stimuliType: extraction.stimuliType.join(", "),
    stimuliCount: extraction.stimuliCount?.toString() ?? "",
    normsCollected: extraction.normsCollected.join(", "),
    instructions: extraction.instructions ?? "",
  })

  const toPayload = () => ({
    paperId,
    language: fields.language.split(",").map((s) => s.trim()).filter(Boolean),
    participantCount: fields.participantCount ? parseInt(fields.participantCount) : null,
    participantType: fields.participantType || null,
    stimuliType: fields.stimuliType.split(",").map((s) => s.trim()).filter(Boolean),
    stimuliCount: fields.stimuliCount ? parseInt(fields.stimuliCount) : null,
    normsCollected: fields.normsCollected.split(",").map((s) => s.trim()).filter(Boolean),
    instructions: fields.instructions || null,
  })

  const set =
    (key: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value }))

  const handleSave = async () => {
    setStatus("saving")
    try {
      await update(toPayload())
      setStatus("saved")
    } catch {
      setStatus("error")
    }
  }

  const handleVerify = async () => {
    setStatus("verifying")
    try {
      await update(toPayload())
      await verify({ paperId })
      router.push("/admin/metadata")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  const busy = status === "saving" || status === "verifying"

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-error text-sm">Something went wrong</span>
        <button className="btn btn-xs btn-ghost" onClick={() => setStatus("idle")}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Field label="Language" hint="comma-separated">
        <input
          className="input input-bordered input-sm w-full"
          value={fields.language}
          onChange={set("language")}
          disabled={busy}
        />
      </Field>
      <Field label="Participants">
        <input
          className="input input-bordered input-sm w-full"
          type="number"
          value={fields.participantCount}
          onChange={set("participantCount")}
          disabled={busy}
        />
      </Field>
      <Field label="Participant type">
        <input
          className="input input-bordered input-sm w-full"
          value={fields.participantType}
          onChange={set("participantType")}
          disabled={busy}
        />
      </Field>
      <Field label="Stimuli type" hint="comma-separated">
        <input
          className="input input-bordered input-sm w-full"
          value={fields.stimuliType}
          onChange={set("stimuliType")}
          disabled={busy}
        />
      </Field>
      <Field label="Stimuli count">
        <input
          className="input input-bordered input-sm w-full"
          type="number"
          value={fields.stimuliCount}
          onChange={set("stimuliCount")}
          disabled={busy}
        />
      </Field>
      <Field label="Norms collected" hint="comma-separated">
        <input
          className="input input-bordered input-sm w-full"
          value={fields.normsCollected}
          onChange={set("normsCollected")}
          disabled={busy}
        />
      </Field>
      <Field label="Instructions">
        <textarea
          className="textarea textarea-bordered textarea-sm w-full"
          rows={3}
          value={fields.instructions}
          onChange={set("instructions")}
          disabled={busy}
        />
      </Field>

      {extraction.confidence != null && (
        <div className="flex gap-3 items-center text-sm pt-1">
          <span className="w-36 shrink-0 font-medium text-base-content/70">Confidence</span>
          <span className={extraction.confidence < 0.6 ? "text-warning" : "text-success"}>
            {(extraction.confidence * 100).toFixed(0)}%
          </span>
        </div>
      )}
      {extraction.extractedBy && (
        <div className="flex gap-3 items-center text-sm">
          <span className="w-36 shrink-0 font-medium text-base-content/70">Extracted by</span>
          <span className="text-base-content/60">{extraction.extractedBy}</span>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          className="btn btn-secondary"
          onClick={handleSave}
          disabled={busy}
        >
          {status === "saving" ? <span className="loading loading-spinner loading-xs" /> : status === "saved" ? "Saved" : "Save"}
        </button>
        <button className="btn btn-success" onClick={handleVerify} disabled={busy}>
          {status === "verifying" ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            "Save & Verify"
          )}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-36 shrink-0 pt-2">
        <span className="text-sm font-medium text-base-content/70">{label}</span>
        {hint && <p className="text-xs text-base-content/40">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import verifyExtraction from "../../mutations/verifyExtraction"
import updateExtraction from "../../mutations/updateExtraction"

type ReliabilityEntry = { norm: string; value: number | null; metric: string | null }

type ExtractionData = {
  language: string[]
  participantCount: number | null
  participantType: string | null
  participantLevelData: boolean
  stimuliType: string[]
  stimuliCount: number | null
  normsCollected: string[]
  instructions: string | null
  licenseUrl: string | null
  dataSource: string | null
  reliabilities: ReliabilityEntry[]
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
    participantLevelData: extraction.participantLevelData,
    stimuliType: extraction.stimuliType.join(", "),
    stimuliCount: extraction.stimuliCount?.toString() ?? "",
    normsCollected: extraction.normsCollected.join(", "),
    instructions: extraction.instructions ?? "",
    licenseUrl: extraction.licenseUrl ?? "",
    dataSource: (extraction.dataSource ?? "") as "" | "ai" | "human",
  })
  const [reliabilities, setReliabilities] = useState<{ norm: string; value: string; metric: string }[]>(
    extraction.reliabilities.map((r) => ({
      norm: r.norm,
      value: r.value?.toString() ?? "",
      metric: r.metric ?? "",
    }))
  )

  const toPayload = () => ({
    paperId,
    language: fields.language.split(",").map((s) => s.trim()).filter(Boolean),
    participantCount: fields.participantCount ? parseInt(fields.participantCount) : null,
    participantType: fields.participantType || null,
    participantLevelData: fields.participantLevelData,
    stimuliType: fields.stimuliType.split(",").map((s) => s.trim()).filter(Boolean),
    stimuliCount: fields.stimuliCount ? parseInt(fields.stimuliCount) : null,
    normsCollected: fields.normsCollected.split(",").map((s) => s.trim()).filter(Boolean),
    instructions: fields.instructions || null,
    licenseUrl: fields.licenseUrl || null,
    dataSource: (fields.dataSource || null) as "ai" | "human" | null,
    reliabilities: reliabilities
      .filter((r) => r.norm.trim())
      .map((r) => ({
        norm: r.norm.trim(),
        value: r.value !== "" ? parseFloat(r.value) : null,
        metric: r.metric.trim() || null,
      })),
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
      <Field label="Participant-level data">
        <label className="flex items-center gap-2 cursor-pointer pt-1.5">
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-primary"
            checked={fields.participantLevelData}
            onChange={(e) => setFields((f) => ({ ...f, participantLevelData: e.target.checked }))}
            disabled={busy}
          />
          <span className="text-sm">Raw participant data available</span>
        </label>
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
      <Field label="License URL">
        <input
          className="input input-bordered input-sm w-full"
          type="url"
          placeholder="https://creativecommons.org/licenses/…"
          value={fields.licenseUrl}
          onChange={set("licenseUrl")}
          disabled={busy}
        />
      </Field>
      <Field label="Data source">
        <select
          className="select select-bordered select-sm w-full"
          value={fields.dataSource}
          onChange={(e) =>
            setFields((f) => ({ ...f, dataSource: e.target.value as "" | "ai" | "human" }))
          }
          disabled={busy}
        >
          <option value="">— Unknown —</option>
          <option value="human">Human collected</option>
          <option value="ai">AI generated</option>
        </select>
      </Field>

      <Field label="Reliabilities">
        <div className="space-y-2">
          {reliabilities.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="input input-bordered input-sm flex-1 min-w-0"
                placeholder="norm (e.g. valence)"
                value={r.norm}
                onChange={(e) =>
                  setReliabilities((rs) => rs.map((x, j) => (j === i ? { ...x, norm: e.target.value } : x)))
                }
                disabled={busy}
              />
              <input
                className="input input-bordered input-sm w-20"
                type="number"
                step="0.01"
                min="0"
                max="1"
                placeholder="0.87"
                value={r.value}
                onChange={(e) =>
                  setReliabilities((rs) => rs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                }
                disabled={busy}
              />
              <input
                className="input input-bordered input-sm w-32"
                placeholder="metric"
                value={r.metric}
                onChange={(e) =>
                  setReliabilities((rs) => rs.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)))
                }
                disabled={busy}
              />
              <button
                className="btn btn-outline btn-xs btn-square"
                onClick={() => setReliabilities((rs) => rs.filter((_, j) => j !== i))}
                disabled={busy}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="btn btn-outline btn-xs"
            onClick={() => setReliabilities((rs) => [...rs, { norm: "", value: "", metric: "" }])}
            disabled={busy}
          >
            + Add
          </button>
        </div>
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

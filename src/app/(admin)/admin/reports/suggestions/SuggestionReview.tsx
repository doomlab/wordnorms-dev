"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import updateExtraction from "../../../mutations/updateExtraction"
import dismissEditSuggestion from "../../../mutations/dismissEditSuggestion"

type Fields = {
  language: string[]
  participantCount: number | null
  participantType: string | null
  stimuliType: string[]
  stimuliCount: number | null
  normsCollected: string[]
  instructions: string | null
}

type Row = {
  label: string
  key: keyof Fields
  type: "text" | "number"
  isArray: boolean
  current: unknown
}

function fmt(val: unknown): string {
  if (val == null) return "—"
  if (Array.isArray(val)) return val.length ? val.join(", ") : "—"
  return String(val)
}

function changed(current: unknown, suggested: string): boolean {
  const currentStr = fmt(current)
  return currentStr !== suggested && !(currentStr === "—" && suggested === "")
}

export function SuggestionReview({
  suggestionId,
  paperId,
  current,
  suggested,
}: {
  suggestionId: number
  paperId: number
  current: Fields
  suggested: Fields
}) {
  const router = useRouter()
  const [update] = useMutation(updateExtraction)
  const [dismiss] = useMutation(dismissEditSuggestion)
  const [status, setStatus] = useState<"idle" | "applying" | "dismissing" | "error">("idle")

  const toStr = (val: unknown, isArray: boolean): string => {
    if (val == null) return ""
    if (isArray && Array.isArray(val)) return val.join(", ")
    return String(val)
  }

  const rows: Row[] = [
    { label: "Language", key: "language", type: "text", isArray: true, current: current.language },
    { label: "Norms collected", key: "normsCollected", type: "text", isArray: true, current: current.normsCollected },
    { label: "Stimuli type", key: "stimuliType", type: "text", isArray: true, current: current.stimuliType },
    { label: "Stimuli count", key: "stimuliCount", type: "number", isArray: false, current: current.stimuliCount },
    { label: "Participant type", key: "participantType", type: "text", isArray: false, current: current.participantType },
    { label: "Participants", key: "participantCount", type: "number", isArray: false, current: current.participantCount },
    { label: "Instructions", key: "instructions", type: "text", isArray: false, current: current.instructions },
  ]

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, toStr(suggested[r.key], r.isArray)]))
  )

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  const toPayload = () => ({
    paperId,
    language: values.language.split(",").map((s) => s.trim()).filter(Boolean),
    participantCount: values.participantCount ? parseInt(values.participantCount) : null,
    participantType: values.participantType || null,
    stimuliType: values.stimuliType.split(",").map((s) => s.trim()).filter(Boolean),
    stimuliCount: values.stimuliCount ? parseInt(values.stimuliCount) : null,
    normsCollected: values.normsCollected.split(",").map((s) => s.trim()).filter(Boolean),
    instructions: values.instructions || null,
  })

  const handleApply = async () => {
    setStatus("applying")
    try {
      await update(toPayload())
      await dismiss({ suggestionId })
      router.push("/admin/reports?tab=metadata")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  const handleDismiss = async () => {
    setStatus("dismissing")
    try {
      await dismiss({ suggestionId })
      router.push("/admin/reports?tab=metadata")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  const busy = status === "applying" || status === "dismissing"

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-error text-sm">Something went wrong</span>
        <button className="btn btn-xs btn-ghost" onClick={() => setStatus("idle")}>Retry</button>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto mb-10">
        <table className="table text-sm">
          <thead>
            <tr>
              <th className="w-40">Field</th>
              <th>Current</th>
              <th>Suggested (editable)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const diff = changed(row.current, values[row.key] ?? "")
              return (
                <tr key={row.key} className={diff ? "bg-warning/5" : ""}>
                  <td className="font-medium text-base-content/70">{row.label}</td>
                  <td className="text-base-content/60">{fmt(row.current)}</td>
                  <td>
                    <input
                      type={row.type}
                      className={`input input-bordered input-xs w-full ${diff ? "border-warning/50" : ""}`}
                      value={values[row.key] ?? ""}
                      onChange={set(row.key)}
                      disabled={busy}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-base-200 pt-8 text-center">
        <p className="text-sm text-base-content/60 mb-4">Apply these changes to the extraction?</p>
        <div className="flex gap-3 justify-center">
          <button className="btn btn-ghost btn-outline btn-wide" onClick={handleDismiss} disabled={busy}>
            {status === "dismissing" ? <span className="loading loading-spinner loading-xs" /> : "Dismiss"}
          </button>
          <button className="btn btn-success btn-wide" onClick={handleApply} disabled={busy}>
            {status === "applying" ? <span className="loading loading-spinner loading-xs" /> : "Apply Changes"}
          </button>
        </div>
      </div>
    </>
  )
}

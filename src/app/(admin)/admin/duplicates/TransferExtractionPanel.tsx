"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { useState } from "react"
import transferExtraction from "../../mutations/transferExtraction"

type Extraction = {
  language: string[]
  participantCount: number | null
  participantType: string | null
  stimuliType: string[]
  stimuliCount: number | null
  normsCollected: string[]
  instructions: string | null
  confidence: number | null
  extractedBy: string | null
  needsReview: boolean
  extractedAt: Date
}

type FieldKey = keyof Omit<Extraction, "extractedAt">

const FIELDS: { key: FieldKey | "extractedAt"; label: string }[] = [
  { key: "language", label: "Language" },
  { key: "participantCount", label: "Participants" },
  { key: "participantType", label: "Participant type" },
  { key: "stimuliType", label: "Stimuli type" },
  { key: "stimuliCount", label: "Stimuli count" },
  { key: "normsCollected", label: "Norms collected" },
  { key: "instructions", label: "Instructions" },
  { key: "confidence", label: "Confidence" },
  { key: "extractedBy", label: "Extracted by" },
  { key: "needsReview", label: "Needs review" },
]

function displayValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return "—"
  if (Array.isArray(val)) return val.length === 0 ? "—" : val.join(", ")
  if (typeof val === "number") return key === "confidence" ? val.toFixed(2) : String(val)
  if (typeof val === "boolean") return val ? "yes" : "no"
  return String(val)
}

function isEmpty(key: string, val: unknown): boolean {
  if (val === null || val === undefined) return true
  if (Array.isArray(val)) return val.length === 0
  if (typeof val === "boolean") return false
  return false
}

export function TransferExtractionPanel({
  fromPaperId,
  toPaperId,
  duplicate,
  canonical,
}: {
  fromPaperId: number
  toPaperId: number
  duplicate: Extraction
  canonical: Extraction | null
}) {
  const [transfer] = useMutation(transferExtraction)
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initialChecked = FIELDS.filter(
    ({ key }) =>
      !isEmpty(key, duplicate[key as FieldKey]) &&
      (canonical === null || isEmpty(key, canonical[key as FieldKey]))
  ).map(({ key }) => key)

  const [checked, setChecked] = useState<string[]>(initialChecked)

  const toggle = (key: string) =>
    setChecked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const handleApply = async () => {
    if (checked.length === 0) return
    setError(null)
    setPending(true)
    try {
      await transfer({ fromPaperId, toPaperId, fields: checked as any })
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? "Transfer failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="border border-base-300 rounded-box p-4 mb-6">
      <h3 className="font-semibold text-sm mb-1">Copy extraction fields to canonical</h3>
      <p className="text-xs text-base-content/50 mb-4">
        Select which fields to copy from the duplicate. Pre-checked where the canonical is empty.
      </p>

      <div className="overflow-x-auto">
        <table className="table table-sm text-sm w-full">
          <thead>
            <tr>
              <th className="w-6"></th>
              <th>Field</th>
              <th>Canonical (#{toPaperId})</th>
              <th>Duplicate (#{fromPaperId})</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map(({ key, label }) => {
              const dupVal = duplicate[key as FieldKey]
              const canVal = canonical?.[key as FieldKey] ?? null
              const dupDisplay = displayValue(key, dupVal)
              const canDisplay = displayValue(key, canVal)
              const dupEmpty = isEmpty(key, dupVal)
              const isChecked = checked.includes(key)

              return (
                <tr
                  key={key}
                  className={isChecked ? "bg-warning/10" : ""}
                  onClick={() => !dupEmpty && toggle(key)}
                  style={{ cursor: dupEmpty ? "default" : "pointer" }}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-warning"
                      checked={isChecked}
                      disabled={dupEmpty}
                      onChange={() => toggle(key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="font-medium text-base-content/70">{label}</td>
                  <td className={canDisplay === "—" ? "text-base-content/30" : ""}>{canDisplay}</td>
                  <td className={dupEmpty ? "text-base-content/30" : "font-medium"}>
                    {dupDisplay}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-error text-xs mt-3">{error}</p>}

      <div className="flex items-center gap-3 mt-4">
        <button
          className="btn btn-warning btn-sm"
          disabled={pending || checked.length === 0}
          onClick={handleApply}
        >
          {pending
            ? "Applying…"
            : `Apply ${checked.length} field${checked.length !== 1 ? "s" : ""}`}
        </button>
        {checked.length > 0 && (
          <button className="btn btn-ghost btn-xs" onClick={() => setChecked([])}>
            Clear all
          </button>
        )}
        <button
          className="btn btn-secondary btn-xs"
          onClick={() =>
            setChecked(
              FIELDS.filter(({ key }) => !isEmpty(key, duplicate[key as FieldKey])).map(
                ({ key }) => key
              )
            )
          }
        >
          Select all
        </button>
      </div>
    </div>
  )
}

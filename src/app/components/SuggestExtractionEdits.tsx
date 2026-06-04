"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import { Prisma } from "@prisma/client"
import submitExtractionEdit from "../(dashboard)/mutations/submitExtractionEdit"

type Ext = {
  language: string[]
  participantCount: number | null
  participantType: string | null
  stimuliType: string[]
  stimuliCount: number | null
  normsCollected: string[]
  instructions: string | null
  participantLevelData: boolean
  reliabilities: Prisma.JsonValue | null
  sourceSnippets?: Record<string, string> | null
}

function toList(arr: string[]) {
  return arr.join(", ")
}

function fromList(s: string) {
  return s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function SnippetBlock({
  text,
  fieldKey,
  hasEvidence,
  onCapture,
  onDismiss,
}: {
  text: string
  fieldKey: string
  hasEvidence: boolean
  onCapture: (key: string, text: string) => void
  onDismiss: (key: string) => void
}) {
  const handleMouseUp = () => {
    const sel = window.getSelection()?.toString().trim()
    if (sel && sel.length > 5) onCapture(fieldKey, sel)
  }

  return (
    <div className="mt-1.5">
      <p className="text-xs text-base-content/40 mb-1 flex items-center gap-2">
        {hasEvidence ? (
          <span className="text-success font-medium">✓ Evidence captured — highlight to update</span>
        ) : (
          <span>Highlight the correct text if this passage is wrong</span>
        )}
        <button
          type="button"
          onClick={() => onDismiss(fieldKey)}
          className="text-base-content/30 hover:text-error leading-none"
          title="Dismiss this snippet"
        >
          ✕
        </button>
      </p>
      <div
        onMouseUp={handleMouseUp}
        className="text-xs text-base-content/55 border-l-2 border-base-300 pl-2.5 py-0.5 leading-relaxed select-text cursor-text italic"
      >
        {text}
      </div>
    </div>
  )
}

export function SuggestExtractionEdits({
  paperId,
  ext,
  hasPriorSuggestion,
  isLoggedIn = true,
}: {
  paperId: number
  ext: Ext
  hasPriorSuggestion: boolean
  isLoggedIn?: boolean
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [submit] = useMutation(submitExtractionEdit)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(hasPriorSuggestion)

  const [language, setLanguage] = useState(toList(ext.language))
  const [participantCount, setParticipantCount] = useState(ext.participantCount?.toString() ?? "")
  const [participantType, setParticipantType] = useState(ext.participantType ?? "")
  const [stimuliType, setStimuliType] = useState(toList(ext.stimuliType))
  const [stimuliCount, setStimuliCount] = useState(ext.stimuliCount?.toString() ?? "")
  const [normsCollected, setNormsCollected] = useState(toList(ext.normsCollected))
  const [instructions, setInstructions] = useState(ext.instructions ?? "")
  const [participantLevelData, setParticipantLevelData] = useState(ext.participantLevelData)
  const [reliabilities, setReliabilities] = useState<{ norm: string; value: string; metric: string }[]>(
    Array.isArray(ext.reliabilities)
      ? (ext.reliabilities as { norm: string; value: number | null; metric: string }[]).map((r) => ({
          norm: r.norm ?? "",
          value: r.value?.toString() ?? "",
          metric: r.metric ?? "",
        }))
      : []
  )
  const [url, setUrl] = useState("")
  const [note, setNote] = useState("")
  const [sourceEvidence, setSourceEvidence] = useState<Record<string, string>>({})
  const [dismissedSnippets, setDismissedSnippets] = useState<Set<string>>(new Set())

  const rawSnippets = ext.sourceSnippets ?? {}
  const snippets = Object.fromEntries(
    Object.entries(rawSnippets).filter(([k]) => !dismissedSnippets.has(k))
  )

  const captureEvidence = (key: string, text: string) => {
    setSourceEvidence((prev) => ({ ...prev, [key]: text }))
  }

  const dismissSnippet = (key: string) => {
    setDismissedSnippets((prev) => new Set([...prev, key]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submit({
        paperId,
        language: fromList(language),
        participantCount: participantCount ? parseInt(participantCount, 10) : null,
        participantType: participantType.trim() || null,
        stimuliType: fromList(stimuliType),
        stimuliCount: stimuliCount ? parseInt(stimuliCount, 10) : null,
        normsCollected: fromList(normsCollected),
        instructions: instructions.trim() || null,
        participantLevelData,
        reliabilities: reliabilities.length > 0
          ? reliabilities.map((r) => ({ norm: r.norm, value: r.value !== "" ? parseFloat(r.value) : null, metric: r.metric }))
          : null,
        url: url.trim() || null,
        note: note.trim() || undefined,
        sourceEvidence: Object.keys(sourceEvidence).length > 0 ? sourceEvidence : undefined,
      })
      setDone(true)
      dialogRef.current?.close()
      router.refresh()
    } catch {
      window.location.href = "/login"
    } finally {
      setSubmitting(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="tooltip tooltip-left" data-tip="You must have an account to use this feature">
        <button
          disabled
          className="btn btn-primary btn-sm text-base-content/25 opacity-40 cursor-not-allowed"
        >
          Suggest edits
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => dialogRef.current?.showModal()}
        className="btn btn-primary btn-sm text-base-content/50 hover:text-base-content"
      >
        {done ? "Edit suggestion submitted ✓" : "Suggest edits"}
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-xl">
          <h3 className="font-bold text-lg mb-1">Suggest edits</h3>
          <p className="text-sm text-base-content/60 mb-5">
            Correct any extracted values. If the source passage is shown, highlight the correct text
            to capture it as evidence.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Language" hint="comma-separated">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g. English, French"
              />
              {snippets.language && (
                <SnippetBlock
                  text={snippets.language}
                  fieldKey="language"
                  hasEvidence={"language" in sourceEvidence}
                  onCapture={captureEvidence}
                  onDismiss={dismissSnippet}
                />
              )}
            </Field>

            <Field label="Norms collected" hint="comma-separated">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={normsCollected}
                onChange={(e) => setNormsCollected(e.target.value)}
                placeholder="e.g. valence, arousal"
              />
              {snippets.normsCollected && (
                <SnippetBlock
                  text={snippets.normsCollected}
                  fieldKey="normsCollected"
                  hasEvidence={"normsCollected" in sourceEvidence}
                  onCapture={captureEvidence}
                  onDismiss={dismissSnippet}
                />
              )}
            </Field>

            <Field label="Stimuli type" hint="comma-separated">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={stimuliType}
                onChange={(e) => setStimuliType(e.target.value)}
                placeholder="e.g. words"
              />
              {snippets.stimuliType && (
                <SnippetBlock
                  text={snippets.stimuliType}
                  fieldKey="stimuliType"
                  hasEvidence={"stimuliType" in sourceEvidence}
                  onCapture={captureEvidence}
                  onDismiss={dismissSnippet}
                />
              )}
            </Field>

            <Field label="Stimuli count">
              <input
                type="number"
                className="input input-bordered input-sm w-full"
                value={stimuliCount}
                onChange={(e) => setStimuliCount(e.target.value)}
                min={0}
              />
              {snippets.stimuliCount && (
                <SnippetBlock
                  text={snippets.stimuliCount}
                  fieldKey="stimuliCount"
                  hasEvidence={"stimuliCount" in sourceEvidence}
                  onCapture={captureEvidence}
                  onDismiss={dismissSnippet}
                />
              )}
            </Field>

            <Field label="Participant type">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={participantType}
                onChange={(e) => setParticipantType(e.target.value)}
                placeholder="e.g. undergraduates"
              />
              {snippets.participantType && (
                <SnippetBlock
                  text={snippets.participantType}
                  fieldKey="participantType"
                  hasEvidence={"participantType" in sourceEvidence}
                  onCapture={captureEvidence}
                  onDismiss={dismissSnippet}
                />
              )}
            </Field>

            <Field label="Participant count">
              <input
                type="number"
                className="input input-bordered input-sm w-full"
                value={participantCount}
                onChange={(e) => setParticipantCount(e.target.value)}
                min={0}
              />
              {snippets.participantCount && (
                <SnippetBlock
                  text={snippets.participantCount}
                  fieldKey="participantCount"
                  hasEvidence={"participantCount" in sourceEvidence}
                  onCapture={captureEvidence}
                  onDismiss={dismissSnippet}
                />
              )}
            </Field>

            <Field label="Instructions">
              <textarea
                className="textarea textarea-bordered w-full text-sm"
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
              {snippets.instructions && (
                <SnippetBlock
                  text={snippets.instructions}
                  fieldKey="instructions"
                  hasEvidence={"instructions" in sourceEvidence}
                  onCapture={captureEvidence}
                  onDismiss={dismissSnippet}
                />
              )}
            </Field>

            <Field label="Participant-level data available">
              <label className="flex items-center gap-2 mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={participantLevelData}
                  onChange={(e) => setParticipantLevelData(e.target.checked)}
                />
                <span className="text-sm text-base-content/70">
                  Raw per-participant data is publicly available
                </span>
              </label>
            </Field>

            <div>
              <label className="label py-1">
                <span className="label-text font-medium">Reliabilities</span>
              </label>
              {reliabilities.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  {reliabilities.map((r, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        className="input input-bordered input-xs flex-1"
                        placeholder="norm (e.g. valence)"
                        value={r.norm}
                        onChange={(e) => setReliabilities((prev) => prev.map((x, j) => j === i ? { ...x, norm: e.target.value } : x))}
                      />
                      <input
                        type="number"
                        className="input input-bordered input-xs w-24"
                        placeholder="value"
                        value={r.value}
                        onChange={(e) => setReliabilities((prev) => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                        step="0.01"
                      />
                      <input
                        type="text"
                        className="input input-bordered input-xs flex-1"
                        placeholder="metric (e.g. cronbach_alpha)"
                        value={r.metric}
                        onChange={(e) => setReliabilities((prev) => prev.map((x, j) => j === i ? { ...x, metric: e.target.value } : x))}
                      />
                      <button
                        type="button"
                        className="text-base-content/30 hover:text-error text-xs"
                        onClick={() => setReliabilities((prev) => prev.filter((_, j) => j !== i))}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="btn btn-xs btn-primary ml-2"
                onClick={() => setReliabilities((prev) => [...prev, { norm: "", value: "", metric: "" }])}
              >
                + Add reliability
              </button>
              {snippets.reliabilities && (
                <SnippetBlock
                  text={snippets.reliabilities}
                  fieldKey="reliabilities"
                  hasEvidence={"reliabilities" in sourceEvidence}
                  onCapture={captureEvidence}
                  onDismiss={dismissSnippet}
                />
              )}
            </div>

            <Field label="Website URL" hint="optional — homepage or repository for this dataset">
              <input
                type="url"
                className="input input-bordered input-sm w-full"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </Field>

            <Field label="Note" hint="optional — explain your changes">
              <textarea
                className="textarea textarea-bordered w-full text-sm"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                placeholder="Any context that would help the reviewer…"
              />
            </Field>

            <div className="modal-action mt-0">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit suggestion"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
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
    <div>
      <label className="label py-1">
        <span className="label-text font-medium">
          {label}
          {hint && <span className="font-normal text-base-content/50 ml-1">({hint})</span>}
        </span>
      </label>
      {children}
    </div>
  )
}

"use client"

import { useState } from "react"
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
  paperText?: string | null
}

function toList(arr: string[]) { return arr.join(", ") }
function fromList(s: string) { return s.split(",").map((v) => v.trim()).filter(Boolean) }

function ModelTag({ label, snippet }: { label: string; snippet?: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!label && !snippet) return null
  return (
    <div className="mt-1 text-xs text-base-content/40 flex flex-col gap-0.5">
      {label && (
        <span>
          <span className="font-medium text-base-content/30">Model: </span>
          {label}
        </span>
      )}
      {snippet && (
        <span>
          <span className="font-medium text-base-content/30">From: </span>
          {expanded ? (
            <>
              <span className="italic">{snippet}</span>{" "}
              <button type="button" onClick={() => setExpanded(false)} className="underline text-base-content/30">less</button>
            </>
          ) : (
            <>
              <span className="italic">{snippet.length > 80 ? snippet.slice(0, 80) + "…" : snippet}</span>
              {snippet.length > 80 && (
                <> <button type="button" onClick={() => setExpanded(true)} className="underline text-base-content/30">more</button></>
              )}
            </>
          )}
        </span>
      )}
    </div>
  )
}

function SnippetHint({
  fieldKey, captured, active, onActivate, onClear,
}: {
  fieldKey: string
  captured: Record<string, string>
  active: string | null
  onActivate: (key: string | null) => void
  onClear: (key: string) => void
}) {
  const hasCaptured = fieldKey in captured
  const isActive = active === fieldKey
  return (
    <div className="mt-1 flex items-center gap-2">
      {hasCaptured ? (
        <>
          <span className="text-xs text-success">✓ Evidence captured</span>
          <button type="button" onClick={() => onClear(fieldKey)}
            className="text-xs text-base-content/30 hover:text-error">clear</button>
        </>
      ) : (
        <button type="button" onClick={() => onActivate(isActive ? null : fieldKey)}
          className={`text-xs ${isActive ? "text-primary font-medium" : "text-base-content/40 hover:text-base-content"}`}>
          {isActive ? "→ Now select text in the paper" : "Capture evidence from paper text"}
        </button>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

export function SuggestExtractionEditsPage({
  paperId, ext, hasPriorSuggestion,
}: {
  paperId: number
  ext: Ext
  hasPriorSuggestion: boolean
}) {
  const router = useRouter()
  const [submit] = useMutation(submitExtractionEdit)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [activeSnippetField, setActiveSnippetField] = useState<string | null>(null)

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
          norm: r.norm ?? "", value: r.value?.toString() ?? "", metric: r.metric ?? "",
        }))
      : []
  )
  const [capturedSnippets, setCapturedSnippets] = useState<Record<string, string>>(
    ext.sourceSnippets ?? {}
  )
  const [url, setUrl] = useState("")
  const [note, setNote] = useState("")

  const snippets = ext.sourceSnippets ?? {}

  const modelAnswers = {
    language: toList(ext.language),
    participantCount: ext.participantCount?.toString() ?? null,
    participantType: ext.participantType,
    stimuliType: toList(ext.stimuliType),
    stimuliCount: ext.stimuliCount?.toString() ?? null,
    normsCollected: toList(ext.normsCollected),
    instructions: ext.instructions,
    participantLevelData: ext.participantLevelData,
    reliabilities: ext.reliabilities,
  }

  const handleTextSelect = (fieldKey: string) => {
    const sel = window.getSelection()?.toString().trim()
    if (sel && sel.length > 5) {
      setCapturedSnippets((prev) => ({ ...prev, [fieldKey]: sel }))
      setActiveSnippetField(null)
    }
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
        sourceEvidence: Object.keys(capturedSnippets).length > 0 ? capturedSnippets : undefined,
        modelAnswers,
        modelSnippets: Object.keys(snippets).length > 0 ? snippets : undefined,
      })
      setDone(true)
      router.refresh()
    } catch {
      window.location.href = "/login"
    } finally {
      setSubmitting(false)
    }
  }

  const clear = (k: string) => setCapturedSnippets((p) => { const n = { ...p }; delete n[k]; return n })

  if (done) {
    return (
      <div className="rounded-xl border border-base-200 p-8 text-center">
        <p className="text-success font-medium mb-2">Thanks — your suggestion has been submitted!</p>
        <a href={`/norms/${paperId}`} className="btn btn-outline btn-sm">Back to paper</a>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Left: form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <Field label="Language" hint="comma-separated">
          <input type="text" className="input input-bordered input-sm w-full" value={language}
            onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. English, French" />
          <ModelTag label={modelAnswers.language} snippet={snippets.language} />
          <SnippetHint fieldKey="language" captured={capturedSnippets} active={activeSnippetField}
            onActivate={setActiveSnippetField} onClear={clear} />
        </Field>

        <Field label="Norms collected" hint="comma-separated">
          <input type="text" className="input input-bordered input-sm w-full" value={normsCollected}
            onChange={(e) => setNormsCollected(e.target.value)} placeholder="e.g. valence, arousal" />
          <ModelTag label={modelAnswers.normsCollected} snippet={snippets.normsCollected} />
          <SnippetHint fieldKey="normsCollected" captured={capturedSnippets} active={activeSnippetField}
            onActivate={setActiveSnippetField} onClear={clear} />
        </Field>

        <Field label="Stimuli type" hint="comma-separated">
          <input type="text" className="input input-bordered input-sm w-full" value={stimuliType}
            onChange={(e) => setStimuliType(e.target.value)} placeholder="e.g. words" />
          <ModelTag label={modelAnswers.stimuliType} snippet={snippets.stimuliType} />
          <SnippetHint fieldKey="stimuliType" captured={capturedSnippets} active={activeSnippetField}
            onActivate={setActiveSnippetField} onClear={clear} />
        </Field>

        <Field label="Stimuli count">
          <input type="number" className="input input-bordered input-sm w-full" value={stimuliCount}
            onChange={(e) => setStimuliCount(e.target.value)} min={0} />
          <ModelTag label={modelAnswers.stimuliCount ?? ""} snippet={snippets.stimuliCount} />
          <SnippetHint fieldKey="stimuliCount" captured={capturedSnippets} active={activeSnippetField}
            onActivate={setActiveSnippetField} onClear={clear} />
        </Field>

        <Field label="Participant type">
          <input type="text" className="input input-bordered input-sm w-full" value={participantType}
            onChange={(e) => setParticipantType(e.target.value)} placeholder="e.g. undergraduates" />
          <ModelTag label={modelAnswers.participantType ?? ""} snippet={snippets.participantType} />
          <SnippetHint fieldKey="participantType" captured={capturedSnippets} active={activeSnippetField}
            onActivate={setActiveSnippetField} onClear={clear} />
        </Field>

        <Field label="Participant count">
          <input type="number" className="input input-bordered input-sm w-full" value={participantCount}
            onChange={(e) => setParticipantCount(e.target.value)} min={0} />
          <ModelTag label={modelAnswers.participantCount ?? ""} snippet={snippets.participantCount} />
          <SnippetHint fieldKey="participantCount" captured={capturedSnippets} active={activeSnippetField}
            onActivate={setActiveSnippetField} onClear={clear} />
        </Field>

        <Field label="Instructions">
          <textarea className="textarea textarea-bordered w-full text-sm" rows={3} value={instructions}
            onChange={(e) => setInstructions(e.target.value)} />
          <ModelTag label={modelAnswers.instructions ?? ""} snippet={snippets.instructions} />
          <SnippetHint fieldKey="instructions" captured={capturedSnippets} active={activeSnippetField}
            onActivate={setActiveSnippetField} onClear={clear} />
        </Field>

        <Field label="Participant-level data available">
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm" checked={participantLevelData}
              onChange={(e) => setParticipantLevelData(e.target.checked)} />
            <span className="text-sm text-base-content/70">Raw per-participant data is publicly available</span>
          </label>
          <div className="mt-1 text-xs text-base-content/40">
            <span className="font-medium text-base-content/30">Model: </span>
            {modelAnswers.participantLevelData ? "Yes" : "No"}
          </div>
        </Field>

        <Field label="Reliabilities">
          {reliabilities.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-2">
              {reliabilities.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" className="input input-bordered input-xs flex-1" placeholder="norm"
                    value={r.norm} onChange={(e) => setReliabilities((prev) => prev.map((x, j) => j === i ? { ...x, norm: e.target.value } : x))} />
                  <input type="number" className="input input-bordered input-xs w-24" placeholder="value"
                    value={r.value} step="0.01" onChange={(e) => setReliabilities((prev) => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                  <input type="text" className="input input-bordered input-xs flex-1" placeholder="metric"
                    value={r.metric} onChange={(e) => setReliabilities((prev) => prev.map((x, j) => j === i ? { ...x, metric: e.target.value } : x))} />
                  <button type="button" className="text-base-content/30 hover:text-error text-xs"
                    onClick={() => setReliabilities((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-xs btn-primary ml-2"
            onClick={() => setReliabilities((prev) => [...prev, { norm: "", value: "", metric: "" }])}>
            + Add reliability
          </button>
          <ModelTag label="" snippet={snippets.reliabilities} />
          <SnippetHint fieldKey="reliabilities" captured={capturedSnippets} active={activeSnippetField}
            onActivate={setActiveSnippetField} onClear={clear} />
        </Field>

        <Field label="Website URL" hint="optional">
          <input type="url" className="input input-bordered input-sm w-full" value={url}
            onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>

        <Field label="Note" hint="optional — explain your changes">
          <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={note}
            onChange={(e) => setNote(e.target.value)} maxLength={1000}
            placeholder="Any context that would help the reviewer…" />
        </Field>

        <div className="flex gap-3 pt-2">
          <a href={`/norms/${paperId}`} className="btn btn-outline btn-sm">Cancel</a>
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            {submitting ? "Submitting…" : hasPriorSuggestion ? "Update suggestion" : "Submit suggestion"}
          </button>
        </div>
      </form>

      {/* Right: paper text */}
      <div className="lg:sticky lg:top-6">
        <div className="rounded-xl border border-base-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-base-200 bg-base-200/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50">Paper text</p>
            {activeSnippetField && (
              <p className="text-xs text-primary mt-0.5">
                Capturing for: <strong>{activeSnippetField}</strong> — select text below
              </p>
            )}
          </div>
          {ext.paperText ? (
            <div
              className="p-4 text-xs text-base-content/70 leading-relaxed whitespace-pre-wrap select-text cursor-text max-h-[75vh] overflow-y-auto font-mono"
              onMouseUp={() => activeSnippetField && handleTextSelect(activeSnippetField)}
            >
              {ext.paperText}
            </div>
          ) : (
            <div className="p-4 text-sm text-base-content/40 italic">
              No paper text available — re-run extraction with <code>--redo</code> to populate it.
            </div>
          )}
        </div>

        {Object.keys(capturedSnippets).length > 0 && (
          <div className="mt-4 rounded-xl border border-base-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">Your captured evidence</p>
            <div className="flex flex-col gap-2">
              {Object.entries(capturedSnippets).map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="font-medium text-base-content/60">{k}:</span>{" "}
                  <span className="italic text-base-content/50">&ldquo;{v}&rdquo;</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

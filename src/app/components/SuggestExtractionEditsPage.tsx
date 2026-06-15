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
  licenseUrl?: string | null
  dataSource?: string | null
  sourceSnippets?: Record<string, string> | null
  paperText?: string | null
}

function toList(arr: string[]) { return arr.join(", ") }
function fromList(s: string) { return s.split(",").map((v) => v.trim()).filter(Boolean) }
function snippetStr(v: unknown): string {
  if (v == null) return ""
  return typeof v === "string" ? v : JSON.stringify(v)
}

function FieldBlock({
  label, hint, modelAnswer, modelSnippet, fieldKey,
  capturedSnippets, setCapturedSnippets, activeSnippetField, setActiveSnippetField,
  noEvidenceFields, setNoEvidenceFields,
  children,
}: {
  label: string
  hint?: string
  modelAnswer?: string
  modelSnippet?: unknown
  fieldKey: string
  capturedSnippets: Record<string, string>
  setCapturedSnippets: React.Dispatch<React.SetStateAction<Record<string, string>>>
  activeSnippetField: string | null
  setActiveSnippetField: (k: string | null) => void
  noEvidenceFields: Set<string>
  setNoEvidenceFields: React.Dispatch<React.SetStateAction<Set<string>>>
  children: React.ReactNode
}) {
  const [snippetExpanded, setSnippetExpanded] = useState(false)
  const isActive = activeSnippetField === fieldKey
  const noEvidence = noEvidenceFields.has(fieldKey)
  const snippetText = snippetStr(modelSnippet)

  const toggleNoEvidence = () => {
    setNoEvidenceFields((prev) => {
      const next = new Set(prev)
      if (next.has(fieldKey)) next.delete(fieldKey)
      else { next.add(fieldKey); setActiveSnippetField(null) }
      return next
    })
  }

  return (
    <div className="rounded-lg border border-base-200 overflow-hidden">
      <div className="px-4 py-2 bg-base-200/50 border-b border-base-200">
        <span className="text-base font-semibold">{label}</span>
        {hint && <span className="text-sm font-normal text-base-content/50 ml-1">({hint})</span>}
      </div>

      {/* Model rows */}
      <div className="px-4 py-3 border-b border-base-200/60 bg-base-200/20">
        <div className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-base">
          <span className="text-base-content/40 font-medium">Model answer</span>
          <span className="text-base-content/70">
            {modelAnswer || <span className="italic text-base-content/30">—</span>}
          </span>
          <span className="text-base-content/40 font-medium">Model evidence</span>
          <span className="text-base-content/50 italic leading-relaxed">
            {snippetText ? (
              <>
                {snippetExpanded || snippetText.length <= 140
                  ? snippetText
                  : snippetText.slice(0, 140) + "…"}
                {snippetText.length > 140 && (
                  <button type="button" onClick={() => setSnippetExpanded((v) => !v)}
                    className="ml-1 underline text-base-content/30 not-italic">
                    {snippetExpanded ? "less" : "more"}
                  </button>
                )}
              </>
            ) : <span className="text-base-content/30">—</span>}
          </span>
        </div>
      </div>

      {/* Human rows */}
      <div className="px-4 py-3 flex flex-col gap-3">
        <div>
          <label className="text-base font-medium text-base-content/50 mb-1.5 block">Your answer</label>
          {children}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-base font-medium text-base-content/50">Your evidence</label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" className="checkbox checkbox-xs" checked={noEvidence} onChange={toggleNoEvidence} />
              <span className="text-sm text-base-content/40">No evidence</span>
            </label>
          </div>
          {noEvidence ? (
            <div className="rounded border border-dashed border-base-300 px-3 py-2 text-base text-base-content/30 italic">
              Marked as not in paper — answer based on supplement or prior knowledge
            </div>
          ) : (
            <>
              <textarea
                className="textarea textarea-bordered w-full text-base leading-relaxed"
                rows={2}
                value={capturedSnippets[fieldKey] ?? ""}
                onChange={(e) => setCapturedSnippets((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                placeholder="Paste the sentence(s) from the paper that support your answer…"
              />
              <button type="button"
                onClick={() => setActiveSnippetField(isActive ? null : fieldKey)}
                className={`mt-1 text-base ${isActive ? "text-primary font-medium" : "text-base-content/40 hover:text-base-content"}`}>
                {isActive ? "→ Select text in the paper panel to the right" : "Select from paper text →"}
              </button>
            </>
          )}
        </div>
      </div>
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
    (ext.sourceSnippets as Record<string, string>) ?? {}
  )
  const [noEvidenceFields, setNoEvidenceFields] = useState<Set<string>>(new Set())
  const [url, setUrl] = useState("")
  const [licenseUrl, setLicenseUrl] = useState(ext.licenseUrl ?? "")
  const [dataSource, setDataSource] = useState(ext.dataSource ?? "")
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

  const handleTextSelect = () => {
    if (!activeSnippetField) return
    const sel = window.getSelection()?.toString().trim()
    if (sel && sel.length > 5) {
      setCapturedSnippets((prev) => ({ ...prev, [activeSnippetField]: sel }))
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
        licenseUrl: licenseUrl.trim() || null,
        dataSource: dataSource.trim() || null,
        note: note.trim() || undefined,
        sourceEvidence: (() => {
          const evidence = Object.fromEntries(
            Object.entries(capturedSnippets).filter(([k]) => !noEvidenceFields.has(k))
          )
          return Object.keys(evidence).length > 0 ? evidence : undefined
        })(),
        modelAnswers,
        modelSnippets: Object.keys(snippets).length > 0 ? snippets as Record<string, string> : undefined,
      })
      setDone(true)
      router.refresh()
    } catch {
      window.location.href = "/login"
    } finally {
      setSubmitting(false)
    }
  }

  const fieldProps = { capturedSnippets, setCapturedSnippets, activeSnippetField, setActiveSnippetField, noEvidenceFields, setNoEvidenceFields }

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

        {/* Instructions banner */}
        <div className="rounded-lg bg-info/10 border border-info/20 px-4 py-3 text-base text-base-content/70 flex flex-col gap-1">
          <p className="font-semibold text-base-content/90">How to use this page</p>
          <ul className="list-disc list-inside text-base gap-1 flex flex-col">
            <li>Each field shows the model&apos;s answer and the sentence it used as evidence.</li>
            <li>Edit <strong>Your answer</strong> if the model got it wrong.</li>
            <li>Edit or replace <strong>Your evidence</strong> — paste the correct sentence, or click &ldquo;Select from paper text&rdquo; and highlight text in the panel on the right.</li>
          </ul>
        </div>

        <FieldBlock label="Language" hint="comma-separated"
          modelAnswer={modelAnswers.language} modelSnippet={snippets.language}
          fieldKey="language" {...fieldProps}>
          <input type="text" className="input input-bordered input-sm w-full" value={language}
            onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. English, French" />
        </FieldBlock>

        <FieldBlock label="Norms collected" hint="comma-separated"
          modelAnswer={modelAnswers.normsCollected} modelSnippet={snippets.normsCollected}
          fieldKey="normsCollected" {...fieldProps}>
          <input type="text" className="input input-bordered input-sm w-full" value={normsCollected}
            onChange={(e) => setNormsCollected(e.target.value)} placeholder="e.g. valence, arousal" />
        </FieldBlock>

        <FieldBlock label="Stimuli type" hint="comma-separated"
          modelAnswer={modelAnswers.stimuliType} modelSnippet={snippets.stimuliType}
          fieldKey="stimuliType" {...fieldProps}>
          <input type="text" className="input input-bordered input-sm w-full" value={stimuliType}
            onChange={(e) => setStimuliType(e.target.value)} placeholder="e.g. words" />
        </FieldBlock>

        <FieldBlock label="Stimuli count"
          modelAnswer={modelAnswers.stimuliCount ?? ""} modelSnippet={snippets.stimuliCount}
          fieldKey="stimuliCount" {...fieldProps}>
          <input type="number" className="input input-bordered input-sm w-full" value={stimuliCount}
            onChange={(e) => setStimuliCount(e.target.value)} min={0} />
        </FieldBlock>

        <FieldBlock label="Participant type"
          modelAnswer={modelAnswers.participantType ?? ""} modelSnippet={snippets.participantType}
          fieldKey="participantType" {...fieldProps}>
          <input type="text" className="input input-bordered input-sm w-full" value={participantType}
            onChange={(e) => setParticipantType(e.target.value)} placeholder="e.g. undergraduates" />
        </FieldBlock>

        <FieldBlock label="Participant count"
          modelAnswer={modelAnswers.participantCount ?? ""} modelSnippet={snippets.participantCount}
          fieldKey="participantCount" {...fieldProps}>
          <input type="number" className="input input-bordered input-sm w-full" value={participantCount}
            onChange={(e) => setParticipantCount(e.target.value)} min={0} />
        </FieldBlock>

        <FieldBlock label="Instructions"
          modelAnswer={modelAnswers.instructions ?? ""} modelSnippet={snippets.instructions}
          fieldKey="instructions" {...fieldProps}>
          <textarea className="textarea textarea-bordered w-full text-base" rows={3} value={instructions}
            onChange={(e) => setInstructions(e.target.value)} />
        </FieldBlock>

        {/* Participant-level data — no evidence field */}
        <div className="rounded-lg border border-base-200 overflow-hidden">
          <div className="px-4 py-2 bg-base-200/50 border-b border-base-200">
            <span className="text-base font-semibold">Participant-level data available</span>
          </div>
          <div className="px-4 py-3 border-b border-base-200/60 bg-base-200/20 text-base">
            <div className="grid grid-cols-[150px_1fr] gap-x-3">
              <span className="text-base-content/40 font-medium">Model answer</span>
              <span className="text-base-content/70">{modelAnswers.participantLevelData ? "Yes" : "No"}</span>
            </div>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3">
            <div>
              <label className="text-base font-medium text-base-content/50 mb-2 block">Your answer</label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={participantLevelData}
                  onChange={(e) => setParticipantLevelData(e.target.checked)} />
                <span className={`text-base font-medium ${participantLevelData ? "text-primary" : "text-base-content/40"}`}>
                  {participantLevelData ? "Yes" : "No"}
                </span>
              </label>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-base font-medium text-base-content/50">Your evidence</label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs"
                    checked={noEvidenceFields.has("participantLevelData")}
                    onChange={() => setNoEvidenceFields((prev) => { const n = new Set(prev); n.has("participantLevelData") ? n.delete("participantLevelData") : n.add("participantLevelData"); return n })} />
                  <span className="text-sm text-base-content/40">No evidence</span>
                </label>
              </div>
              {noEvidenceFields.has("participantLevelData") ? (
                <div className="rounded border border-dashed border-base-300 px-3 py-2 text-base text-base-content/30 italic">
                  Marked as not in paper — answer based on supplement or prior knowledge
                </div>
              ) : (
                <>
                  <textarea
                    className="textarea textarea-bordered w-full text-base leading-relaxed"
                    rows={2}
                    value={capturedSnippets["participantLevelData"] ?? ""}
                    onChange={(e) => setCapturedSnippets((prev) => ({ ...prev, participantLevelData: e.target.value }))}
                    placeholder="Paste the sentence(s) from the paper that support your answer…"
                  />
                  <button type="button"
                    onClick={() => setActiveSnippetField(activeSnippetField === "participantLevelData" ? null : "participantLevelData")}
                    className={`mt-1 text-sm ${activeSnippetField === "participantLevelData" ? "text-primary font-medium" : "text-base-content/40 hover:text-base-content"}`}>
                    {activeSnippetField === "participantLevelData" ? "→ Select text in the paper panel to the right" : "Select from paper text →"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reliabilities — no per-field evidence */}
        <div className="rounded-lg border border-base-200 overflow-hidden">
          <div className="px-4 py-2 bg-base-200/50 border-b border-base-200">
            <span className="text-base font-semibold">Reliabilities</span>
          </div>
          <div className="px-4 py-3 border-b border-base-200/60 bg-base-200/20 text-base">
            <div className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5">
              <span className="text-base-content/40 font-medium">Model answer</span>
              <span className="text-base-content/70 italic">
                {Array.isArray(ext.reliabilities) && ext.reliabilities.length > 0
                  ? (ext.reliabilities as { norm: string; value: number | null; metric: string }[])
                      .map((r) => `${r.norm} ${r.value ?? "?"} (${r.metric})`).join("; ")
                  : "—"}
              </span>
              <span className="text-base-content/40 font-medium">Model evidence</span>
              <span className="text-base-content/50 italic">{snippetStr(snippets.reliabilities) || "—"}</span>
            </div>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2">
            <label className="text-base font-medium text-base-content/50">Your answer</label>
            {reliabilities.length > 0 && (
              <div className="flex flex-col gap-1.5">
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
            <button type="button" className="btn btn-xs btn-primary self-start"
              onClick={() => setReliabilities((prev) => [...prev, { norm: "", value: "", metric: "" }])}>
              + Add reliability
            </button>
            <div className="mt-2 pt-2 border-t border-base-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-base font-medium text-base-content/50">Your evidence</label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-xs"
                    checked={noEvidenceFields.has("reliabilities")}
                    onChange={() => setNoEvidenceFields((prev) => { const n = new Set(prev); n.has("reliabilities") ? n.delete("reliabilities") : n.add("reliabilities"); return n })} />
                  <span className="text-sm text-base-content/40">No evidence</span>
                </label>
              </div>
              {noEvidenceFields.has("reliabilities") ? (
                <div className="rounded border border-dashed border-base-300 px-3 py-2 text-base text-base-content/30 italic">
                  Marked as not in paper — answer based on supplement or prior knowledge
                </div>
              ) : (
                <>
                  <textarea
                    className="textarea textarea-bordered w-full text-base leading-relaxed"
                    rows={2}
                    value={capturedSnippets["reliabilities"] ?? ""}
                    onChange={(e) => setCapturedSnippets((prev) => ({ ...prev, reliabilities: e.target.value }))}
                    placeholder="Paste the sentence(s) from the paper that report reliability statistics…"
                  />
                  <button type="button"
                    onClick={() => setActiveSnippetField(activeSnippetField === "reliabilities" ? null : "reliabilities")}
                    className={`mt-1 text-sm ${activeSnippetField === "reliabilities" ? "text-primary font-medium" : "text-base-content/40 hover:text-base-content"}`}>
                    {activeSnippetField === "reliabilities" ? "→ Select text in the paper panel to the right" : "Select from paper text →"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* URL + Note */}
        <div className="rounded-lg border border-base-200 p-4 flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium text-base-content/50 mb-1.5 block">Website URL <span className="font-normal">(optional)</span></label>
            <input type="url" className="input input-bordered input-sm w-full" value={url}
              onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="text-sm font-medium text-base-content/50 mb-1.5 block">License URL <span className="font-normal">(optional — link to data license or terms of use)</span></label>
            <input type="url" className="input input-bordered input-sm w-full" value={licenseUrl}
              onChange={(e) => setLicenseUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="text-sm font-medium text-base-content/50 mb-1.5 block">Data source URL <span className="font-normal">(optional — link to where the data can be downloaded)</span></label>
            <input type="url" className="input input-bordered input-sm w-full" value={dataSource}
              onChange={(e) => setDataSource(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="text-sm font-medium text-base-content/50 mb-1.5 block">Note <span className="font-normal">(optional — explain your changes)</span></label>
            <textarea className="textarea textarea-bordered w-full text-base" rows={2} value={note}
              onChange={(e) => setNote(e.target.value)} maxLength={1000}
              placeholder="Any context that would help the reviewer…" />
          </div>
        </div>

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
            <p className="text-sm font-semibold uppercase tracking-wider text-base-content/50">Paper text</p>
            {activeSnippetField ? (
              <p className="text-sm text-primary mt-0.5">
                Capturing evidence for: <strong>{activeSnippetField}</strong> — highlight text below, then release
              </p>
            ) : (
              <p className="text-sm text-base-content/40 mt-0.5">Click &ldquo;Select from paper text&rdquo; on a field, then highlight a sentence here</p>
            )}
          </div>
          {ext.paperText ? (
            <div
              className="p-4 text-xs text-base-content/70 leading-relaxed whitespace-pre-wrap select-text cursor-text max-h-[75vh] overflow-y-auto font-mono"
              onMouseUp={handleTextSelect}
            >
              {ext.paperText}
            </div>
          ) : (
            <div className="p-4 text-sm text-base-content/40 italic">
              No paper text available — re-run extraction with <code>--redo</code> to populate it.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

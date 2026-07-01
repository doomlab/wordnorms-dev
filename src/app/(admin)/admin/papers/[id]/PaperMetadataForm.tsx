"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import updatePaperMetadata from "../../../mutations/updatePaperMetadata"
import lookupCrossref from "../../../mutations/lookupCrossref"

type Paper = {
  id: number
  title: string
  authors: string[]
  year: number | null
  doi: string | null
  journal: string | null
  abstract: string | null
  pdfUrl: string | null
  openAlexId: string | null
}

export function PaperMetadataForm({ paper, backHref }: { paper: Paper; backHref: string }) {
  const [update] = useMutation(updatePaperMetadata)
  const [lookup] = useMutation(lookupCrossref)
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [crossrefStatus, setCrossrefStatus] = useState<
    "idle" | "loading" | "done" | "not_found" | "error"
  >("idle")

  const [fields, setFields] = useState({
    title: paper.title,
    authors: paper.authors.join(", "),
    year: paper.year?.toString() ?? "",
    doi: paper.doi ?? "",
    journal: paper.journal ?? "",
    abstract: paper.abstract ?? "",
    pdfUrl: paper.pdfUrl ?? "",
    openAlexId: paper.openAlexId ?? "",
  })

  const set =
    (key: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value }))

  const handleSave = async () => {
    setStatus("saving")
    setErrorMsg(null)
    try {
      await update({
        paperId: paper.id,
        title: fields.title.trim(),
        authors: fields.authors.split(",").map((s) => s.trim()).filter(Boolean),
        year: fields.year ? parseInt(fields.year) : null,
        doi: fields.doi.trim() || null,
        journal: fields.journal.trim() || null,
        abstract: fields.abstract.trim() || null,
        pdfUrl: fields.pdfUrl.trim() || null,
        openAlexId: fields.openAlexId.trim() || null,
      })
      setStatus("saved")
      router.refresh()
    } catch (e: any) {
      setErrorMsg(e.message ?? "Save failed")
      setStatus("error")
    }
  }

  const handleRefetchFromCrossref = async () => {
    const doi = fields.doi.trim()
    if (!doi) return
    setCrossrefStatus("loading")
    try {
      const result = await lookup({ doi })
      if (!result) {
        setCrossrefStatus("not_found")
        return
      }
      setFields((f) => ({
        ...f,
        title: result.title ?? f.title,
        authors: result.authors.length ? result.authors.join(", ") : f.authors,
        year: result.year?.toString() ?? f.year,
        journal: result.journal ?? f.journal,
        abstract: result.abstract ?? f.abstract,
        pdfUrl: result.pdfUrl ?? f.pdfUrl,
      }))
      setCrossrefStatus("done")
    } catch {
      setCrossrefStatus("error")
    }
  }

  const busy = status === "saving"
  const crossrefBusy = crossrefStatus === "loading"

  return (
    <div className="space-y-5 max-w-2xl">
      <Field label="Title">
        <input
          className="input input-bordered w-full"
          value={fields.title}
          onChange={set("title")}
          disabled={busy}
        />
      </Field>

      <Field label="Authors" hint="comma-separated">
        <input
          className="input input-bordered w-full"
          value={fields.authors}
          onChange={set("authors")}
          disabled={busy}
        />
      </Field>

      <Field label="Year">
        <input
          className="input input-bordered w-48"
          type="number"
          value={fields.year}
          onChange={set("year")}
          disabled={busy}
        />
      </Field>

      <Field label="DOI">
        <div className="flex gap-2">
          <input
            className="input input-bordered w-full font-mono text-sm"
            value={fields.doi}
            onChange={set("doi")}
            placeholder="10.xxxx/xxxxx"
            disabled={busy}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm shrink-0"
            onClick={handleRefetchFromCrossref}
            disabled={!fields.doi.trim() || busy || crossrefBusy}
          >
            {crossrefBusy ? <span className="loading loading-spinner loading-xs" /> : null}
            Re-fetch from CrossRef
          </button>
        </div>
        {crossrefStatus === "done" && (
          <p className="text-xs text-success mt-1">
            Fields updated from CrossRef — review before saving.
          </p>
        )}
        {crossrefStatus === "not_found" && (
          <p className="text-xs text-warning mt-1">No CrossRef record found for this DOI.</p>
        )}
        {crossrefStatus === "error" && (
          <p className="text-xs text-error mt-1">CrossRef lookup failed. Try again.</p>
        )}
      </Field>

      <Field label="Journal">
        <input
          className="input input-bordered w-full"
          value={fields.journal}
          onChange={set("journal")}
          disabled={busy}
        />
      </Field>

      <Field label="PDF URL">
        <input
          className="input input-bordered w-full font-mono text-sm"
          value={fields.pdfUrl}
          onChange={set("pdfUrl")}
          placeholder="https://…"
          disabled={busy}
        />
      </Field>

      <Field label="Abstract">
        <textarea
          className="textarea textarea-bordered w-full text-sm leading-relaxed"
          rows={6}
          value={fields.abstract}
          onChange={set("abstract")}
          disabled={busy}
        />
      </Field>

      <Field label="OpenAlex ID" hint="optional">
        <input
          className="input input-bordered w-full font-mono text-sm"
          value={fields.openAlexId}
          onChange={set("openAlexId")}
          placeholder="W…"
          disabled={busy}
        />
      </Field>

      {status === "error" && (
        <p className="text-error text-sm">{errorMsg}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-xs" /> : status === "saved" ? "Saved ✓" : "Save changes"}
        </button>
        <a href={backHref} className="btn btn-ghost">
          Cancel
        </a>
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
    <div className="flex gap-4 items-start">
      <div className="w-32 shrink-0 pt-3">
        <span className="text-sm font-medium text-base-content/70">{label}</span>
        {hint && <p className="text-xs text-base-content/40">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

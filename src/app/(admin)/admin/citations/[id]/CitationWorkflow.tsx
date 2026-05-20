"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import pullCitedPaper from "../../../mutations/pullCitedPaper"
import reviewCitation from "../../../mutations/reviewCitation"

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Props = {
  citedOpenAlexId: string
  title: string | null
  authors: string[]
  year: number | null
  journal: string | null
  reviewed: boolean
  citedBy: { id: number; title: string; year: number | null }[]
  existingPaper: { id: number; title: string } | null
  nextHref: string
}

export function CitationWorkflow({
  citedOpenAlexId,
  title,
  authors,
  year,
  journal,
  reviewed,
  citedBy,
  existingPaper,
  nextHref,
}: Props) {
  const router = useRouter()
  const [pull] = useMutation(pullCitedPaper)
  const [review] = useMutation(reviewCitation)

  const [addStatus, setAddStatus] = useState<
    "idle" | "adding" | "done" | "duplicate" | "error"
  >(existingPaper ? "duplicate" : "idle")
  const [dismissStatus, setDismissStatus] = useState<"idle" | "loading" | "done">("idle")
  const [resultPaper, setResultPaper] = useState(existingPaper)

  const handleAdd = async () => {
    setAddStatus("adding")
    try {
      const result = await pull({
        citedOpenAlexId,
        title: title ?? "Untitled",
        authors,
        year,
        journal,
      })
      setResultPaper(result.paper)
      setAddStatus(result.type === "duplicate" ? "duplicate" : "done")
    } catch {
      setAddStatus("error")
    }
  }

  const handleDismiss = async () => {
    setDismissStatus("loading")
    try {
      await review({ citedOpenAlexId, reviewed: true })
      setDismissStatus("done")
      router.push(nextHref as any)
    } catch {
      setDismissStatus("idle")
    }
  }

  if (addStatus === "done") {
    return (
      <div className="text-center py-16">
        <p className="text-success font-medium text-lg mb-2">Paper added to pipeline</p>
        <p className="text-sm text-base-content/60 mb-6">
          &ldquo;{cap(resultPaper!.title)}&rdquo; is now accepted and queued for extraction.
        </p>
        <div className="flex gap-3 justify-center">
          <a href="/admin/extract" className="btn btn-primary btn-sm">Go to extraction</a>
          <a href={nextHref} className="btn btn-ghost btn-sm">
            {nextHref === "/admin/citations" ? "Back to citations" : "Next →"}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Metadata */}
      <div className="divide-y divide-base-200 text-sm">
        <Row label="Authors" value={authors.length ? authors.join(", ") : undefined} />
        <Row label="Year" value={year?.toString()} />
        <Row label="Journal" value={journal ?? undefined} italic />
        <Row label="OpenAlex ID" value={citedOpenAlexId} mono />
      </div>

      {/* Cited by */}
      <div>
        <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-3">
          Cited by {citedBy.length} accepted {citedBy.length === 1 ? "paper" : "papers"}
        </h2>
        <div className="space-y-1">
          {citedBy.map((p) => (
            <a
              key={p.id}
              href={`/norms/${p.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-3 text-sm hover:text-primary group"
            >
              <span className="group-hover:underline">{cap(p.title)}</span>
              {p.year && <span className="text-base-content/40 shrink-0">{p.year}</span>}
            </a>
          ))}
        </div>
      </div>

      {/* Status / actions */}
      {addStatus === "duplicate" && (
        <div className="alert alert-warning text-sm">
          <div>
            <p className="font-medium">Already in the database.</p>
            {resultPaper && (
              <p className="text-xs mt-1">
                &ldquo;{cap(resultPaper.title)}&rdquo; —{" "}
                <a href={`/admin/papers/${resultPaper.id}`} className="link">view paper</a>
              </p>
            )}
          </div>
        </div>
      )}

      {reviewed && addStatus === "idle" && (
        <div className="alert text-sm">
          <span>This citation has been dismissed.</span>
        </div>
      )}

      <div className="flex gap-3 border-t border-base-200 pt-6">
        <button
          onClick={handleAdd}
          disabled={addStatus === "adding" || addStatus === "duplicate"}
          className="btn btn-success"
        >
          {addStatus === "adding" ? (
            <><span className="loading loading-spinner loading-xs" /> Adding…</>
          ) : "Add to pipeline"}
        </button>
        <button
          onClick={handleDismiss}
          disabled={dismissStatus === "loading" || dismissStatus === "done"}
          className="btn btn-secondary"
        >
          {dismissStatus === "loading" ? "Dismissing…" : "Dismiss"}
        </button>
        <a href={nextHref} className="btn btn-ghost btn-outline">
          Skip →
        </a>
        {addStatus === "error" && (
          <span className="text-error text-sm self-center">Something went wrong.</span>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  italic,
  mono,
}: {
  label: string
  value: string | undefined
  italic?: boolean
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-2">
      <span className="w-28 shrink-0 font-medium text-base-content/60">{label}</span>
      <span className={`${italic ? "italic" : ""} ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import lookupOpenAlex from "../../../mutations/lookupOpenAlex"
import addPaperFromSuggestion from "../../../mutations/addPaperFromSuggestion"
import resolveArticleSuggestion from "../../../mutations/resolveArticleSuggestion"

type Suggestion = {
  id: number
  title: string | null
  authors: string | null
  year: number | null
  doi: string | null
  url: string | null
  note: string | null
}

type ExistingPaper = { id: number; title: string } | null

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function SuggestionWorkflow({
  suggestion,
  existingPaper,
  nextHref,
}: {
  suggestion: Suggestion
  existingPaper: ExistingPaper
  nextHref: string
}) {
  const router = useRouter()

  // Paper form state — pre-filled from suggestion
  const [title, setTitle] = useState(suggestion.title ?? "")
  const [authorsStr, setAuthorsStr] = useState(suggestion.authors ?? "")
  const [year, setYear] = useState(suggestion.year?.toString() ?? "")
  const [doi, setDoi] = useState(suggestion.doi ?? "")
  const [journal, setJournal] = useState("")
  const [abstract, setAbstract] = useState("")
  const [openAlexId, setOpenAlexId] = useState("")
  const [pdfUrl, setPdfUrl] = useState(suggestion.url ?? "")

  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "found" | "not_found" | "error"
  >("idle")
  const [addStatus, setAddStatus] = useState<
    "idle" | "adding" | "done" | "duplicate" | "resolving" | "resolved" | "error"
  >(existingPaper ? "duplicate" : "idle")
  const [resultPaper, setResultPaper] = useState<{ id: number; title: string } | null>(
    existingPaper
  )

  const [lookup] = useMutation(lookupOpenAlex)
  const [addPaper] = useMutation(addPaperFromSuggestion)
  const [resolve] = useMutation(resolveArticleSuggestion)

  const handleLookup = async () => {
    setLookupStatus("loading")
    try {
      const result = await lookup({ doi: doi || undefined, title: title || undefined })
      if (result) {
        setTitle(result.title ?? title)
        setAuthorsStr(result.authors.join(", "))
        setYear(result.year?.toString() ?? year)
        setDoi(result.doi ?? doi)
        setJournal(result.journal ?? "")
        setAbstract(result.abstract ?? "")
        setOpenAlexId(result.openAlexId ?? "")
        setPdfUrl(result.pdfUrl ?? pdfUrl)
        setLookupStatus("found")
      } else {
        setLookupStatus("not_found")
      }
    } catch {
      setLookupStatus("error")
    }
  }

  const handleAdd = async () => {
    setAddStatus("adding")
    try {
      const authors = authorsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const result = await addPaper({
        suggestionId: suggestion.id,
        title,
        authors,
        year: year ? parseInt(year) : null,
        doi: doi || null,
        journal: journal || null,
        abstract: abstract || null,
        openAlexId: openAlexId || null,
        pdfUrl: pdfUrl || null,
      })
      if (result.type === "duplicate") {
        setResultPaper(result.paper)
        setAddStatus("duplicate")
      } else {
        setResultPaper(result.paper)
        setAddStatus("done")
      }
    } catch {
      setAddStatus("error")
    }
  }

  const handleResolve = async () => {
    setAddStatus("resolving")
    try {
      await resolve({ suggestionId: suggestion.id })
      setAddStatus("resolved")
    } catch {
      setAddStatus("error")
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
          <a href={`/admin/extract`} className="btn btn-primary btn-sm">
            Go to extraction
          </a>
          <a href={nextHref} className="btn btn-ghost btn-sm">
            {nextHref === "/admin/suggestions" ? "Back to suggestions" : "Next →"}
          </a>
        </div>
      </div>
    )
  }

  if (addStatus === "resolved") {
    return (
      <div className="text-center py-16">
        <p className="text-base-content/60 mb-4">Suggestion resolved without adding.</p>
        <a href={nextHref} className="btn btn-ghost btn-sm">
          {nextHref === "/admin/suggestions" ? "Back to suggestions" : "Next →"}
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Paper form */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Paper details</h2>
          <button
            onClick={handleLookup}
            disabled={lookupStatus === "loading" || (!doi && !title)}
            className="btn btn-outline btn-sm"
          >
            {lookupStatus === "loading" ? (
              <>
                <span className="loading loading-spinner loading-xs" /> Looking up…
              </>
            ) : (
              "Look up on OpenAlex"
            )}
          </button>
        </div>

        {lookupStatus === "found" && (
          <div className="alert alert-success text-sm mb-4 py-2">
            OpenAlex match found — fields updated. Review and edit before adding.
          </div>
        )}
        {lookupStatus === "not_found" && (
          <div className="alert alert-warning text-sm mb-4 py-2">
            No match found on OpenAlex. Fill in the fields manually.
          </div>
        )}
        {lookupStatus === "error" && (
          <div className="alert alert-error text-sm mb-4 py-2">
            OpenAlex lookup failed. Check your connection and try again.
          </div>
        )}

        {addStatus === "duplicate" && (
          <div className="alert alert-warning text-sm mb-4">
            <div>
              <p className="font-medium">This DOI is already in the database.</p>
              {resultPaper && (
                <p className="text-xs mt-1">
                  &ldquo;{cap(resultPaper.title)}&rdquo; —{" "}
                  <a href={`/admin/papers/${resultPaper.id}`} className="link">
                    view paper
                  </a>
                </p>
              )}
              <p className="text-xs mt-2">The suggestion has been marked as resolved.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label className="label py-1">
              <span className="label-text font-medium">Title *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="label py-1">
              <span className="label-text font-medium">
                Authors <span className="font-normal text-base-content/50">(comma-separated)</span>
              </span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={authorsStr}
              onChange={(e) => setAuthorsStr(e.target.value)}
              placeholder="Author One, Author Two"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label py-1">
                <span className="label-text font-medium">DOI</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.xxxx/xxxxx"
              />
            </div>
            <div className="w-28">
              <label className="label py-1">
                <span className="label-text font-medium">Year</span>
              </label>
              <input
                type="number"
                className="input input-bordered w-full"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min={1900}
                max={2100}
              />
            </div>
          </div>

          <div>
            <label className="label py-1">
              <span className="label-text font-medium">Journal</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
            />
          </div>

          <div>
            <label className="label py-1">
              <span className="label-text font-medium">Abstract</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={4}
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label py-1">
                <span className="label-text font-medium">PDF URL</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
              />
            </div>
            {openAlexId && (
              <div className="flex-1">
                <label className="label py-1">
                  <span className="label-text font-medium">OpenAlex ID</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full bg-base-200"
                  value={openAlexId}
                  readOnly
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 border-t border-base-200 pt-6">
        <button
          onClick={handleAdd}
          disabled={!title.trim() || addStatus === "adding" || addStatus === "duplicate"}
          className="btn btn-success"
        >
          {addStatus === "adding" ? (
            <>
              <span className="loading loading-spinner loading-xs" /> Adding…
            </>
          ) : (
            "Add to accepted papers"
          )}
        </button>
        <button
          onClick={handleResolve}
          disabled={addStatus === "resolving" || addStatus === "duplicate"}
          className="btn btn-secondary"
        >
          {addStatus === "resolving" ? "Resolving…" : "Resolve without adding"}
        </button>
        {addStatus === "error" && (
          <span className="text-error text-sm self-center">Something went wrong.</span>
        )}
      </div>
    </div>
  )
}

"use client"

import { useRef, useState } from "react"
import { useMutation } from "@blitzjs/rpc"
import submitArticleSuggestion from "../(dashboard)/mutations/submitArticleSuggestion"

export function SuggestArticleButton({ isLoggedIn = true }: { isLoggedIn?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [year, setYear] = useState("")
  const [doi, setDoi] = useState("")
  const [url, setUrl] = useState("")
  const [note, setNote] = useState("")
  const [submit] = useMutation(submitArticleSuggestion)

  const handleOpen = () => {
    setSubmitted(false)
    setError("")
    dialogRef.current?.showModal()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() && !doi.trim() && !url.trim()) {
      setError("Please provide at least a title, DOI, or URL.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await submit({
        title: title.trim() || undefined,
        authors: authors.trim() || undefined,
        year: year ? parseInt(year) : undefined,
        doi: doi.trim() || undefined,
        url: url.trim() || undefined,
        note: note.trim() || undefined,
      })
      setSubmitted(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    dialogRef.current?.close()
    setTitle("")
    setAuthors("")
    setYear("")
    setDoi("")
    setUrl("")
    setNote("")
    setSubmitted(false)
    setError("")
  }

  if (!isLoggedIn) {
    return (
      <div className="tooltip tooltip-left" data-tip="Log in to suggest a missing article">
        <button disabled className="btn btn-outline btn-sm opacity-50 cursor-not-allowed">
          Suggest an article
        </button>
      </div>
    )
  }

  return (
    <>
      <button onClick={handleOpen} className="btn btn-outline btn-sm">
        Suggest an article
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-lg mb-1">Suggest a missing article</h3>
          <p className="text-sm text-base-content/60 mb-4">
            Know of a word norms paper that isn&apos;t in our database? Share what you know and
            we&apos;ll look into adding it.
          </p>

          {submitted ? (
            <div className="py-6 text-center">
              <p className="text-success font-medium mb-1">Thanks for your suggestion!</p>
              <p className="text-sm text-base-content/60 mb-6">
                We&apos;ll review it and add the article if it qualifies.
              </p>
              <button className="btn btn-primary btn-sm" onClick={handleClose}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="label py-1">
                  <span className="label-text font-medium">
                    Title <span className="font-normal text-base-content/50">(or DOI / URL below)</span>
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. Affective norms for English words (ANEW)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div>
                <label className="label py-1">
                  <span className="label-text font-medium">
                    Author(s) <span className="font-normal text-base-content/50">(optional)</span>
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. Bradley & Lang, 1999"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label py-1">
                    <span className="label-text font-medium">
                      DOI <span className="font-normal text-base-content/50">(optional)</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="10.xxxx/xxxxx"
                    value={doi}
                    onChange={(e) => setDoi(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="w-24">
                  <label className="label py-1">
                    <span className="label-text font-medium">
                      Year <span className="font-normal text-base-content/50">(opt.)</span>
                    </span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="2024"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    min={1900}
                    max={2100}
                  />
                </div>
              </div>
              <div>
                <label className="label py-1">
                  <span className="label-text font-medium">
                    URL <span className="font-normal text-base-content/50">(optional)</span>
                  </span>
                </label>
                <input
                  type="url"
                  className="input input-bordered w-full"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div>
                <label className="label py-1">
                  <span className="label-text font-medium">
                    Note <span className="font-normal text-base-content/50">(optional)</span>
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  placeholder="Any additional context…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                />
              </div>

              {error && <p className="text-error text-sm">{error}</p>}

              <div className="modal-action mt-0">
                <button
                  type="button"
                  className="btn btn-ghost btn-outline"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit suggestion"}
                </button>
              </div>
            </form>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={handleClose}>close</button>
        </form>
      </dialog>
    </>
  )
}

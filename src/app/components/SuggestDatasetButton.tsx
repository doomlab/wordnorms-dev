"use client"

import { useRef, useState } from "react"
import { useMutation } from "@blitzjs/rpc"
import submitDatasetSuggestion from "../(dashboard)/mutations/submitDatasetSuggestion"

export function SuggestDatasetButton() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [datasetUrl, setDatasetUrl] = useState("")
  const [doi, setDoi] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [note, setNote] = useState("")
  const [submit] = useMutation(submitDatasetSuggestion)

  const handleOpen = () => {
    setSubmitted(false)
    setError("")
    dialogRef.current?.showModal()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!datasetUrl.trim()) {
      setError("Please provide a link to the dataset.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await submit({
        datasetUrl: datasetUrl.trim(),
        doi: doi.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
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
    setDatasetUrl("")
    setDoi("")
    setContactEmail("")
    setNote("")
    setSubmitted(false)
    setError("")
  }

  return (
    <>
      <button onClick={handleOpen} className="btn btn-outline btn-sm">
        Submit a dataset
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-lg mb-1">Submit a dataset</h3>
          <p className="text-sm text-base-content/60 mb-4">
            Know of a word norms dataset that isn&apos;t listed here? Share a link and we&apos;ll
            look into adding it.
          </p>

          {submitted ? (
            <div className="py-6 text-center">
              <p className="text-success font-medium mb-1">Thanks for your suggestion!</p>
              <p className="text-sm text-base-content/60 mb-6">
                We&apos;ll review it and reach out if we have questions.
              </p>
              <button className="btn btn-primary btn-sm" onClick={handleClose}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="label py-1">
                  <span className="label-text font-medium">Dataset link *</span>
                </label>
                <input
                  type="url"
                  className="input input-bordered w-full"
                  placeholder="https://…"
                  value={datasetUrl}
                  onChange={(e) => setDatasetUrl(e.target.value)}
                  maxLength={1000}
                  required
                />
              </div>

              <div>
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

              <div>
                <label className="label py-1">
                  <span className="label-text font-medium">
                    Contact email <span className="font-normal text-base-content/50">(optional)</span>
                  </span>
                </label>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  placeholder="you@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  maxLength={200}
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
                <button type="button" className="btn btn-ghost" onClick={handleClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit"}
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

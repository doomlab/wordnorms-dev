"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import submitReport from "../(dashboard)/mutations/submitReport"

const REASONS = [
  { value: "WRONG_CLASSIFICATION", label: "Incorrectly classified" },
  { value: "DUPLICATE", label: "Duplicate entry" },
  { value: "OTHER", label: "Other" },
]

export function ReportButton({
  paperId,
  initialReported,
  isLoggedIn = true,
}: {
  paperId: number
  initialReported: boolean
  isLoggedIn?: boolean
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reported, setReported] = useState(initialReported)
  const [reason, setReason] = useState("WRONG_CLASSIFICATION")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submit] = useMutation(submitReport)

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dialogRef.current?.showModal()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submit({
        paperId,
        reason: reason as "WRONG_CLASSIFICATION" | "DUPLICATE" | "OTHER",
        note: note.trim() || undefined,
      })
      setReported(true)
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
        <button disabled className="btn btn-primary btn-sm btn-square text-base text-base-content/25 opacity-40 cursor-not-allowed">
          ⚑
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={`btn btn-primary btn-sm btn-square text-base ${
          reported ? "text-warning" : "text-base-content/25 hover:text-base-content/50"
        }`}
        title={
          reported ? "You reported this paper — click to update" : "Report incorrect classification"
        }
      >
        ⚑
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-1">Report paper</h3>
          <p className="text-sm text-base-content/60 mb-4">
            Let us know if you think this paper was incorrectly classified.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="label py-1">
                <span className="label-text font-medium">Reason</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label py-1">
                <span className="label-text font-medium">
                  Note <span className="font-normal text-base-content/50">(optional)</span>
                </span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                placeholder="Any additional context…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
              />
            </div>
            <div className="modal-action mt-0">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit report"}
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

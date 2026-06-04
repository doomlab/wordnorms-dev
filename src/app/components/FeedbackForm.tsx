"use client"

import { useState } from "react"
import { useMutation } from "@blitzjs/rpc"
import submitFeedback from "../(dashboard)/mutations/submitFeedback"

export function FeedbackForm() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [submit] = useMutation(submitFeedback)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) {
      setError("Please enter a message.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await submit({
        message: message.trim(),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      })
      setSubmitted(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    if (submitted) {
      setSubmitted(false)
      setMessage("")
      setName("")
      setEmail("")
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-primary text-primary-content shadow-lg flex items-center justify-center text-lg font-bold hover:brightness-110 transition-all"
        aria-label="Send feedback"
        title="Send feedback"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div className="relative bg-base-100 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <button
              className="absolute right-4 top-4 text-base-content/40 hover:text-base-content text-xl leading-none"
              onClick={handleClose}
              aria-label="Close"
            >
              ✕
            </button>
            <h2 className="font-semibold text-base mb-1">Send feedback</h2>
            <p className="text-sm text-base-content/60 mb-4">
              Questions, corrections, or suggestions? We&apos;d love to hear from you.
            </p>

            {submitted ? (
              <p className="text-sm text-success font-medium">Thanks — your message has been sent!</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={4}
                  placeholder="Your message…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  required
                />
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    placeholder="Name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                  />
                  <input
                    type="email"
                    className="input input-bordered flex-1"
                    placeholder="Email (optional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={200}
                  />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                    {submitting ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

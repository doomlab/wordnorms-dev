"use client"

import { useState } from "react"
import { useMutation } from "@blitzjs/rpc"
import submitFeedback from "../(dashboard)/mutations/submitFeedback"

export function FeedbackForm() {
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

  return (
    <section className="border-t border-base-200 mt-10 pt-10 pb-12">
      <div className="max-w-lg">
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
    </section>
  )
}

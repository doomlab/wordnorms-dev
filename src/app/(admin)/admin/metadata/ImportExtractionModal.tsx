"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import bulkImportExtractions from "../../mutations/bulkImportExtractions"

type ResultRow = {
  index: number
  paperId: number | null
  title: string | null
  status: "created" | "updated" | "skipped" | "error"
  message: string
}

const STATUS_BADGE: Record<ResultRow["status"], string> = {
  created: "badge-success",
  updated: "badge-info",
  skipped: "badge-warning",
  error: "badge-error",
}

export function ImportExtractionModal({ paperId }: { paperId: number }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [run] = useMutation(bulkImportExtractions)
  const [text, setText] = useState("")
  const [markVerified, setMarkVerified] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [results, setResults] = useState<ResultRow[] | null>(null)

  const reset = () => {
    setText("")
    setMarkVerified(false)
    setStatus("idle")
    setErrorMsg(null)
    setResults(null)
  }

  const handleOpen = () => {
    reset()
    dialogRef.current?.showModal()
  }

  const handleClose = () => {
    dialogRef.current?.close()
    if (results?.some((r) => r.status === "created" || r.status === "updated")) {
      router.refresh()
    }
  }

  const handleFile = async (file: File) => {
    setText(await file.text())
  }

  const handleImport = async () => {
    setErrorMsg(null)
    setResults(null)

    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      setErrorMsg(
        "That isn't valid JSON, even after stripping a code fence and normalizing curly quotes. Check for unescaped quotes inside a text field."
      )
      setStatus("error")
      return
    }
    const entries = Array.isArray(parsed) ? parsed : [parsed]
    for (const e of entries) {
      if (!e.paperId && !e.doi) e.paperId = paperId
      if (markVerified) e.markVerified = true
    }

    setStatus("loading")
    try {
      const { results } = await run({ entries })
      setResults(results)
      setStatus("idle")
    } catch (e: any) {
      setErrorMsg(e.message ?? "Import failed")
      setStatus("error")
    }
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className="btn btn-outline btn-sm">
        Import LLM extraction →
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-2xl">
          <h3 className="font-bold text-lg mb-1">Import LLM extraction</h3>
          <p className="text-sm text-base-content/60 mb-4">
            Paste the JSON produced by running this paper&apos;s PDF through an LLM, or upload the
            file. If it omits <code>paperId</code>, this paper (#{paperId}) is filled in
            automatically.
          </p>

          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose JSON file…
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <label className="flex items-center gap-2 cursor-pointer text-sm text-base-content/70">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={markVerified}
                onChange={(e) => setMarkVerified(e.target.checked)}
              />
              Mark as verified (skips the review queue)
            </label>
          </div>

          <textarea
            className="textarea textarea-bordered w-full font-mono text-xs"
            rows={14}
            placeholder='{"language": ["English"], ...}'
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={status === "loading"}
          />

          {errorMsg && <p className="text-error text-sm mt-2">{errorMsg}</p>}

          {results && (
            <div className="overflow-x-auto mt-4">
              <table className="table table-zebra table-sm text-sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Paper</th>
                    <th>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.index}>
                      <td className="font-mono text-xs">{r.index}</td>
                      <td className="max-w-xs">
                        {r.paperId ? `#${r.paperId}${r.title ? ` — ${r.title}` : ""}` : "—"}
                      </td>
                      <td>
                        <span className={`badge badge-sm ${STATUS_BADGE[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="text-base-content/70">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-action">
            <button type="button" className="btn btn-outline" onClick={handleClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImport}
              disabled={status === "loading" || !text.trim()}
            >
              {status === "loading" ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Import"
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={handleClose}>close</button>
        </form>
      </dialog>
    </>
  )
}

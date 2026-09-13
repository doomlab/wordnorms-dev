"use client"

import { useRef, useState } from "react"
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

export function ImportExtractionsForm() {
  const [run] = useMutation(bulkImportExtractions)
  const [text, setText] = useState("")
  const [markVerified, setMarkVerified] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [results, setResults] = useState<ResultRow[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setText(await file.text())
  }

  const handleImport = async () => {
    setErrorMsg(null)
    setResults(null)

    // Tolerate pasting a model's raw response: strip a ```json ... ``` fence if
    // present, and normalize smart/curly quotes to plain ones — both are common
    // artifacts of copying LLM output through a chat UI.
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
    if (markVerified) {
      for (const e of entries) e.markVerified = true
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
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
          Mark all as verified (skips the review queue)
        </label>
      </div>

      <textarea
        className="textarea textarea-bordered w-full font-mono text-xs"
        rows={16}
        placeholder='{"paperId": 1234, "language": ["English"], ...} or a [ ... ] array'
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={status === "loading"}
      />

      {errorMsg && <p className="text-error text-sm">{errorMsg}</p>}

      <button
        className="btn btn-primary"
        onClick={handleImport}
        disabled={status === "loading" || !text.trim()}
      >
        {status === "loading" ? <span className="loading loading-spinner loading-xs" /> : "Import"}
      </button>

      {results && (
        <div className="overflow-x-auto mt-6">
          <table className="table table-zebra text-sm">
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
                    {r.paperId ? (
                      <a href={`/admin/metadata/${r.paperId}`} className="link link-hover">
                        #{r.paperId} {r.title ? `— ${r.title}` : ""}
                      </a>
                    ) : (
                      <span className="text-base-content/40">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-sm ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="text-base-content/70">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import updatePaperUrl from "../../../mutations/updatePaperUrl"

export function UrlEditor({ paperId, initialUrl }: { paperId: number; initialUrl: string | null }) {
  const router = useRouter()
  const [update] = useMutation(updatePaperUrl)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialUrl ?? "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await update({ paperId, url: value || null })
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setValue(initialUrl ?? "")
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        {initialUrl ? (
          <a
            href={initialUrl}
            target="_blank"
            rel="noreferrer"
            className="link link-secondary text-xs truncate max-w-48"
          >
            {initialUrl}
          </a>
        ) : (
          <span className="text-base-content/30 text-xs">—</span>
        )}
        <button
          className="btn btn-ghost btn-xs text-base-content/40"
          onClick={() => setEditing(true)}
        >
          {initialUrl ? "Edit" : "Add"}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="url"
        className="input input-bordered input-xs w-56"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://…"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") save()
          if (e.key === "Escape") cancel()
        }}
      />
      <button className="btn btn-primary btn-xs" onClick={save} disabled={saving}>
        {saving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
      </button>
      <button className="btn btn-ghost btn-xs" onClick={cancel}>
        ✕
      </button>
    </div>
  )
}

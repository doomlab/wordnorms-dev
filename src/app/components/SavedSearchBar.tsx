"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@blitzjs/rpc"
import createSavedSearch from "../(dashboard)/mutations/createSavedSearch"
import deleteSavedSearch from "../(dashboard)/mutations/deleteSavedSearch"

type SavedSearch = { id: number; name: string; query: string }

export function SavedSearchBar({
  path,
  currentQuery,
  savedSearches,
  isLoggedIn,
}: {
  path: string
  currentQuery: string
  savedSearches: SavedSearch[]
  isLoggedIn: boolean
}) {
  const router = useRouter()
  const [create] = useMutation(createSavedSearch)
  const [remove] = useMutation(deleteSavedSearch)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  if (!isLoggedIn) return null

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await create({ name: name.trim(), path, query: currentQuery })
      setNaming(false)
      setName("")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    await remove({ id })
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <div className="dropdown">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setOpen((o) => !o)}
        >
          Saved searches ({savedSearches.length})
        </button>
        {open && (
          <div className="dropdown-content z-10 menu p-2 shadow bg-base-100 border border-base-200 rounded-box w-72 mt-1">
            {savedSearches.length === 0 ? (
              <p className="text-sm text-base-content/50 px-2 py-1">No saved searches yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {savedSearches.map((s) => (
                  <li key={s.id} className="flex items-center gap-1">
                    <a
                      href={s.query ? `${path}?${s.query}` : path}
                      className="flex-1 text-sm link link-hover truncate"
                    >
                      {s.name}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="btn btn-outline btn-xs"
                      title="Delete saved search"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {naming ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") setNaming(false)
            }}
            placeholder="Name this search"
            maxLength={200}
            className="input input-bordered input-sm w-44"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            Save
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setNaming(true)}
          disabled={!currentQuery}
          title={currentQuery ? undefined : "Add a search or filter first"}
        >
          Save this search
        </button>
      )}
    </div>
  )
}

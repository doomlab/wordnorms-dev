"use client"

import { useEffect, useRef, useState } from "react"

export function SearchableFilterField({
  label,
  placeholder,
  options,
  selected,
  onToggle,
}: {
  label: string
  placeholder: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed
    ? options.filter((o) => o.toLowerCase().includes(trimmed) && !selected.includes(o)).slice(0, 20)
    : []

  const select = (value: string) => {
    onToggle(value)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2" ref={containerRef}>
      <span className="text-sm text-base-content/50 w-32 shrink-0">{label}</span>
      {selected.map((v) => (
        <span key={v} className="badge badge-primary gap-1">
          {v}
          <button type="button" onClick={() => onToggle(v)} aria-label={`Remove ${v}`}>
            ✕
          </button>
        </span>
      ))}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="input input-bordered input-sm w-56"
        />
        {open && trimmed && (
          <ul className="absolute z-10 mt-1 w-64 max-h-60 overflow-y-auto bg-base-100 border border-base-300 rounded-lg shadow-md">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-base-content/40">No matches.</li>
            ) : (
              filtered.map((o) => (
                <li key={o}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-base-200 text-sm"
                    onClick={() => select(o)}
                  >
                    {o}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

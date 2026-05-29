"use client"

import { useState } from "react"

type PaperRef = { id: number; title: string; year: number | null }
type ExtRef = { title: string | null; year: number | null; journal: string | null }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function CitationCard({
  title,
  subtitle,
  papers,
  otherRefs,
  emptyMessage,
  defaultOpen = true,
}: {
  title: string
  subtitle?: string
  papers: PaperRef[]
  otherRefs?: ExtRef[]
  emptyMessage?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="py-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between group mb-0"
      >
        <div className="flex items-baseline gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
            {title}
          </h2>
          {subtitle && <span className="text-xs text-base-content/30">{subtitle}</span>}
        </div>
        <svg
          className={`w-3 h-3 text-base-content/30 group-hover:text-base-content/60 transition-all ${open ? "" : "rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-1">
          {papers.length === 0 && emptyMessage ? (
            <p className="text-xs text-base-content/40 py-1">{emptyMessage}</p>
          ) : (
            papers.map((p) => (
              <a
                key={p.id}
                href={`/norms/${p.id}`}
                className="flex gap-3 py-1.5 hover:text-primary group/item"
              >
                <span className="flex-1 text-sm group-hover/item:underline">{cap(p.title)}</span>
                {p.year && (
                  <span className="text-sm text-base-content/40 shrink-0">{p.year}</span>
                )}
              </a>
            ))
          )}
          {otherRefs && otherRefs.length > 0 && (
            <>
              {papers.length > 0 && <div className="mt-2 mb-1 border-t border-base-200" />}
              {otherRefs.map((r, i) => (
                <div key={i} className="flex gap-3 py-1">
                  <span className="flex-1 text-sm text-base-content/40">
                    {r.title ? cap(r.title) : "—"}
                    {r.journal && <span className="italic"> · {r.journal}</span>}
                  </span>
                  {r.year && (
                    <span className="text-sm text-base-content/30 shrink-0">{r.year}</span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { DECADE_LABELS } from "../data/datasets"

const QUICK_SEARCHES = [
  "valence",
  "arousal",
  "concreteness",
  "familiarity",
  "imageability",
  "age of acquisition",
]

export function DatasetFilters({
  allLanguages,
  allFlags,
}: {
  allLanguages: string[]
  allFlags: { key: string; label: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get("q") ?? ""
  const selectedLanguages = searchParams.getAll("lang")
  const selectedDecades = searchParams.getAll("decade")
  const selectedFlags = searchParams.getAll("flag")

  const [inputValue, setInputValue] = useState(q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  const update = useCallback(
    (key: string, value: string, checked?: boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      if (key === "q") {
        if (value) params.set("q", value)
        else params.delete("q")
      } else {
        const existing = params.getAll(key)
        params.delete(key)
        const next = checked
          ? [...existing, value]
          : existing.filter((v) => v !== value)
        next.forEach((v) => params.append(key, v))
      }
      router.replace(`${pathname}?${params.toString()}` as never)
    },
    [router, pathname, searchParams]
  )

  const handleSearchChange = (value: string) => {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => update("q", value), 400)
  }

  const hasFilters =
    q || selectedLanguages.length || selectedDecades.length || selectedFlags.length

  return (
    <aside className="w-56 shrink-0">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-sm">Filters</span>
        {hasFilters && (
          <a href={pathname} className="btn btn-primary btn-xs">
            Reset
          </a>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <label className="label py-1">
          <span className="label-text text-xs font-medium uppercase tracking-wide text-base-content/50">
            Search
          </span>
        </label>
        <input
          type="search"
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="e.g. concreteness"
          className="input input-bordered input-sm w-full"
        />
        <div className="flex flex-wrap gap-1 mt-2">
          {QUICK_SEARCHES.map((kw) => (
            <button
              key={kw}
              onClick={() => handleSearchChange(kw)}
              className={`badge badge-sm cursor-pointer transition-colors ${
                q === kw ? "badge-primary" : "badge-ghost hover:badge-primary"
              }`}
            >
              {kw}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      {allLanguages.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-base-content/50 mb-2">
            Language
          </p>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {allLanguages.map((lang) => (
              <label key={lang} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={selectedLanguages.includes(lang)}
                  onChange={(e) => update("lang", lang, e.target.checked)}
                />
                <span className="text-sm">{lang}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Publication Year */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-base-content/50 mb-2">
          Publication Year
        </p>
        <div className="flex flex-col gap-1.5">
          {Object.keys(DECADE_LABELS).map((decade) => (
            <label key={decade} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={selectedDecades.includes(decade)}
                onChange={(e) => update("decade", decade, e.target.checked)}
              />
              <span className="text-sm">{decade}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Norms */}
      {allFlags.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-base-content/50 mb-2">
            Norms
          </p>
          <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
            {allFlags.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={selectedFlags.includes(key)}
                  onChange={(e) => update("flag", key, e.target.checked)}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

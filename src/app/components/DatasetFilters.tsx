"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { DECADE_LABELS } from "../data/datasets"
import { SearchableFilterField } from "./SearchableFilterField"

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

  const activeCount = selectedLanguages.length + selectedDecades.length + selectedFlags.length
  const hasActiveFilters = activeCount > 0
  const hasFilters = !!q || hasActiveFilters

  return (
    <div className="mb-6">
      {/* Search */}
      <input
        type="search"
        value={inputValue}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Search title, author, or language…"
        className="input input-bordered w-full"
      />

      {/* Advanced filters */}
      <details className="mt-3 group" open={hasActiveFilters}>
        <summary className="cursor-pointer select-none text-sm font-medium text-base-content/60 hover:text-base-content flex items-center gap-2 w-fit">
          <span className="transition-transform group-open:rotate-90">▸</span>
          Filters
          {hasActiveFilters && <span className="badge badge-primary badge-sm">{activeCount}</span>}
        </summary>

        <div className="mt-3 p-4 bg-base-200/50 rounded-lg flex flex-col gap-4">
          {allLanguages.length > 0 && (
            <SearchableFilterField
              label="Language"
              placeholder="Search languages…"
              options={allLanguages}
              selected={selectedLanguages}
              onToggle={(v) => update("lang", v, !selectedLanguages.includes(v))}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-base-content/50 w-32 shrink-0">Publication year</span>
            {Object.keys(DECADE_LABELS).map((decade) => (
              <button
                key={decade}
                onClick={() => update("decade", decade, !selectedDecades.includes(decade))}
                className={`badge cursor-pointer transition-colors ${
                  selectedDecades.includes(decade) ? "badge-primary" : "badge-outline hover:badge-primary"
                }`}
              >
                {decade}
              </button>
            ))}
          </div>

          {allFlags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-base-content/50 w-32 shrink-0">Norms</span>
              {allFlags.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => update("flag", key, !selectedFlags.includes(key))}
                  className={`badge cursor-pointer transition-colors ${
                    selectedFlags.includes(key) ? "badge-primary" : "badge-outline hover:badge-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </details>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {selectedLanguages.map((l) => (
            <span key={l} className="badge badge-lg gap-1">
              {l}
              <button onClick={() => update("lang", l, false)} aria-label={`Remove ${l} filter`}>
                ✕
              </button>
            </span>
          ))}
          {selectedDecades.map((d) => (
            <span key={d} className="badge badge-lg gap-1">
              {d}
              <button onClick={() => update("decade", d, false)} aria-label={`Remove ${d} filter`}>
                ✕
              </button>
            </span>
          ))}
          {selectedFlags.map((f) => (
            <span key={f} className="badge badge-lg gap-1">
              {allFlags.find((o) => o.key === f)?.label ?? f}
              <button onClick={() => update("flag", f, false)} aria-label={`Remove ${f} filter`}>
                ✕
              </button>
            </span>
          ))}
          {hasActiveFilters && (
            <a
              href={q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname}
              className="link link-primary text-sm ml-1"
            >
              Clear all
            </a>
          )}
        </div>
      )}
    </div>
  )
}

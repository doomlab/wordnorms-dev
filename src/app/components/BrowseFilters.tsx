"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { DECADE_LABELS } from "../data/datasets"
import { SearchableFilterField } from "./SearchableFilterField"

const STATUS_OPTIONS: { value: string; label: string; activeClass: string }[] = [
  { value: "dataset", label: "dataset", activeClass: "badge-primary" },
  { value: "peer-reviewed", label: "peer reviewed", activeClass: "badge-info" },
  { value: "verified", label: "verified", activeClass: "badge-success" },
  { value: "awaiting", label: "awaiting extraction", activeClass: "badge-neutral" },
]

const QUICK_KEYWORDS = [
  "age of acquisition",
  "familiarity",
  "concreteness",
  "imageability",
  "valence",
  "arousal",
  "dominance",
]

export function BrowseFilters({
  allLanguages,
  allStimuliTypes = [],
}: {
  allLanguages: string[]
  allStimuliTypes?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get("q") ?? ""
  const selectedLanguages = searchParams.getAll("lang")
  const selectedDecades = searchParams.getAll("decade")
  const selectedStimuliTypes = searchParams.getAll("stimuli")
  const selectedStatuses = searchParams.getAll("status")
  const year = searchParams.get("year") ?? ""

  const [inputValue, setInputValue] = useState(q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [yearInput, setYearInput] = useState(year)
  const yearDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync input when URL param changes externally (e.g. Reset)
  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    setYearInput(year)
  }, [year])

  const update = useCallback(
    (key: string, value: string, checked?: boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      if (key === "q" || key === "year") {
        if (value) params.set(key, value)
        else params.delete(key)
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

  const handleYearChange = (value: string) => {
    setYearInput(value)
    if (yearDebounceRef.current) clearTimeout(yearDebounceRef.current)
    yearDebounceRef.current = setTimeout(() => update("year", value), 400)
  }

  const activeCount =
    selectedLanguages.length +
    selectedDecades.length +
    selectedStimuliTypes.length +
    selectedStatuses.length +
    (year ? 1 : 0)
  const hasActiveFilters = activeCount > 0
  const hasFilters = !!q || hasActiveFilters

  return (
    <div className="mb-6">
      {/* Search */}
      <input
        type="search"
        value={inputValue}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Search title, abstract, author, or DOI…"
        className="input input-bordered w-full"
      />
      <div className="flex flex-wrap gap-1 mt-2">
        {QUICK_KEYWORDS.map((kw) => (
          <button
            key={kw}
            onClick={() => handleSearchChange(kw)}
            className={`badge badge-sm cursor-pointer transition-colors ${
              q === kw ? "badge-primary" : "badge-outline hover:badge-primary"
            }`}
          >
            {kw}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <details className="mt-3 group" open={hasActiveFilters}>
        <summary className="cursor-pointer select-none text-sm font-medium text-base-content/60 hover:text-base-content flex items-center gap-2 w-fit">
          <span className="transition-transform group-open:rotate-90">▸</span>
          Filters
          {hasActiveFilters && <span className="badge badge-primary badge-sm">{activeCount}</span>}
        </summary>

        <div className="mt-3 p-4 bg-base-200/50 rounded-lg flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-base-content/50 w-32 shrink-0">Status</span>
            {STATUS_OPTIONS.map(({ value, label, activeClass }) => (
              <button
                key={value}
                onClick={() => update("status", value, !selectedStatuses.includes(value))}
                className={`badge cursor-pointer transition-colors ${
                  selectedStatuses.includes(value) ? activeClass : "badge-outline hover:badge-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {allStimuliTypes.length > 0 && (
            <SearchableFilterField
              label="Stimuli type"
              placeholder="Search stimuli types…"
              options={allStimuliTypes}
              selected={selectedStimuliTypes}
              onToggle={(v) => update("stimuli", v, !selectedStimuliTypes.includes(v))}
            />
          )}

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
            <input
              type="number"
              inputMode="numeric"
              value={yearInput}
              onChange={(e) => handleYearChange(e.target.value)}
              placeholder="Exact year, e.g. 2019"
              className="input input-bordered input-sm w-40"
            />
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
        </div>
      </details>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {selectedStatuses.map((s) => (
            <span key={s} className="badge badge-lg gap-1">
              {STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s}
              <button onClick={() => update("status", s, false)} aria-label={`Remove ${s} filter`}>
                ✕
              </button>
            </span>
          ))}
          {selectedStimuliTypes.map((s) => (
            <span key={s} className="badge badge-lg gap-1 capitalize">
              {s}
              <button onClick={() => update("stimuli", s, false)} aria-label={`Remove ${s} filter`}>
                ✕
              </button>
            </span>
          ))}
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
          {year && (
            <span className="badge badge-lg gap-1">
              {year}
              <button onClick={() => handleYearChange("")} aria-label="Clear year filter">
                ✕
              </button>
            </span>
          )}
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

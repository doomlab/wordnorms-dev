"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { DECADE_LABELS } from "../data/datasets"

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

  const hasFilters = q || selectedLanguages.length || selectedDecades.length || selectedStimuliTypes.length || selectedStatuses.length || year

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
          {[
            "age of acquisition",
            "familiarity",
            "concreteness",
            "imageability",
            "valence",
            "arousal",
            "dominance",
          ].map((kw) => (
            <button
              key={kw}
              onClick={() => handleSearchChange(kw)}
              className={`badge badge-sm cursor-pointer transition-colors ${
                q === kw
                  ? "badge-primary"
                  : "badge-ghost hover:badge-primary"
              }`}
            >
              {kw}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-base-content/50 mb-2">
          Status
        </p>
        <div className="flex flex-wrap gap-1">
          {[
            { value: "dataset", label: "dataset", activeClass: "badge-primary" },
            { value: "peer-reviewed", label: "peer reviewed", activeClass: "badge-info" },
            { value: "verified", label: "verified", activeClass: "badge-success" },
            { value: "awaiting", label: "awaiting extraction", activeClass: "badge-neutral" },
          ].map(({ value, label, activeClass }) => (
            <button
              key={value}
              onClick={() => update("status", value, !selectedStatuses.includes(value))}
              className={`badge badge-sm cursor-pointer transition-colors ${
                selectedStatuses.includes(value)
                  ? activeClass
                  : "badge-outline hover:badge-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stimuli Type */}
      {allStimuliTypes.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-base-content/50 mb-2">
            Stimuli Type
          </p>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {allStimuliTypes.map((st) => (
              <label key={st} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={selectedStimuliTypes.includes(st)}
                  onChange={(e) => update("stimuli", st, e.target.checked)}
                />
                <span className="text-sm capitalize">{st}</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
        <input
          type="number"
          inputMode="numeric"
          value={yearInput}
          onChange={(e) => handleYearChange(e.target.value)}
          placeholder="Exact year, e.g. 2019"
          className="input input-bordered input-sm w-full mb-2"
        />
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
    </aside>
  )
}

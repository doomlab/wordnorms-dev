"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"
import { ALL_LANGUAGES, DECADE_LABELS } from "../data/datasets"

export function BrowseFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get("q") ?? ""
  const selectedLanguages = searchParams.getAll("lang")
  const selectedDecades = searchParams.getAll("decade")

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

  const hasFilters = q || selectedLanguages.length || selectedDecades.length

  return (
    <aside className="w-56 shrink-0">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-sm">Filters</span>
        {hasFilters && (
          <a href={pathname} className="text-xs text-primary">
            Reset
          </a>
        )}
      </div>

      {/* Keyword */}
      <div className="mb-6">
        <label className="label py-1">
          <span className="label-text text-xs font-medium uppercase tracking-wide text-base-content/50">
            Keyword
          </span>
        </label>
        <input
          type="search"
          value={q}
          onChange={(e) => update("q", e.target.value)}
          placeholder="e.g. concreteness"
          className="input input-bordered input-sm w-full"
        />
      </div>

      {/* Language */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-base-content/50 mb-2">
          Language
        </p>
        <div className="flex flex-col gap-1.5">
          {ALL_LANGUAGES.map((lang) => (
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
    </aside>
  )
}

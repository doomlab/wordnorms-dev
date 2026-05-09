import Link from "next/link"
import { Suspense } from "react"
import { invoke } from "./blitz-server"
import getCurrentUser from "./users/queries/getCurrentUser"
import { LogoutButton } from "./(auth)/components/LogoutButton"
import { BrowseFilters } from "./components/BrowseFilters"
import { ThemeToggle } from "./components/ThemeToggle"
import { DATASETS, filterDatasets } from "./data/datasets"

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lang?: string | string[]; decade?: string | string[] }>
}) {
  const currentUser = await invoke(getCurrentUser, null)
  const params = await searchParams

  const q = params.q
  const languages = params.lang ? (Array.isArray(params.lang) ? params.lang : [params.lang]) : []
  const decades = params.decade
    ? Array.isArray(params.decade)
      ? params.decade
      : [params.decade]
    : []

  const results = filterDatasets(DATASETS, { q, languages, decades })

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      {/* Navbar */}
      <div className="navbar bg-base-200 px-6 shadow-sm shrink-0 sticky top-0 z-50">
        <div className="flex-1">
          <span className="text-xl font-bold">WordNorms.com</span>
        </div>
        <div className="flex-none gap-2">
          <ThemeToggle />
          {currentUser ? (
            <>
              <Link href="/dashboard" className="btn btn-primary btn-sm m-2">
                Dashboard
              </Link>
              {currentUser.role === "ADMIN" && (
                <Link href="/admin" className="btn btn-ghost btn-sm">
                  Admin
                </Link>
              )}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-primary btn-sm m-2">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-secondary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 max-w-6xl w-full mx-auto px-6 py-8 gap-8">
        {/* Filters — Suspense required because BrowseFilters reads useSearchParams */}
        <Suspense fallback={<div className="w-56 shrink-0" />}>
          <BrowseFilters />
        </Suspense>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-base-content/60">
              <span className="font-semibold text-base-content">{results.length}</span> norm{" "}
              {results.length === 1 ? "set" : "sets"}
            </p>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-16 text-base-content/40">
              <p className="text-lg">No results match your filters.</p>
              <a href="/" className="link link-primary text-sm mt-2 inline-block">
                Clear filters
              </a>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-base-200">
              {results.map((dataset) => (
                <li
                  key={dataset.id}
                  className="py-5 hover:bg-base-200/40 px-3 -mx-3 rounded-lg transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-base leading-snug mb-1">{dataset.name}</h2>
                      <p className="text-sm text-base-content/60 mb-3 line-clamp-2">
                        {dataset.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50">
                        <span className="font-medium text-base-content/70">
                          {dataset.languages.join(", ")}
                        </span>
                        <span>·</span>
                        <span>{dataset.year}</span>
                        <span>·</span>
                        <span>{dataset.wordCount.toLocaleString()} words</span>
                        <span>·</span>
                        <span>{dataset.normTypes.join(", ")}</span>
                      </div>
                    </div>
                    <a href={`/datasets/${dataset.id}`} className="btn btn-outline btn-sm shrink-0">
                      View
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

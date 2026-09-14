import { Suspense } from "react"
import { Navbar } from "../components/Navbar"
import { DatasetFilters } from "../components/DatasetFilters"
import { SavedSearchBar } from "../components/SavedSearchBar"
import { DatasetFavoriteButton } from "../components/DatasetFavoriteButton"
import { SuggestDatasetButton } from "../components/SuggestDatasetButton"
import { getBlitzContext } from "../blitz-server"
import {
  loadDatasetData,
  baseCards as baseCardsOf,
  extractBaseLanguages,
  filterDatasetCards,
  parseDatasetFilterParams,
  FLAG_LABELS,
  type DatasetFilterSearchParams,
} from "src/lib/datasetFilters"
import db from "db"

export const dynamic = "force-dynamic"
export const metadata = { title: "Datasets – WordNorms" }

function capFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default async function DatasetsPage({
  searchParams,
}: {
  searchParams: Promise<DatasetFilterSearchParams>
}) {
  const params = await searchParams
  const ctx = await getBlitzContext()
  const userId = ctx.session.userId as number | undefined

  const filters = parseDatasetFilterParams(params)
  const { q, languages: selectedLanguages, decades: selectedDecades, flags: selectedFlags } = filters

  const [data, favoritedBibtexSet, savedSearches] = await Promise.all([
    Promise.resolve(loadDatasetData()),
    userId
      ? db.userDatasetFavorite
          .findMany({ where: { userId }, select: { bibtex: true } })
          .then((rows) => new Set(rows.map((r) => r.bibtex)))
      : Promise.resolve(new Set<string>()),
    userId
      ? db.savedSearch.findMany({
          where: { userId, path: "/datasets" },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, query: true },
        })
      : Promise.resolve([]),
  ])

  if (!data) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col">
        <Navbar />
        <div className="text-center py-16 text-base-content/40">
          <p className="text-lg">No dataset index found.</p>
          <p className="text-sm mt-2">
            Run{" "}
            <code className="font-mono bg-base-200 px-1 rounded">
              node scripts/sync-model-cards.mjs
            </code>{" "}
            to sync.
          </p>
        </div>
      </div>
    )
  }

  const baseCards = baseCardsOf(data)

  // Compute sidebar options from full card list
  const allLanguages = Array.from(
    new Set(baseCards.flatMap((c) => (c.language ? extractBaseLanguages(c.language) : [])))
  ).sort()

  const allFlagKeys = Array.from(new Set(baseCards.flatMap((c) => c.flags))).sort()
  const allFlags = allFlagKeys.map((k) => ({ key: k, label: FLAG_LABELS[k] ?? k }))

  const cards = filterDatasetCards(baseCards, filters)

  const hasFilters = !!(q || selectedLanguages.length || selectedDecades.length || selectedFlags.length)

  const downloadParams = new URLSearchParams()
  if (q) downloadParams.set("q", q)
  selectedLanguages.forEach((l) => downloadParams.append("lang", l))
  selectedDecades.forEach((d) => downloadParams.append("decade", d))
  selectedFlags.forEach((f) => downloadParams.append("flag", f))
  const downloadHref = `/api/download/datasets${downloadParams.size ? `?${downloadParams}` : ""}`

  const syncDate = new Date(data.syncedAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex-1 w-full px-10 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">Datasets</h1>
          <p className="text-base-content/60 text-sm">
            Word norm datasets from the{" "}
            <a
              href="https://github.com/SemanticPriming/semanticprimeR"
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary"
            >
              SemanticPrimeR
            </a>{" "}
            collection, synced {syncDate}.
          </p>
        </div>

        <Suspense fallback={<div className="h-24" />}>
          <DatasetFilters allLanguages={allLanguages} allFlags={allFlags} />
        </Suspense>

        <div className="min-w-0">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-base-content/60">
              <span className="font-semibold text-base-content">{cards.length}</span>{" "}
              {cards.length === 1 ? "dataset" : "datasets"}
              {hasFilters && " match your filters"}
            </p>
            <div className="flex items-center gap-2">
              <SavedSearchBar
                path="/datasets"
                currentQuery={downloadParams.toString()}
                savedSearches={savedSearches}
                isLoggedIn={!!userId}
              />
              <a href={downloadHref} className="btn btn-outline btn-sm">
                Download CSV
              </a>
              <SuggestDatasetButton />
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="text-center py-16 text-base-content/40">
              <p className="text-lg">No results match your filters.</p>
              <a href="/datasets" className="link link-primary text-sm mt-2 inline-block">
                Clear filters
              </a>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-base-200">
              {cards.map((card) => (
                <li
                  key={card.bibtex}
                  className="py-5 hover:bg-base-200/40 px-3 -mx-3 rounded-lg transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-base leading-snug mb-1">
                        {capFirst(card.citation.title)}
                      </h2>
                      {card.citation.author && (
                        <p className="text-sm text-base-content/60 mb-2 line-clamp-1">
                          {card.citation.author}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50 mb-2">
                        {card.citation.year && <span>{card.citation.year}</span>}
                        {card.citation.journal && (
                          <>
                            <span>·</span>
                            <span className="italic">{card.citation.journal}</span>
                          </>
                        )}
                        {card.language && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-base-content/70">
                              {extractBaseLanguages(card.language).join(", ")}
                            </span>
                          </>
                        )}
                        {card.nRows != null && (
                          <>
                            <span>·</span>
                            <span>{card.nRows.toLocaleString()} stimuli</span>
                          </>
                        )}
                      </div>
                      {card.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {card.flags.map((f) => (
                            <span key={f} className="badge badge-sm badge-ghost text-xs">
                              {FLAG_LABELS[f] ?? f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <DatasetFavoriteButton
                        bibtex={card.bibtex}
                        initialFavorited={favoritedBibtexSet.has(card.bibtex)}
                        isLoggedIn={!!userId}
                      />
                      {card.citation.doi && (
                        <a
                          href={`https://doi.org/${card.citation.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline btn-sm"
                        >
                          DOI
                        </a>
                      )}
                      <a
                        href={`https://github.com/SemanticPriming/semanticprimeR/releases/download/v0.0.1/${card.bibtex}.csv`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                      >
                        CSV
                      </a>
                      <a href={`/datasets/${card.bibtex}`} className="btn btn-outline btn-sm">
                        View
                      </a>
                    </div>
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

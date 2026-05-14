import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Navbar } from "../components/Navbar"
import { FavoriteButton } from "../components/FavoriteButton"
import { BrowseFilters } from "../components/BrowseFilters"
import { DECADE_LABELS } from "../data/datasets"
import { getBlitzContext } from "../blitz-server"
import db from "db"

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const metadata = { title: "My Favorites – WordNorms" }

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lang?: string | string[]; decade?: string | string[] }>
}) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")

  const userId = ctx.session.userId as number

  const params = await searchParams
  const q = params.q?.trim() || undefined
  const languages = params.lang ? (Array.isArray(params.lang) ? params.lang : [params.lang]) : []
  const decades = params.decade
    ? Array.isArray(params.decade)
      ? params.decade
      : [params.decade]
    : []

  const authorMatchIds = q
    ? (
        await db.$queryRaw<{ id: number }[]>`
          SELECT id FROM "Paper"
          WHERE EXISTS (SELECT 1 FROM unnest(authors) AS a WHERE a ILIKE ${`%${q}%`})
        `
      ).map((r) => r.id)
    : []

  const andClauses: object[] = []

  if (q) {
    andClauses.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { abstract: { contains: q, mode: "insensitive" } },
        { extraction: { normsCollected: { hasSome: [q] } } },
        ...(authorMatchIds.length ? [{ id: { in: authorMatchIds } }] : []),
      ],
    })
  }

  if (decades.length) {
    andClauses.push({
      OR: decades.flatMap((decade) => {
        const range = DECADE_LABELS[decade]
        return range ? [{ year: { gte: range[0], lte: range[1] } }] : []
      }),
    })
  }

  const allFavorites = await db.userFavorite.findMany({
    where: { userId },
    include: { paper: { select: { extraction: { select: { language: true } } } } },
  })

  const allLanguages = Array.from(
    new Set(allFavorites.flatMap((f) => f.paper.extraction?.language ?? []))
  ).sort()

  const favorites = await db.userFavorite.findMany({
    where: {
      userId,
      paper: {
        ...(languages.length ? { extraction: { language: { hasSome: languages } } } : {}),
        ...(andClauses.length ? { AND: andClauses } : {}),
      },
    },
    include: { paper: { include: { extraction: true } } },
    orderBy: { paper: { year: { sort: "desc", nulls: "last" } } },
  })

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex flex-1 w-full px-10 py-8 gap-8">
        <Suspense fallback={<div className="w-56 shrink-0" />}>
          <BrowseFilters allLanguages={allLanguages} />
        </Suspense>

        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-1">My Favorites</h1>
            <p className="text-base-content/60 text-sm">Papers you&apos;ve saved for quick reference.</p>
          </div>

          <p className="text-sm text-base-content/60 mb-5">
            <span className="font-semibold text-base-content">{favorites.length}</span>{" "}
            {favorites.length === 1 ? "paper" : "papers"}
            {(q || languages.length > 0 || decades.length > 0) && " match your filters"}
          </p>

          {favorites.length === 0 ? (
            <div className="text-center py-16 text-base-content/40">
              {allFavorites.length === 0 ? (
                <>
                  <p className="text-lg">No favorites yet.</p>
                  <a href="/" className="link link-primary text-sm mt-2 inline-block">
                    Browse word norms
                  </a>
                </>
              ) : (
                <>
                  <p className="text-lg">No results match your filters.</p>
                  <a href="/favorites" className="link link-primary text-sm mt-2 inline-block">
                    Clear filters
                  </a>
                </>
              )}
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-base-200">
              {favorites.map(({ paper }) => {
                const ext = paper.extraction
                return (
                  <li
                    key={paper.id}
                    className="py-5 hover:bg-base-200/40 px-3 -mx-3 rounded-lg transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-base leading-snug mb-1">{capFirst(paper.title)}</h2>
                        {paper.abstract && (
                          <p className="text-sm text-base-content/60 mb-3 line-clamp-2">
                            {paper.abstract}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50">
                          {ext?.language && ext.language.length > 0 && (
                            <>
                              <span className="font-medium text-base-content/70">
                                {ext.language.join(", ")}
                              </span>
                              <span>·</span>
                            </>
                          )}
                          {paper.year && <span>{paper.year}</span>}
                          {paper.journal && (
                            <>
                              <span>·</span>
                              <span className="italic">{paper.journal}</span>
                            </>
                          )}
                          {ext?.stimuliCount && (
                            <>
                              <span>·</span>
                              <span>
                            {ext.stimuliCount.toLocaleString()}{" "}
                            {ext.stimuliType.length > 0 ? ext.stimuliType.join(", ") : "stimuli"}
                          </span>
                            </>
                          )}
                          {ext?.normsCollected && ext.normsCollected.length > 0 && (
                            <>
                              <span>·</span>
                              <span>{ext.normsCollected.join(", ")}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <FavoriteButton paperId={paper.id} initialFavorited={true} />
                        {paper.url && (
                          <a
                            href={paper.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm"
                          >
                            Website
                          </a>
                        )}
                        <a href={`/norms/${paper.id}?from=favorites`} className="btn btn-outline btn-sm">
                          View
                        </a>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

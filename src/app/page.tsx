import { Suspense } from "react"
import { Navbar } from "./components/Navbar"
import { BrowseFilters } from "./components/BrowseFilters"
import { FavoriteButton } from "./components/FavoriteButton"
import { ReportButton } from "./components/ReportButton"
import { DECADE_LABELS } from "./data/datasets"
import { getBlitzContext } from "./blitz-server"
import db from "db"

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lang?: string | string[]; decade?: string | string[] }>
}) {
  const params = await searchParams

  const q = params.q?.trim() || undefined
  const languages = params.lang ? (Array.isArray(params.lang) ? params.lang : [params.lang]) : []
  const decades = params.decade
    ? Array.isArray(params.decade)
      ? params.decade
      : [params.decade]
    : []

  const ctx = await getBlitzContext()
  const userId = ctx.session.userId as number | undefined

  // Build AND clauses for search and decade filters
  const andClauses: object[] = []

  if (q) {
    andClauses.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { abstract: { contains: q, mode: "insensitive" } },
        { extraction: { normsCollected: { hasSome: [q] } } },
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

  const [papers, allPapers, favoritedIds, reportedIds] = await Promise.all([
    db.paper.findMany({
      where: {
        status: { in: ["ACCEPTED", "ADDED_TO_TRAINING"] },
        extraction: languages.length
          ? { language: { hasSome: languages } }
          : { isNot: null },
        ...(andClauses.length ? { AND: andClauses } : {}),
      },
      include: { extraction: true },
      orderBy: { year: "desc" },
    }),
    db.paper.findMany({
      where: {
        status: { in: ["ACCEPTED", "ADDED_TO_TRAINING"] },
        extraction: { isNot: null },
      },
      select: { extraction: { select: { language: true } } },
    }),
    userId
      ? db.userFavorite
          .findMany({ where: { userId }, select: { paperId: true } })
          .then((rows) => new Set(rows.map((r) => r.paperId)))
      : Promise.resolve(new Set<number>()),
    userId
      ? db.paperReport
          .findMany({ where: { userId }, select: { paperId: true } })
          .then((rows) => new Set(rows.map((r) => r.paperId)))
      : Promise.resolve(new Set<number>()),
  ])

  const allLanguages = Array.from(
    new Set(allPapers.flatMap((p) => p.extraction?.language ?? []))
  ).sort()

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex flex-1 w-full px-10 py-8 gap-8">
        <Suspense fallback={<div className="w-56 shrink-0" />}>
          <BrowseFilters allLanguages={allLanguages} />
        </Suspense>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-base-content/60">
              <span className="font-semibold text-base-content">{papers.length}</span> norm{" "}
              {papers.length === 1 ? "set" : "sets"}
            </p>
          </div>

          {papers.length === 0 ? (
            <div className="text-center py-16 text-base-content/40">
              <p className="text-lg">No results match your filters.</p>
              <a href="/" className="link link-primary text-sm mt-2 inline-block">
                Clear filters
              </a>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-base-200">
              {papers.map((paper) => {
                const ext = paper.extraction
                return (
                  <li
                    key={paper.id}
                    className="py-5 hover:bg-base-200/40 px-3 -mx-3 rounded-lg transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="font-semibold text-base leading-snug">
                            {paper.title}
                          </h2>
                          {ext?.needsReview && (
                            <span className="badge badge-warning badge-sm shrink-0">
                              unverified
                            </span>
                          )}
                        </div>
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
                      <div className="flex items-center gap-1 shrink-0">
                        <ReportButton
                          paperId={paper.id}
                          initialReported={reportedIds.has(paper.id)}
                        />
                        <FavoriteButton
                          paperId={paper.id}
                          initialFavorited={favoritedIds.has(paper.id)}
                        />
                        <a href={`/norms/${paper.id}`} className="btn btn-outline btn-sm">
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

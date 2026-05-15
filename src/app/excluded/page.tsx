import { Suspense } from "react"
import { Navbar } from "../components/Navbar"

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
import { BrowseFilters } from "../components/BrowseFilters"
import { ReportButton } from "../components/ReportButton"
import { DECADE_LABELS } from "../data/datasets"
import { getBlitzContext } from "../blitz-server"
import db from "db"

export const metadata = { title: "Excluded Papers – WordNorms" }

export default async function ExcludedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; decade?: string | string[] }>
}) {
  const params = await searchParams
  const ctx = await getBlitzContext()
  const userId = ctx.session.userId as number | undefined

  const q = params.q?.trim() || undefined
  const decades = params.decade
    ? Array.isArray(params.decade)
      ? params.decade
      : [params.decade]
    : []

  const andClauses: object[] = []

  if (q) {
    andClauses.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { abstract: { contains: q, mode: "insensitive" } },
        { journal: { contains: q, mode: "insensitive" } },
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

  const [papers, reportedIds] = await Promise.all([
    db.paper.findMany({
      where: {
        status: "EXCLUDED",
        canonicalPaperId: null,
        ...(andClauses.length ? { AND: andClauses } : {}),
      },
      select: {
        id: true,
        title: true,
        abstract: true,
        year: true,
        journal: true,
        reviewNote: true,
      },
      orderBy: { year: "desc" },
    }),
    userId
      ? db.paperReport
          .findMany({ where: { userId }, select: { paperId: true } })
          .then((rows) => new Set(rows.map((r) => r.paperId)))
      : Promise.resolve(new Set<number>()),
  ])

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex flex-1 w-full px-10 py-8 gap-8">
        <Suspense fallback={<div className="w-56 shrink-0" />}>
          <BrowseFilters allLanguages={[]} />
        </Suspense>

        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-1">Excluded papers</h1>
            <p className="text-base-content/60 text-sm">
              Papers reviewed and determined not to be word norm studies. Use the flag icon to
              report errors or suggest re-inclusion.
            </p>
          </div>

          <p className="text-sm text-base-content/60 mb-5">
            <span className="font-semibold text-base-content">{papers.length}</span>{" "}
            {papers.length === 1 ? "paper" : "papers"}
            {(q || decades.length > 0) && " match your filters"}
          </p>

          {papers.length === 0 ? (
            <div className="text-center py-16 text-base-content/40">
              <p className="text-lg">No results match your filters.</p>
              <a href="/excluded" className="link link-primary text-sm mt-2 inline-block">
                Clear filters
              </a>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-base-200">
              {papers.map((paper) => (
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
                        {paper.year && <span>{paper.year}</span>}
                        {paper.journal && (
                          <>
                            <span>·</span>
                            <span className="italic">{paper.journal}</span>
                          </>
                        )}
                        {paper.reviewNote && (
                          <>
                            <span>·</span>
                            <span className="text-base-content/40">{paper.reviewNote}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ReportButton
                        paperId={paper.id}
                        initialReported={reportedIds.has(paper.id)}
                        isLoggedIn={!!userId}
                      />
                      <a
                        href={`/excluded/${paper.id}?from=excluded`}
                        className="btn btn-outline btn-sm"
                      >
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

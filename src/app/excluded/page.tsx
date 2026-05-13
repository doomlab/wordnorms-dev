import { Suspense } from "react"
import { Navbar } from "../components/Navbar"
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
        ...(andClauses.length ? { AND: andClauses } : {}),
      },
      select: {
        id: true,
        title: true,
        authors: true,
        year: true,
        doi: true,
        journal: true,
        abstract: true,
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

      <div className="flex flex-1 max-w-6xl w-full mx-auto px-6 py-8 gap-8">
        <Suspense fallback={<div className="w-56 shrink-0" />}>
          <BrowseFilters allLanguages={[]} />
        </Suspense>

        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-1">Excluded papers</h1>
            <p className="text-base-content/60 text-sm">
              Papers reviewed and determined not to be word norm studies. Click any row to expand.
              Use the flag icon to report errors or suggest re-inclusion.
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
                <li key={paper.id} className="-mx-3">
                  <details className="group">
                    <summary className="flex items-center justify-between gap-4 py-4 px-3 cursor-pointer hover:bg-base-200/40 rounded-lg transition-colors list-none">
                      <div className="min-w-0">
                        <span className="font-medium text-sm leading-snug line-clamp-2">
                          {paper.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {paper.year && (
                          <span className="text-xs text-base-content/50">{paper.year}</span>
                        )}
                        <ReportButton
                          paperId={paper.id}
                          initialReported={reportedIds.has(paper.id)}
                        />
                        <span className="text-base-content/40 group-open:rotate-90 transition-transform text-xs">
                          ▶
                        </span>
                      </div>
                    </summary>

                    <div className="px-3 pb-5 pt-1 space-y-2 text-sm text-base-content/70">
                      {paper.authors.length > 0 && (
                        <p>
                          <span className="font-medium text-base-content">Authors:</span>{" "}
                          {paper.authors.join(", ")}
                        </p>
                      )}
                      {paper.year && (
                        <p>
                          <span className="font-medium text-base-content">Year:</span> {paper.year}
                        </p>
                      )}
                      {paper.journal && (
                        <p>
                          <span className="font-medium text-base-content">Journal:</span>{" "}
                          <span className="italic">{paper.journal}</span>
                        </p>
                      )}
                      {paper.doi && (
                        <p>
                          <span className="font-medium text-base-content">DOI:</span>{" "}
                          <a
                            href={`https://doi.org/${paper.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link link-primary break-all"
                          >
                            {paper.doi}
                          </a>
                        </p>
                      )}
                      {paper.abstract && (
                        <div>
                          <p className="font-medium text-base-content mb-1">Abstract:</p>
                          <p className="leading-relaxed">{paper.abstract}</p>
                        </div>
                      )}
                      {paper.reviewNote && (
                        <p>
                          <span className="font-medium text-base-content">Note:</span>{" "}
                          {paper.reviewNote}
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

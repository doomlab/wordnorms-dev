import db from "db"

export const metadata = { title: "Citation Review – Admin" }

const PER_PAGE = 50

export default async function CitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; show?: string }>
}) {
  const { page: pageParam, show } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10))
  const showAll = show === "all"

  const allCitations = await db.paperCitation.findMany({
    where: showAll ? undefined : { reviewed: false },
    include: { citingPaper: { select: { id: true, title: true } } },
    orderBy: { id: "asc" },
  })

  // Find which citedOpenAlexIds are already in the DB
  const citedIds = [...new Set(allCitations.map((c) => c.citedOpenAlexId))]
  const matched = await db.paper.findMany({
    where: { openAlexId: { in: citedIds } },
    select: { openAlexId: true },
  })
  const matchedIds = new Set(matched.map((p) => p.openAlexId))

  // Group unmatched rows by citedOpenAlexId
  type CitingPaper = { id: number; title: string }
  type Group = {
    citedOpenAlexId: string
    title: string | null
    authors: string[]
    year: number | null
    journal: string | null
    reviewed: boolean
    citedBy: CitingPaper[]
  }

  const groupMap = new Map<string, Group>()
  for (const c of allCitations) {
    if (matchedIds.has(c.citedOpenAlexId)) continue
    if (!groupMap.has(c.citedOpenAlexId)) {
      groupMap.set(c.citedOpenAlexId, {
        citedOpenAlexId: c.citedOpenAlexId,
        title: c.title,
        authors: c.authors,
        year: c.year,
        journal: c.journal,
        reviewed: c.reviewed,
        citedBy: [],
      })
    }
    groupMap.get(c.citedOpenAlexId)!.citedBy.push(c.citingPaper)
  }

  const groups = [...groupMap.values()]
  const total = groups.length
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const paginated = groups.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-3xl font-bold">Citation Review</h1>
        <span className="text-base-content/50 text-sm">{total} unmatched</span>
      </div>
      <p className="text-base-content/60 mb-6 text-sm">
        Papers cited by accepted papers that are not yet in the database. Add any that belong.
      </p>

      <div className="flex gap-2 mb-6">
        <a
          href={`?show=pending&page=1`}
          className={`btn btn-sm ${!showAll ? "btn-neutral" : "btn-ghost"}`}
        >
          Unreviewed
        </a>
        <a
          href={`?show=all&page=1`}
          className={`btn btn-sm ${showAll ? "btn-neutral" : "btn-ghost"}`}
        >
          All
        </a>
      </div>

      {total === 0 ? (
        <p className="text-base-content/40 text-sm">
          {showAll
            ? "All cited papers are already in the database."
            : "No unreviewed citations — switch to All to see dismissed ones."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="text-base-content/50 text-xs uppercase">
                  <th className="w-[38%]">Title</th>
                  <th>Year</th>
                  <th>Journal</th>
                  <th>Cited by</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((g) => (
                  <tr
                    key={g.citedOpenAlexId}
                    className={`hover:bg-base-200 ${g.reviewed ? "opacity-50" : ""}`}
                  >
                    <td className="text-sm align-top py-3">
                      {g.title ?? <span className="text-base-content/30 italic">no title</span>}
                    </td>
                    <td className="text-sm text-base-content/60 align-top py-3">{g.year ?? "—"}</td>
                    <td className="text-sm text-base-content/60 italic align-top py-3">
                      {g.journal ?? "—"}
                    </td>
                    <td className="align-top py-3">
                      <div className="flex flex-col gap-0.5">
                        {g.citedBy.slice(0, 3).map((p) => (
                          <a
                            key={p.id}
                            href={`/norms/${p.id}`}
                            className="text-xs link link-hover text-base-content/50 max-w-[200px] truncate block"
                            title={p.title}
                          >
                            {p.title}
                          </a>
                        ))}
                        {g.citedBy.length > 3 && (
                          <span className="text-xs text-base-content/30">
                            +{g.citedBy.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="align-top py-3">
                      <a
                        href={`/admin/citations/${g.citedOpenAlexId}`}
                        className="btn btn-outline btn-xs"
                      >
                        Review
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {page > 1 && (
                <a
                  href={`?show=${show ?? "pending"}&page=${page - 1}`}
                  className="btn btn-sm btn-ghost"
                >
                  ← Prev
                </a>
              )}
              <span className="btn btn-sm btn-ghost no-animation cursor-default">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <a
                  href={`?show=${show ?? "pending"}&page=${page + 1}`}
                  className="btn btn-sm btn-ghost"
                >
                  Next →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}

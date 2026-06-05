import db from "db"
import { Pagination } from "src/app/components/Pagination"

export const metadata = { title: "Citation Review – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const PER_PAGE = 50

export default async function CitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; show?: string }>
}) {
  const { page: pageParam, show } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10))
  const showAll = show === "all"
  const skip = (page - 1) * PER_PAGE

  // Count and fetch unmatched citations grouped by citedOpenAlexId at DB level
  type GroupRow = {
    citedOpenAlexId: string
    title: string | null
    year: number | null
    journal: string | null
    reviewed: boolean
    citedByCount: bigint
  }

  const reviewedFilter = showAll ? "" : `AND c.reviewed = false`

  const [groups, countResult, totalResult, unreviewedResult] = await Promise.all([
    db.$queryRawUnsafe<GroupRow[]>(`
      SELECT
        c."citedOpenAlexId",
        MIN(c.title) AS title,
        MIN(c.year)  AS year,
        MIN(c.journal) AS journal,
        bool_and(c.reviewed) AS reviewed,
        COUNT(DISTINCT c."citingPaperId") AS "citedByCount"
      FROM "PaperCitation" c
      WHERE NOT EXISTS (
        SELECT 1 FROM "Paper" p WHERE p."openAlexId" = c."citedOpenAlexId"
      )
      ${reviewedFilter}
      GROUP BY c."citedOpenAlexId"
      ORDER BY MIN(c.id)
      LIMIT ${PER_PAGE} OFFSET ${skip}
    `),
    db.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(DISTINCT c."citedOpenAlexId") AS count
      FROM "PaperCitation" c
      WHERE NOT EXISTS (
        SELECT 1 FROM "Paper" p WHERE p."openAlexId" = c."citedOpenAlexId"
      )
      ${reviewedFilter}
    `),
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT c."citedOpenAlexId")::int AS count
      FROM "PaperCitation" c
      WHERE NOT EXISTS (
        SELECT 1 FROM "Paper" p WHERE p."openAlexId" = c."citedOpenAlexId"
      )
    `.then((r) => Number(r[0]?.count ?? 0)),
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT c."citedOpenAlexId")::int AS count
      FROM "PaperCitation" c
      WHERE NOT EXISTS (
        SELECT 1 FROM "Paper" p WHERE p."openAlexId" = c."citedOpenAlexId"
      )
      AND c.reviewed = false
    `.then((r) => Number(r[0]?.count ?? 0)),
  ])

  const total = Number(countResult[0]?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const grandTotal = totalResult
  const unreviewedTotal = unreviewedResult

  // Fetch citing paper titles for this page's groups
  const citedIds = groups.map((g) => g.citedOpenAlexId)
  const citingRows = citedIds.length
    ? await db.paperCitation.findMany({
        where: { citedOpenAlexId: { in: citedIds } },
        select: { citedOpenAlexId: true, citingPaper: { select: { id: true, title: true } } },
      })
    : []

  const citingByGroup = new Map<string, { id: number; title: string }[]>()
  for (const r of citingRows) {
    if (!citingByGroup.has(r.citedOpenAlexId)) citingByGroup.set(r.citedOpenAlexId, [])
    citingByGroup.get(r.citedOpenAlexId)!.push(r.citingPaper)
  }

  return (
    <>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-3xl font-bold">Citation Review</h1>
        <span className="text-base-content/50 text-sm">
          {showAll
            ? `${grandTotal.toLocaleString()} external citations`
            : `${unreviewedTotal.toLocaleString()} / ${grandTotal.toLocaleString()} external citations`}
        </span>
      </div>
      <p className="text-base-content/60 mb-6 text-sm">
        Papers cited by accepted papers that are not yet in the database. Add any that belong.
      </p>

      <div className="flex gap-2 mb-6">
        <a href="?show=pending&page=1" className={`btn btn-sm ${!showAll ? "btn-neutral" : "btn-ghost"}`}>
          Unreviewed
        </a>
        <a href="?show=all&page=1" className={`btn btn-sm ${showAll ? "btn-neutral" : "btn-ghost"}`}>
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
                {groups.map((g, idx) => {
                  const citedBy = citingByGroup.get(g.citedOpenAlexId) ?? []
                  const nextIds = groups.slice(idx + 1, idx + 11).map((r) => r.citedOpenAlexId).join(",")
                  return (
                    <tr key={g.citedOpenAlexId} className={`hover:bg-base-200 ${g.reviewed ? "opacity-50" : ""}`}>
                      <td className="text-sm align-top py-3">
                        {g.title ? cap(g.title) : <span className="text-base-content/30 italic">no title</span>}
                      </td>
                      <td className="text-sm text-base-content/60 align-top py-3">{g.year ?? "—"}</td>
                      <td className="text-sm text-base-content/60 italic align-top py-3">{g.journal ?? "—"}</td>
                      <td className="align-top py-3">
                        <div className="flex flex-col gap-0.5">
                          {citedBy.slice(0, 3).map((p) => (
                            <a
                              key={p.id}
                              href={`/norms/${p.id}`}
                              className="text-xs link link-hover text-base-content/50 max-w-[200px] truncate block"
                              title={p.title}
                            >
                              {cap(p.title)}
                            </a>
                          ))}
                          {citedBy.length > 3 && (
                            <span className="text-xs text-base-content/30">+{citedBy.length - 3} more</span>
                          )}
                        </div>
                      </td>
                      <td className="align-top py-3">
                        <a
                          href={`/admin/citations/${g.citedOpenAlexId}${nextIds ? `?next=${nextIds}` : ""}`}
                          className="btn btn-outline btn-xs"
                        >
                          Review
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) => `?show=${show ?? "pending"}&page=${p}`}
          />
        </>
      )}
    </>
  )
}

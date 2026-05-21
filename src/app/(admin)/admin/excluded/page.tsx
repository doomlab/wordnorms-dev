import db from "db"
import { Pagination } from "src/app/components/Pagination"

export const metadata = { title: "Excluded – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const PAGE_SIZE = 50

export default async function AdminExcludedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    status: "EXCLUDED" as const,
    canonicalPaperId: null,
    modelScore: { not: null },
  }

  const [papers, total] = await Promise.all([
    db.paper.findMany({
      where,
      select: {
        id: true, title: true, authors: true, year: true, doi: true,
        modelScore: true, reviewedById: true,
      },
      orderBy: [{ reviewedById: { sort: "asc", nulls: "first" } }, { modelScore: { sort: "desc", nulls: "last" } }],
      skip,
      take: PAGE_SIZE,
    }),
    db.paper.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Excluded</h1>
      <p className="text-base-content/60 mb-8">
        Auto-excluded papers. Accept any that belong, or confirm exclusion to clear them from this
        queue.
      </p>

      <p className="text-sm text-base-content/60 mb-4">
        {total} paper{total !== 1 ? "s" : ""} pending
      </p>

      {total === 0 ? (
        <div className="text-base-content/40 py-10 text-center">All clear — nothing to review.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Authors</th>
                  <th>Year</th>
                  <th>Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {papers.map((p, idx) => {
                  const nextIds = papers
                    .slice(idx + 1, idx + 11)
                    .map((r) => r.id)
                    .join(",")
                  return (
                    <tr key={p.id}>
                      <td className="max-w-sm">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <p className="font-medium line-clamp-2">{cap(p.title)}</p>
                          {p.reviewedById && (
                            <span className="badge badge-neutral badge-xs shrink-0">reviewed</span>
                          )}
                        </div>
                        {p.doi && (
                          <a
                            href={`https://doi.org/${p.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            className="link link-primary text-xs"
                          >
                            {p.doi}
                          </a>
                        )}
                      </td>
                      <td className="text-sm text-base-content/70 max-w-xs">
                        {p.authors.slice(0, 3).join(", ")}
                        {p.authors.length > 3 && " et al."}
                      </td>
                      <td>{p.year ?? "—"}</td>
                      <td>
                        {p.modelScore != null ? (
                          <span className="badge badge-outline badge-sm">
                            {p.modelScore.toFixed(2)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <a
                          href={`/admin/excluded/${p.id}${nextIds ? `?next=${nextIds}` : ""}`}
                          className="btn btn-outline btn-xs"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `?page=${p}`} />
        </>
      )}
    </>
  )
}

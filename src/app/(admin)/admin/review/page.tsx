import db from "db"
import { Pagination } from "src/app/components/Pagination"

export const metadata = { title: "Review – Admin" }

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const PAGE_SIZE = 50

export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where = { status: "PENDING_REVIEW" as const, canonicalPaperId: null }

  const [pending, total] = await Promise.all([
    db.paper.findMany({
      where,
      orderBy: [{ modelScore: "desc" }, { createdAt: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
    db.paper.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Review Queue</h1>
      <p className="text-base-content/60 mb-8">
        Papers scored by the model — sorted by relevance score. Accept papers that are lexical
        norms, corpora, or linguistic databases. Exclude anything else.
      </p>

      <p className="text-sm text-base-content/60 mb-4">
        {total} paper{total !== 1 ? "s" : ""} pending
      </p>

      {total === 0 ? (
        <div className="text-base-content/40 py-10 text-center">Queue is empty.</div>
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
                {pending.map((p, idx) => {
                  const nextIds = pending.slice(idx + 1, idx + 11).map((r) => r.id).join(",")
                  return (
                  <tr key={p.id}>
                    <td className="max-w-sm">
                      <p className="font-medium line-clamp-2">{capFirst(p.title)}</p>
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
                        href={`/admin/review/${p.id}${nextIds ? `?next=${nextIds}` : ""}`}
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

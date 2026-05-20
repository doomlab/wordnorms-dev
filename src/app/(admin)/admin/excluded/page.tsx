import db from "db"

export const metadata = { title: "Excluded – Admin" }

const PAGE_SIZE = 100

export default async function AdminExcludedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const [papers, total] = await Promise.all([
    db.paper.findMany({
      where: { status: "EXCLUDED" },
      include: {
        reviewedBy: { select: { email: true } },
        _count: { select: { reports: { where: { resolved: false } } } },
      },
      orderBy: { modelScore: { sort: "desc", nulls: "last" } },
      skip,
      take: PAGE_SIZE,
    }),
    db.paper.count({ where: { status: "EXCLUDED" } }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Excluded Papers</h1>
      <p className="text-base-content/60 mb-8">
        {total} paper{total !== 1 ? "s" : ""} excluded from the model.
      </p>

      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Title</th>
              <th>Year</th>
              <th>Score</th>
              <th>Reviewed by</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {papers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-base-content/40 py-10">
                  No excluded papers yet.
                </td>
              </tr>
            )}
            {papers.map((p) => (
              <tr key={p.id}>
                <td className="max-w-sm">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <a href={`/excluded/${p.id}`} className="font-medium line-clamp-2 hover:underline">
                      {p.title}
                    </a>
                    {p._count.reports > 0 && (
                      <span className="badge badge-warning badge-xs shrink-0">flagged</span>
                    )}
                    {p.reviewedBy && (
                      <span className="badge badge-ghost badge-xs shrink-0">reviewed</span>
                    )}
                  </div>
                  {p.abstract && (
                    <p className="text-xs text-base-content/50 line-clamp-2 mt-0.5">{p.abstract}</p>
                  )}
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
                <td>{p.year ?? "—"}</td>
                <td className="text-sm tabular-nums">
                  {p.modelScore != null ? (
                    <span className={p.modelScore >= 0 ? "text-warning" : "text-base-content/40"}>
                      {p.modelScore.toFixed(2)}
                    </span>
                  ) : "—"}
                </td>
                <td className="text-sm text-base-content/60">
                  {p.reviewedBy?.email ?? "—"}
                </td>
                <td className="text-sm text-base-content/60 max-w-xs">
                  {p.reviewNote ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-base-content/50">
            Page {page} of {totalPages}
          </span>
          <div className="join">
            {page > 1 && (
              <a href={`?page=${page - 1}`} className="join-item btn btn-sm">«</a>
            )}
            {page > 1 && (
              <a href="?page=1" className="join-item btn btn-sm">1</a>
            )}
            <button className="join-item btn btn-sm btn-active">{page}</button>
            {page < totalPages && (
              <a href={`?page=${totalPages}`} className="join-item btn btn-sm">{totalPages}</a>
            )}
            {page < totalPages && (
              <a href={`?page=${page + 1}`} className="join-item btn btn-sm">»</a>
            )}
          </div>
        </div>
      )}
    </>
  )
}

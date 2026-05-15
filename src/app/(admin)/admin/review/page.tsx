import db from "db"

export const metadata = { title: "Review – Admin" }

export default async function AdminReviewPage() {
  const pending = await db.paper.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: [{ modelScore: "desc" }, { createdAt: "asc" }],
  })

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Review Queue</h1>
      <p className="text-base-content/60 mb-8">
        Papers scored by the model — sorted by relevance score. Accept papers that should go into
        the model, exclude the rest.
      </p>

      <p className="text-sm text-base-content/60 mb-4">
        {pending.length} paper{pending.length !== 1 ? "s" : ""} pending
      </p>

      {pending.length === 0 ? (
        <div className="text-base-content/40 py-10 text-center">Queue is empty.</div>
      ) : (
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
              {pending.map((p) => (
                <tr key={p.id}>
                  <td className="max-w-sm">
                    <p className="font-medium line-clamp-2">{p.title}</p>
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
                    <a href={`/admin/review/${p.id}`} className="btn btn-ghost btn-xs">
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

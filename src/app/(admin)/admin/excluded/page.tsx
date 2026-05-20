import db from "db"

export const metadata = { title: "Excluded – Admin" }

export default async function AdminExcludedPage() {
  const papers = await db.paper.findMany({
    where: { status: "EXCLUDED" },
    include: { reviewedBy: { select: { email: true } } },
    orderBy: { modelScore: { sort: "desc", nulls: "last" } },
  })

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Excluded Papers</h1>
      <p className="text-base-content/60 mb-8">
        {papers.length} paper{papers.length !== 1 ? "s" : ""} excluded from the model.
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
                <td colSpan={4} className="text-center text-base-content/40 py-10">
                  No excluded papers yet.
                </td>
              </tr>
            )}
            {papers.map((p) => (
              <tr key={p.id}>
                <td className="max-w-sm">
                  <p className="font-medium line-clamp-2">{p.title}</p>
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
    </>
  )
}

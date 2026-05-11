import db from "db"

export const metadata = { title: "Excluded – Admin" }

export default async function AdminExcludedPage() {
  const papers = await db.paper.findMany({
    where: { status: { in: ["EXCLUDED", "ADDED_TO_TRAINING"] } },
    include: { reviewedBy: { select: { email: true } } },
    orderBy: { updatedAt: "desc" },
  })

  const excluded = papers.filter((p) => p.status === "EXCLUDED")
  const training = papers.filter((p) => p.status === "ADDED_TO_TRAINING")

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Excluded Papers</h1>
      <p className="text-base-content/60 mb-8">
        {excluded.length} excluded · {training.length} added to training
      </p>

      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Title</th>
              <th>Year</th>
              <th>Status</th>
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
                  <p className="font-medium line-clamp-2">{p.title}</p>
                  {p.doi && (
                    <span className="text-xs text-base-content/50">{p.doi}</span>
                  )}
                </td>
                <td>{p.year ?? "—"}</td>
                <td>
                  <span
                    className={`badge badge-sm ${
                      p.status === "EXCLUDED" ? "badge-error" : "badge-warning"
                    }`}
                  >
                    {p.status === "EXCLUDED" ? "Excluded" : "Training"}
                  </span>
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

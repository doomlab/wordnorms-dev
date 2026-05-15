import db from "db"

export const metadata = { title: "Metadata Review – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default async function AdminMetadataPage() {
  const papers = await db.paper.findMany({
    where: {
      status: "ACCEPTED",
      extraction: { isNot: null, verifiedAt: null },
    },
    select: {
      id: true,
      title: true,
      authors: true,
      year: true,
      modelScore: true,
      extraction: { select: { normsCollected: true, confidence: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Metadata Review</h1>
      <p className="text-base-content/60 mb-8">
        Check the extracted metadata for each paper and verify it looks correct.
      </p>

      <p className="text-sm text-base-content/60 mb-4">
        {papers.length} paper{papers.length !== 1 ? "s" : ""} pending review
      </p>

      {papers.length === 0 ? (
        <div className="text-base-content/40 py-10 text-center">All extractions verified.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Title</th>
                <th>Authors</th>
                <th>Year</th>
                <th>Score</th>
                <th>Norms</th>
                <th>Confidence</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {papers.map((p) => (
                <tr key={p.id}>
                  <td className="max-w-sm">
                    <p className="font-medium line-clamp-2">{cap(p.title)}</p>
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
                    ) : "—"}
                  </td>
                  <td className="max-w-xs truncate text-sm">
                    {p.extraction?.normsCollected?.join(", ") || "—"}
                  </td>
                  <td>
                    {p.extraction?.confidence != null ? (
                      <span className={p.extraction.confidence < 0.6 ? "text-warning" : "text-success"}>
                        {(p.extraction.confidence * 100).toFixed(0)}%
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    <a href={`/admin/metadata/${p.id}`} className="btn btn-ghost btn-outline btn-xs">
                      Review
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

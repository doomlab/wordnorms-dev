import db from "db"
import { PaperActions } from "./PaperActions"
import { UrlEditor } from "./UrlEditor"

export const metadata = { title: "Review – Admin" }

export default async function AdminReviewPage() {
  const [pending, pendingPdf] = await Promise.all([
    db.paper.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: [{ modelScore: "desc" }, { createdAt: "asc" }],
    }),
    db.paper.findMany({
      where: { status: "PENDING_PDF" },
      orderBy: { updatedAt: "asc" },
    }),
  ])

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Review Queue</h1>
      <p className="text-base-content/60 mb-8">
        Papers flagged by the prediction model as likely relevant.
      </p>

      {/* Step 1 — Initial review */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-1">Step 1 — Initial review</h2>
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
                  <th>URL</th>
                  <th>Score</th>
                  <th>Actions</th>
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
                    <td><UrlEditor paperId={p.id} initialUrl={p.url} /></td>
                    <td>
                      {p.modelScore != null ? (
                        <span className="badge badge-outline badge-sm">
                          {(p.modelScore * 100).toFixed(0)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <PaperActions paperId={p.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Step 2 — PDF review */}
      <section>
        <h2 className="text-lg font-semibold mb-1">Step 2 — PDF review</h2>
        <p className="text-sm text-base-content/60 mb-4">
          {pendingPdf.length} paper{pendingPdf.length !== 1 ? "s" : ""} accepted, awaiting PDF
          confirmation
        </p>

        {pendingPdf.length === 0 ? (
          <div className="text-base-content/40 py-10 text-center">Nothing here yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Authors</th>
                  <th>Year</th>
                  <th>Website URL</th>
                  <th>PDF</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingPdf.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-sm">
                      <p className="font-medium line-clamp-2">{p.title}</p>
                    </td>
                    <td className="text-sm text-base-content/70 max-w-xs">
                      {p.authors.slice(0, 3).join(", ")}
                      {p.authors.length > 3 && " et al."}
                    </td>
                    <td>{p.year ?? "—"}</td>
                    <td><UrlEditor paperId={p.id} initialUrl={p.url} /></td>
                    <td>
                      {p.pdfUrl ? (
                        <a
                          href={p.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-xs"
                        >
                          Open PDF
                        </a>
                      ) : (
                        <span className="text-base-content/40 text-xs">No URL</span>
                      )}
                    </td>
                    <td>
                      <PaperActions paperId={p.id} isPdf />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

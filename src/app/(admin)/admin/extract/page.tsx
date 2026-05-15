import db from "db"

export const metadata = { title: "Extraction – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default async function AdminExtractPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = "new" } = await searchParams

  const [hasPdf, noPdf, needsReview] = await Promise.all([
    // New: accepted, has a PDF, never extracted
    db.paper.findMany({
      where: { status: "ACCEPTED", extraction: null, pdfUrl: { not: null } },
      select: { id: true, title: true, authors: true, year: true, modelScore: true },
      orderBy: { updatedAt: "desc" },
    }),
    // No PDF: never extracted + no URL, OR extraction failed (needsReview + no confidence)
    db.paper.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { extraction: { is: null }, pdfUrl: null },
          { extraction: { needsReview: true, confidence: null } },
        ],
      },
      select: { id: true, title: true, authors: true, year: true, modelScore: true },
      orderBy: { updatedAt: "desc" },
    }),
    // Needs review: extraction ran and has a confidence score, but flagged for human review
    db.paper.findMany({
      where: {
        status: "ACCEPTED",
        extraction: { needsReview: true, confidence: { not: null } },
      },
      select: {
        id: true,
        title: true,
        authors: true,
        year: true,
        modelScore: true,
        extraction: { select: { confidence: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  const tabs = [
    { key: "new", label: "New", count: hasPdf.length },
    { key: "no-pdf", label: "No PDF", count: noPdf.length },
    { key: "needs-review", label: "Needs Review", count: needsReview.length },
  ]

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Extraction</h1>
      <p className="text-base-content/60 mb-8">
        Extract structured metadata from accepted papers using the LLM pipeline.
      </p>

      <div role="tablist" className="tabs tabs-bordered mb-8">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`?tab=${t.key}`}
            role="tab"
            className={`tab ${tab === t.key ? "tab-active" : ""}`}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`badge badge-sm ml-2 ${tab === t.key ? "badge-neutral" : "badge-ghost"}`}
              >
                {t.count}
              </span>
            )}
          </a>
        ))}
      </div>

      {tab === "new" &&
        (hasPdf.length === 0 ? (
          <p className="text-base-content/40">No papers waiting for extraction.</p>
        ) : (
          <PaperTable rows={hasPdf} tab="new" />
        ))}

      {tab === "no-pdf" &&
        (noPdf.length === 0 ? (
          <p className="text-base-content/40">No papers missing a PDF.</p>
        ) : (
          <>
            <PaperTable rows={noPdf} tab="no-pdf" />
          </>
        ))}

      {tab === "needs-review" &&
        (needsReview.length === 0 ? (
          <p className="text-base-content/40">No extractions flagged for review.</p>
        ) : (
          <>
            <p className="text-sm text-base-content/60 mb-4">
              Extraction ran but confidence was low. Review each paper and approve or re-extract.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Authors</th>
                    <th>Year</th>
                    <th>Score</th>
                    <th>Confidence</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {needsReview.map((p) => (
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
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {p.extraction?.confidence != null ? (
                          <span className="text-warning">
                            {(p.extraction.confidence * 100).toFixed(0)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <a
                          href={`/admin/extract/${p.id}`}
                          className="btn btn-ghost btn-outline btn-xs"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}
    </>
  )
}

type PaperRow = {
  id: number
  title: string
  authors: string[]
  year: number | null
  modelScore: number | null
}

function PaperTable({ rows, tab }: { rows: PaperRow[]; tab: string }) {
  return (
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
          {rows.map((p) => (
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
                  <span className="badge badge-outline badge-sm">{p.modelScore.toFixed(2)}</span>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <a
                  href={`/admin/extract/${p.id}?from=${tab}`}
                  className="btn btn-ghost btn-outline btn-xs"
                >
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

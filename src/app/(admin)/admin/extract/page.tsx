import db from "db"
import { ExtractButton } from "./ExtractButton"
import { AddPdfUrl } from "./AddPdfUrl"

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
      select: { id: true, title: true, year: true, doi: true, pdfUrl: true },
      orderBy: { updatedAt: "desc" },
    }),
    // No PDF: never extracted + no URL, OR extraction failed (needsReview + no confidence)
    db.paper.findMany({
      where: {
        status: { in: ["ACCEPTED", "ADDED_TO_TRAINING"] },
        OR: [
          { extraction: { is: null }, pdfUrl: null },
          { extraction: { needsReview: true, confidence: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        year: true,
        doi: true,
        pdfUrl: true,
        extraction: { select: { needsReview: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Needs review: extraction ran and has a confidence score, but flagged for human review
    db.paper.findMany({
      where: {
        status: { in: ["ACCEPTED", "ADDED_TO_TRAINING"] },
        extraction: { needsReview: true, confidence: { not: null } },
      },
      select: {
        id: true,
        title: true,
        year: true,
        doi: true,
        extraction: {
          select: { language: true, normsCollected: true, confidence: true, extractedBy: true },
        },
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
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Year</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hasPdf.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <p className="font-medium line-clamp-1">{cap(p.title)}</p>
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
                    <td>
                      <div className="flex gap-2 items-center">
                        {p.pdfUrl && (
                          <a
                            href={p.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-xs btn-ghost btn-outline"
                          >
                            PDF
                          </a>
                        )}
                        <ExtractButton paperId={p.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "no-pdf" &&
        (noPdf.length === 0 ? (
          <p className="text-base-content/40">No papers missing a PDF.</p>
        ) : (
          <>
            <p className="text-sm text-base-content/60 mb-4">
              No usable PDF for these papers. Paste a direct PDF link to extract.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Year</th>
                    <th>DOI</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {noPdf.map((p) => (
                    <tr key={p.id}>
                      <td className="max-w-sm">
                        <p className="font-medium line-clamp-1">{cap(p.title)}</p>
                        {p.extraction?.needsReview && (
                          <span className="text-xs text-warning">prev. extraction failed</span>
                        )}
                      </td>
                      <td>{p.year ?? "—"}</td>
                      <td>
                        {p.doi ? (
                          <a
                            href={`https://doi.org/${p.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            className="link link-primary text-xs"
                          >
                            {p.doi}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <AddPdfUrl paperId={p.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}

      {tab === "needs-review" &&
        (needsReview.length === 0 ? (
          <p className="text-base-content/40">No extractions flagged for review.</p>
        ) : (
          <>
            <p className="text-sm text-base-content/60 mb-4">
              Extraction ran but confidence was low. Check the data and approve or re-extract.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Year</th>
                    <th>Language</th>
                    <th>Norms</th>
                    <th>Confidence</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {needsReview.map((p) => {
                    const e = p.extraction
                    return (
                      <tr key={p.id}>
                        <td className="max-w-sm">
                          <p className="font-medium line-clamp-1">{cap(p.title)}</p>
                        </td>
                        <td>{p.year ?? "—"}</td>
                        <td>{e?.language?.join(", ") ?? "—"}</td>
                        <td className="max-w-xs truncate">
                          {e?.normsCollected?.join(", ") ?? "—"}
                        </td>
                        <td>
                          {e?.confidence != null ? (
                            <span className="text-warning">{(e.confidence * 100).toFixed(0)}%</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <a
                            href={`/norms/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-xs btn-ghost btn-outline"
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
          </>
        ))}
    </>
  )
}

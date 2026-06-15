import db from "db"
import { Pagination } from "src/app/components/Pagination"

export const metadata = { title: "Metadata Review – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const PAGE_SIZE = 50

export default async function AdminMetadataPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; view?: string }>
}) {
  const { page: pageParam, view } = await searchParams
  const showUpdated = view === "updated"
  const showSuggested = view === "suggested"
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const baseWhere = { status: "ACCEPTED" as const, canonicalPaperId: null }

  const suggestedWhere = {
    ...baseWhere,
    extractionEdits: { some: {} },
    extraction: { is: { verifiedAt: null } },
  }

  const where = showSuggested
    ? suggestedWhere
    : {
        ...baseWhere,
        extraction: { is: showUpdated ? { verifiedAt: { not: null } } : { verifiedAt: null } },
      }

  const [papers, total, pendingCount, updatedCount, suggestedCount] = await Promise.all([
    db.paper.findMany({
      where,
      select: {
        id: true,
        title: true,
        authors: true,
        year: true,
        doi: true,
        extraction: { select: { normsCollected: true, confidence: true, verifiedAt: true } },
        extractionEdits: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.paper.count({ where }),
    db.paper.count({ where: { ...baseWhere, extraction: { is: { verifiedAt: null } } } }),
    db.paper.count({ where: { ...baseWhere, extraction: { is: { verifiedAt: { not: null } } } } }),
    db.paper.count({ where: suggestedWhere }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Metadata Review</h1>
      <p className="text-base-content/60 mb-6">
        Check the extracted metadata for each paper and verify it looks correct.
      </p>

      <div role="tablist" className="tabs tabs-border mb-6">
        <a
          role="tab"
          href="/admin/metadata"
          className={`tab${!showUpdated && !showSuggested ? " tab-active" : ""}`}
        >
          Pending <span className="ml-1.5 badge badge-sm">{pendingCount}</span>
        </a>
        <a
          role="tab"
          href="/admin/metadata?view=suggested"
          className={`tab${showSuggested ? " tab-active" : ""}`}
        >
          Suggested edits <span className="ml-1.5 badge badge-sm badge-warning">{suggestedCount}</span>
        </a>
        <a
          role="tab"
          href="/admin/metadata?view=updated"
          className={`tab${showUpdated ? " tab-active" : ""}`}
        >
          Verified <span className="ml-1.5 badge badge-sm badge-success">{updatedCount}</span>
        </a>
      </div>

      <p className="text-sm text-base-content/60 mb-4">
        {total} paper{total !== 1 ? "s" : ""}
      </p>

      {total === 0 ? (
        <div className="text-base-content/40 py-10 text-center">
          {showSuggested ? "No pending suggestions." : showUpdated ? "No verified extractions yet." : "All extractions verified."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Authors</th>
                  <th>Year</th>
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
                      {p.doi && (
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary/70 hover:text-primary"
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
                      <a
                        href={`/admin/metadata/${p.id}${showUpdated ? "?from=updated" : showSuggested ? "?from=suggested" : ""}`}
                        className={`btn btn-sm ${showSuggested ? "btn-primary" : "btn-outline"}`}
                      >
                        {showSuggested ? "Review suggestion" : "Review"}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `?${showUpdated ? "view=updated&" : showSuggested ? "view=suggested&" : ""}page=${p}`} />
        </>
      )}
    </>
  )
}

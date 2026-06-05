import db from "db"
import { getBlitzContext } from "../../../blitz-server"
import { Pagination } from "src/app/components/Pagination"

export const metadata = { title: "Extraction – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const PAGE_SIZE = 50

export default async function AdminExtractPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const { tab = "new", page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const skip = (page - 1) * PAGE_SIZE
  const ctx = await getBlitzContext()

  const hasPdfWhere = { status: "ACCEPTED" as const, canonicalPaperId: null, extraction: null, pdfUrl: { not: null } }
  const noPdfWhere = { status: "ACCEPTED" as const, canonicalPaperId: null, extraction: null, pdfUrl: null }

  const activeWhere = tab === "new" ? hasPdfWhere : noPdfWhere

  const [rows, total, hasPdfCount, noPdfCount, admin] = await Promise.all([
    db.paper.findMany({
      where: activeWhere,
      select: { id: true, title: true, authors: true, year: true, doi: true },
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.paper.count({ where: activeWhere }),
    db.paper.count({ where: hasPdfWhere }),
    db.paper.count({ where: noPdfWhere }),
    db.user.findUnique({
      where: { id: ctx.session.userId as number },
      select: { groqApiKey: true },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasGroqKey = !!admin?.groqApiKey

  const tabs = [
    { key: "new", label: "New", count: hasPdfCount },
    { key: "no-pdf", label: "No PDF", count: noPdfCount },
  ]

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Extraction</h1>
      <p className="text-base-content/60 mb-4">
        Extract structured metadata from accepted papers using the LLM pipeline.
      </p>

      {!hasGroqKey && (
        <div className="alert alert-warning mb-8">
          <span>
            A Groq API key is required to run extractions.{" "}
            <a href="/dashboard/profile" className="link font-medium">Add one in your profile.</a>
          </span>
        </div>
      )}

      <div role="tablist" className="tabs tabs-bordered mb-8">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`?tab=${t.key}&page=1`}
            role="tab"
            className={`tab ${tab === t.key ? "tab-active" : ""}`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`badge badge-sm ml-2 ${tab === t.key ? "badge-neutral" : "badge-ghost"}`}>
                {t.count}
              </span>
            )}
          </a>
        ))}
      </div>

      {total === 0 ? (
        <p className="text-base-content/40">No papers waiting for extraction.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Authors</th>
                  <th>Year</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
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
                    <td>
                      <a href={`/admin/extract/${p.id}?from=${tab}`} className="btn btn-outline btn-xs">
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `?tab=${tab}&page=${p}`} />
        </>
      )}
    </>
  )
}

import db from "db"
import { getBlitzContext } from "../../../blitz-server"

export const metadata = { title: "Extraction – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default async function AdminExtractPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = "new" } = await searchParams
  const ctx = await getBlitzContext()

  const [hasPdf, noPdf, admin] = await Promise.all([
    db.paper.findMany({
      where: { status: "ACCEPTED", extraction: null, pdfUrl: { not: null } },
      select: { id: true, title: true, authors: true, year: true, doi: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.paper.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { extraction: { is: null }, pdfUrl: null },
          { extraction: { needsReview: true, confidence: null } },
        ],
      },
      select: { id: true, title: true, authors: true, year: true, doi: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findUnique({
      where: { id: ctx.session.userId as number },
      select: { groqApiKey: true },
    }),
  ])

  const hasGroqKey = !!admin?.groqApiKey

  const tabs = [
    { key: "new", label: "New", count: hasPdf.length },
    { key: "no-pdf", label: "No PDF", count: noPdf.length },
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
            href={`?tab=${t.key}`}
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

      {tab === "new" && (
        hasPdf.length === 0 ? (
          <p className="text-base-content/40">No papers waiting for extraction.</p>
        ) : (
          <PaperTable rows={hasPdf} tab="new" />
        )
      )}

      {tab === "no-pdf" && (
        noPdf.length === 0 ? (
          <p className="text-base-content/40">No papers missing a PDF.</p>
        ) : (
          <PaperTable rows={noPdf} tab="no-pdf" />
        )
      )}
    </>
  )
}

type PaperRow = {
  id: number
  title: string
  authors: string[]
  year: number | null
  doi: string | null
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
                <a href={`/admin/extract/${p.id}?from=${tab}`} className="btn btn-ghost btn-outline btn-xs">
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

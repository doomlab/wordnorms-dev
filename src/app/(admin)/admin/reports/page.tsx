import db from "db"
import { StatusBadge } from "src/app/components/StatusBadge"
import { Pagination } from "src/app/components/Pagination"

export const metadata = { title: "Reports – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const PAGE_SIZE = 50

const REASON_LABELS: Record<string, string> = {
  WRONG_CLASSIFICATION: "Incorrectly classified",
  DUPLICATE: "Duplicate entry",
  OTHER: "Other",
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const { tab = "classification", page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const [classificationCount, metadataCount] = await Promise.all([
    db.paperReport.count({ where: { resolved: false } }),
    db.extractionEditSuggestion.count({ where: { resolved: false } }),
  ])

  const tabs = [
    { key: "classification", label: "Classification", count: classificationCount },
    { key: "metadata", label: "Metadata", count: metadataCount },
  ]

  let content: React.ReactNode
  let totalPages = 1

  if (tab === "metadata") {
    const total = metadataCount
    totalPages = Math.ceil(total / PAGE_SIZE)
    const suggestions = await db.extractionEditSuggestion.findMany({
      where: { resolved: false },
      include: {
        paper: { select: { id: true, title: true, doi: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    })
    content = suggestions.length === 0 ? (
      <div className="text-center py-16 text-base-content/40">No pending suggestions.</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Paper</th>
              <th>Suggested by</th>
              <th>Note</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.id}>
                <td className="max-w-sm">
                  <p className="font-medium line-clamp-2">{cap(s.paper.title)}</p>
                  {s.paper.doi && (
                    <a href={`https://doi.org/${s.paper.doi}`} target="_blank" rel="noreferrer" className="link link-primary text-xs">
                      {s.paper.doi}
                    </a>
                  )}
                </td>
                <td className="text-sm text-base-content/60">{s.user.name ?? s.user.email}</td>
                <td className="text-sm text-base-content/60 max-w-xs">
                  {s.note ?? <span className="text-base-content/30">—</span>}
                </td>
                <td className="text-xs text-base-content/50 whitespace-nowrap">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <a href={`/admin/reports/suggestions/${s.id}`} className="btn btn-outline btn-xs">Review</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  } else {
    const total = classificationCount
    totalPages = Math.ceil(total / PAGE_SIZE)
    const reports = await db.paperReport.findMany({
      where: { resolved: false },
      include: {
        paper: { select: { id: true, title: true, status: true, doi: true } },
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    })
    content = reports.length === 0 ? (
      <div className="text-center py-16 text-base-content/40">No open reports.</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Paper</th>
              <th>Status</th>
              <th>Reported by</th>
              <th>Reason</th>
              <th>Note</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="max-w-sm">
                  <p className="font-medium line-clamp-2">{cap(r.paper.title)}</p>
                  {r.paper.doi && (
                    <a href={`https://doi.org/${r.paper.doi}`} target="_blank" rel="noreferrer" className="link link-primary text-xs">
                      {r.paper.doi}
                    </a>
                  )}
                </td>
                <td><StatusBadge status={r.paper.status} /></td>
                <td className="text-sm text-base-content/60">{r.user.email}</td>
                <td className="text-sm">{REASON_LABELS[r.reason] ?? r.reason}</td>
                <td className="text-sm text-base-content/60 max-w-xs">
                  {r.note ?? <span className="text-base-content/30">—</span>}
                </td>
                <td className="text-xs text-base-content/50 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <a href={`/admin/reports/${r.id}`} className="btn btn-outline btn-xs">Review</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">User Reports</h1>
      <p className="text-base-content/60 mb-8">Papers flagged by users as having issues.</p>

      <div role="tablist" className="tabs tabs-bordered mb-8">
        {tabs.map((t) => (
          <a key={t.key} href={`?tab=${t.key}&page=1`} role="tab" className={`tab ${tab === t.key ? "tab-active" : ""}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`badge badge-sm ml-2 ${tab === t.key ? "badge-neutral" : "badge-ghost"}`}>
                {t.count}
              </span>
            )}
          </a>
        ))}
      </div>

      {content}
      <Pagination page={page} totalPages={totalPages} buildHref={(p) => `?tab=${tab}&page=${p}`} />
    </>
  )
}

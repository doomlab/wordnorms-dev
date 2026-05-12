import db from "db"
import { ResolveButton } from "./ResolveButton"

export const metadata = { title: "Reports – Admin" }

const REASON_LABELS: Record<string, string> = {
  WRONG_CLASSIFICATION: "Incorrectly classified",
  DUPLICATE: "Duplicate entry",
  OTHER: "Other",
}

const STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Included",
  ADDED_TO_TRAINING: "Included",
  EXCLUDED: "Excluded",
  PENDING_REVIEW: "Pending",
  PENDING_PDF: "Pending PDF",
}

export default async function AdminReportsPage() {
  const reports = await db.paperReport.findMany({
    where: { resolved: false },
    include: {
      paper: { select: { id: true, title: true, status: true, doi: true } },
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">User Reports</h1>
      <p className="text-base-content/60 mb-8">
        {reports.length} open {reports.length === 1 ? "report" : "reports"} — papers users flagged
        as incorrectly classified.
      </p>

      {reports.length === 0 ? (
        <div className="text-center py-16 text-base-content/40">
          <p className="text-lg">No open reports.</p>
        </div>
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
                    <p className="font-medium line-clamp-2">{r.paper.title}</p>
                    {r.paper.doi && (
                      <a
                        href={`https://doi.org/${r.paper.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link link-primary text-xs"
                      >
                        {r.paper.doi}
                      </a>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge badge-sm ${
                        r.paper.status === "EXCLUDED" ? "badge-error" : "badge-success"
                      }`}
                    >
                      {STATUS_LABELS[r.paper.status] ?? r.paper.status}
                    </span>
                  </td>
                  <td className="text-sm text-base-content/60">{r.user.email}</td>
                  <td className="text-sm">{REASON_LABELS[r.reason] ?? r.reason}</td>
                  <td className="text-sm text-base-content/60 max-w-xs">
                    {r.note ?? <span className="text-base-content/30">—</span>}
                  </td>
                  <td className="text-xs text-base-content/50 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <ResolveButton reportId={r.id} />
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

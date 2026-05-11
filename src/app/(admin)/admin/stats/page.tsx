import db from "db"

export const metadata = { title: "Stats – Admin" }

export default async function AdminStatsPage() {
  const counts = await db.paper.groupBy({
    by: ["status"],
    _count: { _all: true },
  })

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))

  const total = counts.reduce((sum, c) => sum + c._count._all, 0)
  const reviewed = (byStatus.PENDING_PDF ?? 0) + (byStatus.ACCEPTED ?? 0) +
    (byStatus.EXCLUDED ?? 0) + (byStatus.ADDED_TO_TRAINING ?? 0)
  const acceptRate = reviewed > 0
    ? (((byStatus.PENDING_PDF ?? 0) + (byStatus.ACCEPTED ?? 0)) / reviewed * 100).toFixed(1)
    : null

  const stats = [
    { label: "Total papers", value: total, style: "" },
    { label: "Pending review", value: byStatus.PENDING_REVIEW ?? 0, style: "text-warning" },
    { label: "Pending PDF", value: byStatus.PENDING_PDF ?? 0, style: "text-info" },
    { label: "Accepted", value: byStatus.ACCEPTED ?? 0, style: "text-success" },
    { label: "Excluded", value: byStatus.EXCLUDED ?? 0, style: "text-error" },
    { label: "Added to training", value: byStatus.ADDED_TO_TRAINING ?? 0, style: "text-secondary" },
  ]

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Pipeline Stats</h1>
      <p className="text-base-content/60 mb-8">Training validation and review throughput.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="card card-bordered bg-base-200">
            <div className="card-body py-4 px-5">
              <p className="text-sm text-base-content/60">{s.label}</p>
              <p className={`text-3xl font-bold ${s.style}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {acceptRate !== null && (
        <div className="card card-bordered bg-base-200 max-w-sm">
          <div className="card-body py-4 px-5">
            <p className="text-sm text-base-content/60">Model accept rate (reviewed papers)</p>
            <p className="text-3xl font-bold">{acceptRate}%</p>
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="text-center text-base-content/40 py-16">
          No papers in the pipeline yet.
        </div>
      )}
    </>
  )
}

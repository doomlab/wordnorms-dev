import db from "db"

export const metadata = { title: "Stats – Admin" }

function pct(n: number) {
  return (n * 100).toFixed(1) + "%"
}

export default async function AdminStatsPage() {
  const [counts, extracted, metadataApproved, runs] = await Promise.all([
    db.paper.groupBy({ by: ["status"], where: { canonicalPaperId: null }, _count: { _all: true } }),
    db.paper.count({ where: { status: "ACCEPTED", canonicalPaperId: null, extraction: { isNot: null } } }),
    db.paperExtraction.count({ where: { verifiedAt: { not: null }, paper: { status: "ACCEPTED", canonicalPaperId: null } } }),
    db.modelRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ])

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))
  const total = counts.reduce((sum, c) => sum + c._count._all, 0)
  const accepted = byStatus.ACCEPTED ?? 0
  const excluded = byStatus.EXCLUDED ?? 0
  const reviewed = accepted + excluded
  const acceptRate = reviewed > 0 ? ((accepted / reviewed) * 100).toFixed(1) : null

  const stats = [
    { label: "Total papers", value: total, style: "" },
    { label: "Pending review", value: byStatus.PENDING_REVIEW ?? 0, style: "text-warning" },
    { label: "Accepted", value: accepted, style: "text-success" },
    { label: "Extracted", value: extracted, style: "text-info" },
    { label: "Excluded", value: excluded, style: "text-error" },
    { label: "Metadata approved", value: metadataApproved, style: "text-primary" },
  ]

  const latest = runs[0]

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Pipeline Stats</h1>
      <p className="text-base-content/60 mb-8">Model performance and review throughput.</p>

      {/* Paper counts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
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
        <div className="card card-bordered bg-base-200 mb-12">
          <div className="card-body py-4 px-5">
            <p className="text-sm text-base-content/60">Admin accept rate (reviewed papers)</p>
            <p className="text-3xl font-bold">{acceptRate}%</p>
          </div>
        </div>
      )}

      {/* Latest model metrics */}
      {latest && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Latest model run</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Accuracy", value: pct(latest.accuracy) },
              { label: "Precision", value: pct(latest.precision) },
              { label: "Recall", value: pct(latest.recall) },
              { label: "F1", value: pct(latest.f1) },
            ].map((m) => (
              <div key={m.label} className="card card-bordered bg-base-200">
                <div className="card-body py-4 px-5">
                  <p className="text-sm text-base-content/60">{m.label}</p>
                  <p className="text-3xl font-bold">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-base-content/40 mt-3">
            Trained on {latest.trainSize} papers · validated on {latest.valSize} ·{" "}
            {latest.createdAt.toLocaleDateString()}
            {latest.valRebalanced && (
              <span className="badge badge-info badge-sm ml-2">val rebalanced</span>
            )}
          </p>
        </section>
      )}

      {/* Model run history */}
      {runs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Model run history</h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>F1</th>
                  <th>Accuracy</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>Train</th>
                  <th>Val</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="text-base-content/60">
                      {r.createdAt.toLocaleDateString()}
                    </td>
                    <td className="font-medium">{pct(r.f1)}</td>
                    <td>{pct(r.accuracy)}</td>
                    <td>{pct(r.precision)}</td>
                    <td>{pct(r.recall)}</td>
                    <td>{r.trainSize}</td>
                    <td>{r.valSize}</td>
                    <td>
                      {r.valRebalanced && (
                        <span className="badge badge-info badge-sm">rebalanced</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="text-center text-base-content/40 py-16">
          No papers in the pipeline yet.
        </div>
      )}
    </>
  )
}

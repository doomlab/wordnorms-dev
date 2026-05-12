import db from "db"

export const metadata = { title: "Admin" }

export default async function AdminPage() {
  const counts = await db.paper.groupBy({ by: ["status"], _count: { _all: true } })
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))
  const pendingExtraction = await db.paper.count({
    where: { status: "ACCEPTED", extraction: null },
  })

  const cards = [
    {
      href: "/admin/review",
      label: "Review Queue",
      desc: "Papers flagged by the prediction model",
      badge: byStatus.PENDING_REVIEW ?? 0,
    },
    {
      href: "/admin/extract",
      label: "Extraction",
      desc: "Extract metadata from accepted papers",
      badge: pendingExtraction,
    },
    {
      href: "/admin/excluded",
      label: "Excluded",
      desc: "Papers rejected or added to training",
      badge: null,
    },
    {
      href: "/admin/stats",
      label: "Pipeline Stats",
      desc: "Model performance and validation metrics",
      badge: null,
    },
    {
      href: "/admin/users",
      label: "Users",
      desc: "View and manage user accounts",
      badge: null,
    },
  ]

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
      <p className="text-base-content/60 mb-8">Manage the curation pipeline and site.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <a
            key={c.href}
            href={c.href}
            className="card card-bordered bg-base-200 hover:bg-base-300 transition-colors"
          >
            <div className="card-body">
              <div className="flex items-center justify-between">
                <h2 className="card-title">{c.label}</h2>
                {c.badge != null && c.badge > 0 && (
                  <span className="badge badge-warning">{c.badge}</span>
                )}
              </div>
              <p className="text-base-content/60 text-sm">{c.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </>
  )
}

import db from "db"
import { PipelineButton } from "./PipelineButton"

export const metadata = { title: "Admin" }

export default async function AdminPage() {
  const [counts, extractionNew, extractionNoPdf, pendingMetadata, openReports, lastRun, activeRun, openSuggestions] =
    await Promise.all([
      db.paper.groupBy({ by: ["status"], _count: { _all: true } }),
      db.paper.count({ where: { status: "ACCEPTED", extraction: null, pdfUrl: { not: null } } }),
      db.paper.count({
        where: {
          status: "ACCEPTED",
          OR: [
            { extraction: { is: null }, pdfUrl: null },
            { extraction: { needsReview: true, confidence: null } },
          ],
        },
      }),
      db.paperExtraction.count({ where: { verifiedAt: null, paper: { status: "ACCEPTED" } } }),
      db.paperReport.count({ where: { resolved: false } }),
      db.pipelineRun.findFirst({ where: { status: "DONE" }, orderBy: { finishedAt: "desc" } }),
      db.pipelineRun.findFirst({ where: { status: "RUNNING" }, orderBy: { createdAt: "desc" } }),
      db.articleSuggestion.count({ where: { resolved: false } }),
    ])
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))

  const lastRanLabel = lastRun?.finishedAt
    ? lastRun.finishedAt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null

  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
  const ranRecently =
    !!lastRun?.finishedAt && Date.now() - lastRun.finishedAt.getTime() < ONE_WEEK_MS

  const pendingReview = byStatus.PENDING_REVIEW ?? 0

  const cards = [
    {
      href: "/admin/metadata",
      label: "Metadata Review",
      desc: "Edit, verify, and approve extracted metadata",
      badge: pendingMetadata,
    },
    {
      href: "/admin/reports",
      label: "Reports",
      desc: "Papers flagged by users as incorrectly classified",
      badge: openReports,
    },
    {
      href: "/admin/suggestions",
      label: "Article Suggestions",
      desc: "Papers suggested by users that aren't in the database yet",
      badge: openSuggestions,
    },
    {
      href: "/admin/duplicates",
      label: "Duplicates",
      desc: "Find and merge duplicate paper entries (e.g. preprint + published version)",
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
        {/* Step 1: Fetch + Predict */}
        <div className="card card-bordered bg-base-200">
          <div className="card-body gap-3">
            <h2 className="card-title">Fetch + Predict</h2>
            <p className="text-base-content/60 text-sm">
              Pull new papers from OpenAlex and score them with the model. Run if the review queue
              is empty or to fetch new papers. The queue is automatically run once a month. The
              process can be slow, so check back later to see results. You can only run this once a
              week.
            </p>
            <div className="flex items-center justify-between">
              <PipelineButton
                activeRunId={activeRun?.id ?? null}
                activeStep={activeRun?.step ?? null}
                ranRecently={ranRecently}
              />
              {lastRanLabel ? (
                <span className="text-base-content/40 text-xs">Last ran {lastRanLabel}</span>
              ) : (
                <span className="text-base-content/40 text-xs">Never run</span>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Review */}
        <a
          href="/admin/review"
          className="card card-bordered bg-base-200 hover:bg-base-300 transition-colors"
        >
          <div className="card-body gap-3">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Review</h2>
              {pendingReview > 0 && <span className="badge badge-warning">{pendingReview}</span>}
            </div>
            <p className="text-base-content/60 text-sm">
              For each paper, decide: should it go into the model or not? Accept relevant papers and
              exclude the rest.
            </p>
          </div>
        </a>

        {/* Extraction card with two bucket counts */}
        <a
          href="/admin/extract"
          className="card card-bordered bg-base-200 hover:bg-base-300 transition-colors"
        >
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Extraction</h2>
              <div className="flex gap-1.5">
                {extractionNew > 0 && (
                  <span className="badge badge-warning">{extractionNew} new</span>
                )}
                {extractionNoPdf > 0 && (
                  <span className="badge badge-ghost">{extractionNoPdf} no PDF</span>
                )}
              </div>
            </div>
            <p className="text-base-content/60 text-sm">Extract metadata from accepted papers</p>
          </div>
        </a>

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

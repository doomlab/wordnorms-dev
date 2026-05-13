import { notFound } from "next/navigation"
import { Navbar } from "../../components/Navbar"
import { ReportButton } from "../../components/ReportButton"
import { getBlitzContext } from "../../blitz-server"
import db from "db"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await db.paper.findUnique({ where: { id: Number(id) }, select: { title: true } })
  return { title: paper ? `${paper.title} – WordNorms` : "Excluded Paper – WordNorms" }
}

export default async function ExcludedDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const ctx = await getBlitzContext()
  const userId = ctx.session.userId as number | undefined

  const paper = await db.paper.findUnique({
    where: { id: Number(id), status: "EXCLUDED" },
    include: { reviewedBy: { select: { name: true } } },
  })

  if (!paper) notFound()

  const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : null

  const isReported = userId
    ? await db.paperReport
        .findUnique({ where: { userId_paperId: { userId, paperId: paper.id } } })
        .then(Boolean)
    : false

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="w-full px-10 py-10">
        <a
          href={from === "excluded" ? "/excluded" : "/excluded"}
          className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
        >
          ← Back to excluded papers
        </a>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold leading-snug mb-2">{paper.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge badge-error badge-sm">Excluded</span>
              {paper.reviewedBy?.name ? (
                <span className="badge badge-ghost badge-sm text-base-content/50">
                  Reviewed by {paper.reviewedBy.name}
                </span>
              ) : (
                <span className="badge badge-ghost badge-sm text-base-content/40">
                  Not yet reviewed
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 pt-1">
            <ReportButton paperId={paper.id} initialReported={isReported} />
          </div>
        </div>

        {(doiUrl || paper.pdfUrl) && (
          <div className="flex flex-wrap gap-2 mb-8">
            {doiUrl && (
              <a
                href={doiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                View DOI
              </a>
            )}
            {paper.pdfUrl != null && (
              <a
                href={paper.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                View PDF
              </a>
            )}
          </div>
        )}

        <div className="divide-y divide-base-200 text-sm">
          <Section title="Publication">
            <Row
              label="Authors"
              value={paper.authors.length ? paper.authors.join(", ") : undefined}
            />
            <Row label="Year" value={paper.year?.toString()} />
            <Row label="Journal" value={paper.journal ?? undefined} italic />
            {paper.doi && (
              <div className="flex gap-3 py-1.5">
                <span className="w-36 shrink-0 font-medium text-base-content/70">DOI</span>
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary break-all"
                >
                  {paper.doi}
                </a>
              </div>
            )}
          </Section>

          {paper.abstract && (
            <Section title="Abstract">
              <p className="text-base-content/70 leading-relaxed">{paper.abstract}</p>
            </Section>
          )}

          {paper.reviewNote && (
            <Section title="Exclusion reason">
              <p className="text-base-content/70 leading-relaxed">{paper.reviewNote}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/40 mb-3">
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  italic,
}: {
  label: string
  value: string | undefined
  italic?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-1.5">
      <span className="w-36 shrink-0 font-medium text-base-content/70">{label}</span>
      <span className={`text-base-content/80 ${italic ? "italic" : ""}`}>{value}</span>
    </div>
  )
}

import { notFound } from "next/navigation"
import { Navbar } from "../../components/Navbar"
import { FavoriteButton } from "../../components/FavoriteButton"
import { ReportButton } from "../../components/ReportButton"
import { getBlitzContext } from "../../blitz-server"
import db from "db"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await db.paper.findUnique({ where: { id: Number(id) }, select: { title: true } })
  return { title: paper ? `${paper.title} – WordNorms` : "Norm Set – WordNorms" }
}

export default async function NormDetailPage({
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
    where: { id: Number(id), status: { in: ["ACCEPTED", "ADDED_TO_TRAINING"] } },
    include: { extraction: true },
  })

  if (!paper) notFound()

  const ext = paper.extraction
  const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : null

  const [isFavorited, isReported] = await Promise.all([
    userId
      ? db.userFavorite
          .findUnique({ where: { userId_paperId: { userId, paperId: paper.id } } })
          .then(Boolean)
      : false,
    userId
      ? db.paperReport
          .findUnique({ where: { userId_paperId: { userId, paperId: paper.id } } })
          .then(Boolean)
      : false,
  ])

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="w-full px-10 py-10">
        <a
          href={from === "favorites" ? "/favorites" : "/"}
          className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
        >
          {from === "favorites" ? "← Back to favorites" : "← Back to browse"}
        </a>

        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold leading-snug">{paper.title}</h1>
          <div className="flex items-center gap-1 shrink-0 pt-1">
            <ReportButton paperId={paper.id} initialReported={isReported} />
            <FavoriteButton paperId={paper.id} initialFavorited={isFavorited} />
          </div>
        </div>

        {/* Links */}
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
          {/* Paper metadata */}
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

          {ext && (
            <Section title="Extracted information">
              <Row
                label="Language"
                value={ext.language.length ? ext.language.join(", ") : undefined}
              />
              <Row
                label="Norms collected"
                value={ext.normsCollected.length ? ext.normsCollected.join(", ") : undefined}
              />
              <Row
                label="Stimuli type"
                value={ext.stimuliType.length ? ext.stimuliType.join(", ") : undefined}
              />
              <Row
                label="Stimuli count"
                value={ext.stimuliCount != null ? ext.stimuliCount.toLocaleString() : undefined}
              />
              <Row label="Participant type" value={ext.participantType ?? undefined} />
              <Row
                label="Participant count"
                value={
                  ext.participantCount != null ? ext.participantCount.toLocaleString() : undefined
                }
              />
              {ext.instructions && (
                <div className="py-1.5">
                  <span className="font-medium text-base-content/70 block mb-1">Instructions</span>
                  <p className="text-base-content/70 leading-relaxed">{ext.instructions}</p>
                </div>
              )}
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

import { notFound } from "next/navigation"
import { Navbar } from "../../components/Navbar"
import { FavoriteButton } from "../../components/FavoriteButton"
import { ReportButton } from "../../components/ReportButton"
import { SuggestExtractionEdits } from "../../components/SuggestExtractionEdits"
import { getBlitzContext } from "../../blitz-server"
import db from "db"

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

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
    include: {
      extraction: true,
      reviewedBy: { select: { name: true } },
      extractionEdits: {
        select: {
          createdAt: true,
          resolved: true,
          note: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!paper) notFound()

  const ext = paper.extraction
  const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : null
  const isAiExtracted = ext && ["groq", "ollama"].includes(ext.extractedBy ?? "")

  const [isFavorited, isReported, hasPriorSuggestion] = await Promise.all([
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
    userId
      ? db.extractionEditSuggestion
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
          <div>
            <h1 className="text-2xl font-bold leading-snug mb-1">{capFirst(paper.title)}</h1>
            {ext?.needsReview && (
              <span className="badge badge-warning badge-sm">
                extraction unverified — data may be incomplete
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            <ReportButton paperId={paper.id} initialReported={isReported} isLoggedIn={!!userId} />
            <FavoriteButton paperId={paper.id} initialFavorited={isFavorited} isLoggedIn={!!userId} />
          </div>
        </div>

        {/* Links */}
        {(doiUrl || paper.pdfUrl || paper.url) && (
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
            {paper.url != null && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                Visit Website
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
            {paper.url && (
              <div className="flex gap-3 py-1.5">
                <span className="w-36 shrink-0 font-medium text-base-content/70">Website</span>
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary break-all"
                >
                  {paper.url}
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
            <div className="py-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
                    Extracted information
                  </h2>
                  {isAiExtracted && !paper.reviewedBy ? (
                    <span className="badge badge-ghost badge-sm text-base-content/40">
                      AI extracted
                    </span>
                  ) : paper.reviewedBy?.name ? (
                    <span className="badge badge-ghost badge-sm text-base-content/50">
                      Reviewed by {paper.reviewedBy.name}
                    </span>
                  ) : null}
                </div>
                <SuggestExtractionEdits
                  paperId={paper.id}
                  ext={ext}
                  hasPriorSuggestion={hasPriorSuggestion}
                  isLoggedIn={!!userId}
                />
              </div>

              <div className="space-y-0.5">
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
                    ext.participantCount != null
                      ? ext.participantCount.toLocaleString()
                      : undefined
                  }
                />
                {ext.instructions && (
                  <div className="py-1.5">
                    <span className="font-medium text-base-content/70 block mb-1">
                      Instructions
                    </span>
                    <p className="text-base-content/70 leading-relaxed">{ext.instructions}</p>
                  </div>
                )}
              </div>

              {/* Edit history */}
              <div className="mt-5 pt-4 border-t border-base-200 space-y-2">
                <HistoryEvent
                  label={`Extracted by ${ext.extractedBy ?? "AI"}`}
                  date={ext.extractedAt}
                />
                {paper.extractionEdits.map((edit, i) => (
                  <HistoryEvent
                    key={i}
                    label={`${edit.user.name ?? "A user"} suggested edits${edit.note ? ` — "${edit.note}"` : ""}`}
                    date={edit.createdAt}
                    resolved={edit.resolved}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryEvent({
  label,
  date,
  resolved,
}: {
  label: string
  date: Date
  resolved?: boolean
}) {
  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  return (
    <div className="flex items-baseline gap-2 text-xs text-base-content/40">
      <span className="shrink-0">·</span>
      <span>{label}</span>
      <span className="shrink-0">{formatted}</span>
      {resolved === true && (
        <span className="badge badge-success badge-xs">applied</span>
      )}
      {resolved === false && (
        <span className="badge badge-ghost badge-xs">pending</span>
      )}
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

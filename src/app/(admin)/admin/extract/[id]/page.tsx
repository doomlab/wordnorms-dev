import { notFound } from "next/navigation"
import db from "db"
import { getBlitzContext } from "../../../../blitz-server"
import { ExtractionActions } from "../ExtractionActions"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await db.paper.findUnique({ where: { id: Number(id) }, select: { title: true } })
  return { title: paper ? `${paper.title} – Extract` : "Extract – Admin" }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default async function AdminExtractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const ctx = await getBlitzContext()

  const [paper, admin] = await Promise.all([
    db.paper.findUnique({
      where: { id: Number(id), status: "ACCEPTED" },
      include: { extraction: true },
    }),
    db.user.findUnique({
      where: { id: ctx.session.userId as number },
      select: { groqApiKey: true },
    }),
  ])

  if (!paper) notFound()
  const hasGroqKey = !!admin?.groqApiKey

  const state: "new" | "no-pdf" | "needs-review" =
    paper.extraction
      ? paper.extraction.needsReview && paper.extraction.confidence == null
        ? "no-pdf"
        : paper.extraction.needsReview
        ? "needs-review"
        : "needs-review"
      : paper.pdfUrl
      ? "new"
      : "no-pdf"

  const backHref = from ? `/admin/extract?tab=${from}` : "/admin/extract"

  return (
    <>
      <a
        href={backHref}
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back to extraction
      </a>

      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold leading-snug">{cap(paper.title)}</h1>
        {paper.modelScore != null && (
          <span className="badge badge-outline shrink-0 mt-1">
            Score {paper.modelScore.toFixed(2)}
          </span>
        )}
      </div>

      {(paper.doi || paper.pdfUrl) && (
        <div className="flex flex-wrap gap-2 mb-8">
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
            >
              View DOI
            </a>
          )}
          {paper.pdfUrl && (
            <a
              href={paper.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
            >
              View PDF
            </a>
          )}
        </div>
      )}

      <div className="divide-y divide-base-200 text-sm mb-10">
        <Section title="Publication">
          <Row label="Authors" value={paper.authors.join(", ") || undefined} />
          <Row label="Year" value={paper.year?.toString()} />
          <Row label="Journal" value={paper.journal ?? undefined} italic />
          <Row label="DOI" value={paper.doi ?? undefined} />
        </Section>

        {paper.abstract && (
          <Section title="Abstract">
            <p className="text-base-content/70 leading-relaxed">{paper.abstract}</p>
          </Section>
        )}

        {paper.extraction && (
          <Section title="Extracted Data">
            <Row label="Language" value={paper.extraction.language?.join(", ") || undefined} />
            <Row label="Participants" value={paper.extraction.participantCount?.toString()} />
            <Row label="Participant type" value={paper.extraction.participantType ?? undefined} />
            <Row label="Stimuli type" value={paper.extraction.stimuliType?.join(", ") || undefined} />
            <Row label="Stimuli count" value={paper.extraction.stimuliCount?.toString()} />
            <Row label="Norms collected" value={paper.extraction.normsCollected?.join(", ") || undefined} />
            <Row label="Instructions" value={paper.extraction.instructions ?? undefined} />
            {paper.extraction.confidence != null && (
              <div className="flex gap-3 py-1.5">
                <span className="w-36 shrink-0 font-medium text-base-content/70">Confidence</span>
                <span className={paper.extraction.confidence < 0.6 ? "text-warning" : "text-success"}>
                  {(paper.extraction.confidence * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </Section>
        )}
      </div>

      <div className="border-t border-base-200 pt-8 text-center">
        <ExtractionActions paperId={paper.id} state={state} hasGroqKey={hasGroqKey} />
      </div>
    </>
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

function Row({ label, value, italic }: { label: string; value: string | undefined; italic?: boolean }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-1.5">
      <span className="w-36 shrink-0 font-medium text-base-content/70">{label}</span>
      <span className={`text-base-content/80 ${italic ? "italic" : ""}`}>{value}</span>
    </div>
  )
}

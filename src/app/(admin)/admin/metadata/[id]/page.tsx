import { notFound } from "next/navigation"
import db from "db"
import { MetadataActions } from "../MetadataActions"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await db.paper.findUnique({ where: { id: Number(id) }, select: { title: true } })
  return { title: paper ? `${paper.title} – Metadata Review` : "Metadata Review – Admin" }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default async function AdminMetadataDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const paper = await db.paper.findUnique({
    where: { id: Number(id), status: "ACCEPTED", extraction: { isNot: null, verifiedAt: null } },
    include: { extraction: true },
  })

  if (!paper) notFound()

  const ext = paper.extraction!

  return (
    <>
      <a
        href="/admin/metadata"
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back to metadata review
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

        <Section title="Extracted Metadata">
          <Row label="Language" value={ext.language?.join(", ") || undefined} />
          <Row label="Participants" value={ext.participantCount?.toString()} />
          <Row label="Participant type" value={ext.participantType ?? undefined} />
          <Row label="Stimuli type" value={ext.stimuliType?.join(", ") || undefined} />
          <Row label="Stimuli count" value={ext.stimuliCount?.toString()} />
          <Row label="Norms collected" value={ext.normsCollected?.join(", ") || undefined} />
          <Row label="Instructions" value={ext.instructions ?? undefined} />
          {ext.confidence != null && (
            <div className="flex gap-3 py-1.5">
              <span className="w-36 shrink-0 font-medium text-base-content/70">Confidence</span>
              <span className={ext.confidence < 0.6 ? "text-warning" : "text-success"}>
                {(ext.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
          <Row label="Extracted by" value={ext.extractedBy ?? undefined} />
        </Section>
      </div>

      <div className="border-t border-base-200 pt-8 text-center">
        <p className="text-sm text-base-content/60 mb-3">Does this metadata look correct?</p>
        <MetadataActions paperId={paper.id} />
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

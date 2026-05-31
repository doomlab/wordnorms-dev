import { notFound } from "next/navigation"
import db from "db"
import { MetadataForm } from "../MetadataForm"

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
    where: { id: Number(id), status: "ACCEPTED", extraction: { is: { verifiedAt: null } } },
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

      <h1 className="text-2xl font-bold leading-snug mb-6">{cap(paper.title)}</h1>

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
          <MetadataForm
            paperId={paper.id}
            extraction={{
              language: ext.language,
              participantCount: ext.participantCount,
              participantType: ext.participantType,
              participantLevelData: ext.participantLevelData,
              stimuliType: ext.stimuliType,
              stimuliCount: ext.stimuliCount,
              normsCollected: ext.normsCollected,
              instructions: ext.instructions,
              licenseUrl: ext.licenseUrl,
              dataSource: ext.dataSource,
              reliabilities: (ext.reliabilities ?? []) as { norm: string; value: number | null; metric: string | null }[],
              confidence: ext.confidence,
              extractedBy: ext.extractedBy,
            }}
          />
        </Section>
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

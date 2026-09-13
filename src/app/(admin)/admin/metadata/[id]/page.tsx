import { notFound } from "next/navigation"
import db from "db"
import { MetadataForm } from "../MetadataForm"
import { PaperMetadataForm } from "../../papers/[id]/PaperMetadataForm"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await db.paper.findUnique({ where: { id: Number(id) }, select: { title: true } })
  return { title: paper ? `${paper.title} – Metadata Review` : "Metadata Review – Admin" }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default async function AdminMetadataDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const backHref = from === "updated" ? "/admin/metadata?view=updated" : "/admin/metadata"
  const paper = await db.paper.findUnique({
    where: { id: Number(id), status: "ACCEPTED" },
    include: { extraction: true },
  })

  if (!paper) notFound()

  const ext = paper.extraction!

  return (
    <>
      <a
        href={backHref}
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
          <PaperMetadataForm
            paper={{
              id: paper.id,
              title: paper.title,
              authors: paper.authors,
              year: paper.year,
              doi: paper.doi,
              journal: paper.journal,
              abstract: paper.abstract,
              pdfUrl: paper.pdfUrl,
              openAlexId: paper.openAlexId,
              authorMeta: Array.isArray(paper.authorMeta)
                ? (paper.authorMeta as unknown as { name: string; orcid: string | null; openAlexId: string | null }[])
                : null,
            }}
            backHref={backHref}
          />
        </Section>

        <Section
          title="Extracted Metadata"
          headerRight={
            <a
              href={`/admin/import-extractions?paperId=${paper.id}&from=/admin/metadata/${paper.id}`}
              className="btn btn-outline btn-xs"
            >
              Import LLM extraction →
            </a>
          }
        >
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
              dataUrl: ext.dataUrl,
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

function Section({
  title,
  headerRight,
  children,
}: {
  title: string
  headerRight?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
          {title}
        </h2>
        {headerRight}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

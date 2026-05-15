import { notFound } from "next/navigation"
import db from "db"
import { UnmergeButton } from "../UnmergeButton"
import { TransferExtractionPanel } from "../TransferExtractionPanel"
import { StatusBadge } from "src/app/components/StatusBadge"
import type { PaperExtraction } from "@prisma/client"

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await db.paper.findUnique({ where: { id: Number(id) }, select: { title: true } })
  return { title: paper ? `Merge Review – Admin` : "Duplicates – Admin" }
}

export default async function DuplicateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const duplicate = await db.paper.findUnique({
    where: { id: Number(id) },
    include: {
      extraction: true,
      canonical: {
        include: {
          extraction: true,
          duplicates: { select: { id: true } },
        },
      },
    },
  })

  if (!duplicate || !duplicate.canonical) notFound()

  const canonical = duplicate.canonical

  return (
    <>
      <a
        href="/admin/duplicates?tab=merged"
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back to merged
      </a>

      <h1 className="text-3xl font-bold mb-2">Merge Review</h1>
      <p className="text-base-content/60 mb-8 text-sm">
        Verify this merge is correct. The canonical paper is the one that will appear in the
        database; the duplicate points to it and is hidden from public views.
      </p>

      <div className="grid grid-cols-2 gap-6 mb-10">
        <PaperCard paper={duplicate} extraction={duplicate.extraction} role="duplicate" />
        <PaperCard paper={canonical} extraction={canonical.extraction} role="canonical" />
      </div>

      {duplicate.extraction && (
        <TransferExtractionPanel
          fromPaperId={duplicate.id}
          toPaperId={canonical.id}
          duplicate={duplicate.extraction}
          canonical={canonical.extraction}
        />
      )}

      <div className="border-t border-base-200 pt-8 text-center">
        <p className="text-sm text-base-content/60 mb-4">
          If this merge is incorrect, undo it to restore both papers as independent entries.
        </p>
        <UnmergeButton paperId={duplicate.id} redirectTo="/admin/duplicates?tab=merged" />
      </div>
    </>
  )
}

type PaperShape = {
  id: number
  title: string
  authors: string[]
  year: number | null
  doi: string | null
  journal: string | null
  abstract: string | null
  status: string
  openAlexId: string | null
  pdfUrl: string | null
}

function PaperCard({
  paper,
  extraction,
  role,
}: {
  paper: PaperShape
  extraction: PaperExtraction | null
  role: "canonical" | "duplicate"
}) {
  const isCanonical = role === "canonical"

  return (
    <div className={`card card-bordered ${isCanonical ? "border-primary/40" : ""} bg-base-100`}>
      <div className="card-body gap-0 divide-y divide-base-200">
        {/* Header */}
        <div className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={`badge badge-sm ${isCanonical ? "badge-primary" : "badge-warning"}`}>
              {isCanonical ? "canonical" : "duplicate"}
            </span>
            <span className="font-mono text-xs text-base-content/40">#{paper.id}</span>
          </div>
          <h2 className="font-semibold leading-snug">{cap(paper.title)}</h2>
        </div>

        {/* Publication */}
        <div className="py-4 space-y-1 text-sm">
          <SectionLabel>Publication</SectionLabel>
          <Row label="Authors">
            {paper.authors.length > 0
              ? paper.authors.slice(0, 3).join(", ") + (paper.authors.length > 3 ? " et al." : "")
              : null}
          </Row>
          <Row label="Year">{paper.year?.toString() ?? null}</Row>
          <Row label="Journal" italic>{paper.journal}</Row>
          <Row label="DOI">
            {paper.doi ? (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noreferrer"
                className="link link-primary font-mono"
              >
                {paper.doi}
              </a>
            ) : (
              <span className="text-base-content/30">none</span>
            )}
          </Row>
          <Row label="OpenAlex">
            {paper.openAlexId ? (
              <span className="font-mono text-xs">{paper.openAlexId}</span>
            ) : null}
          </Row>
          <Row label="Status">
            <StatusBadge status={paper.status} size="xs" />
          </Row>
          {paper.pdfUrl && (
            <div className="pt-1">
              <a href={paper.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-xs">
                View PDF
              </a>
            </div>
          )}
        </div>

        {/* Abstract */}
        {paper.abstract && (
          <div className="py-4">
            <SectionLabel>Abstract</SectionLabel>
            <p className="text-xs text-base-content/60 leading-relaxed mt-1">{paper.abstract}</p>
          </div>
        )}

        {/* Extraction */}
        <div className="py-4 space-y-1 text-sm">
          <SectionLabel>Extracted Metadata</SectionLabel>
          {extraction ? (
            <>
              <Row label="Language">{extraction.language.join(", ") || null}</Row>
              <Row label="Participants">{extraction.participantCount?.toString() ?? null}</Row>
              <Row label="Participant type">{extraction.participantType}</Row>
              <Row label="Stimuli type">{extraction.stimuliType.join(", ") || null}</Row>
              <Row label="Stimuli count">{extraction.stimuliCount?.toString() ?? null}</Row>
              <Row label="Norms collected">{extraction.normsCollected.join(", ") || null}</Row>
              {extraction.instructions && (
                <div className="flex gap-3 py-1">
                  <span className="w-32 shrink-0 text-base-content/60">Instructions</span>
                  <span className="text-base-content/80 text-xs leading-relaxed">
                    {extraction.instructions}
                  </span>
                </div>
              )}
              <Row label="Confidence">
                {extraction.confidence != null ? extraction.confidence.toFixed(2) : null}
              </Row>
              <Row label="Extracted by">{extraction.extractedBy}</Row>
              <Row label="Verified">
                {extraction.verifiedAt ? extraction.verifiedAt.toLocaleDateString() : "no"}
              </Row>
            </>
          ) : (
            <p className="text-xs text-base-content/30 py-1">No extraction data</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-base-content/40 mb-1">
      {children}
    </p>
  )
}

function Row({
  label,
  italic,
  children,
}: {
  label: string
  italic?: boolean
  children: React.ReactNode | null
}) {
  if (!children) return null
  return (
    <div className="flex gap-3 py-0.5">
      <span className="w-32 shrink-0 text-base-content/60">{label}</span>
      <span className={`text-base-content/80 ${italic ? "italic" : ""}`}>{children}</span>
    </div>
  )
}

import { notFound } from "next/navigation"
import db from "db"
import { UnmergeButton } from "../UnmergeButton"

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
    include: { canonical: { include: { duplicates: { select: { id: true } } } } },
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
        <PaperCard paper={duplicate} role="duplicate" />
        <PaperCard paper={canonical} role="canonical" />
      </div>

      <div className="border-t border-base-200 pt-8 text-center">
        <p className="text-sm text-base-content/60 mb-4">
          If this merge is incorrect, undo it to restore both papers as independent entries.
        </p>
        <UnmergeButton paperId={duplicate.id} redirectTo="/admin/duplicates?tab=merged" />
      </div>
    </>
  )
}

function PaperCard({
  paper,
  role,
}: {
  paper: {
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
  role: "canonical" | "duplicate"
}) {
  const isCanonical = role === "canonical"

  return (
    <div className={`card card-bordered ${isCanonical ? "bg-base-100 border-primary/40" : "bg-base-100"}`}>
      <div className="card-body gap-2">
        <div className="flex items-center justify-between">
          <span
            className={`badge badge-sm ${isCanonical ? "badge-primary" : "badge-warning"}`}
          >
            {isCanonical ? "canonical" : "duplicate"}
          </span>
          <span className="font-mono text-xs text-base-content/40">#{paper.id}</span>
        </div>

        <h2 className="font-semibold leading-snug mt-1">{cap(paper.title)}</h2>

        <div className="text-sm text-base-content/70 space-y-1 mt-1">
          {paper.authors.length > 0 && (
            <p>
              {paper.authors.slice(0, 3).join(", ")}
              {paper.authors.length > 3 ? " et al." : ""}
            </p>
          )}
          {paper.year && <p>{paper.year}</p>}
          {paper.journal && <p className="italic">{paper.journal}</p>}
          {paper.doi ? (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noreferrer"
              className="link link-primary font-mono text-xs block"
            >
              {paper.doi}
            </a>
          ) : (
            <p className="text-base-content/30 text-xs">No DOI</p>
          )}
          {paper.openAlexId && (
            <p className="font-mono text-xs text-base-content/40">{paper.openAlexId}</p>
          )}
        </div>

        {paper.abstract && (
          <p className="text-xs text-base-content/50 line-clamp-4 mt-2 leading-relaxed">
            {paper.abstract}
          </p>
        )}

        <div className="mt-2 flex gap-2 flex-wrap">
          <span className="badge badge-ghost badge-xs">{paper.status}</span>
          {paper.pdfUrl && (
            <a
              href={paper.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="badge badge-ghost badge-xs link"
            >
              PDF
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

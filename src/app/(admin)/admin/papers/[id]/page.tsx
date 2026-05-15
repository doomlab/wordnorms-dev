import { notFound } from "next/navigation"
import db from "db"
import { PaperMetadataForm } from "./PaperMetadataForm"
import { FetchCitationsButton } from "./FetchCitationsButton"
import { StatusBadge } from "src/app/components/StatusBadge"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await db.paper.findUnique({ where: { id: Number(id) }, select: { title: true } })
  return { title: paper ? `Edit Paper – Admin` : "Edit Paper – Admin" }
}

export default async function AdminEditPaperPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams

  const paper = await db.paper.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      title: true,
      authors: true,
      year: true,
      doi: true,
      journal: true,
      abstract: true,
      pdfUrl: true,
      openAlexId: true,
      status: true,
      _count: { select: { citationsFrom: true } },
    },
  })

  if (!paper) notFound()

  const backHref = from ?? `/norms/${paper.id}`

  return (
    <>
      <a
        href={backHref}
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back
      </a>

      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold">Edit Paper</h1>
        <span className="badge badge-ghost btn-outline badge-sm">#{paper.id}</span>
        <StatusBadge status={paper.status} />
      </div>
      <p className="text-base-content/60 mb-8 text-sm">
        Direct edits to bibliographic data. Changes take effect immediately.
      </p>

      {paper.openAlexId && paper._count.citationsFrom === 0 && (
        <div className="mb-6">
          <FetchCitationsButton paperId={paper.id} />
        </div>
      )}

      <PaperMetadataForm paper={paper} backHref={backHref} />
    </>
  )
}

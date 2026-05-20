import { notFound } from "next/navigation"
import db from "db"
import { CitationWorkflow } from "./CitationWorkflow"

export const metadata = { title: "Review Citation – Admin" }

export default async function CitationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { id } = await params
  const { next: nextParam } = await searchParams
  const [nextFirst, ...restNext] = nextParam?.split(",").filter(Boolean) ?? []
  const nextHref = nextFirst
    ? `/admin/citations/${nextFirst}${restNext.length ? `?next=${restNext.join(",")}` : ""}`
    : "/admin/citations"

  const rows = await db.paperCitation.findMany({
    where: { citedOpenAlexId: id },
    include: { citingPaper: { select: { id: true, title: true, year: true } } },
    orderBy: { id: "asc" },
  })

  if (rows.length === 0) notFound()

  const first = rows[0]!
  const reviewed = rows.every((r) => r.reviewed)

  const existingPaper = await db.paper.findUnique({
    where: { openAlexId: id },
    select: { id: true, title: true },
  })

  return (
    <>
      <a
        href="/admin/citations"
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back to citations
      </a>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">
          {first.title ?? <span className="text-base-content/40 italic">No title</span>}
        </h1>
        <div className="flex flex-wrap gap-3 mt-3">
          <a
            href={`https://openalex.org/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
          >
            View on OpenAlex
          </a>
          {first.title && (
            <a
              href={`https://scholar.google.com/scholar?q=${encodeURIComponent(first.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              Google Scholar
            </a>
          )}
        </div>
      </div>

      <CitationWorkflow
        citedOpenAlexId={id}
        title={first.title}
        authors={first.authors}
        year={first.year}
        journal={first.journal}
        reviewed={reviewed}
        citedBy={rows.map((r) => r.citingPaper)}
        existingPaper={existingPaper}
        nextHref={nextHref}
      />
    </>
  )
}

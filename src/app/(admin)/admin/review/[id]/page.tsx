import { notFound } from "next/navigation"
import db from "db"
import { PaperActions } from "../PaperActions"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await db.paper.findUnique({ where: { id: Number(id) }, select: { title: true } })
  return { title: paper ? `${paper.title} – Review` : "Review – Admin" }
}

export default async function AdminReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { id } = await params
  const { next: nextParam } = await searchParams
  const paper = await db.paper.findUnique({
    where: { id: Number(id), status: "PENDING_REVIEW" },
  })

  if (!paper) notFound()

  const [nextFirst, ...restNext] = nextParam?.split(",").filter(Boolean) ?? []
  const nextHref = nextFirst
    ? `/admin/review/${nextFirst}${restNext.length ? `?next=${restNext.join(",")}` : ""}`
    : "/admin/review"

  return (
    <>
      <a
        href="/admin/review"
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back to queue
      </a>

      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold leading-snug">{paper.title}</h1>
        {paper.modelScore != null && (
          <span className="badge badge-outline shrink-0 mt-1">
            Score {paper.modelScore.toFixed(2)}
          </span>
        )}
      </div>

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
        <a
          href={`/admin/papers/${paper.id}?from=/admin/review/${paper.id}`}
          className="btn btn-outline btn-sm"
        >
          Edit paper
        </a>
      </div>

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
      </div>

      <div className="border-t border-base-200 pt-8 text-center">
        <p className="text-sm text-base-content/60 mb-3">Should this paper go into the model?</p>
        <PaperActions paperId={paper.id} nextHref={nextHref} />
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

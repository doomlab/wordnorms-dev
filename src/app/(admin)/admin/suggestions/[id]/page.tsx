import { notFound } from "next/navigation"
import db from "db"
import { SuggestionWorkflow } from "./SuggestionWorkflow"

export const metadata = { title: "Review Suggestion – Admin" }

export default async function AdminSuggestionDetailPage({
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
    ? `/admin/suggestions/${nextFirst}${restNext.length ? `?next=${restNext.join(",")}` : ""}`
    : "/admin/suggestions"
  const suggestion = await db.articleSuggestion.findUnique({
    where: { id: Number(id) },
    include: { user: { select: { name: true, email: true } } },
  })

  if (!suggestion) notFound()

  const existingPaper = suggestion.doi
    ? await db.paper.findUnique({
        where: { doi: suggestion.doi },
        select: { id: true, title: true },
      })
    : null

  return (
    <>
      <a
        href="/admin/suggestions"
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back to suggestions
      </a>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Review suggestion</h1>
        <p className="text-sm text-base-content/50">
          Submitted by {suggestion.user.name ?? suggestion.user.email} on{" "}
          {new Date(suggestion.createdAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {suggestion.note && (
        <div className="alert alert-info mb-6 text-sm">
          <span className="font-medium">Note from submitter:</span> {suggestion.note}
        </div>
      )}

      <SuggestionWorkflow suggestion={suggestion} existingPaper={existingPaper} nextHref={nextHref} />
    </>
  )
}

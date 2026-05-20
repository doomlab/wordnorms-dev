import { notFound } from "next/navigation"
import db from "db"
import { SuggestionReview } from "../SuggestionReview"

export const metadata = { title: "Review Suggestion – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

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
    ? `/admin/reports/suggestions/${nextFirst}${restNext.length ? `?next=${restNext.join(",")}` : ""}`
    : "/admin/reports?tab=metadata"
  const suggestion = await db.extractionEditSuggestion.findUnique({
    where: { id: Number(id), resolved: false },
    include: {
      user: { select: { name: true, email: true } },
      paper: { include: { extraction: true } },
    },
  })

  if (!suggestion) notFound()

  const paper = suggestion.paper
  const ext = paper.extraction

  const current = {
    language: ext?.language ?? [],
    participantCount: ext?.participantCount ?? null,
    participantType: ext?.participantType ?? null,
    stimuliType: ext?.stimuliType ?? [],
    stimuliCount: ext?.stimuliCount ?? null,
    normsCollected: ext?.normsCollected ?? [],
    instructions: ext?.instructions ?? null,
  }

  const suggested = {
    language: suggestion.language,
    participantCount: suggestion.participantCount,
    participantType: suggestion.participantType,
    stimuliType: suggestion.stimuliType,
    stimuliCount: suggestion.stimuliCount,
    normsCollected: suggestion.normsCollected,
    instructions: suggestion.instructions,
  }

  return (
    <>
      <a
        href="/admin/reports?tab=metadata"
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back to metadata reports
      </a>

      <h1 className="text-2xl font-bold leading-snug mb-1">{cap(paper.title)}</h1>
      <p className="text-sm text-base-content/50 mb-6">
        Suggested by {suggestion.user.name ?? suggestion.user.email} on{" "}
        {new Date(suggestion.createdAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      {suggestion.note && (
        <div className="alert alert-info mb-6 text-sm">
          <span className="font-medium">Note:</span> {suggestion.note}
        </div>
      )}

      <SuggestionReview
        suggestionId={suggestion.id}
        paperId={paper.id}
        current={current}
        suggested={suggested}
        nextHref={nextHref}
      />
    </>
  )
}

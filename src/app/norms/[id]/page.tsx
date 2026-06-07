import { notFound } from "next/navigation"
import fs from "fs"
import path from "path"
import { Navbar } from "../../components/Navbar"
import { FavoriteButton } from "../../components/FavoriteButton"
import { ReportButton } from "../../components/ReportButton"
import { SuggestExtractionEdits } from "../../components/SuggestExtractionEdits"
import { getBlitzContext } from "../../blitz-server"
import { CitationCard } from "./CitationCard"
import { CollapsibleSection } from "./CollapsibleSection"
import db from "db"

async function findDatasetCards(
  paperId: number,
  doi: string | null,
  title: string
): Promise<{ bibtex: string; title: string }[]> {
  const p = path.join(process.cwd(), "data", "model-cards", "_data.json")
  if (!fs.existsSync(p)) return []
  try {
    const { cards } = JSON.parse(fs.readFileSync(p, "utf8")) as {
      cards: { bibtex: string; citation: { doi: string | null; title: string } }[]
    }
    const seen = new Set<string>()
    const results: { bibtex: string; title: string }[] = []

    const add = (c: { bibtex: string; citation: { title: string } }) => {
      if (!seen.has(c.bibtex)) {
        seen.add(c.bibtex)
        results.push({ bibtex: c.bibtex, title: c.citation.title })
      }
    }

    // Manual links
    const dbLinks = await db.datasetLink.findMany({ where: { paperId } })
    for (const link of dbLinks) {
      const c = cards.find((c) => c.bibtex === link.bibtex)
      if (c) add(c)
    }

    // All cards sharing this DOI
    if (doi) {
      for (const c of cards) {
        if (c.citation.doi?.toLowerCase() === doi.toLowerCase()) add(c)
      }
    }

    // Title fallback (only if nothing matched yet)
    if (results.length === 0) {
      const normalizeTitle = (t: string) => t.toLowerCase().trim().replace(/\s+/g, " ")
      for (const c of cards) {
        if (normalizeTitle(c.citation.title) === normalizeTitle(title)) add(c)
      }
    }

    return results
  } catch {
    return []
  }
}

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await db.paper.findUnique({ where: { id: Number(id) }, select: { title: true } })
  return { title: paper ? `${paper.title} – WordNorms` : "Norm Set – WordNorms" }
}

export default async function NormDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const ctx = await getBlitzContext()
  const userId = ctx.session.userId as number | undefined
  const role = ctx.session.role

  const paper = await db.paper.findUnique({
    where: { id: Number(id), status: "ACCEPTED" },
    include: {
      extraction: { include: { verifiedBy: { select: { name: true, points: true } } } },
      extractionEdits: {
        select: {
          createdAt: true,
          resolved: true,
          note: true,
          language: true,
          participantCount: true,
          participantType: true,
          stimuliType: true,
          stimuliCount: true,
          normsCollected: true,
          instructions: true,
          participantLevelData: true,
          reliabilities: true,
          user: { select: { name: true, points: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      citationsFrom: {
        select: { citedOpenAlexId: true, title: true, year: true, journal: true },
      },
    },
  })

  if (!paper) notFound()

  const ext = paper.extraction
  // Use the most recent human edit suggestion's values where available, falling back to model extraction
  const latestEdit = paper.extractionEdits.at(-1)
  const displayExt = ext && latestEdit ? {
    ...ext,
    language: latestEdit.language.length ? latestEdit.language : ext.language,
    participantCount: latestEdit.participantCount ?? ext.participantCount,
    participantType: latestEdit.participantType ?? ext.participantType,
    stimuliType: latestEdit.stimuliType.length ? latestEdit.stimuliType : ext.stimuliType,
    stimuliCount: latestEdit.stimuliCount ?? ext.stimuliCount,
    normsCollected: latestEdit.normsCollected.length ? latestEdit.normsCollected : ext.normsCollected,
    instructions: latestEdit.instructions ?? ext.instructions,
    participantLevelData: latestEdit.participantLevelData ?? ext.participantLevelData,
    reliabilities: latestEdit.reliabilities ?? ext.reliabilities,
  } : ext
  const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : null
  const isAiExtracted = ext && ["groq", "ollama"].includes(ext.extractedBy ?? "")
  const linkedDatasets = await findDatasetCards(paper.id, paper.doi, paper.title)

  // Resolve which cited papers are in the DB, following canonical resolution for duplicates
  const citedIds = paper.citationsFrom.map((c) => c.citedOpenAlexId)
  const matchedCitations =
    citedIds.length > 0
      ? await db.paper.findMany({
          where: { openAlexId: { in: citedIds }, status: "ACCEPTED" },
          select: {
            id: true,
            openAlexId: true,
            title: true,
            year: true,
            canonicalPaperId: true,
            canonical: { select: { id: true, title: true, year: true } },
          },
        })
      : []
  // Map each openAlexId to the canonical paper's details (following canonicalPaperId if set)
  const matchedById = new Map(
    matchedCitations.map((p) => {
      const resolved = p.canonical ?? p
      return [p.openAlexId, { id: resolved.id, title: resolved.title, year: resolved.year ?? null }]
    })
  )
  // Build deduplicated list, collapsing multiple duplicate openAlexIds to the same canonical paper
  const seenCanonicalIds = new Set<number>()
  const referencedInDb = paper.citationsFrom
    .filter((c) => matchedById.has(c.citedOpenAlexId))
    .map((c) => matchedById.get(c.citedOpenAlexId)!)
    .filter((resolved) => {
      if (seenCanonicalIds.has(resolved.id)) return false
      seenCanonicalIds.add(resolved.id)
      return true
    })

  const otherCitations = paper.citationsFrom
    .filter((c) => !matchedById.has(c.citedOpenAlexId))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))

  const [citedByInDb, openAlexCitedByCount] = await Promise.all([
    paper.openAlexId
      ? db.paperCitation
          .findMany({
            where: { citedOpenAlexId: paper.openAlexId, citingPaper: { status: "ACCEPTED" } },
            select: { citingPaper: { select: { id: true, title: true, year: true } } },
          })
          .then((rows) => {
            const seen = new Set<number>()
            return rows
              .map((r) => ({ id: r.citingPaper.id, title: r.citingPaper.title, year: r.citingPaper.year ?? null }))
              .filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true })
          })
      : Promise.resolve([] as { id: number; title: string; year: number | null }[]),
    paper.openAlexId
      ? fetch(
          `https://api.openalex.org/works/${encodeURIComponent(paper.openAlexId)}?select=cited_by_count&mailto=buchananlab@gmail.com`,
          { next: { revalidate: 86400 } }
        )
          .then((r) => (r.ok ? (r.json() as Promise<{ cited_by_count?: number }>) : null))
          .then((d) => d?.cited_by_count ?? null)
          .catch(() => null)
      : Promise.resolve(null as number | null),
  ])

  const [isFavorited, isReported, hasPriorSuggestion] = await Promise.all([
    userId
      ? db.userFavorite
          .findUnique({ where: { userId_paperId: { userId, paperId: paper.id } } })
          .then(Boolean)
      : false,
    userId
      ? db.paperReport
          .findUnique({ where: { userId_paperId: { userId, paperId: paper.id } } })
          .then(Boolean)
      : false,
    userId
      ? db.extractionEditSuggestion
          .findUnique({ where: { userId_paperId: { userId, paperId: paper.id } } })
          .then(Boolean)
      : false,
  ])

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="w-full px-10 py-10">
        <a
          href={from === "favorites" ? "/favorites" : "/"}
          className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
        >
          {from === "favorites" ? "← Back to favorites" : "← Back to browse"}
        </a>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold leading-snug mb-1">{capFirst(paper.title)}</h1>

          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            <ReportButton paperId={paper.id} initialReported={isReported} isLoggedIn={!!userId} />
            <FavoriteButton
              paperId={paper.id}
              initialFavorited={isFavorited}
              isLoggedIn={!!userId}
            />
          </div>
        </div>

        {/* Links */}
        {(doiUrl || paper.pdfUrl || linkedDatasets.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-8">
            {doiUrl && (
              <a
                href={doiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                View DOI
              </a>
            )}
            {paper.pdfUrl != null && (
              <a
                href={paper.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                View PDF
              </a>
            )}

            {linkedDatasets.map((ds) => (
              <a
                key={ds.bibtex}
                href={`/datasets/${ds.bibtex}`}
                className="btn btn-outline btn-sm"
              >
                {linkedDatasets.length > 1 ? ds.bibtex : "View Dataset"}
              </a>
            ))}
            {(role === "ADMIN" || role === "SUPER_ADMIN") && (
              <a
                href={`/admin/papers/${paper.id}?from=/norms/${paper.id}`}
                className="btn btn-ghost btn-outline btn-sm"
              >
                Edit paper
              </a>
            )}
          </div>
        )}

        <div className="divide-y divide-base-200 text-sm">
          {/* Paper metadata */}
          <Section title="Publication">
            {paper.authors.length > 0 && (
              <div className="flex gap-3 py-1.5">
                <span className="w-36 shrink-0 font-medium text-base-content/70">Authors</span>
                <span className="text-base-content/80 flex flex-wrap gap-x-3 gap-y-0.5">
                  {(() => {
                    const meta = Array.isArray(paper.authorMeta)
                      ? (paper.authorMeta as { name: string; orcid?: string | null; openAlexId?: string | null }[])
                      : []
                    return paper.authors.map((name, i) => {
                      const m = meta[i]
                      return (
                        <span key={i} className="inline-flex items-center gap-1">
                          {name}
                          {m?.orcid && (
                            <a
                              href={m.orcid}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="ORCID profile"
                              className="inline-flex items-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="w-3.5 h-3.5">
                                <path fill="#A6CE39" d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z"/>
                                <path fill="#fff" d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7C191.7 111.2 178 93 148 93h-23.7v79.4zM88.7 56.8c0 5.5-4.5 10.1-10.1 10.1s-10.1-4.6-10.1-10.1c0-5.6 4.5-10.1 10.1-10.1s10.1 4.5 10.1 10.1z"/>
                              </svg>
                            </a>
                          )}
                          {m?.openAlexId && (
                            <a
                              href={`https://openalex.org/${m.openAlexId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="OpenAlex profile"
                              className="text-[10px] font-semibold text-base-content/40 hover:text-primary leading-none"
                            >
                              OA
                            </a>
                          )}
                        </span>
                      )
                    })
                  })()}
                </span>
              </div>
            )}
            <Row label="Year" value={paper.year?.toString()} />
            <Row label="Journal" value={paper.journal ?? undefined} italic />
            {paper.doi && (
              <div className="flex gap-3 py-1.5">
                <span className="w-36 shrink-0 font-medium text-base-content/70">DOI</span>
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary break-all"
                >
                  {paper.doi}
                </a>
              </div>
            )}
          </Section>

          {paper.abstract && (
            <Section title="Abstract">
              <p className="text-base-content/70 leading-relaxed">{paper.abstract}</p>
            </Section>
          )}

          {displayExt && (
            <>
            <CollapsibleSection
              title="Extracted information"
              subtitle={
                ext?.verifiedAt
                  ? <span className="badge badge-success badge-sm">verified</span>
                  : isAiExtracted
                  ? "AI extracted"
                  : undefined
              }
              headerRight={userId ? (
                  <a
                    href={`/norms/${paper.id}/suggest-edit`}
                    className="btn btn-primary btn-sm text-base-content/50 hover:text-base-content"
                  >
                    {hasPriorSuggestion ? "Edit suggestion submitted ✓" : "Suggest edits"}
                  </a>
                ) : (
                  <div className="tooltip tooltip-left" data-tip="You must have an account to use this feature">
                    <button disabled className="btn btn-primary btn-sm opacity-40 cursor-not-allowed">
                      Suggest edits
                    </button>
                  </div>
                )}
            >

              <div className="space-y-0.5">
                <Row label="Language" value={displayExt.language.length ? displayExt.language.join(", ") : undefined} />
                <Row label="Norms collected" value={displayExt.normsCollected.length ? displayExt.normsCollected.join(", ") : undefined} />
                <Row label="Stimuli type" value={displayExt.stimuliType.length ? displayExt.stimuliType.join(", ") : undefined} />
                <Row label="Stimuli count" value={displayExt.stimuliCount != null ? displayExt.stimuliCount.toLocaleString() : undefined} />
                <Row label="Participant type" value={displayExt.participantType ?? undefined} />
                <Row label="Participant count" value={displayExt.participantCount != null ? displayExt.participantCount.toLocaleString() : undefined} />
                {displayExt.participantLevelData && (
                  <div className="flex gap-3 py-1.5">
                    <span className="w-36 shrink-0 font-medium text-base-content/70">Participant data</span>
                    <span className="text-base-content/80">Raw data available</span>
                  </div>
                )}
                {Array.isArray(displayExt.reliabilities) && (displayExt.reliabilities as { norm: string; value: number | null; metric: string | null }[]).length > 0 && (
                  <div className="flex gap-3 py-1.5">
                    <span className="w-36 shrink-0 font-medium text-base-content/70">Reliabilities</span>
                    <div className="space-y-0.5">
                      {(displayExt.reliabilities as { norm: string; value: number | null; metric: string | null }[]).map((r, i) => (
                        <div key={i} className="text-base-content/80 text-sm">
                          {r.norm}
                          {r.value != null && <span> — {r.value}</span>}
                          {r.metric && <span className="text-base-content/40"> ({r.metric.replace(/_/g, " ")})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {displayExt.dataSource && (
                  <div className="flex gap-3 py-1.5">
                    <span className="w-36 shrink-0 font-medium text-base-content/70">Data source</span>
                    <span className="text-base-content/80">
                      {displayExt.dataSource === "ai" ? "AI generated" : "Human collected"}
                    </span>
                  </div>
                )}
                {displayExt.licenseUrl && (
                  <div className="flex gap-3 py-1.5">
                    <span className="w-36 shrink-0 font-medium text-base-content/70">License</span>
                    <a
                      href={displayExt.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary break-all"
                    >
                      {displayExt.licenseUrl}
                    </a>
                  </div>
                )}
                {displayExt.instructions && (
                  <div className="flex gap-3 py-1.5">
                    <span className="w-36 shrink-0 font-medium text-base-content/70">Instructions</span>
                    <p className="text-base-content/80 leading-relaxed">{displayExt.instructions}</p>
                  </div>
                )}
              </div>

            </CollapsibleSection>

            <CollapsibleSection title="Edits / History" defaultOpen={false}>
              <div className="space-y-2">
                <HistoryEvent
                  label={`Extracted by ${displayExt.extractedBy ?? "AI"}`}
                  date={displayExt.extractedAt}
                />
                {paper.extractionEdits.map((edit, i) => (
                  <HistoryEvent
                    key={i}
                    label={
                      <>
                        {edit.user.name ?? "A user"}
                        {edit.user.points > 0 && (
                          <span className="badge badge-info badge-xs ml-1">{edit.user.points} pts</span>
                        )}
                        {` suggested edits${edit.note ? ` — "${edit.note}"` : ""}`}
                      </>
                    }
                    date={edit.createdAt}
                    resolved={edit.resolved}
                  />
                ))}
                {displayExt.verifiedAt && (
                  <HistoryEvent
                    label={
                      <>
                        {"Verified by "}
                        {displayExt.verifiedBy?.name ?? "admin"}
                        {displayExt.verifiedBy && displayExt.verifiedBy.points > 0 && (
                          <span className="badge badge-info badge-xs ml-1">{displayExt.verifiedBy.points} pts</span>
                        )}
                      </>
                    }
                    date={displayExt.verifiedAt}
                  />
                )}
              </div>
            </CollapsibleSection>
            </>
          )}
          {(citedByInDb.length > 0 || openAlexCitedByCount != null) && (() => {
            const parts: string[] = []
            if (citedByInDb.length > 0) parts.push(`${citedByInDb.length} in WordNorms`)
            if (openAlexCitedByCount != null) parts.push(`${openAlexCitedByCount.toLocaleString()} total`)
            return (
              <CitationCard
                title="Cited by"
                subtitle={parts.join(" · ")}
                papers={citedByInDb}
                emptyMessage="No citing papers are currently in WordNorms"
              />
            )
          })()}
          {(referencedInDb.length > 0 || otherCitations.length > 0) && (
            <CitationCard
              title="References"
              subtitle={
                paper.citationsFrom.length > 0
                  ? `${referencedInDb.length} in WordNorms · ${paper.citationsFrom.length} total`
                  : undefined
              }
              papers={referencedInDb}
              otherRefs={otherCitations}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryEvent({
  label,
  date,
  resolved,
}: {
  label: React.ReactNode
  date: Date
  resolved?: boolean
}) {
  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  return (
    <div className="flex items-baseline gap-2 text-xs text-base-content/40">
      <span className="shrink-0">·</span>
      <span>{label}</span>
      <span className="shrink-0">{formatted}</span>
      {resolved === true && <span className="badge badge-success badge-xs">applied</span>}
      {resolved === false && <span className="badge badge-ghost badge-xs">pending</span>}
    </div>
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

function Row({
  label,
  value,
  italic,
}: {
  label: string
  value: string | undefined
  italic?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-1.5">
      <span className="w-36 shrink-0 font-medium text-base-content/70">{label}</span>
      <span className={`text-base-content/80 ${italic ? "italic" : ""}`}>{value}</span>
    </div>
  )
}

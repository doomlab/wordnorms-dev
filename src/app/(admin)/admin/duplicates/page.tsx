import db from "db"
import { MergeActions } from "./MergeActions"
import { DuplicateResultsTable } from "./DuplicateResultsTable"
import { StatusBadge } from "src/app/components/StatusBadge"

export const metadata = { title: "Duplicates – Admin" }

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type Props = { searchParams: Promise<{ q?: string; a?: string; b?: string; tab?: string; next?: string; from?: string }> }

export default async function AdminDuplicatesPage({ searchParams }: Props) {
  const { q, a, b, tab, next: nextParam, from: fromParam } = await searchParams

  // Compare mode: both IDs provided
  if (a && b) {
    const [paperA, paperB] = await Promise.all([
      db.paper.findUnique({
        where: { id: Number(a) },
        include: { canonical: true, duplicates: true },
      }),
      db.paper.findUnique({
        where: { id: Number(b) },
        include: { canonical: true, duplicates: true },
      }),
    ])

    if (!paperA || !paperB) {
      return (
        <>
          <BackLink fromSuggestions={fromParam === "suggestions"} />
          <p className="text-error">One or both paper IDs not found.</p>
        </>
      )
    }

    // Build href for the next suggestion in the chain
    const [nextFirst, ...restNext] = nextParam?.split(",").filter(Boolean) ?? []
    const nextHref = nextFirst
      ? (() => {
          const [na, nb] = nextFirst.split("_")
          const sp = new URLSearchParams({ a: na, b: nb, from: "suggestions" })
          if (restNext.length) sp.set("next", restNext.join(","))
          return `/admin/duplicates?${sp.toString()}`
        })()
      : fromParam === "suggestions"
        ? "/admin/duplicates?tab=suggestions"
        : undefined

    return (
      <>
        <BackLink fromSuggestions={fromParam === "suggestions"} />
        <h1 className="text-3xl font-bold mb-2">Merge Duplicates</h1>
        <p className="text-base-content/60 mb-8 text-sm">
          Choose which paper is canonical (the one to keep). The other will be marked as a
          duplicate pointing to it. Extraction data transfers automatically if the canonical has
          none.
        </p>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <PaperCard paper={paperA} label="Paper A" />
          <PaperCard paper={paperB} label="Paper B" />
        </div>

        <MergeActions idA={paperA.id} idB={paperB.id} nextHref={nextHref} />
      </>
    )
  }

  const mergedCount = await db.paper.count({ where: { canonicalPaperId: { not: null } } })
  const isMergedTab = tab === "merged"
  const isSuggestionsTab = tab === "suggestions"

  // Merged tab: show all duplicate→canonical relationships
  const mergedPapers = isMergedTab
    ? await db.paper.findMany({
        where: { canonicalPaperId: { not: null } },
        orderBy: { updatedAt: "desc" },
        include: { canonical: { select: { id: true, title: true, doi: true, year: true } } },
      })
    : null

  // Suggestions: same DOI and title-prefix matches
  type PairRow = {
    aid: number; atitle: string; ayear: number | null; astatus: string; adoi: string | null
    bid: number; btitle: string; byear: number | null; bstatus: string; bdoi: string | null
  }

  const [doiPairs, titlePairs] = await Promise.all([
    db.$queryRaw<PairRow[]>`
      SELECT a.id AS aid, a.title AS atitle, a.year AS ayear, a.status AS astatus, a.doi AS adoi,
             b.id AS bid, b.title AS btitle, b.year AS byear, b.status AS bstatus, b.doi AS bdoi
      FROM "Paper" a
      JOIN "Paper" b ON b.id > a.id AND a.doi = b.doi
      WHERE a.doi IS NOT NULL
        AND a."canonicalPaperId" IS NULL
        AND b."canonicalPaperId" IS NULL
      LIMIT 50
    `,
    db.$queryRaw<PairRow[]>`
      WITH normed AS (
        SELECT id, title, year, status, doi,
               lower(left(title, 80)) AS ntitle
        FROM "Paper"
        WHERE "canonicalPaperId" IS NULL AND length(title) > 20
      )
      SELECT a.id AS aid, a.title AS atitle, a.year AS ayear, a.status AS astatus, a.doi AS adoi,
             b.id AS bid, b.title AS btitle, b.year AS byear, b.status AS bstatus, b.doi AS bdoi
      FROM normed a
      JOIN normed b ON b.id > a.id AND a.ntitle = b.ntitle
      WHERE (a.doi IS NULL OR b.doi IS NULL OR a.doi != b.doi)
      LIMIT 50
    `,
  ])
  const suggestionsCount = doiPairs.length + titlePairs.length

  // Search mode
  const results =
    !isMergedTab && !isSuggestionsTab && q && q.trim().length > 1
      ? await db.paper.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { doi: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { canonical: { select: { id: true, title: true } }, duplicates: true },
        })
      : null

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Duplicates</h1>

      <div role="tablist" className="tabs tabs-bordered mb-8">
        <a
          href="/admin/duplicates"
          role="tab"
          className={`tab ${!isMergedTab && !isSuggestionsTab ? "tab-active" : ""}`}
        >
          Search &amp; Merge
        </a>
        <a
          href="/admin/duplicates?tab=suggestions"
          role="tab"
          className={`tab ${isSuggestionsTab ? "tab-active" : ""}`}
        >
          Suggestions
          {suggestionsCount > 0 && (
            <span className="badge badge-neutral badge-sm ml-2">{suggestionsCount}</span>
          )}
        </a>
        <a
          href="/admin/duplicates?tab=merged"
          role="tab"
          className={`tab ${isMergedTab ? "tab-active" : ""}`}
        >
          Merged
          {mergedCount > 0 && (
            <span className="badge badge-neutral badge-sm ml-2">{mergedCount}</span>
          )}
        </a>
      </div>

      {isSuggestionsTab ? (
        <>
          <p className="text-base-content/60 mb-6 text-sm">
            Candidate pairs detected by DOI match or title similarity. Click Compare to review.
          </p>

          {doiPairs.length > 0 && (
            <>
              <h2 className="font-semibold text-sm mb-3 text-base-content/70 uppercase tracking-wide">
                Same DOI ({doiPairs.length})
              </h2>
              <SuggestionTable pairs={doiPairs} />
            </>
          )}

          {titlePairs.length > 0 && (
            <>
              <h2 className={`font-semibold text-sm mb-3 text-base-content/70 uppercase tracking-wide ${doiPairs.length > 0 ? "mt-10" : ""}`}>
                Similar title ({titlePairs.length})
              </h2>
              <SuggestionTable pairs={titlePairs} />
            </>
          )}

          {doiPairs.length === 0 && titlePairs.length === 0 && (
            <p className="text-base-content/40 text-sm text-center py-10">
              No duplicate candidates found.
            </p>
          )}
        </>
      ) : isMergedTab ? (
        <>
          <p className="text-base-content/60 mb-6 text-sm">
            Papers marked as duplicates. Click Undo to restore a paper as independent.
          </p>
          {mergedPapers!.length === 0 ? (
            <p className="text-base-content/40 text-sm text-center py-10">
              No merges recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra text-sm">
                <thead>
                  <tr>
                    <th>Duplicate</th>
                    <th>→ Canonical</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {mergedPapers!.map((p) => (
                    <tr key={p.id}>
                      <td className="max-w-xs">
                        <p className="line-clamp-2 font-medium">{cap(p.title)}</p>
                        <div className="flex gap-3 mt-0.5">
                          <span className="font-mono text-xs text-base-content/40">#{p.id}</span>
                          {p.doi && (
                            <span className="font-mono text-xs text-base-content/40">{p.doi}</span>
                          )}
                          {p.year && (
                            <span className="text-xs text-base-content/40">{p.year}</span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs">
                        <a
                          href={`/admin/duplicates?a=${p.canonical!.id}`}
                          className="line-clamp-2 font-medium link link-hover"
                        >
                          {cap(p.canonical!.title)}
                        </a>
                        <div className="flex gap-3 mt-0.5">
                          <span className="font-mono text-xs text-base-content/40">
                            #{p.canonical!.id}
                          </span>
                          {p.canonical!.doi && (
                            <span className="font-mono text-xs text-base-content/40">
                              {p.canonical!.doi}
                            </span>
                          )}
                          {p.canonical!.year && (
                            <span className="text-xs text-base-content/40">
                              {p.canonical!.year}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <a
                          href={`/admin/duplicates/${p.id}`}
                          className="btn btn-ghost btn-xs"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-base-content/60 mb-6 text-sm">
            Search for papers by title or DOI, then check two to compare and merge.
          </p>

          <form className="flex gap-2 mb-8" method="get">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by title or DOI…"
              className="input input-bordered flex-1"
              autoFocus
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>

          {results === null && (
            <p className="text-base-content/40 text-sm text-center py-10">
              Enter a search term to find papers.
            </p>
          )}

          {results !== null && results.length === 0 && (
            <p className="text-base-content/40 text-sm text-center py-10">No papers found.</p>
          )}

          {results && results.length > 0 && <DuplicateResultsTable papers={results} />}
        </>
      )}
    </>
  )
}

function SuggestionTable({
  pairs,
}: {
  pairs: {
    aid: number; atitle: string; ayear: number | null; astatus: string; adoi: string | null
    bid: number; btitle: string; byear: number | null; bstatus: string; bdoi: string | null
  }[]
}) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="table table-zebra text-sm">
        <thead>
          <tr>
            <th>Paper A</th>
            <th>Paper B</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, idx) => {
            const upcoming = pairs.slice(idx + 1, idx + 11).map((r) => `${r.aid}_${r.bid}`).join(",")
            const href = `/admin/duplicates?a=${p.aid}&b=${p.bid}&from=suggestions${upcoming ? `&next=${upcoming}` : ""}`
            return (
              <tr key={`${p.aid}-${p.bid}`}>
                <td className="max-w-xs align-top">
                  <p className="line-clamp-2 font-medium">{cap(p.atitle)}</p>
                  <div className="flex gap-2 mt-0.5 text-xs text-base-content/40">
                    <span className="font-mono">#{p.aid}</span>
                    {p.ayear && <span>{p.ayear}</span>}
                    {p.adoi && <span className="font-mono">{p.adoi}</span>}
                  </div>
                </td>
                <td className="max-w-xs align-top">
                  <p className="line-clamp-2 font-medium">{cap(p.btitle)}</p>
                  <div className="flex gap-2 mt-0.5 text-xs text-base-content/40">
                    <span className="font-mono">#{p.bid}</span>
                    {p.byear && <span>{p.byear}</span>}
                    {p.bdoi && <span className="font-mono">{p.bdoi}</span>}
                  </div>
                </td>
                <td className="align-top">
                  <a href={href} className="btn btn-outline btn-xs">
                    Compare →
                  </a>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PaperCard({
  paper,
}: {
  paper: {
    id: number
    title: string
    authors: string[]
    year: number | null
    doi: string | null
    journal: string | null
    status: string
    openAlexId: string | null
    canonicalPaperId: number | null
    duplicates: { id: number }[]
  }
  label: string
}) {
  return (
    <div className="card card-bordered bg-base-100">
      <div className="card-body gap-2">
        <span className="font-mono text-xs text-base-content/40">#{paper.id}</span>

        <h2 className="font-semibold leading-snug">{cap(paper.title)}</h2>

        <div className="text-sm text-base-content/70 space-y-0.5 mt-1">
          {paper.authors.length > 0 && (
            <p>
              {paper.authors.slice(0, 3).join(", ")}
              {paper.authors.length > 3 ? " et al." : ""}
            </p>
          )}
          {paper.year && <p>{paper.year}</p>}
          {paper.journal && <p className="italic">{paper.journal}</p>}
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noreferrer"
              className="link link-primary font-mono text-xs block"
            >
              {paper.doi}
            </a>
          )}
          {paper.openAlexId && (
            <p className="font-mono text-xs text-base-content/40">{paper.openAlexId}</p>
          )}
        </div>

        <div className="mt-2">
          <StatusBadge status={paper.status} />
          {paper.canonicalPaperId && (
            <span className="badge badge-warning badge-sm ml-1">already a duplicate</span>
          )}
          {paper.duplicates.length > 0 && (
            <span className="badge badge-info badge-sm ml-1">
              {paper.duplicates.length} merged
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function BackLink({ fromSuggestions }: { fromSuggestions?: boolean }) {
  return (
    <a
      href={fromSuggestions ? "/admin/duplicates?tab=suggestions" : "/admin/duplicates"}
      className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
    >
      {fromSuggestions ? "← Back to suggestions" : "← Back to search"}
    </a>
  )
}

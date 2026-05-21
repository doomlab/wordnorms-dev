import db from "db"
import { MergeActions } from "./MergeActions"
import { DuplicateResultsTable } from "./DuplicateResultsTable"
import { StatusBadge } from "src/app/components/StatusBadge"
import { AutomergeVersionsButton } from "./AutomergeVersionsButton"
import { AutomergeZenodoButton } from "./AutomergeZenodoButton"
import { MergeGroupButton } from "./MergeGroupButton"
import { DismissGroupButton } from "./DismissGroupButton"

export const metadata = { title: "Duplicates – Admin" }

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type Props = { searchParams: Promise<{ q?: string; a?: string; b?: string; tab?: string; next?: string; from?: string }> }

export default async function AdminDuplicatesPage({ searchParams }: Props) {
  const { q, a, b, tab, next: nextParam, from: fromParam } = await searchParams

  const isMergedTab = tab === "merged"
  const isSuggestionsTab = tab === "suggestions"
  const isDismissedTab = tab === "dismissed"

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

  // Merged tab: show all duplicate→canonical relationships
  const mergedPapers = isMergedTab
    ? await db.paper.findMany({
        where: { canonicalPaperId: { not: null } },
        orderBy: { updatedAt: "desc" },
        include: { canonical: { select: { id: true, title: true, doi: true, year: true } } },
      })
    : null

  // Suggestions: group by DOI and title (not pairwise — avoids N*(N-1)/2 explosion)
  type GroupMember = {
    id: number; title: string; year: number | null; status: string; doi: string | null
    authors: string[]; journal: string | null; has_extraction: boolean; groupkey: string
  }

  const [[versionPairsResult], [zenodoGroupsResult]] = await Promise.all([
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::int AS count
      FROM "Paper" v
      JOIN "Paper" c ON c.doi = regexp_replace(v.doi, '[._]v[0-9]+$', '')
      WHERE v.doi ~ '[._]v[0-9]+$'
        AND v.doi != regexp_replace(v.doi, '[._]v[0-9]+$', '')
        AND v."canonicalPaperId" IS NULL
        AND c."canonicalPaperId" IS NULL
    `,
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::int AS count FROM (
        SELECT left(regexp_replace(regexp_replace(lower(title), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'), 80),
               lower(authors[1])
        FROM "Paper"
        WHERE doi ~ '^10\.5281/zenodo\.\d+$'
          AND "canonicalPaperId" IS NULL
          AND array_length(authors, 1) > 0
          AND length(title) > 20
        GROUP BY 1, 2
        HAVING COUNT(*) > 1
      ) sub
    `,
  ])
  const versionPairsCount = Number(versionPairsResult?.count ?? 0)
  const zenodoGroupsCount = Number(zenodoGroupsResult?.count ?? 0)

  type GroupCount = { count: bigint }
  const [doiRows, titleRows, doiGroupCount, titleGroupCount, ignoredGroups] = await Promise.all([
    db.$queryRaw<GroupMember[]>`
      WITH dup_dois AS (
        SELECT doi FROM "Paper"
        WHERE doi IS NOT NULL AND "canonicalPaperId" IS NULL
        GROUP BY doi HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC LIMIT 50
      )
      SELECT p.id, p.title, p.year, p.status::text AS status, p.doi, p.authors, p.journal,
             EXISTS (SELECT 1 FROM "PaperExtraction" pe WHERE pe."paperId" = p.id) AS has_extraction,
             p.doi AS groupkey
      FROM "Paper" p JOIN dup_dois d ON p.doi = d.doi
      WHERE p."canonicalPaperId" IS NULL
      ORDER BY p.doi, p.id
    `,
    db.$queryRaw<GroupMember[]>`
      WITH dup_titles AS (
        SELECT left(regexp_replace(regexp_replace(lower(title), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'), 80) AS ntitle
        FROM "Paper"
        WHERE "canonicalPaperId" IS NULL AND length(title) > 20
        GROUP BY ntitle HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC LIMIT 50
      )
      SELECT p.id, p.title, p.year, p.status::text AS status, p.doi, p.authors, p.journal,
             EXISTS (SELECT 1 FROM "PaperExtraction" pe WHERE pe."paperId" = p.id) AS has_extraction,
             left(regexp_replace(regexp_replace(lower(p.title), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'), 80) AS groupkey
      FROM "Paper" p
      JOIN dup_titles d ON left(regexp_replace(regexp_replace(lower(p.title), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'), 80) = d.ntitle
      WHERE p."canonicalPaperId" IS NULL
      ORDER BY groupkey, p.id
    `,
    db.$queryRaw<[GroupCount]>`
      SELECT COUNT(*)::int AS count FROM (
        SELECT doi FROM "Paper"
        WHERE doi IS NOT NULL AND "canonicalPaperId" IS NULL
        GROUP BY doi HAVING COUNT(*) > 1 LIMIT 50
      ) sub
    `,
    db.$queryRaw<[GroupCount]>`
      SELECT COUNT(*)::int AS count FROM (
        SELECT left(regexp_replace(regexp_replace(lower(title), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'), 80)
        FROM "Paper"
        WHERE "canonicalPaperId" IS NULL AND length(title) > 20
        GROUP BY 1 HAVING COUNT(*) > 1
        LIMIT 50
      ) sub
    `,
    db.duplicateGroupIgnore.findMany({ orderBy: { createdAt: "desc" } }),
  ])

  // Group rows by key, filtering out dismissed groups
  const ignoredDoiKeys = new Set(ignoredGroups.filter(g => g.groupType === "doi").map(g => g.groupKey))
  const ignoredTitleKeys = new Set(ignoredGroups.filter(g => g.groupType === "title").map(g => g.groupKey))

  const groupBy = (rows: GroupMember[]) => {
    const map = new Map<string, GroupMember[]>()
    for (const r of rows) {
      const list = map.get(r.groupkey) ?? []
      list.push(r)
      map.set(r.groupkey, list)
    }
    return [...map.values()]
  }
  const doiGroups = groupBy(doiRows).filter(g => !ignoredDoiKeys.has(g[0]!.groupkey))
  const titleGroups = groupBy(titleRows).filter(g => !ignoredTitleKeys.has(g[0]!.groupkey))
  const suggestionsCount = doiGroups.length + titleGroups.length

  // Search mode
  const results =
    !isMergedTab && !isSuggestionsTab && !isDismissedTab && q && q.trim().length > 1
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

      {versionPairsCount > 0 && (
        <div className="alert mb-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Versioned DOI duplicates detected</p>
            <p className="text-sm text-base-content/60">
              {versionPairsCount} papers with versioned DOIs (e.g. <code>.v18</code>, <code>_v1</code>) have a matching canonical paper. These can be safely auto-merged.
            </p>
          </div>
          <AutomergeVersionsButton count={versionPairsCount} />
        </div>
      )}

      {zenodoGroupsCount > 0 && (
        <div className="alert mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Zenodo version groups detected</p>
            <p className="text-sm text-base-content/60">
              {zenodoGroupsCount} groups of Zenodo papers share the same title and first author. The earliest version (lowest record number) will be kept as canonical.
            </p>
          </div>
          <AutomergeZenodoButton groupCount={zenodoGroupsCount} />
        </div>
      )}

      <div role="tablist" className="tabs tabs-bordered mb-8">
        <a
          href="/admin/duplicates"
          role="tab"
          className={`tab ${!isMergedTab && !isSuggestionsTab && !isDismissedTab ? "tab-active" : ""}`}
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
          href="/admin/duplicates?tab=dismissed"
          role="tab"
          className={`tab ${isDismissedTab ? "tab-active" : ""}`}
        >
          Dismissed
          {ignoredGroups.length > 0 && (
            <span className="badge badge-neutral badge-sm ml-2">{ignoredGroups.length}</span>
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
            Groups of papers sharing a DOI or title. Click <strong>Make canonical</strong> on the one to keep — the rest will be merged into it. Click <strong>Dismiss</strong> to hide a group that is not actually a duplicate.
          </p>

          {doiGroups.length > 0 && (
            <>
              <h2 className="font-semibold text-sm mb-3 text-base-content/70 uppercase tracking-wide">
                Same DOI ({doiGroups.length} groups)
              </h2>
              <GroupTable groups={doiGroups} groupType="doi" />
            </>
          )}

          {titleGroups.length > 0 && (
            <>
              <h2 className={`font-semibold text-sm mb-3 text-base-content/70 uppercase tracking-wide ${doiGroups.length > 0 ? "mt-10" : ""}`}>
                Similar title ({titleGroups.length} groups)
              </h2>
              <GroupTable groups={titleGroups} groupType="title" />
            </>
          )}

          {doiGroups.length === 0 && titleGroups.length === 0 && (
            <p className="text-base-content/40 text-sm text-center py-10">
              No duplicate candidates found.
            </p>
          )}
        </>
      ) : isDismissedTab ? (
        <>
          <p className="text-base-content/60 mb-6 text-sm">
            Groups you dismissed as not being duplicates. Click <strong>Restore</strong> to bring them back to Suggestions.
          </p>
          {ignoredGroups.length === 0 ? (
            <p className="text-base-content/40 text-sm text-center py-10">No dismissed groups.</p>
          ) : (
            <div className="border border-base-300 rounded-lg overflow-hidden divide-y divide-base-200">
              {ignoredGroups.map((g) => (
                <div
                  key={`${g.groupType}:${g.groupKey}`}
                  className="flex items-center justify-between px-4 py-3 text-sm gap-4"
                >
                  <div className="min-w-0">
                    <span className="badge badge-outline badge-xs mr-2">{g.groupType}</span>
                    <span className="font-medium">{cap(g.label)}</span>
                    {g.groupType === "doi" && (
                      <span className="font-mono text-xs text-base-content/40 ml-2">{g.groupKey}</span>
                    )}
                  </div>
                  <DismissGroupButton
                    groupKey={g.groupKey}
                    groupType={g.groupType}
                    label={g.label}
                    isDismissed
                  />
                </div>
              ))}
            </div>
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

type GroupMember = {
  id: number; title: string; year: number | null; status: string; doi: string | null
  authors: string[]; journal: string | null; has_extraction: boolean; groupkey: string
}

function GroupTable({ groups, groupType }: { groups: GroupMember[][], groupType: "doi" | "title" }) {
  return (
    <div className="space-y-4 mb-6">
      {groups.map((members) => {
        const allIds = members.map((m) => m.id)
        const defaultOpen = members.length <= 5
        return (
          <details
            key={members[0]!.groupkey}
            open={defaultOpen}
            className="border border-base-300 rounded-lg overflow-hidden"
          >
            <summary className="bg-base-200 px-4 py-2 cursor-pointer select-none list-none flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wide truncate min-w-0">
                {cap(members[0]!.title)} — {members.length} {members.length === 1 ? "copy" : "copies"}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-base-content/30">▾</span>
                <DismissGroupButton
                  groupKey={members[0]!.groupkey}
                  groupType={groupType}
                  label={members[0]!.title}
                />
              </div>
            </summary>
            <div className="divide-y divide-base-200">
              {members.map((m) => {
                const authorStr = m.authors.length
                  ? m.authors.slice(0, 3).join(", ") + (m.authors.length > 3 ? " et al." : "")
                  : null
                return (
                  <div key={m.id} className="flex items-start gap-4 px-4 py-3 text-sm">
                    <span className="font-mono text-xs text-base-content/40 w-14 shrink-0 pt-0.5">#{m.id}</span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {authorStr && <p className="text-base-content/70 truncate">{authorStr}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-base-content/40">
                        {m.year && <span>{m.year}</span>}
                        {m.journal && <span className="italic truncate max-w-xs">{m.journal}</span>}
                        {m.doi && <span className="font-mono">{m.doi}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={m.status} />
                      {m.has_extraction && (
                        <span className="badge badge-success badge-xs">extracted</span>
                      )}
                      <a
                        href={`/admin/papers/${m.id}?from=/admin/duplicates?tab=suggestions`}
                        className="btn btn-outline btn-xs"
                      >
                        View
                      </a>
                      <MergeGroupButton
                        canonicalId={m.id}
                        duplicateIds={allIds.filter((id) => id !== m.id)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        )
      })}
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

import db from "db"
import { MergeActions } from "./MergeActions"
import { DuplicateResultsTable } from "./DuplicateResultsTable"

export const metadata = { title: "Duplicates – Admin" }

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type Props = { searchParams: Promise<{ q?: string; a?: string; b?: string; tab?: string }> }

export default async function AdminDuplicatesPage({ searchParams }: Props) {
  const { q, a, b, tab } = await searchParams

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
          <BackLink />
          <p className="text-error">One or both paper IDs not found.</p>
        </>
      )
    }

    return (
      <>
        <BackLink />
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

        <MergeActions idA={paperA.id} idB={paperB.id} />
      </>
    )
  }

  const mergedCount = await db.paper.count({ where: { canonicalPaperId: { not: null } } })
  const isMergedTab = tab === "merged"

  // Merged tab: show all duplicate→canonical relationships
  const mergedPapers = isMergedTab
    ? await db.paper.findMany({
        where: { canonicalPaperId: { not: null } },
        orderBy: { updatedAt: "desc" },
        include: { canonical: { select: { id: true, title: true, doi: true, year: true } } },
      })
    : null

  // Search mode
  const results =
    !isMergedTab && q && q.trim().length > 1
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
          className={`tab ${!isMergedTab ? "tab-active" : ""}`}
        >
          Search &amp; Merge
        </a>
        <a
          href="/admin/duplicates?tab=merged"
          role="tab"
          className={`tab ${isMergedTab ? "tab-active" : ""}`}
        >
          Merged
          {mergedCount > 0 && (
            <span className="badge badge-ghost badge-sm ml-2">{mergedCount}</span>
          )}
        </a>
      </div>

      {isMergedTab ? (
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
          <span className="badge badge-ghost badge-sm">{paper.status}</span>
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

function BackLink() {
  return (
    <a
      href="/admin/duplicates"
      className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
    >
      ← Back to search
    </a>
  )
}

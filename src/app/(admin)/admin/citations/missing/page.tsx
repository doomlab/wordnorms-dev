import db from "db"
import { Pagination } from "src/app/components/Pagination"
import { FetchCitationsButton } from "../../papers/[id]/FetchCitationsButton"

export const metadata = { title: "Missing Citations – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const PER_PAGE = 50

export default async function MissingCitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const skip = (page - 1) * PER_PAGE

  const where = {
    status: "ACCEPTED" as const,
    canonicalPaperId: null,
    openAlexId: { not: null },
    citationsFrom: { none: {} },
  }

  const [papers, total] = await Promise.all([
    db.paper.findMany({
      where,
      select: {
        id: true,
        title: true,
        doi: true,
        journal: true,
        year: true,
        citationsFetchedAt: true,
      },
      orderBy: { citationsFetchedAt: { sort: "asc", nulls: "first" } },
      skip,
      take: PER_PAGE,
    }),
    db.paper.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-3xl font-bold">Missing Citations</h1>
        <span className="text-base-content/50 text-sm">{total.toLocaleString()} papers</span>
      </div>
      <p className="text-base-content/60 mb-6 text-sm">
        Accepted papers with an OpenAlex ID but zero stored citations — usually a fetch that came
        back empty. Re-run to retry, now with a CrossRef fallback for references OpenAlex missed.
      </p>

      {total === 0 ? (
        <p className="text-base-content/40 text-sm">
          Every accepted paper has at least one citation on file.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="text-base-content/50 text-xs uppercase">
                  <th className="w-[32%]">Title</th>
                  <th className="w-16">Year</th>
                  <th className="w-40">Journal</th>
                  <th className="w-24">Last fetch</th>
                  <th className="w-px"></th>
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.id} className="hover:bg-base-200">
                    <td className="text-sm align-top py-3">
                      <a href={`/admin/papers/${p.id}`} className="link link-hover">
                        {cap(p.title)}
                      </a>
                      {p.doi && <p className="text-xs text-base-content/40 font-mono">{p.doi}</p>}
                    </td>
                    <td className="text-sm text-base-content/60 align-top py-3">{p.year ?? "—"}</td>
                    <td
                      className="text-sm text-base-content/60 italic align-top py-3 max-w-[10rem] truncate"
                      title={p.journal ?? undefined}
                    >
                      {p.journal ?? "—"}
                    </td>
                    <td className="text-sm text-base-content/60 align-top py-3">
                      {p.citationsFetchedAt ? (
                        new Date(p.citationsFetchedAt).toLocaleDateString()
                      ) : (
                        <span className="text-base-content/30">never</span>
                      )}
                    </td>
                    <td className="align-top py-3 whitespace-nowrap">
                      <FetchCitationsButton paperId={p.id} size="xs" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `?page=${p}`} />
        </>
      )}
    </>
  )
}

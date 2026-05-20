import db from "db"
import { Pagination } from "src/app/components/Pagination"

export const metadata = { title: "Article Suggestions – Admin" }

const PAGE_SIZE = 50

export default async function AdminArticleSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ resolved?: string; page?: string }>
}) {
  const { resolved, page: pageParam } = await searchParams
  const showResolved = resolved === "1"
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where = { resolved: showResolved }

  const [suggestions, total] = await Promise.all([
    db.articleSuggestion.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.articleSuggestion.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Article Suggestions</h1>
        <a
          href={showResolved ? "/admin/suggestions" : "/admin/suggestions?resolved=1"}
          className="btn btn-outline btn-sm"
        >
          {showResolved ? "Show open" : "Show resolved"}
        </a>
      </div>
      <p className="text-base-content/60 mb-8">
        Papers suggested by users that aren&apos;t in the database yet.
      </p>

      {total === 0 ? (
        <div className="text-center py-16 text-base-content/40">
          No {showResolved ? "resolved" : "open"} suggestions.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Title / DOI / URL</th>
                  <th>Authors</th>
                  <th>Year</th>
                  <th>Suggested by</th>
                  <th>Note</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr key={s.id}>
                    <td className="max-w-sm">
                      {s.title && <p className="font-medium line-clamp-2">{s.title}</p>}
                      {s.doi && (
                        <a
                          href={`https://doi.org/${s.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="link link-primary text-xs"
                        >
                          {s.doi}
                        </a>
                      )}
                      {s.url && !s.doi && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="link link-primary text-xs"
                        >
                          {s.url}
                        </a>
                      )}
                    </td>
                    <td className="text-sm text-base-content/70 max-w-xs">
                      {s.authors ?? <span className="text-base-content/30">—</span>}
                    </td>
                    <td className="text-sm text-base-content/70">
                      {s.year ?? <span className="text-base-content/30">—</span>}
                    </td>
                    <td className="text-sm text-base-content/60">{s.user.name ?? s.user.email}</td>
                    <td className="text-sm text-base-content/60 max-w-xs">
                      {s.note ?? <span className="text-base-content/30">—</span>}
                    </td>
                    <td className="text-xs text-base-content/50 whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <a href={`/admin/suggestions/${s.id}`} className="btn btn-outline btn-xs">
                        Review
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(p) => `?resolved=${resolved ?? "0"}&page=${p}`}
          />
        </>
      )}
    </>
  )
}

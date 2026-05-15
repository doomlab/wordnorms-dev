import db from "db"
import { StatusBadge } from "src/app/components/StatusBadge"

export const metadata = { title: "Papers – Admin" }

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type Props = { searchParams: Promise<{ q?: string }> }

export default async function AdminPapersPage({ searchParams }: Props) {
  const { q } = await searchParams

  const results =
    q && q.trim().length > 1
      ? await db.paper.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { doi: { contains: q, mode: "insensitive" } },
              { id: isNaN(Number(q)) ? undefined : Number(q) },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { id: true, title: true, year: true, doi: true, status: true },
        })
      : null

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Papers</h1>
      <p className="text-base-content/60 mb-8 text-sm">
        Search by title, DOI, or ID to edit a paper's bibliographic data.
      </p>

      <form className="flex gap-2 mb-8" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Title, DOI, or paper ID…"
          className="input input-bordered flex-1"
          autoFocus
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {results === null && (
        <p className="text-base-content/40 text-sm text-center py-10">
          Enter a search term to find a paper.
        </p>
      )}

      {results !== null && results.length === 0 && (
        <p className="text-base-content/40 text-sm text-center py-10">No papers found.</p>
      )}

      {results && results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table table-zebra text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Year</th>
                <th>DOI</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.id}</td>
                  <td className="max-w-sm">
                    <p className="line-clamp-2">{cap(p.title)}</p>
                  </td>
                  <td>{p.year ?? "—"}</td>
                  <td className="font-mono text-xs">{p.doi ?? "—"}</td>
                  <td>
                    <StatusBadge status={p.status} size="xs" />
                  </td>
                  <td>
                    <a
                      href={`/admin/papers/${p.id}?from=/admin/papers${
                        q ? `?q=${encodeURIComponent(q)}` : ""
                      }`}
                      className="btn btn-outline btn-xs"
                    >
                      Edit
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

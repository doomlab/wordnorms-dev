import fs from "fs"
import path from "path"
import { notFound } from "next/navigation"
import db from "db"
import { DatasetLinkActions } from "./DatasetLinkActions"

type Card = {
  bibtex: string
  citation: { author: string; year: number | null; title: string; journal: string | null; doi: string | null }
}

function loadCard(bibtex: string): Card | null {
  const p = path.join(process.cwd(), "data", "model-cards", "_data.json")
  if (!fs.existsSync(p)) return null
  const { cards } = JSON.parse(fs.readFileSync(p, "utf8"))
  return (cards as Card[]).find((c) => c.bibtex === bibtex) ?? null
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default async function AdminDatasetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ bibtex: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { bibtex: encodedBibtex } = await params
  const bibtex = decodeURIComponent(encodedBibtex)
  const { q } = await searchParams

  const card = loadCard(bibtex)
  if (!card) notFound()

  const [existingLink, searchResults] = await Promise.all([
    db.datasetLink.findUnique({
      where: { bibtex },
      include: { paper: { select: { id: true, title: true, doi: true, year: true, status: true } } },
    }),
    q && q.trim().length > 1
      ? db.paper.findMany({
          where: {
            canonicalPaperId: null,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { doi: { contains: q, mode: "insensitive" } },
              { id: isNaN(Number(q)) ? undefined : Number(q) },
            ],
          },
          select: { id: true, title: true, doi: true, year: true, status: true },
          orderBy: { year: "desc" },
          take: 20,
        })
      : null,
  ])

  return (
    <>
      <a href="/admin/datasets" className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block">
        ← Back to datasets
      </a>

      <h1 className="text-2xl font-bold mb-1">{cap(card.citation.title)}</h1>
      <p className="text-xs font-mono text-base-content/40 mb-4">{bibtex}</p>

      <div className="text-sm text-base-content/60 space-y-0.5 mb-8">
        {card.citation.author && <p>{card.citation.author}</p>}
        {card.citation.year && <p>{card.citation.year}</p>}
        {card.citation.journal && <p className="italic">{card.citation.journal}</p>}
        {card.citation.doi && (
          <a href={`https://doi.org/${card.citation.doi}`} target="_blank" rel="noreferrer" className="link link-primary font-mono text-xs">
            {card.citation.doi}
          </a>
        )}
      </div>

      {existingLink && (
        <div className="alert alert-success mb-6 text-sm">
          <div>
            <p className="font-semibold">Currently linked to paper #{existingLink.paper.id}</p>
            <p className="text-success-content/80">{cap(existingLink.paper.title)}</p>
          </div>
        </div>
      )}

      <DatasetLinkActions bibtex={bibtex} currentPaperId={existingLink?.paperId ?? null} />

      <form className="flex gap-2 mt-6 mb-6" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search papers by title, DOI, or ID…"
          className="input input-bordered flex-1 text-sm"
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-sm">Search</button>
      </form>

      {searchResults === null && (
        <p className="text-base-content/40 text-sm text-center py-8">Enter a search term to find the matching paper.</p>
      )}
      {searchResults !== null && searchResults.length === 0 && (
        <p className="text-base-content/40 text-sm text-center py-8">No papers found.</p>
      )}
      {searchResults && searchResults.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table table-zebra text-sm">
            <thead>
              <tr><th>Paper</th><th>Year</th><th>DOI</th><th></th></tr>
            </thead>
            <tbody>
              {searchResults.map((p) => (
                <tr key={p.id}>
                  <td className="max-w-sm">
                    <p className="line-clamp-2 font-medium">{cap(p.title)}</p>
                    <span className="font-mono text-xs text-base-content/40">#{p.id}</span>
                  </td>
                  <td>{p.year ?? "—"}</td>
                  <td className="font-mono text-xs text-base-content/50">{p.doi ?? "—"}</td>
                  <td>
                    <DatasetLinkActions bibtex={bibtex} currentPaperId={existingLink?.paperId ?? null} linkPaperId={p.id} />
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

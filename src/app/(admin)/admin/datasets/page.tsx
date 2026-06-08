import fs from "fs"
import path from "path"
import db from "db"
import { ImportCardButton } from "./ImportCardButton"

export const metadata = { title: "Datasets – Admin" }

type Card = {
  bibtex: string
  parentBibtex: string | null
  citation: { author: string; year: number | null; title: string; journal: string | null; doi: string | null }
}

function loadCards(): Card[] {
  const p = path.join(process.cwd(), "data", "model-cards", "_data.json")
  if (!fs.existsSync(p)) return []
  const { cards } = JSON.parse(fs.readFileSync(p, "utf8"))
  return cards ?? []
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default async function AdminDatasetsPage() {
  const cards = loadCards().filter((c) => !/_R1(23)?$/.test(c.bibtex))

  // Build lookup sets for fast matching
  const dois = cards.map((c) => c.citation.doi).filter(Boolean) as string[]
  const [papersByDoi, allLinks] = await Promise.all([
    db.paper.findMany({
      where: { doi: { in: dois }, canonicalPaperId: null },
      select: { id: true, doi: true, title: true, status: true },
    }),
    db.datasetLink.findMany({ include: { paper: { select: { id: true, title: true, status: true } } } }),
  ])

  const doiToPaper = new Map(papersByDoi.map((p) => [p.doi!.toLowerCase(), p]))
  const linksByBibtex = new Map(allLinks.map((l) => [l.bibtex, l]))

  const matched: { card: Card; paperId: number; paperTitle: string; via: string }[] = []
  const unmatchedWithDoi: Card[] = []
  const unmatchedNoDoi: Card[] = []

  for (const card of cards) {
    const link = linksByBibtex.get(card.bibtex)
    if (link) {
      matched.push({ card, paperId: link.paperId, paperTitle: link.paper.title, via: "manual" })
      continue
    }
    const byDoi = card.citation.doi ? doiToPaper.get(card.citation.doi.toLowerCase()) : undefined
    if (byDoi) {
      matched.push({ card, paperId: byDoi.id, paperTitle: byDoi.title, via: "doi" })
      continue
    }
    if (card.citation.doi) {
      unmatchedWithDoi.push(card)
    } else {
      unmatchedNoDoi.push(card)
    }
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Datasets</h1>
      <p className="text-base-content/60 mb-8 text-sm">
        Link YAML dataset cards to their corresponding paper in the database. Cards matched by DOI automatically;
        cards with a DOI not yet in the DB can be imported from OpenAlex; others need a manual link.
      </p>

      <div className="flex gap-6 mb-6 text-sm">
        <span className="text-base-content/60">
          <span className="font-semibold text-base-content">{cards.length}</span> total cards
        </span>
        <span className="text-base-content/60">
          <span className="font-semibold text-success">{matched.length}</span> matched
        </span>
        {unmatchedWithDoi.length > 0 && (
          <span className="text-base-content/60">
            <span className="font-semibold text-warning">{unmatchedWithDoi.length}</span> importable
          </span>
        )}
        {unmatchedNoDoi.length > 0 && (
          <span className="text-base-content/60">
            <span className="font-semibold text-error">{unmatchedNoDoi.length}</span> need manual link
          </span>
        )}
      </div>

      {unmatchedWithDoi.length > 0 && (
        <>
          <h2 className="font-semibold text-sm mb-3 text-base-content/70 uppercase tracking-wide">
            Import from OpenAlex ({unmatchedWithDoi.length})
          </h2>
          <p className="text-xs text-base-content/50 mb-3">
            These cards have DOIs but the paper is not in the database yet. Click Import to fetch from OpenAlex and add as Pending Review.
          </p>
          <div className="overflow-x-auto mb-10">
            <table className="table table-zebra text-sm">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Year</th>
                  <th>DOI</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {unmatchedWithDoi.map((c) => (
                  <tr key={c.bibtex}>
                    <td className="max-w-sm">
                      <p className="font-medium line-clamp-2">{cap(c.citation.title)}</p>
                      <p className="text-xs text-base-content/40 mt-0.5">{c.bibtex}</p>
                    </td>
                    <td>{c.citation.year ?? "—"}</td>
                    <td className="font-mono text-xs text-base-content/50">{c.citation.doi}</td>
                    <td className="flex gap-1">
                      <ImportCardButton
                        bibtex={c.bibtex}
                        doi={c.citation.doi}
                        title={c.citation.title}
                        authors={c.citation.author}
                        year={c.citation.year}
                        journal={c.citation.journal}
                      />
                      <a href={`/admin/datasets/${encodeURIComponent(c.bibtex)}`} className="btn btn-outline btn-xs">
                        Link →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {unmatchedNoDoi.length > 0 && (
        <>
          <h2 className="font-semibold text-sm mb-3 text-base-content/70 uppercase tracking-wide">
            No DOI — manual link needed ({unmatchedNoDoi.length})
          </h2>
          <div className="overflow-x-auto mb-10">
            <table className="table table-zebra text-sm">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Year</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {unmatchedNoDoi.map((c) => (
                  <tr key={c.bibtex}>
                    <td className="max-w-sm">
                      <p className="font-medium line-clamp-2">{cap(c.citation.title)}</p>
                      <p className="text-xs text-base-content/40 mt-0.5">{c.bibtex}</p>
                    </td>
                    <td>{c.citation.year ?? "—"}</td>
                    <td>
                      <a href={`/admin/datasets/${encodeURIComponent(c.bibtex)}`} className="btn btn-warning btn-xs">
                        Link →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="font-semibold text-sm mb-3 text-base-content/70 uppercase tracking-wide">
        Matched ({matched.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="table table-zebra text-sm">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>→ Paper</th>
              <th>Via</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {matched.map(({ card, paperId, paperTitle, via }) => (
              <tr key={card.bibtex}>
                <td className="max-w-xs">
                  <p className="font-medium line-clamp-2">{cap(card.citation.title)}</p>
                  <p className="text-xs text-base-content/40 mt-0.5">{card.bibtex}</p>
                </td>
                <td className="max-w-xs">
                  <a href={`/norms/${paperId}`} className="line-clamp-2 link link-hover">
                    {cap(paperTitle)}
                  </a>
                  <span className="font-mono text-xs text-base-content/40 ml-1">#{paperId}</span>
                </td>
                <td>
                  <span className={`badge badge-xs ${via === "manual" ? "badge-info" : "badge-neutral"}`}>
                    {via}
                  </span>
                </td>
                <td>
                  <a href={`/admin/datasets/${encodeURIComponent(card.bibtex)}`} className="btn btn-outline btn-xs">
                    Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

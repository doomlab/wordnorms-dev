import db from "db"
import { Navbar } from "../components/Navbar"
import { NetworkGraph } from "./NetworkGraph"
import { DbCharts } from "./Charts"

export const metadata = { title: "Visualizations – WordNorms" }

const ACCEPTED = { in: ["ACCEPTED" as const, "ADDED_TO_TRAINING" as const] }

export default async function VisualizationsPage() {
  const [acceptedPapers, citations, extractions, yearGroups, journalGroups, summaryCounts] = await Promise.all([
    db.paper.findMany({
      where: { status: ACCEPTED, openAlexId: { not: null } },
      select: { id: true, title: true, year: true, openAlexId: true, canonicalPaperId: true },
    }),
    db.paperCitation.findMany({
      include: { citingPaper: { select: { openAlexId: true } } },
    }),
    db.paperExtraction.findMany({
      where: { paper: { status: ACCEPTED } },
      select: { normsCollected: true, language: true, participantType: true },
    }),
    db.paper.groupBy({
      by: ["year"],
      where: { status: ACCEPTED, year: { not: null } },
      _count: { _all: true },
      orderBy: { year: "asc" },
    }),
    db.paper.groupBy({
      by: ["journal"],
      where: { status: ACCEPTED, journal: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { journal: "desc" } },
      take: 10,
    }),
    Promise.all([
      db.paper.count(),
      db.paper.count({ where: { status: { in: [...ACCEPTED.in] } } }),
      db.paper.count({ where: { status: "PENDING_REVIEW" } }),
      db.paper.count({ where: { status: { in: [...ACCEPTED.in] }, doi: { not: null } } }),
      db.paper.count({ where: { status: { in: [...ACCEPTED.in] }, openAlexId: { not: null } } }),
      db.paperExtraction.count({ where: { paper: { status: { in: [...ACCEPTED.in] } } } }),
    ]),
  ])

  // Build network graph data
  // allByAlexId covers canonical + duplicate accepted papers (for unmatched detection)
  const paperById = new Map(acceptedPapers.map((p) => [p.id, p]))
  const allByAlexId = new Map(acceptedPapers.map((p) => [p.openAlexId!, p]))

  const resolveAlexId = (openAlexId: string): string => {
    const paper = allByAlexId.get(openAlexId)
    if (!paper?.canonicalPaperId) return openAlexId
    return paperById.get(paper.canonicalPaperId)?.openAlexId ?? openAlexId
  }

  // Only canonical papers become graph nodes
  const canonicalPapers = acceptedPapers.filter((p) => !p.canonicalPaperId)
  const canonicalByAlexId = new Map(canonicalPapers.map((p) => [p.openAlexId!, p]))

  const dbNodes = canonicalPapers.map((p) => ({
    id: p.openAlexId!,
    title: p.title,
    year: p.year ?? undefined,
    inDb: true as const,
    paperId: p.id,
  }))

  const unmatchedNodeMap = new Map<
    string,
    { id: string; title: string; year?: number; inDb: false }
  >()
  for (const c of citations) {
    if (!allByAlexId.has(c.citedOpenAlexId) && !unmatchedNodeMap.has(c.citedOpenAlexId)) {
      unmatchedNodeMap.set(c.citedOpenAlexId, {
        id: c.citedOpenAlexId,
        title: c.title ?? c.citedOpenAlexId,
        year: c.year ?? undefined,
        inDb: false,
      })
    }
  }

  // Resolve both ends of each edge to canonical openAlexIds, then deduplicate
  const linkKeySet = new Set<string>()
  const allLinks = citations
    .filter((c) => c.citingPaper.openAlexId)
    .flatMap((c) => {
      const source = resolveAlexId(c.citingPaper.openAlexId!)
      const target = resolveAlexId(c.citedOpenAlexId)
      if (source === target) return []
      const key = `${source}→${target}`
      if (linkKeySet.has(key)) return []
      linkKeySet.add(key)
      return [{ source, target }]
    })

  const dbOnlyLinks = allLinks.filter((l) => canonicalByAlexId.has(l.target))

  const graphData = {
    dbNodes,
    unmatchedNodes: Array.from(unmatchedNodeMap.values()),
    allLinks,
    dbOnlyLinks,
  }

  // Top 100 hubs by DB-to-DB connections
  const dbDegreeMap = new Map<string, number>()
  for (const link of dbOnlyLinks) {
    dbDegreeMap.set(link.source, (dbDegreeMap.get(link.source) ?? 0) + 1)
    dbDegreeMap.set(link.target, (dbDegreeMap.get(link.target) ?? 0) + 1)
  }
  const topHubs = canonicalPapers
    .filter((p) => dbDegreeMap.has(p.openAlexId!))
    .sort((a, b) => dbDegreeMap.get(b.openAlexId!)! - dbDegreeMap.get(a.openAlexId!)!)
    .slice(0, 100)
    .map((p, i) => ({
      rank: i + 1,
      id: p.id,
      title: p.title,
      year: p.year,
      connections: dbDegreeMap.get(p.openAlexId!)!,
    }))

  // Build chart data
  const normCounts: Record<string, number> = {}
  const langCounts: Record<string, number> = {}
  const ptCounts: Record<string, number> = {}

  for (const e of extractions) {
    for (const n of e.normsCollected) normCounts[n] = (normCounts[n] ?? 0) + 1
    for (const l of e.language) langCounts[l] = (langCounts[l] ?? 0) + 1
    if (e.participantType) ptCounts[e.participantType] = (ptCounts[e.participantType] ?? 0) + 1
  }

  const vizData = {
    totalCitations: citations.length,
    uniqueCited: unmatchedNodeMap.size,
  }

  const [totalAll, totalAccepted, totalPending, withDoi, withAlexId, withExtraction] = summaryCounts

  const dbData = {
    totalPapers: canonicalPapers.length,
    summary: [
      { label: "Total papers in database", value: totalAll.toLocaleString() },
      { label: "Accepted papers", value: totalAccepted.toLocaleString() },
      { label: "Pending review", value: totalPending.toLocaleString() },
      { label: "With extraction data", value: withExtraction.toLocaleString() },
      { label: "With DOI", value: withDoi.toLocaleString() },
      { label: "With OpenAlex ID", value: withAlexId.toLocaleString() },
    ],
    years: yearGroups.map((g) => ({ year: String(g.year), count: g._count?._all ?? 0 })),
    journals: journalGroups.map((g) => ({ name: g.journal!, count: g._count?._all ?? 0 })),
    norms: Object.entries(normCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    languages: Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    participantTypes: Object.entries(ptCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
  }

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />
      <div className="w-full px-10 py-10">
        <h1 className="text-3xl font-bold mb-10">Visualizations</h1>

        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Citation Network</h2>
          <div className="card card-bordered bg-base-200 mb-6">
            <div className="card-body p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                {[
                  { value: dbData.totalPapers.toLocaleString(), label: "Accepted papers" },
                  {
                    value: vizData.totalCitations.toLocaleString(),
                    label: "Citation relationships stored",
                  },
                  {
                    value: graphData.dbOnlyLinks.length.toLocaleString(),
                    label: "Cross-references between DB papers",
                  },
                  {
                    value: vizData.uniqueCited.toLocaleString(),
                    label: "Cited papers not yet in database",
                  },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-base-content/60 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-base-content/60">
                Each node is an accepted paper; edges represent citation relationships retrieved
                from OpenAlex. Larger amber nodes are the top {20} most-connected hubs. Click any
                node to open its paper page. Papers with no connections to other accepted papers are
                not shown. Toggle unmatched citations to reveal papers cited by the database but not
                yet included.
              </p>
            </div>
          </div>
          <NetworkGraph graphData={graphData} />

          {topHubs.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-base-content/60 uppercase tracking-wider mb-2">
                Top {topHubs.length} hubs by connections
              </h3>
              <div
                className="overflow-y-auto rounded-lg border border-base-200"
                style={{ maxHeight: 320 }}
              >
                <table className="table table-xs w-full">
                  <thead className="sticky top-0 bg-base-200 z-10">
                    <tr className="text-base-content/50 text-xs uppercase">
                      <th className="w-10">#</th>
                      <th>Title</th>
                      <th className="w-16">Year</th>
                      <th className="w-28 text-right">Connections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topHubs.map((hub) => (
                      <tr key={hub.id} className="hover:bg-base-200">
                        <td className="text-base-content/40 tabular-nums">{hub.rank}</td>
                        <td>
                          <a
                            href={`/norms/${hub.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {hub.title.charAt(0).toUpperCase() + hub.title.slice(1)}
                          </a>
                        </td>
                        <td className="text-base-content/60">{hub.year ?? "—"}</td>
                        <td className="text-right tabular-nums font-medium">{hub.connections}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-6">Database Stats</h2>
          <DbCharts data={dbData} />
        </section>
      </div>
    </div>
  )
}

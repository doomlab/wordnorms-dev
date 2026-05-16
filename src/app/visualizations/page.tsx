import db from "db"
import { Navbar } from "../components/Navbar"
import { NetworkGraph } from "./NetworkGraph"
import { VizStats, DbCharts } from "./Charts"

export const metadata = { title: "Visualizations – WordNorms" }

const ACCEPTED = { in: ["ACCEPTED", "ADDED_TO_TRAINING"] as const }

export default async function VisualizationsPage() {
  const [acceptedPapers, citations, extractions, yearGroups, journalGroups] = await Promise.all([
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
      take: 15,
    }),
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

  const unmatchedNodeMap = new Map<string, { id: string; title: string; year?: number; inDb: false }>()
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
    unmatchedNodes: [...unmatchedNodeMap.values()],
    allLinks,
    dbOnlyLinks,
  }

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

  const dbData = {
    totalPapers: canonicalPapers.length,
    years: yearGroups.map((g) => ({ year: String(g.year), count: g._count._all })),
    journals: journalGroups.map((g) => ({ name: g.journal!, count: g._count._all })),
    norms: Object.entries(normCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    languages: Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    participantTypes: Object.entries(ptCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
  }

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />
      <div className="w-full px-10 py-10">
        <h1 className="text-3xl font-bold mb-1">Visualizations</h1>
        <p className="text-base-content/60 mb-10 text-sm">
          {dbData.totalPapers.toLocaleString()} accepted papers ·{" "}
          {vizData.totalCitations.toLocaleString()} citation relationships
        </p>

        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Visualization Stats</h2>
          <NetworkGraph graphData={graphData} />
          <VizStats data={vizData} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-6">Database Stats</h2>
          <DbCharts data={dbData} />
        </section>
      </div>
    </div>
  )
}

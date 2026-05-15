import db from "db"
import { Navbar } from "../components/Navbar"
import { NetworkGraph } from "./NetworkGraph"
import { Charts } from "./Charts"

export const metadata = { title: "Visualizations – WordNorms" }

const ACCEPTED = { in: ["ACCEPTED", "ADDED_TO_TRAINING"] as const }

export default async function VisualizationsPage() {
  const [acceptedPapers, citations, extractions, yearGroups, journalGroups] = await Promise.all([
    db.paper.findMany({
      where: { status: ACCEPTED, openAlexId: { not: null } },
      select: { id: true, title: true, year: true, openAlexId: true },
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
  const acceptedByAlexId = new Map(acceptedPapers.map((p) => [p.openAlexId!, p]))

  const dbNodes = acceptedPapers.map((p) => ({
    id: p.openAlexId!,
    title: p.title,
    year: p.year ?? undefined,
    inDb: true as const,
    paperId: p.id,
  }))

  const unmatchedNodeMap = new Map<string, { id: string; title: string; year?: number; inDb: false }>()
  for (const c of citations) {
    if (!acceptedByAlexId.has(c.citedOpenAlexId) && !unmatchedNodeMap.has(c.citedOpenAlexId)) {
      unmatchedNodeMap.set(c.citedOpenAlexId, {
        id: c.citedOpenAlexId,
        title: c.title ?? c.citedOpenAlexId,
        year: c.year ?? undefined,
        inDb: false,
      })
    }
  }

  const allLinks = citations
    .filter((c) => c.citingPaper.openAlexId)
    .map((c) => ({ source: c.citingPaper.openAlexId!, target: c.citedOpenAlexId }))

  const dbOnlyLinks = allLinks.filter((l) => acceptedByAlexId.has(l.target))

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

  const chartData = {
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
    totalPapers: acceptedPapers.length,
    totalCitations: citations.length,
    uniqueCited: unmatchedNodeMap.size,
  }

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />
      <div className="w-full px-10 py-10">
        <h1 className="text-3xl font-bold mb-1">Visualizations</h1>
        <p className="text-base-content/60 mb-10 text-sm">
          {chartData.totalPapers.toLocaleString()} accepted papers ·{" "}
          {chartData.totalCitations.toLocaleString()} citation relationships
        </p>

        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Citation Network</h2>
          <NetworkGraph graphData={graphData} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-6">Database Stats</h2>
          <Charts chartData={chartData} />
        </section>
      </div>
    </div>
  )
}

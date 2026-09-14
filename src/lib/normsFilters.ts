import fs from "fs"
import path from "path"
import db from "db"
import { DECADE_LABELS } from "src/app/data/datasets"

export type NormsFilters = {
  q?: string
  languages: string[]
  decades: string[]
  year?: number
  stimuliTypes: string[]
  statuses: string[]
}

export type NormsFilterSearchParams = {
  q?: string
  lang?: string | string[]
  decade?: string | string[]
  stimuli?: string | string[]
  status?: string | string[]
  year?: string
}

const STATUS_LABELS: Record<string, string> = {
  dataset: "dataset",
  "peer-reviewed": "peer reviewed",
  verified: "verified",
  awaiting: "awaiting extraction",
}

const toArray = (v: string | string[] | undefined) => (v ? (Array.isArray(v) ? v : [v]) : [])

export function parseNormsFilterParams(params: NormsFilterSearchParams): NormsFilters {
  const year = params.year?.trim() ? parseInt(params.year, 10) : undefined
  return {
    q: params.q?.trim() || undefined,
    languages: toArray(params.lang),
    decades: toArray(params.decade),
    year: year !== undefined && !Number.isNaN(year) ? year : undefined,
    stimuliTypes: toArray(params.stimuli),
    statuses: toArray(params.status),
  }
}

export function parseNormsFilterQueryString(query: string): NormsFilters {
  const sp = new URLSearchParams(query)
  return parseNormsFilterParams({
    q: sp.get("q") ?? undefined,
    lang: sp.getAll("lang"),
    decade: sp.getAll("decade"),
    stimuli: sp.getAll("stimuli"),
    status: sp.getAll("status"),
    year: sp.get("year") ?? undefined,
  })
}

export function loadDatasetLookup(): { byDoi: Map<string, string>; byTitle: Map<string, string> } {
  const p = path.join(process.cwd(), "data", "model-cards", "_data.json")
  if (!fs.existsSync(p)) return { byDoi: new Map(), byTitle: new Map() }
  try {
    const { cards } = JSON.parse(fs.readFileSync(p, "utf8")) as {
      cards: { bibtex: string; citation: { doi: string | null; title: string } }[]
    }
    const byDoi = new Map<string, string>()
    const byTitle = new Map<string, string>()
    for (const c of cards) {
      if (c.citation.doi) byDoi.set(c.citation.doi.toLowerCase(), c.bibtex)
      byTitle.set(c.citation.title.toLowerCase().trim(), c.bibtex)
    }
    return { byDoi, byTitle }
  } catch {
    return { byDoi: new Map(), byTitle: new Map() }
  }
}

// Prisma has no substring filter for String[] columns — raw queries for author
// and norms-collected matches so e.g. "words" also matches "word frequency"
export async function buildNormsWhere(filters: NormsFilters) {
  const { q, languages, decades, year, stimuliTypes, statuses } = filters
  const { byDoi: datasetByDoi, byTitle: datasetByTitle } = loadDatasetLookup()

  const [authorMatches, normsMatches] = q
    ? await Promise.all([
        db.$queryRaw<{ id: number }[]>`
          SELECT id FROM "Paper"
          WHERE EXISTS (SELECT 1 FROM unnest(authors) AS a WHERE a ILIKE ${`%${q}%`})
        `,
        db.$queryRaw<{ id: number }[]>`
          SELECT "paperId" AS id FROM "PaperExtraction"
          WHERE EXISTS (SELECT 1 FROM unnest("normsCollected") AS n WHERE n ILIKE ${`%${q}%`})
        `,
      ])
    : [[], []]
  const authorMatchIds = authorMatches.map((r) => r.id)
  const normsMatchIds = normsMatches.map((r) => r.id)

  const andClauses: object[] = []

  if (q) {
    andClauses.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { abstract: { contains: q, mode: "insensitive" } },
        { doi: { contains: q, mode: "insensitive" } },
        ...(authorMatchIds.length ? [{ id: { in: authorMatchIds } }] : []),
        ...(normsMatchIds.length ? [{ id: { in: normsMatchIds } }] : []),
      ],
    })
  }

  if (decades.length) {
    andClauses.push({
      OR: decades.flatMap((decade) => {
        const range = DECADE_LABELS[decade]
        return range ? [{ year: { gte: range[0], lte: range[1] } }] : []
      }),
    })
  }

  if (year !== undefined) {
    andClauses.push({ year })
  }

  if (statuses.length) {
    const statusClauses: object[] = []
    if (statuses.includes("peer-reviewed")) {
      statusClauses.push({ journal: { not: null } })
    }
    if (statuses.includes("awaiting")) {
      statusClauses.push({ extraction: { is: null } })
    }
    if (statuses.includes("verified")) {
      statusClauses.push({ extraction: { verifiedAt: { not: null } } })
    }
    if (statuses.includes("dataset")) {
      const datasetDois = Array.from(datasetByDoi.keys()).filter(Boolean)
      const datasetTitles = Array.from(datasetByTitle.keys()).filter(Boolean)
      const dsClauses: object[] = []
      if (datasetDois.length) dsClauses.push({ doi: { in: datasetDois } })
      if (datasetTitles.length) dsClauses.push({ title: { in: datasetTitles } })
      if (dsClauses.length) statusClauses.push({ OR: dsClauses })
    }
    if (statusClauses.length) andClauses.push({ OR: statusClauses })
  }

  return {
    status: "ACCEPTED" as const,
    canonicalPaperId: null,
    ...(languages.length || stimuliTypes.length
      ? {
          extraction: {
            ...(languages.length ? { language: { hasSome: languages } } : {}),
            ...(stimuliTypes.length ? { stimuliType: { hasSome: stimuliTypes } } : {}),
          },
        }
      : {}),
    ...(andClauses.length ? { AND: andClauses } : {}),
  }
}

export function describeNormsFilters(filters: NormsFilters): string[] {
  const chips: string[] = []
  if (filters.q) chips.push(`"${filters.q}"`)
  filters.statuses.forEach((s) => chips.push(STATUS_LABELS[s] ?? s))
  filters.stimuliTypes.forEach((s) => chips.push(s))
  filters.languages.forEach((l) => chips.push(l))
  filters.decades.forEach((d) => chips.push(d))
  if (filters.year !== undefined) chips.push(String(filters.year))
  return chips
}

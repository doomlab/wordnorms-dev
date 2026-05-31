import { Suspense } from "react"
import fs from "fs"
import path from "path"
import { Navbar } from "./components/Navbar"
import { BrowseFilters } from "./components/BrowseFilters"
import { FavoriteButton } from "./components/FavoriteButton"
import { ReportButton } from "./components/ReportButton"
import { DECADE_LABELS } from "./data/datasets"
import { getBlitzContext } from "./blitz-server"
import { SuggestArticleButton } from "./components/SuggestArticleButton"
import { Pagination } from "./components/Pagination"
import { FeedbackForm } from "./components/FeedbackForm"
import db from "db"

const PAGE_SIZE = 50

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function loadDatasetLookup(): { byDoi: Map<string, string>; byTitle: Map<string, string> } {
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lang?: string | string[]; decade?: string | string[]; stimuli?: string | string[]; status?: string | string[]; page?: string }>
}) {
  const params = await searchParams

  const q = params.q?.trim() || undefined
  const languages = params.lang ? (Array.isArray(params.lang) ? params.lang : [params.lang]) : []
  const decades = params.decade
    ? Array.isArray(params.decade)
      ? params.decade
      : [params.decade]
    : []
  const stimuliTypes = params.stimuli
    ? Array.isArray(params.stimuli)
      ? params.stimuli
      : [params.stimuli]
    : []
  const statuses = params.status
    ? Array.isArray(params.status)
      ? params.status
      : [params.status]
    : []
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  const { byDoi: datasetByDoi, byTitle: datasetByTitle } = loadDatasetLookup()

  const ctx = await getBlitzContext()
  const userId = ctx.session.userId as number | undefined

  // Prisma has no substring filter for String[] columns — raw query for author matches
  const authorMatchIds = q
    ? (
        await db.$queryRaw<{ id: number }[]>`
          SELECT id FROM "Paper"
          WHERE EXISTS (SELECT 1 FROM unnest(authors) AS a WHERE a ILIKE ${`%${q}%`})
        `
      ).map((r) => r.id)
    : []

  const andClauses: object[] = []

  if (q) {
    andClauses.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { abstract: { contains: q, mode: "insensitive" } },
        { extraction: { normsCollected: { hasSome: [q] } } },
        ...(authorMatchIds.length ? [{ id: { in: authorMatchIds } }] : []),
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

  const paperWhere = {
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

  const [papers, totalPapers, allPapers, favoritedIds, reportedIds] = await Promise.all([
    db.paper.findMany({
      where: paperWhere,
      include: { extraction: { select: { language: true, stimuliType: true, stimuliCount: true, normsCollected: true, verifiedAt: true } } },
      orderBy: [{ updatedAt: "desc" }, { year: { sort: "desc", nulls: "last" } }],
      skip,
      take: PAGE_SIZE,
    }),
    db.paper.count({ where: paperWhere }),
    db.paper.findMany({
      where: {
        status: "ACCEPTED",
        canonicalPaperId: null,
        extraction: { isNot: null },
      },
      select: { extraction: { select: { language: true, stimuliType: true } } },
    }),
    userId
      ? db.userFavorite
          .findMany({ where: { userId }, select: { paperId: true } })
          .then((rows) => new Set(rows.map((r) => r.paperId)))
      : Promise.resolve(new Set<number>()),
    userId
      ? db.paperReport
          .findMany({ where: { userId }, select: { paperId: true } })
          .then((rows) => new Set(rows.map((r) => r.paperId)))
      : Promise.resolve(new Set<number>()),
  ])

  const allLanguages = Array.from(
    new Set(allPapers.flatMap((p) => p.extraction?.language ?? []))
  ).sort()

  const allStimuliTypes = Array.from(
    new Set(allPapers.flatMap((p) => p.extraction?.stimuliType ?? []))
  ).sort()

  const downloadParams = new URLSearchParams()
  if (q) downloadParams.set("q", q)
  languages.forEach((l) => downloadParams.append("lang", l))
  decades.forEach((d) => downloadParams.append("decade", d))
  stimuliTypes.forEach((s) => downloadParams.append("stimuli", s))
  statuses.forEach((s) => downloadParams.append("status", s))
  const downloadHref = `/api/download/norms${downloadParams.size ? `?${downloadParams}` : ""}`

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex flex-1 w-full px-10 py-8 gap-8">
        <Suspense fallback={<div className="w-56 shrink-0" />}>
          <BrowseFilters allLanguages={allLanguages} allStimuliTypes={allStimuliTypes} />
        </Suspense>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-base-content/60">
              <span className="font-semibold text-base-content">{totalPapers}</span> norm{" "}
              {totalPapers === 1 ? "set" : "sets"}
            </p>
            <div className="flex items-center gap-2">
              <a href={downloadHref} className="btn btn-outline btn-sm">
                Download CSV
              </a>
              <SuggestArticleButton isLoggedIn={!!userId} />
            </div>
          </div>

          {papers.length === 0 ? (
            <div className="text-center py-16 text-base-content/40">
              <p className="text-lg">No results match your filters.</p>
              <a href="/" className="link link-primary text-sm mt-2 inline-block">
                Clear filters
              </a>
            </div>
          ) : (
            <>
            <ul className="flex flex-col divide-y divide-base-200">
              {papers.map((paper) => {
                const ext = paper.extraction
                const datasetBibtex =
                  (paper.doi ? datasetByDoi.get(paper.doi.toLowerCase()) : undefined) ??
                  datasetByTitle.get(paper.title.toLowerCase().trim())
                return (
                  <li
                    key={paper.id}
                    className="py-5 hover:bg-base-200/40 px-3 -mx-3 rounded-lg transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="font-semibold text-base leading-snug">
                            {capFirst(paper.title)}
                          </h2>

                          {datasetBibtex && (
                            <a
                              href={`/datasets/${datasetBibtex}`}
                              className="badge badge-primary badge-sm shrink-0"
                            >
                              dataset
                            </a>
                          )}
                          {paper.journal && (
                            <span className="badge badge-info badge-sm shrink-0">peer reviewed</span>
                          )}
                          {!ext && (
                            <span className="badge badge-outline badge-sm shrink-0">awaiting extraction</span>
                          )}
                          {ext?.verifiedAt && (
                            <span className="badge badge-success badge-sm shrink-0">verified</span>
                          )}
                        </div>
                        {paper.abstract && (
                          <p className="text-sm text-base-content/60 mb-3 line-clamp-2">
                            {paper.abstract}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50">
                          {ext?.language && ext.language.length > 0 && (
                            <>
                              <span className="font-medium text-base-content/70">
                                {ext.language.join(", ")}
                              </span>
                              <span>·</span>
                            </>
                          )}
                          {paper.year && <span>{paper.year}</span>}
                          {paper.journal && (
                            <>
                              <span>·</span>
                              <span className="italic">{paper.journal}</span>
                            </>
                          )}
                          {ext?.stimuliCount && (
                            <>
                              <span>·</span>
                              <span>
                                {ext.stimuliCount.toLocaleString()}{" "}
                                {ext.stimuliType.length > 0 ? ext.stimuliType.join(", ") : "stimuli"}
                              </span>
                            </>
                          )}
                          {ext?.normsCollected && ext.normsCollected.length > 0 && (
                            <>
                              <span>·</span>
                              <span>{ext.normsCollected.join(", ")}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ReportButton
                          paperId={paper.id}
                          initialReported={reportedIds.has(paper.id)}
                          isLoggedIn={!!userId}
                        />
                        <FavoriteButton
                          paperId={paper.id}
                          initialFavorited={favoritedIds.has(paper.id)}
                          isLoggedIn={!!userId}
                        />
                        <a href={`/norms/${paper.id}`} className="btn btn-outline btn-sm">
                          View
                        </a>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            {totalPapers > PAGE_SIZE && (() => {
              const totalPages = Math.ceil(totalPapers / PAGE_SIZE)
              const buildHref = (p: number) => {
                const sp = new URLSearchParams()
                if (q) sp.set("q", q)
                languages.forEach((l) => sp.append("lang", l))
                decades.forEach((d) => sp.append("decade", d))
                stimuliTypes.forEach((s) => sp.append("stimuli", s))
                statuses.forEach((s) => sp.append("status", s))
                sp.set("page", String(p))
                return `/?${sp.toString()}`
              }
              return <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
            })()}
            </>
          )}
          <FeedbackForm />
        </div>
      </div>
    </div>
  )
}

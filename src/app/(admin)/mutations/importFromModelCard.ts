import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const Input = z.object({
  bibtex: z.string(),
  doi: z.string().nullable(),
  title: z.string(),
  authors: z.string(),
  year: z.number().nullable(),
  journal: z.string().nullable(),
})

function reconstructAbstract(aii: Record<string, number[]> | null | undefined): string | null {
  if (!aii) return null
  const words: string[] = []
  for (const [word, positions] of Object.entries(aii)) {
    for (const pos of positions) words[pos] = word
  }
  return words.filter(Boolean).join(" ")
}

const HEADERS = { "User-Agent": "mailto:buchananlab@gmail.com" }

export default resolver.pipe(
  resolver.zod(Input),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ bibtex, doi, title, authors, year, journal }) => {
    // Check if already in DB by DOI
    if (doi) {
      const existing = await db.paper.findUnique({ where: { doi }, select: { id: true, title: true, status: true } })
      if (existing) {
        await db.datasetLink.upsert({
          where: { bibtex },
          create: { bibtex, paperId: existing.id },
          update: { paperId: existing.id },
        })
        return { type: "linked" as const, paperId: existing.id, paperTitle: existing.title }
      }
    }

    // Fetch from OpenAlex
    let work: any = null
    if (doi) {
      const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      try {
        const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(clean)}`, { headers: HEADERS })
        if (res.ok) work = await res.json()
      } catch {}
    }
    if (!work) {
      try {
        const res = await fetch(
          `https://api.openalex.org/works?filter=title.search:${encodeURIComponent(title)}&per_page=1`,
          { headers: HEADERS }
        )
        if (res.ok) {
          const data = await res.json()
          if (data.results?.[0]) work = data.results[0]
        }
      } catch {}
    }

    const resolvedDoi = work?.doi ? work.doi.replace("https://doi.org/", "") : doi
    const openAlexId = work?.id ? work.id.replace("https://openalex.org/", "") : null
    const paperAuthors: string[] = work?.authorships?.map((a: any) => a.author.display_name) ?? authors.split(",").map((s: string) => s.trim()).filter(Boolean)
    const authorMeta = work?.authorships?.map((a: any) => ({
      name: a.author.display_name as string,
      orcid: (a.author.orcid as string | null) ?? null,
      openAlexId: a.author.id ? (a.author.id as string).replace("https://openalex.org/", "") : null,
    })) ?? []
    const abstract = reconstructAbstract(work?.abstract_inverted_index)
    const pdfUrl = work?.primary_location?.pdf_url ?? work?.open_access?.oa_url ?? null
    const resolvedJournal = work?.primary_location?.source?.display_name ?? journal

    // Double-check by DOI in case OpenAlex returned a normalized version
    if (resolvedDoi) {
      const existing = await db.paper.findUnique({ where: { doi: resolvedDoi }, select: { id: true, title: true } })
      if (existing) {
        await db.datasetLink.upsert({
          where: { bibtex },
          create: { bibtex, paperId: existing.id },
          update: { paperId: existing.id },
        })
        return { type: "linked" as const, paperId: existing.id, paperTitle: existing.title }
      }
    }

    const paper = await db.paper.create({
      data: {
        title: title.toLowerCase(),
        authors: paperAuthors,
        authorMeta,
        year: year ?? null,
        doi: resolvedDoi ?? null,
        journal: resolvedJournal ?? null,
        abstract: abstract ?? null,
        openAlexId: openAlexId ?? null,
        pdfUrl: pdfUrl ?? null,
        status: "PENDING_REVIEW",
        discoverySource: "DIRECT",
      },
    })

    await db.datasetLink.upsert({
      where: { bibtex },
      create: { bibtex, paperId: paper.id },
      update: { paperId: paper.id },
    })

    return { type: "created" as const, paperId: paper.id, paperTitle: paper.title }
  }
)

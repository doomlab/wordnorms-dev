import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"
import { withOpenAlexApiKey } from "src/lib/openAlexApiKey"

const PullCitedPaper = z.object({
  citedOpenAlexId: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().int().nullable(),
  journal: z.string().nullable(),
})

const HEADERS = { "User-Agent": "mailto:buchananlab@gmail.com" }

function reconstructAbstract(aii: Record<string, number[]> | null | undefined): string | null {
  if (!aii) return null
  const words: string[] = []
  for (const [word, positions] of Object.entries(aii)) {
    for (const pos of positions) {
      words[pos] = word
    }
  }
  return words.filter(Boolean).join(" ")
}

export default resolver.pipe(
  resolver.zod(PullCitedPaper),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ citedOpenAlexId, title, authors, year, journal }) => {
    // Check if already in DB by openAlexId
    const existingByAlexId = await db.paper.findUnique({
      where: { openAlexId: citedOpenAlexId },
      select: { id: true, title: true },
    })
    if (existingByAlexId) return { type: "duplicate" as const, paper: existingByAlexId }

    // Fetch full metadata from OpenAlex for doi, abstract, pdfUrl
    let doi: string | null = null
    let abstract: string | null = null
    let pdfUrl: string | null = null
    let authorMeta: { name: string; orcid: string | null; openAlexId: string | null }[] = []

    try {
      const res = await fetch(withOpenAlexApiKey(`https://api.openalex.org/works/openalex:${citedOpenAlexId}`), {
        headers: HEADERS,
      })
      if (res.ok) {
        const data = await res.json()
        doi = data.doi ? data.doi.replace("https://doi.org/", "") : null
        pdfUrl = data.primary_location?.pdf_url ?? data.open_access?.oa_url ?? null
        abstract = reconstructAbstract(data.abstract_inverted_index)
        authorMeta = data.authorships?.map((a: any) => ({
          name: a.author.display_name as string,
          orcid: (a.author.orcid as string | null) ?? null,
          openAlexId: a.author.id ? (a.author.id as string).replace("https://openalex.org/", "") : null,
        })) ?? []
      }
    } catch {}

    // Check for duplicate by DOI
    if (doi) {
      const existingByDoi = await db.paper.findUnique({
        where: { doi },
        select: { id: true, title: true },
      })
      if (existingByDoi) return { type: "duplicate" as const, paper: existingByDoi }
    }

    const paper = await db.paper.create({
      data: {
        title: title.toLowerCase(),
        authors,
        authorMeta,
        year,
        doi,
        journal,
        abstract,
        openAlexId: citedOpenAlexId,
        pdfUrl,
        status: "PENDING_REVIEW",
        discoverySource: "CITED",
      },
    })

    // Mark all citation rows for this paper as reviewed since it's now in the DB
    await db.paperCitation.updateMany({
      where: { citedOpenAlexId },
      data: { reviewed: true },
    })

    return { type: "created" as const, paper }
  }
)

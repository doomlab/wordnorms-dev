import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import { fetchAndStoreCitations } from "src/lib/fetchAndStoreCitations"

const LookupOpenAlex = z.object({
  doi: z.string().optional(),
  title: z.string().optional(),
  paperId: z.number().optional(),
})

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

function formatWork(work: any) {
  const doi = work.doi ? work.doi.replace("https://doi.org/", "") : null
  const openAlexId = work.id ? work.id.replace("https://openalex.org/", "") : null
  const authors: string[] = work.authorships?.map((a: any) => a.author.display_name) ?? []
  const abstract = reconstructAbstract(work.abstract_inverted_index)
  const journal = work.primary_location?.source?.display_name ?? null
  const pdfUrl = work.primary_location?.pdf_url ?? work.open_access?.oa_url ?? null
  return {
    title: (work.title as string | null) ?? null,
    authors,
    year: (work.publication_year as number | null) ?? null,
    doi,
    journal,
    abstract,
    openAlexId,
    pdfUrl,
  }
}

const HEADERS = { "User-Agent": "mailto:buchananlab@gmail.com" }

export default resolver.pipe(
  resolver.zod(LookupOpenAlex),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ doi, title, paperId }) => {
    let work = null

    if (doi) {
      const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      try {
        const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(clean)}`, {
          headers: HEADERS,
        })
        if (res.ok) work = formatWork(await res.json())
      } catch {}
    }

    if (!work && title) {
      try {
        const res = await fetch(
          `https://api.openalex.org/works?filter=title.search:${encodeURIComponent(title)}&per_page=1`,
          { headers: HEADERS }
        )
        if (res.ok) {
          const data = await res.json()
          if (data.results?.[0]) work = formatWork(data.results[0])
        }
      } catch {}
    }

    if (!work) return null

    if (paperId && work.openAlexId) {
      await fetchAndStoreCitations(paperId, work.openAlexId)
    }

    return work
  }
)

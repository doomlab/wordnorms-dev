import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import { fetchAndStoreCitations } from "src/lib/fetchAndStoreCitations"
import { cleanMetadataText } from "src/lib/cleanMetadataText"

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

// PLOS ONE works are heavily mirrored (PMC, Europe PMC, etc.), so primary_location
// is often a repository copy rather than the journal itself — prefer any location
// whose source is actually typed "journal" before falling back to primary_location.
function pickJournal(work: any): string | null {
  const primarySource = work.primary_location?.source
  if (primarySource?.type === "journal" && primarySource.display_name) {
    return primarySource.display_name
  }
  const journalLocation = work.locations?.find((l: any) => l.source?.type === "journal")
  return journalLocation?.source?.display_name ?? primarySource?.display_name ?? null
}

function formatWork(work: any) {
  const doi = work.doi ? work.doi.replace("https://doi.org/", "") : null
  const openAlexId = work.id ? work.id.replace("https://openalex.org/", "") : null
  const authors: string[] = work.authorships?.map((a: any) => a.author.display_name) ?? []
  const authorMeta = work.authorships?.map((a: any) => ({
    name: a.author.display_name as string,
    orcid: (a.author.orcid as string | null) ?? null,
    openAlexId: a.author.id ? (a.author.id as string).replace("https://openalex.org/", "") : null,
  })) ?? []
  const abstract = cleanMetadataText(reconstructAbstract(work.abstract_inverted_index))
  const journal = cleanMetadataText(pickJournal(work))
  const pdfUrl = work.primary_location?.pdf_url ?? work.open_access?.oa_url ?? null
  return {
    title: cleanMetadataText(work.title as string | null),
    authors,
    authorMeta,
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
      await fetchAndStoreCitations(paperId, work.openAlexId, work.doi)
    }

    return work
  }
)

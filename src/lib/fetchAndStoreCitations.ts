import db from "db"

const HEADERS = { "User-Agent": "mailto:buchananlab@gmail.com" }
const BATCH_SIZE = 50

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCitation(work: any) {
  const openAlexId = work.id ? (work.id as string).replace("https://openalex.org/", "") : null
  const authors: string[] = work.authorships?.map((a: any) => a.author.display_name) ?? []
  const journal = work.primary_location?.source?.display_name ?? null
  return {
    citedOpenAlexId: openAlexId as string,
    title: (work.title as string | null) ?? null,
    authors,
    year: (work.publication_year as number | null) ?? null,
    journal,
  }
}

export async function fetchAndStoreCitations(paperId: number, openAlexId: string): Promise<number> {
  // Fetch the paper's referenced_works from OpenAlex
  let referencedIds: string[] = []
  try {
    const res = await fetch(
      `https://api.openalex.org/works/openalex:${openAlexId}?select=referenced_works`,
      { headers: HEADERS }
    )
    if (res.ok) {
      const data = await res.json()
      referencedIds = (data.referenced_works ?? []).map((id: string) =>
        id.replace("https://openalex.org/", "")
      )
    }
  } catch {
    return 0
  }

  if (referencedIds.length === 0) return 0

  // Batch fetch metadata for all referenced works
  const citations: ReturnType<typeof formatCitation>[] = []
  for (let i = 0; i < referencedIds.length; i += BATCH_SIZE) {
    const chunk = referencedIds.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch(
        `https://api.openalex.org/works?filter=ids.openalex:${chunk.join("|")}&per_page=${BATCH_SIZE}&select=id,title,authorships,publication_year,primary_location`,
        { headers: HEADERS }
      )
      if (res.ok) {
        const data = await res.json()
        for (const work of data.results ?? []) {
          citations.push(formatCitation(work))
        }
      }
    } catch {}
  }

  if (citations.length === 0) return 0

  const result = await db.paperCitation.createMany({
    data: citations
      .filter((c) => c.citedOpenAlexId)
      .map((c) => ({ citingPaperId: paperId, ...c })),
    skipDuplicates: true,
  })

  return result.count
}

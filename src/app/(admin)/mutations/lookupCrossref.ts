import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import { cleanMetadataText } from "src/lib/cleanMetadataText"

const LookupCrossref = z.object({
  doi: z.string().min(1),
})

const HEADERS = { "User-Agent": "mailto:buchananlab@gmail.com" }

function formatWork(message: any) {
  const doi = (message.DOI as string | null) ?? null
  const authors: string[] =
    message.author?.map((a: any) => [a.given, a.family].filter(Boolean).join(" ")) ?? []
  const journal = cleanMetadataText(message["container-title"]?.[0] ?? null)
  const dateParts =
    message["published-print"]?.["date-parts"]?.[0] ??
    message["published-online"]?.["date-parts"]?.[0] ??
    message.published?.["date-parts"]?.[0]
  const year = dateParts?.[0] ?? null
  const pdfLink = message.link?.find((l: any) => l["content-type"] === "application/pdf")
  const pdfUrl = pdfLink?.URL ?? message.link?.[0]?.URL ?? null

  return {
    title: cleanMetadataText(message.title?.[0] ?? null),
    authors,
    year: (year as number | null) ?? null,
    doi,
    journal,
    abstract: cleanMetadataText(message.abstract ?? null),
    pdfUrl,
  }
}

export default resolver.pipe(
  resolver.zod(LookupCrossref),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ doi }) => {
    const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, {
      headers: HEADERS,
    })
    if (!res.ok) return null

    const { message } = await res.json()
    return formatWork(message)
  }
)

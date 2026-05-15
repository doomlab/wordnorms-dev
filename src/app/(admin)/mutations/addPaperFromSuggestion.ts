import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"
import { fetchAndStoreCitations } from "src/lib/fetchAndStoreCitations"

const AddPaperFromSuggestion = z.object({
  suggestionId: z.number(),
  title: z.string().min(1),
  authors: z.array(z.string()),
  year: z.number().int().nullable().optional(),
  doi: z.string().nullable().optional(),
  journal: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  openAlexId: z.string().nullable().optional(),
  pdfUrl: z.string().nullable().optional(),
})

export default resolver.pipe(
  resolver.zod(AddPaperFromSuggestion),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ suggestionId, title, ...rest }) => {
    if (rest.doi) {
      const existing = await db.paper.findUnique({
        where: { doi: rest.doi },
        select: { id: true, title: true },
      })
      if (existing) {
        await db.articleSuggestion.update({
          where: { id: suggestionId },
          data: { resolved: true },
        })
        return { type: "duplicate" as const, paper: existing }
      }
    }

    const paper = await db.paper.create({
      data: {
        title: title.toLowerCase(),
        authors: rest.authors,
        year: rest.year ?? null,
        doi: rest.doi ?? null,
        journal: rest.journal ?? null,
        abstract: rest.abstract ?? null,
        openAlexId: rest.openAlexId ?? null,
        pdfUrl: rest.pdfUrl ?? null,
        status: "ACCEPTED",
        discoverySource: "DIRECT",
      },
    })

    await db.articleSuggestion.update({
      where: { id: suggestionId },
      data: { resolved: true },
    })

    if (paper.openAlexId) {
      await fetchAndStoreCitations(paper.id, paper.openAlexId)
    }

    return { type: "created" as const, paper }
  }
)

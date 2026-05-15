import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const SubmitArticleSuggestion = z
  .object({
    title: z.string().max(500).optional(),
    authors: z.string().max(500).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    doi: z.string().max(200).optional(),
    url: z.string().max(500).optional(),
    note: z.string().max(1000).optional(),
  })
  .refine((d) => d.title || d.doi || d.url, {
    message: "Please provide at least a title, DOI, or URL",
  })

export default resolver.pipe(
  resolver.zod(SubmitArticleSuggestion),
  resolver.authorize(),
  async ({ title, authors, year, doi, url, note }, ctx) => {
    const userId = ctx.session.userId as number
    await db.articleSuggestion.create({
      data: { userId, title, authors, year, doi, url, note },
    })
    return { ok: true }
  }
)

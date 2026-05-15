import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const ResolveArticleSuggestion = z.object({
  suggestionId: z.number(),
})

export default resolver.pipe(
  resolver.zod(ResolveArticleSuggestion),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ suggestionId }) => {
    return db.articleSuggestion.update({
      where: { id: suggestionId },
      data: { resolved: true },
    })
  }
)

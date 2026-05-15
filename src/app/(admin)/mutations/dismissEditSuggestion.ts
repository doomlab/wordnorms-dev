import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(z.object({ suggestionId: z.number() })),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ suggestionId }) => {
    return db.extractionEditSuggestion.update({
      where: { id: suggestionId },
      data: { resolved: true },
    })
  }
)

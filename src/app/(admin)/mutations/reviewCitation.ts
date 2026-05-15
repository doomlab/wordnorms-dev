import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const ReviewCitation = z.object({
  citedOpenAlexId: z.string(),
  reviewed: z.boolean(),
})

export default resolver.pipe(
  resolver.zod(ReviewCitation),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ citedOpenAlexId, reviewed }) => {
    await db.paperCitation.updateMany({
      where: { citedOpenAlexId },
      data: { reviewed },
    })
  }
)

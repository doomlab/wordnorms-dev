import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(z.object({ paperId: z.number() })),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ paperId }, ctx) => {
    return db.paperExtraction.update({
      where: { paperId },
      data: { verifiedAt: new Date(), verifiedById: ctx.session.userId, needsReview: false },
    })
  }
)

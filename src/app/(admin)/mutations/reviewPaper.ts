import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"
import { PaperStatus } from "@prisma/client"

const ReviewPaper = z.object({
  paperId: z.number(),
  status: z.nativeEnum(PaperStatus),
  reviewNote: z.string().optional(),
})

export default resolver.pipe(
  resolver.zod(ReviewPaper),
  resolver.authorize("ADMIN"),
  async ({ paperId, status, reviewNote }, ctx) => {
    return db.paper.update({
      where: { id: paperId },
      data: { status, reviewNote, reviewedById: ctx.session.userId },
    })
  }
)

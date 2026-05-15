import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(
    z.object({
      reportId: z.number(),
      paperId: z.number(),
      newStatus: z.enum(["ACCEPTED", "EXCLUDED"]),
    })
  ),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ reportId, paperId, newStatus }, ctx) => {
    await db.paper.update({
      where: { id: paperId },
      data: { status: newStatus, reviewedById: ctx.session.userId },
    })
    return db.paperReport.update({
      where: { id: reportId },
      data: { resolved: true },
    })
  }
)

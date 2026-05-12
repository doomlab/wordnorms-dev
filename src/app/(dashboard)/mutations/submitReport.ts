import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const SubmitReport = z.object({
  paperId: z.number(),
  reason: z.enum(["WRONG_CLASSIFICATION", "DUPLICATE", "OTHER"]),
  note: z.string().max(1000).optional(),
})

export default resolver.pipe(
  resolver.zod(SubmitReport),
  resolver.authorize(),
  async ({ paperId, reason, note }, ctx) => {
    const userId = ctx.session.userId as number
    await db.paperReport.upsert({
      where: { userId_paperId: { userId, paperId } },
      create: { userId, paperId, reason, note, resolved: false },
      update: { reason, note, resolved: false },
    })
    return { ok: true }
  }
)

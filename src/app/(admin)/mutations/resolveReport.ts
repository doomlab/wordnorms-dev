import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const ResolveReport = z.object({
  reportId: z.number(),
})

export default resolver.pipe(
  resolver.zod(ResolveReport),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ reportId }) => {
    return db.paperReport.update({
      where: { id: reportId },
      data: { resolved: true },
    })
  }
)

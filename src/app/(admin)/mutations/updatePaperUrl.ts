import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const UpdatePaperUrl = z.object({
  paperId: z.number(),
  url: z.string().url().or(z.literal("")).nullable(),
})

export default resolver.pipe(
  resolver.zod(UpdatePaperUrl),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ paperId, url }) => {
    return db.paper.update({
      where: { id: paperId },
      data: { url: url || null },
    })
  }
)

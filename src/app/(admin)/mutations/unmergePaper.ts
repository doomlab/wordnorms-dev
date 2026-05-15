import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const UnmergePaper = z.object({
  paperId: z.number(),
})

export default resolver.pipe(
  resolver.zod(UnmergePaper),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ paperId }) => {
    return db.paper.update({
      where: { id: paperId },
      data: { canonicalPaperId: null },
    })
  }
)

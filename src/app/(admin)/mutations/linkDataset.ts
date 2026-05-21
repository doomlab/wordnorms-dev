import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(z.object({ bibtex: z.string(), paperId: z.number() })),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ bibtex, paperId }) => {
    return db.datasetLink.upsert({
      where: { bibtex },
      create: { bibtex, paperId },
      update: { paperId },
    })
  }
)

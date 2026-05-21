import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(z.object({ bibtex: z.string() })),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ bibtex }) => {
    return db.datasetLink.delete({ where: { bibtex } })
  }
)

import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(
    z.object({
      paperId: z.number(),
      language: z.array(z.string()),
      participantCount: z.number().nullable(),
      participantType: z.string().nullable(),
      stimuliType: z.array(z.string()),
      stimuliCount: z.number().nullable(),
      normsCollected: z.array(z.string()),
      instructions: z.string().nullable(),
    })
  ),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ paperId, ...data }) => {
    return db.paperExtraction.update({ where: { paperId }, data })
  }
)

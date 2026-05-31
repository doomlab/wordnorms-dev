import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const ReliabilityEntry = z.object({
  norm: z.string(),
  value: z.number().nullable(),
  metric: z.string().nullable(),
})

export default resolver.pipe(
  resolver.zod(
    z.object({
      paperId: z.number(),
      language: z.array(z.string()),
      participantCount: z.number().nullable(),
      participantType: z.string().nullable(),
      participantLevelData: z.boolean(),
      stimuliType: z.array(z.string()),
      stimuliCount: z.number().nullable(),
      normsCollected: z.array(z.string()),
      instructions: z.string().nullable(),
      licenseUrl: z.string().nullable(),
      dataSource: z.enum(["ai", "human"]).nullable(),
      reliabilities: z.array(ReliabilityEntry),
    })
  ),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ paperId, ...data }) => {
    return db.paperExtraction.update({ where: { paperId }, data })
  }
)

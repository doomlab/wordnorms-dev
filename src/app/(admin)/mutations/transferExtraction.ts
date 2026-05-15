import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const TRANSFERABLE_FIELDS = [
  "language",
  "participantCount",
  "participantType",
  "stimuliType",
  "stimuliCount",
  "normsCollected",
  "instructions",
  "confidence",
  "extractedBy",
  "needsReview",
  "extractedAt",
] as const

const TransferExtraction = z.object({
  fromPaperId: z.number(),
  toPaperId: z.number(),
  fields: z.array(z.enum(TRANSFERABLE_FIELDS)).min(1),
})

export default resolver.pipe(
  resolver.zod(TransferExtraction),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ fromPaperId, toPaperId, fields }) => {
    const source = await db.paperExtraction.findUnique({ where: { paperId: fromPaperId } })
    if (!source) throw new Error(`No extraction found on paper ${fromPaperId}`)

    const target = await db.paperExtraction.findUnique({ where: { paperId: toPaperId } })

    const picked = Object.fromEntries(fields.map((f) => [f, source[f]]))

    if (target) {
      return db.paperExtraction.update({
        where: { paperId: toPaperId },
        data: picked,
      })
    } else {
      // No extraction on canonical yet — create one using source data as base, then override picked fields
      return db.paperExtraction.update({
        where: { paperId: fromPaperId },
        data: { paperId: toPaperId },
      })
    }
  }
)

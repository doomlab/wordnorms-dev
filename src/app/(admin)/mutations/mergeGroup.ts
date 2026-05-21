import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(z.object({ canonicalId: z.number(), duplicateIds: z.array(z.number()).min(1) })),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ canonicalId, duplicateIds }) => {
    const canonical = await db.paper.findUnique({
      where: { id: canonicalId },
      include: { extraction: true },
    })
    if (!canonical) throw new Error(`Paper ${canonicalId} not found`)
    if (canonical.canonicalPaperId) throw new Error(`Paper ${canonicalId} is itself a duplicate`)

    let hasExtraction = !!canonical.extraction
    let merged = 0

    for (const duplicateId of duplicateIds) {
      const duplicate = await db.paper.findUnique({
        where: { id: duplicateId },
        include: { extraction: true },
      })
      if (!duplicate || duplicate.canonicalPaperId) continue

      await db.$transaction(async (tx) => {
        if (!hasExtraction && duplicate.extraction) {
          await tx.paperExtraction.update({
            where: { paperId: duplicateId },
            data: { paperId: canonicalId },
          })
          hasExtraction = true
        }
        await tx.paper.updateMany({
          where: { canonicalPaperId: duplicateId },
          data: { canonicalPaperId: canonicalId },
        })
        await tx.paper.update({
          where: { id: duplicateId },
          data: { canonicalPaperId: canonicalId },
        })
      })
      merged++
    }

    return { merged }
  }
)

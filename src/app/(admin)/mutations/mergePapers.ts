import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const MergePapers = z.object({
  canonicalId: z.number(),
  duplicateId: z.number(),
})

export default resolver.pipe(
  resolver.zod(MergePapers),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ canonicalId, duplicateId }) => {
    if (canonicalId === duplicateId) throw new Error("Cannot merge a paper with itself")

    const [canonical, duplicate] = await Promise.all([
      db.paper.findUnique({ where: { id: canonicalId }, include: { extraction: true } }),
      db.paper.findUnique({ where: { id: duplicateId }, include: { extraction: true } }),
    ])

    if (!canonical) throw new Error(`Paper ${canonicalId} not found`)
    if (!duplicate) throw new Error(`Paper ${duplicateId} not found`)
    if (duplicate.canonicalPaperId)
      throw new Error(`Paper ${duplicateId} is already marked as a duplicate`)
    if (canonical.canonicalPaperId)
      throw new Error(`Paper ${canonicalId} is itself a duplicate — choose the canonical version`)

    return db.$transaction(async (tx) => {
      // Transfer extraction to canonical if canonical has none and duplicate does
      if (!canonical.extraction && duplicate.extraction) {
        await tx.paperExtraction.update({
          where: { paperId: duplicateId },
          data: { paperId: canonicalId },
        })
      }

      return tx.paper.update({
        where: { id: duplicateId },
        data: { canonicalPaperId: canonicalId },
      })
    })
  }
)

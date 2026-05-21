import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

type PairRow = { versioned_id: number; canonical_id: number }

export default resolver.pipe(
  resolver.zod(z.object({})),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async () => {
    const pairs = await db.$queryRaw<PairRow[]>`
      SELECT v.id AS versioned_id, c.id AS canonical_id
      FROM "Paper" v
      JOIN "Paper" c ON c.doi = regexp_replace(v.doi, '[._]v[0-9]+$', '')
      WHERE v.doi ~ '[._]v[0-9]+$'
        AND v.doi != regexp_replace(v.doi, '[._]v[0-9]+$', '')
        AND v."canonicalPaperId" IS NULL
        AND c."canonicalPaperId" IS NULL
    `

    let merged = 0
    for (const { versioned_id, canonical_id } of pairs) {
      await db.$transaction(async (tx) => {
        const [canonical, versioned] = await Promise.all([
          tx.paper.findUnique({ where: { id: canonical_id }, include: { extraction: true } }),
          tx.paper.findUnique({ where: { id: versioned_id }, include: { extraction: true } }),
        ])
        if (!canonical || !versioned) return
        if (!canonical.extraction && versioned.extraction) {
          await tx.paperExtraction.update({
            where: { paperId: versioned_id },
            data: { paperId: canonical_id },
          })
        }
        await tx.paper.updateMany({
          where: { canonicalPaperId: versioned_id },
          data: { canonicalPaperId: canonical_id },
        })
        await tx.paper.update({
          where: { id: versioned_id },
          data: { canonicalPaperId: canonical_id },
        })
      })
      merged++
    }

    return { merged }
  }
)

import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

type PairRow = { versioned_id: number; canonical_id: number }

export default resolver.pipe(
  resolver.zod(z.object({})),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async () => {
    const pairs = await db.$queryRaw<PairRow[]>`
      -- Case 1: bare DOI exists → versioned papers merge into it
      SELECT v.id AS versioned_id, c.id AS canonical_id
      FROM "Paper" v
      JOIN "Paper" c ON c.doi = regexp_replace(v.doi, '[._]v[0-9]+$', '')
      WHERE v.doi ~ '[._]v[0-9]+$'
        AND v.doi != regexp_replace(v.doi, '[._]v[0-9]+$', '')
        AND v."canonicalPaperId" IS NULL
        AND c."canonicalPaperId" IS NULL

      UNION

      -- Case 2: no bare DOI → lowest version (_v1 etc.) is canonical
      SELECT v.id AS versioned_id, c.id AS canonical_id
      FROM "Paper" v
      JOIN "Paper" c ON (
        regexp_replace(v.doi, '[._]v[0-9]+$', '') = regexp_replace(c.doi, '[._]v[0-9]+$', '')
        AND c.doi ~ '[._]v[0-9]+$'
        AND (regexp_match(v.doi, '[._]v([0-9]+)$'))[1]::int
            > (regexp_match(c.doi, '[._]v([0-9]+)$'))[1]::int
        AND NOT EXISTS (
          SELECT 1 FROM "Paper" p3
          WHERE p3.doi ~ '[._]v[0-9]+$'
            AND p3."canonicalPaperId" IS NULL
            AND regexp_replace(p3.doi, '[._]v[0-9]+$', '') = regexp_replace(c.doi, '[._]v[0-9]+$', '')
            AND (regexp_match(p3.doi, '[._]v([0-9]+)$'))[1]::int
                < (regexp_match(c.doi, '[._]v([0-9]+)$'))[1]::int
        )
      )
      WHERE v.doi ~ '[._]v[0-9]+$'
        AND v."canonicalPaperId" IS NULL
        AND c."canonicalPaperId" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "Paper" p2
          WHERE p2.doi = regexp_replace(v.doi, '[._]v[0-9]+$', '')
            AND p2."canonicalPaperId" IS NULL
        )
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

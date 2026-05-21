import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

type GroupRow = { ids: number[] }

export default resolver.pipe(
  resolver.zod(z.object({})),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async () => {
    // Group zenodo papers by normalized title + first author.
    // Within each group, order by zenodo record number so the earliest version (lowest ID) is canonical.
    const groups = await db.$queryRaw<GroupRow[]>`
      WITH zenodo AS (
        SELECT id,
          left(regexp_replace(regexp_replace(lower(title), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'), 80) AS ntitle,
          (regexp_match(doi, '^10[.]5281/zenodo[.]([0-9]+)$'))[1]::int AS record_id
        FROM "Paper"
        WHERE doi ~ '^10[.]5281/zenodo[.][0-9]+$'
          AND "canonicalPaperId" IS NULL
          AND length(title) > 20
      )
      SELECT array_agg(id ORDER BY record_id) AS ids
      FROM zenodo
      GROUP BY ntitle
      HAVING COUNT(*) > 1
    `

    let mergedPapers = 0
    for (const { ids } of groups) {
      const [canonicalId, ...duplicateIds] = ids
      if (!canonicalId || duplicateIds.length === 0) continue

      await db.$transaction(async (tx) => {
        const allPapers = await Promise.all(
          ids.map((id) => tx.paper.findUnique({ where: { id }, include: { extraction: true } }))
        )
        const canonical = allPapers[0]
        if (!canonical) return

        // Promote canonical status: ACCEPTED > PENDING_REVIEW > anything else
        const statuses = allPapers.filter(Boolean).map((p) => p!.status)
        const promotedStatus = statuses.includes("ACCEPTED")
          ? "ACCEPTED"
          : statuses.includes("PENDING_REVIEW")
            ? "PENDING_REVIEW"
            : null

        let hasExtraction = !!canonical.extraction

        for (const dup of allPapers.slice(1)) {
          if (!dup) continue

          if (!hasExtraction && dup.extraction) {
            await tx.paperExtraction.update({
              where: { paperId: dup.id },
              data: { paperId: canonicalId },
            })
            hasExtraction = true
          }
          await tx.paper.updateMany({
            where: { canonicalPaperId: dup.id },
            data: { canonicalPaperId: canonicalId },
          })
          await tx.paper.update({
            where: { id: dup.id },
            data: { canonicalPaperId: canonicalId },
          })
        }

        if (promotedStatus && canonical.status !== promotedStatus) {
          await tx.paper.update({
            where: { id: canonicalId },
            data: { status: promotedStatus },
          })
        }
      })
      mergedPapers += duplicateIds.length
    }

    return { merged: mergedPapers, groups: groups.length }
  }
)

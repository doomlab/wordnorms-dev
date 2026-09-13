import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"
import {
  journalMergeCandidate,
  sameRepositoryMergeCandidate,
  type GroupMember,
} from "src/app/(admin)/admin/duplicates/preprintDetection"

type Row = {
  id: number
  title: string
  doi: string | null
  authors: string[]
  journal: string | null
  groupkey: string
}

export default resolver.pipe(
  resolver.zod(z.object({})),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async () => {
    // Same normalized-title grouping as the Suggestions tab (with the same guard
    // against near-empty keys from non-Latin-script titles), but unpaginated —
    // this scans every matching group, not just the top 50 by count.
    const rows = await db.$queryRaw<Row[]>`
      WITH dup_titles AS (
        SELECT left(regexp_replace(regexp_replace(lower(title), '[^a-z0-9 ]', '', 'g'), '\\s+', ' ', 'g'), 80) AS ntitle
        FROM "Paper"
        WHERE "canonicalPaperId" IS NULL AND length(title) > 20
          AND length(trim(left(regexp_replace(regexp_replace(lower(title), '[^a-z0-9 ]', '', 'g'), '\\s+', ' ', 'g'), 80))) >= 10
        GROUP BY ntitle HAVING COUNT(*) > 1
      )
      SELECT p.id, p.title, p.doi, p.authors, p.journal,
             left(regexp_replace(regexp_replace(lower(p.title), '[^a-z0-9 ]', '', 'g'), '\\s+', ' ', 'g'), 80) AS groupkey
      FROM "Paper" p
      JOIN dup_titles d ON left(regexp_replace(regexp_replace(lower(p.title), '[^a-z0-9 ]', '', 'g'), '\\s+', ' ', 'g'), 80) = d.ntitle
      WHERE p."canonicalPaperId" IS NULL
    `

    const groups = new Map<string, Row[]>()
    for (const r of rows) {
      const list = groups.get(r.groupkey) ?? []
      list.push(r)
      groups.set(r.groupkey, list)
    }

    const asGroupMember = (r: Row): GroupMember => ({
      id: r.id,
      title: r.title,
      year: null,
      status: "",
      doi: r.doi,
      authors: r.authors,
      journal: r.journal,
      has_extraction: false,
      groupkey: r.groupkey,
    })

    let mergedPapers = 0
    let mergedGroups = 0

    for (const members of groups.values()) {
      const gm = members.map(asGroupMember)
      const candidate = journalMergeCandidate(gm) ?? sameRepositoryMergeCandidate(gm)
      if (!candidate) continue

      const canonicalId = candidate.canonical.id
      const duplicateIds = candidate.duplicates.map((d) => d.id)

      const canonical = await db.paper.findUnique({
        where: { id: canonicalId },
        include: { extraction: true },
      })
      if (!canonical || canonical.canonicalPaperId) continue

      let hasExtraction = !!canonical.extraction
      let mergedAny = false

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
        mergedPapers++
        mergedAny = true
      }

      if (mergedAny) mergedGroups++
    }

    return { merged: mergedPapers, groups: mergedGroups }
  }
)

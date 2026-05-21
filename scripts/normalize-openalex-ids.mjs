#!/usr/bin/env node
/**
 * Normalizes openAlexId values that were stored as full URLs
 * (e.g. "https://openalex.org/W123") to bare IDs ("W123").
 *
 * For each full-URL paper:
 *   - If a paper with the bare ID already exists → merge (URL version is duplicate)
 *   - Otherwise → just update the openAlexId in place
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/normalize-openalex-ids.mjs
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const urlPapers = await db.paper.findMany({
    where: { openAlexId: { startsWith: "https://openalex.org/" } },
    include: { extraction: true },
  })

  if (urlPapers.length === 0) {
    console.log("No full-URL openAlexIds found — nothing to do.")
    return
  }

  console.log(`Found ${urlPapers.length} papers with full-URL openAlexIds`)

  let merged = 0
  let normalized = 0

  for (const paper of urlPapers) {
    const bareId = paper.openAlexId.replace("https://openalex.org/", "")

    const existing = await db.paper.findUnique({
      where: { openAlexId: bareId },
      include: { extraction: true },
    })

    if (existing) {
      // Two papers exist for the same openAlexId — merge URL version into bare version
      console.log(`  Merging #${paper.id} (URL) → #${existing.id} (bare) [${bareId}]`)
      await db.$transaction(async (tx) => {
        if (!existing.extraction && paper.extraction) {
          await tx.paperExtraction.update({
            where: { paperId: paper.id },
            data: { paperId: existing.id },
          })
        }
        await tx.paper.updateMany({
          where: { canonicalPaperId: paper.id },
          data: { canonicalPaperId: existing.id },
        })
        await tx.paper.update({
          where: { id: paper.id },
          data: { canonicalPaperId: existing.id },
        })
      })
      merged++
    } else {
      // No conflict — just normalize the ID in place
      console.log(`  Normalizing #${paper.id}: ${paper.openAlexId} → ${bareId}`)
      await db.paper.update({
        where: { id: paper.id },
        data: { openAlexId: bareId },
      })
      normalized++
    }
  }

  console.log(`\nDone — ${normalized} normalized, ${merged} merged as duplicates`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => db.$disconnect())

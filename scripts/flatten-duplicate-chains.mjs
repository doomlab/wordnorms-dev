#!/usr/bin/env node
/**
 * Finds and flattens chained canonicalPaperId references.
 *
 * A chain looks like: A.canonicalPaperId → B, B.canonicalPaperId → C
 * After fix: A.canonicalPaperId → C, B.canonicalPaperId → C
 *
 * Runs iteratively until no chains remain (handles arbitrary depth).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/flatten-duplicate-chains.mjs
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  let round = 0
  let totalFixed = 0

  while (true) {
    round++
    // Find papers whose canonical is itself a duplicate (chain)
    const chains = await db.$queryRaw`
      SELECT a.id AS id, b."canonicalPaperId" AS resolved_canonical_id
      FROM "Paper" a
      JOIN "Paper" b ON b.id = a."canonicalPaperId"
      WHERE a."canonicalPaperId" IS NOT NULL
        AND b."canonicalPaperId" IS NOT NULL
    `

    if (chains.length === 0) {
      console.log(`Round ${round}: no chains found — done.`)
      break
    }

    console.log(`Round ${round}: ${chains.length} chained reference(s) found, fixing…`)

    for (const { id, resolved_canonical_id } of chains) {
      await db.paper.update({
        where: { id },
        data: { canonicalPaperId: resolved_canonical_id },
      })
    }

    totalFixed += chains.length
    console.log(`Round ${round}: fixed ${chains.length}`)
  }

  console.log(`\nTotal references flattened: ${totalFixed}`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => db.$disconnect())

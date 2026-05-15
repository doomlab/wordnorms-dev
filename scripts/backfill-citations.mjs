#!/usr/bin/env node
/**
 * Backfills PaperCitation rows for accepted papers that have an openAlexId
 * but no citations stored yet.
 *
 * Usage:
 *   node scripts/backfill-citations.mjs
 *   node scripts/backfill-citations.mjs --batch-size 20 --delay 2000
 *
 * Options:
 *   --batch-size N   Papers to process per run (default: 50)
 *   --delay N        Ms to wait between papers to respect API rate limits (default: 1000)
 *   --dry-run        Print what would be processed without writing to DB
 */

import { PrismaClient } from "@prisma/client"

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .matchAll(/--(\w[\w-]*)(?:\s+(\S+))?/g),
  // eslint-disable-next-line no-unused-vars
  ([_, k, v]) => [k, v ?? true]
)

const BATCH_SIZE = parseInt(args["batch-size"] ?? "50", 10)
const DELAY_MS = parseInt(args["delay"] ?? "1000", 10)
const DRY_RUN = args["dry-run"] === true

const HEADERS = { "User-Agent": "mailto:buchananlab@gmail.com" }
const OPENALEX_BATCH = 50

const db = new PrismaClient()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchReferencedIds(openAlexId) {
  const res = await fetch(
    `https://api.openalex.org/works/openalex:${openAlexId}?select=referenced_works`,
    { headers: HEADERS }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.referenced_works ?? []).map((id) => id.replace("https://openalex.org/", ""))
}

async function fetchCitationMetadata(ids) {
  const results = []
  for (let i = 0; i < ids.length; i += OPENALEX_BATCH) {
    const chunk = ids.slice(i, i + OPENALEX_BATCH)
    const filter = chunk.map((id) => `openalex:${id}`).join("|")
    const res = await fetch(
      `https://api.openalex.org/works?filter=ids.openalex:${encodeURIComponent(filter)}&per_page=${OPENALEX_BATCH}&select=id,title,authorships,publication_year,primary_location`,
      { headers: HEADERS }
    )
    if (!res.ok) continue
    const data = await res.json()
    for (const work of data.results ?? []) {
      const openAlexId = work.id?.replace("https://openalex.org/", "") ?? null
      if (!openAlexId) continue
      results.push({
        citedOpenAlexId: openAlexId,
        title: work.title ?? null,
        authors: work.authorships?.map((a) => a.author.display_name) ?? [],
        year: work.publication_year ?? null,
        journal: work.primary_location?.source?.display_name ?? null,
      })
    }
  }
  return results
}

async function main() {
  // Find accepted papers with an openAlexId that have no citations stored yet
  const papers = await db.paper.findMany({
    where: {
      status: { in: ["ACCEPTED", "ADDED_TO_TRAINING"] },
      openAlexId: { not: null },
      citationsFrom: { none: {} },
    },
    select: { id: true, title: true, openAlexId: true },
    take: BATCH_SIZE,
    orderBy: { id: "asc" },
  })

  console.log(`Found ${papers.length} papers to process (batch size: ${BATCH_SIZE})`)
  if (DRY_RUN) {
    for (const p of papers) console.log(`  [dry-run] ${p.id}: ${p.title}`)
    await db.$disconnect()
    return
  }

  let totalStored = 0

  for (const paper of papers) {
    process.stdout.write(`  Paper ${paper.id} (${paper.openAlexId})... `)

    try {
      const refIds = await fetchReferencedIds(paper.openAlexId)
      if (refIds.length === 0) {
        console.log("no references found")
        await sleep(DELAY_MS)
        continue
      }

      const citations = await fetchCitationMetadata(refIds)
      if (citations.length === 0) {
        console.log(`${refIds.length} refs but metadata fetch returned 0`)
        await sleep(DELAY_MS)
        continue
      }

      const result = await db.paperCitation.createMany({
        data: citations.map((c) => ({ citingPaperId: paper.id, ...c })),
        skipDuplicates: true,
      })

      totalStored += result.count
      console.log(`stored ${result.count} of ${refIds.length} refs`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
    }

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. Stored ${totalStored} citation rows across ${papers.length} papers.`)
  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

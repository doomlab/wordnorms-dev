#!/usr/bin/env node
/**
 * Backfills authorMeta for papers that have an openAlexId but no authorMeta stored yet.
 * Fetches authorships (name, ORCID, OpenAlex author ID) from OpenAlex in batches of 50.
 *
 * Usage:
 *   npm run backfill:author-meta
 *   npm run backfill:author-meta -- --batch-size 500 --delay 300
 *   npm run backfill:author-meta -- --all      (re-fetch even papers that already have authorMeta)
 *   npm run backfill:author-meta -- --dry-run
 *
 * Options:
 *   --batch-size N   Max papers to process in one run (default: 200)
 *   --delay N        Ms to wait between OpenAlex API chunks (default: 500)
 *   --dry-run        Print what would be processed without writing to DB
 *   --all            Re-fetch even papers that already have authorMeta
 */

import { PrismaClient } from "@prisma/client"

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith("--")) {
    const key = process.argv[i].slice(2)
    const next = process.argv[i + 1]
    args[key] = next && !next.startsWith("--") ? process.argv[++i] : true
  }
}

const BATCH_SIZE = parseInt(args["batch-size"] ?? "200", 10)
const DELAY_MS = parseInt(args["delay"] ?? "2000", 10)
const DRY_RUN = args["dry-run"] === true
const REFETCH_ALL = args["all"] === true
const OPENALEX_CHUNK = 50

const HEADERS = { "User-Agent": "mailto:buchananlab@gmail.com" }

const db = new PrismaClient()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchAuthorships(openAlexIds) {
  const results = new Map()
  for (let i = 0; i < openAlexIds.length; i += OPENALEX_CHUNK) {
    const chunk = openAlexIds.slice(i, i + OPENALEX_CHUNK)
    try {
      const res = await fetch(
        `https://api.openalex.org/works?filter=ids.openalex:${chunk.join("|")}&per_page=${OPENALEX_CHUNK}&select=id,authorships`,
        { headers: HEADERS }
      )
      if (!res.ok) {
        console.warn(`  API ${res.status} for chunk ${Math.floor(i / OPENALEX_CHUNK) + 1}`)
        continue
      }
      const data = await res.json()
      for (const work of data.results ?? []) {
        const id = work.id?.replace("https://openalex.org/", "")
        if (!id) continue
        results.set(
          id,
          work.authorships?.map((a) => ({
            name: a.author.display_name,
            orcid: a.author.orcid ?? null,
            openAlexId: a.author.id ? a.author.id.replace("https://openalex.org/", "") : null,
          })) ?? []
        )
      }
    } catch (err) {
      console.warn(`  Fetch error for chunk ${Math.floor(i / OPENALEX_CHUNK) + 1}: ${err.message}`)
    }
    if (i + OPENALEX_CHUNK < openAlexIds.length) await sleep(DELAY_MS)
  }
  return results
}

async function main() {
  const papers = await db.paper.findMany({
    where: {
      openAlexId: { not: null },
      ...(REFETCH_ALL ? {} : { authorMeta: null }),
    },
    select: { id: true, title: true, openAlexId: true },
    take: BATCH_SIZE,
    orderBy: { id: "asc" },
  })

  const label = REFETCH_ALL ? "all papers with openAlexId" : "papers missing authorMeta"
  console.log(`Found ${papers.length} ${label} (batch size: ${BATCH_SIZE})`)

  if (DRY_RUN) {
    for (const p of papers) console.log(`  [dry-run] ${p.id}: ${p.title}`)
    await db.$disconnect()
    return
  }

  if (papers.length === 0) {
    console.log("Nothing to do.")
    await db.$disconnect()
    return
  }

  const ids = papers.map((p) => p.openAlexId)
  const chunks = Math.ceil(ids.length / OPENALEX_CHUNK)
  console.log(`Fetching from OpenAlex in ${chunks} chunk${chunks === 1 ? "" : "s"} of up to ${OPENALEX_CHUNK}...`)

  const authorMetaById = await fetchAuthorships(ids)
  console.log(`Received authorships for ${authorMetaById.size} / ${papers.length} papers\n`)

  let updated = 0
  let missing = 0

  for (const paper of papers) {
    const meta = authorMetaById.get(paper.openAlexId)
    if (meta === undefined) {
      console.log(`  [missing] ${paper.id}: ${paper.openAlexId}`)
      missing++
      continue
    }
    await db.paper.update({
      where: { id: paper.id },
      data: { authorMeta: meta },
    })
    updated++
    if (updated % 25 === 0) process.stdout.write(`  ${updated} updated...\r`)
  }

  console.log(`\nDone. ${updated} updated, ${missing} not found in OpenAlex.`)
  if (papers.length === BATCH_SIZE) {
    console.log(`Batch limit reached — run again to continue (${papers.length} processed this run).`)
  }

  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

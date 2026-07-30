#!/usr/bin/env node
/**
 * Loads Norms Card JSON documents into the NormsCard table.
 *
 * A Norms Card is a structured documentation record for one norms dataset
 * (constructs, scales, participants, provenance, reporting gaps). Cards live
 * in data/norms-cards/; mapping.json says which card belongs to which
 * dataset page (bibtex handle). One card can serve several dataset pages
 * when one study is split across several CSV files.
 *
 * Usage (after `prisma migrate deploy` has created the NormsCard table):
 *   npm run import:norms-cards
 *
 * The script is idempotent: it inserts or updates only NormsCard rows and
 * touches nothing else. Re-running it is always safe.
 */

import { readFile } from "fs/promises"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "data", "norms-cards")
const prisma = new PrismaClient()

async function main() {
  const mapping = JSON.parse(await readFile(join(DATA_DIR, "mapping.json"), "utf8"))
  let count = 0
  for (const [bibtex, file] of Object.entries(mapping)) {
    const card = JSON.parse(await readFile(join(DATA_DIR, file), "utf8"))
    if (!card.schema_version || !card.layer1?.dataset_name) {
      throw new Error(`${file}: not a Norms Card (missing schema_version or layer1.dataset_name)`)
    }
    await prisma.normsCard.upsert({
      where: { bibtex },
      update: { card },
      create: { bibtex, card },
    })
    console.log(`upserted ${bibtex} <- ${file} (Norms Card schema v${card.schema_version})`)
    count++
  }
  console.log(`Done - ${count} NormsCard rows in place.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

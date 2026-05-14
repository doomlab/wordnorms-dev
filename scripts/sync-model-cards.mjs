#!/usr/bin/env node
/**
 * Fetches YAML model cards from the SemanticPrimeR GitHub repo and writes them
 * plus a parsed _data.json to data/model-cards/.
 *
 * Cron (monthly):
 *   0 0 1 * * cd /path/to/wordnorms-dev && node scripts/sync-model-cards.mjs >> /var/log/wordnorms-sync.log 2>&1
 *
 * Optional env:
 *   GITHUB_TOKEN — increases rate limit from 60 to 5000 req/hr
 */

import { mkdir, writeFile, readFile } from "fs/promises"
import { existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import yaml from "js-yaml"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "..", "data", "model-cards")
const GITHUB_CONTENTS_URL =
  "https://api.github.com/repos/SemanticPriming/semanticprimeR/contents/inst/extdata/model_cards"

function githubHeaders() {
  const h = { "User-Agent": "wordnorms-sync", Accept: "application/vnd.github.v3+json" }
  if (process.env.GITHUB_TOKEN) h["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`
  return h
}

function parseFlags(flags) {
  if (!flags || typeof flags !== "object") return []
  return Object.entries(flags)
    .filter(([, v]) => v === "yes" || v === true)
    .map(([k]) => k)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  console.log(`[${new Date().toISOString()}] Fetching file list from GitHub…`)
  const listRes = await fetch(GITHUB_CONTENTS_URL, { headers: githubHeaders() })
  if (!listRes.ok) throw new Error(`GitHub API ${listRes.status}: ${await listRes.text()}`)

  const entries = await listRes.json()
  const yamlFiles = entries.filter(
    (f) => f.type === "file" && (f.name.endsWith(".yaml") || f.name.endsWith(".yml"))
  )
  console.log(`Found ${yamlFiles.length} YAML files`)

  const cards = []
  let saved = 0
  let skipped = 0

  for (const file of yamlFiles) {
    const destPath = join(OUT_DIR, file.name)

    // Check if local copy already matches by sha
    let needsUpdate = true
    if (existsSync(destPath)) {
      const existing = await readFile(join(OUT_DIR, "_manifest.json"), "utf8").catch(() => null)
      const manifest = existing ? JSON.parse(existing) : {}
      if (manifest.shas?.[file.name] === file.sha) {
        needsUpdate = false
      }
    }

    let content
    if (needsUpdate) {
      content = await fetch(file.download_url).then((r) => r.text())
      await writeFile(destPath, content, "utf8")
      saved++
    } else {
      content = await readFile(destPath, "utf8")
      skipped++
    }

    try {
      const doc = yaml.load(content)
      if (!doc?.citation) continue
      cards.push({
        bibtex: doc.bibtex ?? file.name.replace(/\.ya?ml$/, ""),
        parentBibtex: doc.parent_bibtex && doc.parent_bibtex !== "~" ? doc.parent_bibtex : null,
        citation: {
          author: doc.citation.author ?? "",
          year: doc.citation.year ?? null,
          title: doc.citation.title ?? "",
          journal: doc.citation.journal ?? null,
          doi: doc.citation.doi ?? null,
        },
        language: doc.dataset?.language_from_columns ?? null,
        nRows: doc.dataset?.n_rows_csv ?? null,
        flags: parseFlags(doc.variables?.flags),
      })
    } catch {
      console.warn(`  ⚠ Could not parse ${file.name}`)
    }
  }

  // Sort by year desc, then title
  cards.sort((a, b) => {
    if ((b.citation.year ?? 0) !== (a.citation.year ?? 0))
      return (b.citation.year ?? 0) - (a.citation.year ?? 0)
    return (a.citation.title ?? "").localeCompare(b.citation.title ?? "")
  })

  // Write parsed data
  await writeFile(
    join(OUT_DIR, "_data.json"),
    JSON.stringify({ syncedAt: new Date().toISOString(), cards }, null, 2),
    "utf8"
  )

  // Write manifest with shas for incremental updates
  const shas = Object.fromEntries(yamlFiles.map((f) => [f.name, f.sha]))
  await writeFile(
    join(OUT_DIR, "_manifest.json"),
    JSON.stringify({ syncedAt: new Date().toISOString(), shas }, null, 2),
    "utf8"
  )

  console.log(`Done — ${saved} updated, ${skipped} unchanged, ${cards.length} cards in _data.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

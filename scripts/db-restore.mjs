#!/usr/bin/env node
/**
 * Restore a SQL dump into the database specified by DATABASE_URL.
 *
 * Usage:
 *   npm run db:restore -- --file=wordnorms-2026-05-31.sql
 *
 * The script redacts credentials in the confirmation prompt and requires
 * an explicit "y" before touching the database.
 */
import { execSync } from "child_process"
import { existsSync } from "fs"
import { createInterface } from "readline"

const args = process.argv.slice(2)
const fileArg =
  args.find((a) => a.startsWith("--file="))?.slice(7) ??
  (args.includes("--file") ? args[args.indexOf("--file") + 1] : null)

if (!fileArg) {
  console.error("Usage: npm run db:restore -- --file=path/to/dump.sql")
  process.exit(1)
}
if (!existsSync(fileArg)) {
  console.error(`File not found: ${fileArg}`)
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL not found. Run via: npm run db:restore -- --file=...")
  process.exit(1)
}

const redacted = url.replace(/\/\/[^@]+@/, "//***@")
const rl = createInterface({ input: process.stdin, output: process.stdout })

rl.question(`\nRestore "${fileArg}" into ${redacted}?\nThis will OVERWRITE existing data. Type "y" to continue: `, (answer) => {
  rl.close()
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Aborted.")
    process.exit(0)
  }
  try {
    execSync(`psql "${url}" < "${fileArg}"`, { stdio: "inherit" })
    console.log("\nRestore complete.")
  } catch {
    console.error("\nRestore failed. Check the output above for details.")
    process.exit(1)
  }
})

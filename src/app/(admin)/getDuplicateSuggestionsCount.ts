import db from "db"

// Same normalized-title grouping (and guard against near-empty keys from
// non-Latin-script titles) used by the Suggestions tab on /admin/duplicates —
// shared here so the Navbar badge and admin dashboard card agree with it.
export async function getDuplicateSuggestionsCount() {
  const [doiCount, titleCount] = await Promise.all([
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::int AS count FROM (
        SELECT doi FROM "Paper"
        WHERE doi IS NOT NULL AND "canonicalPaperId" IS NULL
        GROUP BY doi HAVING COUNT(*) > 1
      ) sub
    `,
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::int AS count FROM (
        SELECT left(regexp_replace(regexp_replace(lower(title), '[^a-z0-9 ]', '', 'g'), '\\s+', ' ', 'g'), 80)
        FROM "Paper"
        WHERE "canonicalPaperId" IS NULL AND length(title) > 20
          AND length(trim(left(regexp_replace(regexp_replace(lower(title), '[^a-z0-9 ]', '', 'g'), '\\s+', ' ', 'g'), 80))) >= 10
        GROUP BY 1 HAVING COUNT(*) > 1
      ) sub
    `,
  ])
  return Number(doiCount[0]?.count ?? 0) + Number(titleCount[0]?.count ?? 0)
}

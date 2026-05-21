import Link from "next/link"
import db from "db"
import { getBlitzContext } from "../blitz-server"
import { LogoutButton } from "../(auth)/components/LogoutButton"
import { ThemeToggle } from "./ThemeToggle"

interface NavbarProps {
  leftLinks?: React.ReactNode
  rightExtra?: React.ReactNode
  className?: string
}

export async function Navbar({ leftLinks, rightExtra, className }: NavbarProps) {
  const ctx = await getBlitzContext()
  const userId = ctx.session.userId
  const role = ctx.session.role

  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN"

  const [
    pendingReviewCount,
    excludedCount,
    extractionCount,
    metadataCount,
    reportsCount,
    suggestionsCount,
    citationsCount,
    duplicateSuggestionsCount,
  ] = isAdmin
    ? await Promise.all([
        db.paper.count({ where: { status: "PENDING_REVIEW", canonicalPaperId: null } }),
        db.paper.count({ where: { status: "EXCLUDED", canonicalPaperId: null, reviewedById: null } }),
        Promise.all([
          db.paper.count({ where: { status: "ACCEPTED", canonicalPaperId: null, extraction: null, pdfUrl: { not: null } } }),
          db.paper.count({ where: { status: "ACCEPTED", canonicalPaperId: null, OR: [{ extraction: { is: null }, pdfUrl: null }, { extraction: { needsReview: true, confidence: null } }] } }),
        ]).then(([hasPdf, noPdf]) => hasPdf + noPdf),
        db.paperExtraction.count({ where: { verifiedAt: null, paper: { status: "ACCEPTED", canonicalPaperId: null } } }),
        db.paperReport.count({ where: { resolved: false } }),
        db.articleSuggestion.count({ where: { resolved: false } }),
        db.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT pc."citedOpenAlexId")::int AS count FROM "PaperCitation" pc
          WHERE NOT EXISTS (
            SELECT 1 FROM "Paper" p WHERE p."openAlexId" = pc."citedOpenAlexId"
          )
          AND pc.reviewed = false
        `.then((r) => Number(r[0]?.count ?? 0)),
        Promise.all([
          db.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*)::int AS count FROM (
              SELECT a.id FROM "Paper" a
              JOIN "Paper" b ON b.id > a.id AND a.doi = b.doi
              WHERE a.doi IS NOT NULL
                AND a."canonicalPaperId" IS NULL
                AND b."canonicalPaperId" IS NULL
              LIMIT 50
            ) sub
          `.then((r) => Number(r[0]?.count ?? 0)),
          db.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*)::int AS count FROM (
              WITH normed AS (
                SELECT id, lower(left(title, 80)) AS ntitle
                FROM "Paper"
                WHERE "canonicalPaperId" IS NULL AND length(title) > 20
              )
              SELECT a.id FROM normed a
              JOIN normed b ON b.id > a.id AND a.ntitle = b.ntitle
              LIMIT 50
            ) sub
          `.then((r) => Number(r[0]?.count ?? 0)),
        ]).then(([doi, title]) => doi + title),
      ])
    : [0, 0, 0, 0, 0, 0, 0, 0]

  return (
    <div className={`navbar bg-base-200 px-6 shadow-sm sticky top-0 z-50 ${className ?? ""}`}>
      <div className="flex-1 gap-4">
        <Link href="/" className="text-xl font-bold">
          WordNorms.com
        </Link>
        {leftLinks}
      </div>
      <div className="flex-none gap-2">
        {rightExtra}
        <ThemeToggle />
        {userId ? (
          <>
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-primary btn-sm mr-2">
                Database ▾
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-md border border-base-300 mt-1"
              >
                <li>
                  <Link href="/">Search</Link>
                </li>
                <li>
                  <Link href="/excluded">Excluded</Link>
                </li>
                <li>
                  <Link href="/datasets">Datasets</Link>
                </li>
                <li>
                  <Link href="/visualizations">Visualizations</Link>
                </li>
                <li>
                  <Link href="/favorites">★ My Favorites</Link>
                </li>
              </ul>
            </div>
            <Link href="/dashboard/profile" className="btn btn-info btn-sm mr-2">
              Profile
            </Link>
            {isAdmin && (
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-secondary btn-sm mr-2">
                  Admin ▾
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-md border border-base-300 mt-1"
                >
                  <li><Link href="/admin">Home</Link></li>
                  <li>
                    <Link href="/admin/review" className="flex justify-between">
                      <span>Included</span>
                      {pendingReviewCount > 0 && <span className="badge badge-warning badge-sm">{pendingReviewCount}</span>}
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/excluded" className="flex justify-between">
                      <span>Excluded</span>
                      {excludedCount > 0 && <span className="badge badge-warning badge-sm">{excludedCount}</span>}
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/extract" className="flex justify-between">
                      <span>Extraction</span>
                      {extractionCount > 0 && <span className="badge badge-warning badge-sm">{extractionCount}</span>}
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/metadata" className="flex justify-between">
                      <span>Metadata Review</span>
                      {metadataCount > 0 && <span className="badge badge-warning badge-sm">{metadataCount}</span>}
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/reports" className="flex justify-between">
                      <span>User Reports</span>
                      {reportsCount > 0 && <span className="badge badge-warning badge-sm">{reportsCount}</span>}
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/suggestions" className="flex justify-between">
                      <span>Suggestions</span>
                      {suggestionsCount > 0 && <span className="badge badge-warning badge-sm">{suggestionsCount}</span>}
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/citations" className="flex justify-between">
                      <span>Citations</span>
                      {citationsCount > 0 && <span className="badge badge-warning badge-sm">{citationsCount}</span>}
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/duplicates" className="flex justify-between">
                      <span>Duplicates</span>
                      {duplicateSuggestionsCount > 0 && <span className="badge badge-warning badge-sm">{duplicateSuggestionsCount}</span>}
                    </Link>
                  </li>
                  <li><Link href="/admin/datasets" className="flex justify-between">
                    <span>Datasets</span>
                  </Link></li>
                  <li><Link href="/admin/papers">Edit Papers</Link></li>
                  <li><Link href="/admin/stats">Stats</Link></li>
                  <li><Link href="/admin/users">Users</Link></li>
                </ul>
              </div>
            )}
            <LogoutButton />
          </>
        ) : (
          <>
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-primary btn-sm ">
                Database ▾
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box z-50 w-44 p-2 shadow-md border border-base-300 mt-1"
              >
                <li>
                  <Link href="/">Search</Link>
                </li>
                <li>
                  <Link href="/excluded">Excluded</Link>
                </li>
                <li>
                  <Link href="/datasets">Datasets</Link>
                </li>
                <li>
                  <Link href="/visualizations">Visualizations</Link>
                </li>
              </ul>
            </div>
            <Link href="/login" className="btn btn-accent btn-sm m-2">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-secondary btn-sm">
              Sign up
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

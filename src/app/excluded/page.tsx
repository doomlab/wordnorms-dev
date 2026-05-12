import { Navbar } from "../components/Navbar"
import { getBlitzContext } from "../blitz-server"
import db from "db"

export const metadata = { title: "Excluded Papers – WordNorms" }

export default async function ExcludedPage() {
  await getBlitzContext()

  const papers = await db.paper.findMany({
    where: { status: "EXCLUDED" },
    select: {
      id: true,
      title: true,
      authors: true,
      year: true,
      doi: true,
      reviewNote: true,
    },
    orderBy: { year: "desc" },
  })

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="max-w-4xl w-full mx-auto px-6 py-10">
        <div className="mb-8">
          <a href="/" className="text-sm text-base-content/50 hover:text-primary mb-4 inline-block">
            ← Browse word norms
          </a>
          <h1 className="text-3xl font-bold mb-2">Excluded papers</h1>
          <p className="text-base-content/60">
            Papers reviewed and determined not to be word norm studies.
            Click any row to expand details.
          </p>
        </div>

        <p className="text-sm text-base-content/60 mb-5">
          <span className="font-semibold text-base-content">{papers.length}</span>{" "}
          {papers.length === 1 ? "paper" : "papers"} excluded
        </p>

        {papers.length === 0 ? (
          <p className="text-base-content/40 py-16 text-center">No excluded papers yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-base-200">
            {papers.map((paper) => (
              <li key={paper.id} className="-mx-3">
                <details className="group">
                  <summary className="flex items-center justify-between gap-4 py-4 px-3 cursor-pointer hover:bg-base-200/40 rounded-lg transition-colors list-none">
                    <div className="min-w-0">
                      <span className="font-medium text-sm leading-snug line-clamp-2">
                        {paper.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {paper.year && (
                        <span className="text-xs text-base-content/50">{paper.year}</span>
                      )}
                      <span className="text-base-content/40 group-open:rotate-90 transition-transform text-xs">
                        ▶
                      </span>
                    </div>
                  </summary>

                  <div className="px-3 pb-5 pt-1 space-y-2 text-sm text-base-content/70">
                    {paper.authors.length > 0 && (
                      <p>
                        <span className="font-medium text-base-content">Authors:</span>{" "}
                        {paper.authors.join(", ")}
                      </p>
                    )}
                    {paper.year && (
                      <p>
                        <span className="font-medium text-base-content">Year:</span> {paper.year}
                      </p>
                    )}
                    {paper.doi && (
                      <p>
                        <span className="font-medium text-base-content">DOI:</span>{" "}
                        <a
                          href={`https://doi.org/${paper.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary break-all"
                        >
                          {paper.doi}
                        </a>
                      </p>
                    )}
                    {paper.reviewNote && (
                      <p>
                        <span className="font-medium text-base-content">Note:</span>{" "}
                        {paper.reviewNote}
                      </p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

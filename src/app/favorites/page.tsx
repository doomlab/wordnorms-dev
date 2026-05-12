import { redirect } from "next/navigation"
import { Navbar } from "../components/Navbar"
import { FavoriteButton } from "../components/FavoriteButton"
import { getBlitzContext } from "../blitz-server"
import db from "db"

export const metadata = { title: "My Favorites – WordNorms" }

export default async function FavoritesPage() {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) redirect("/login")

  const userId = ctx.session.userId as number

  const favorites = await db.userFavorite.findMany({
    where: { userId },
    include: {
      paper: {
        include: { extraction: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="max-w-4xl w-full mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Favorites</h1>
          <p className="text-base-content/60">Papers you&apos;ve saved for quick reference.</p>
        </div>

        <p className="text-sm text-base-content/60 mb-5">
          <span className="font-semibold text-base-content">{favorites.length}</span>{" "}
          {favorites.length === 1 ? "paper" : "papers"} saved
        </p>

        {favorites.length === 0 ? (
          <div className="text-center py-16 text-base-content/40">
            <p className="text-lg">No favorites yet.</p>
            <a href="/" className="link link-primary text-sm mt-2 inline-block">
              Browse word norms
            </a>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-base-200">
            {favorites.map(({ paper }) => {
              const ext = paper.extraction
              const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : null
              return (
                <li
                  key={paper.id}
                  className="py-5 hover:bg-base-200/40 px-3 -mx-3 rounded-lg transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-base leading-snug mb-1">{paper.title}</h2>
                      {paper.abstract && (
                        <p className="text-sm text-base-content/60 mb-3 line-clamp-2">
                          {paper.abstract}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50">
                        {ext?.language && ext.language.length > 0 && (
                          <>
                            <span className="font-medium text-base-content/70">
                              {ext.language.join(", ")}
                            </span>
                            <span>·</span>
                          </>
                        )}
                        {paper.year && <span>{paper.year}</span>}
                        {ext?.stimuliCount && (
                          <>
                            <span>·</span>
                            <span>{ext.stimuliCount.toLocaleString()} stimuli</span>
                          </>
                        )}
                        {ext?.normsCollected && ext.normsCollected.length > 0 && (
                          <>
                            <span>·</span>
                            <span>{ext.normsCollected.join(", ")}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <FavoriteButton paperId={paper.id} initialFavorited={true} />
                      {doiUrl && (
                        <a
                          href={doiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline btn-sm"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

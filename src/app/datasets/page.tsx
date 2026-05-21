import fs from "fs"
import path from "path"
import { Suspense } from "react"
import { Navbar } from "../components/Navbar"
import { DatasetFilters } from "../components/DatasetFilters"
import { DatasetFavoriteButton } from "../components/DatasetFavoriteButton"
import { SuggestDatasetButton } from "../components/SuggestDatasetButton"
import { DECADE_LABELS } from "../data/datasets"
import { getBlitzContext } from "../blitz-server"
import db from "db"

export const dynamic = "force-dynamic"
export const metadata = { title: "Datasets – WordNorms" }

type Card = {
  bibtex: string
  parentBibtex: string | null
  citation: {
    author: string
    year: number | null
    title: string
    journal: string | null
    doi: string | null
  }
  language: string | null
  nRows: number | null
  flags: string[]
  wordColumns: string[]
  rawColumns: string[]
}

type DataFile = { syncedAt: string; cards: Card[] }

const FLAG_LABELS: Record<string, string> = {
  accuracy: "Accuracy",
  ambiguity: "Ambiguity",
  aoa: "Age of acquisition",
  arousal: "Arousal",
  assoc: "Association",
  category: "Category",
  complex: "Complexity",
  concrete: "Concreteness",
  context: "Context",
  dominate: "Dominance",
  emotion: "Emotion",
  familiar: "Familiarity",
  freq: "Frequency",
  imageagree: "Image agreement",
  imagevar: "Image variability",
  imagine: "Imageability",
  intense: "Intensity",
  letters: "Letters",
  meaning: "Meaning",
  modality: "Modality",
  morph: "Morphology",
  nameagree: "Name agreement",
  orthon: "Orthog. neighbors",
  phonemes: "Phonemes",
  picture: "Picture",
  pos: "Part of speech",
  pronounce: "Pronunciation",
  recognition: "Recognition",
  relevance: "Relevance",
  rt: "Reaction time",
  semantic: "Semantic",
  sensory: "Sensory",
  similar: "Similarity",
  syllables: "Syllables",
  taboo: "Taboo",
  typical: "Typicality",
  valence: "Valence",
  visualcomp: "Visual complexity",
}

// A comma-separated or underscore-suffixed language string like
// "chinese_simplified_cue, chinese_simplified_response" → ["Chinese"]
function extractBaseLanguages(raw: string): string[] {
  const seen = new Set<string>()
  for (const part of raw.split(",")) {
    const base = part.trim().split("_")[0].toLowerCase()
    if (!base) continue
    const label = base.charAt(0).toUpperCase() + base.slice(1)
    seen.add(label)
  }
  return Array.from(seen)
}

function loadData(): DataFile | null {
  const p = path.join(process.cwd(), "data", "model-cards", "_data.json")
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as DataFile
  } catch {
    return null
  }
}

function capFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default async function DatasetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    lang?: string | string[]
    decade?: string | string[]
    flag?: string | string[]
  }>
}) {
  const params = await searchParams
  const ctx = await getBlitzContext()
  const userId = ctx.session.userId as number | undefined

  const q = params.q?.trim().toLowerCase() || undefined
  const selectedLanguages = params.lang
    ? Array.isArray(params.lang) ? params.lang : [params.lang]
    : []
  const selectedDecades = params.decade
    ? Array.isArray(params.decade) ? params.decade : [params.decade]
    : []
  const selectedFlags = params.flag
    ? Array.isArray(params.flag) ? params.flag : [params.flag]
    : []

  const [data, favoritedBibtexSet] = await Promise.all([
    Promise.resolve(loadData()),
    userId
      ? db.userDatasetFavorite
          .findMany({ where: { userId }, select: { bibtex: true } })
          .then((rows) => new Set(rows.map((r) => r.bibtex)))
      : Promise.resolve(new Set<string>()),
  ])

  if (!data) {
    return (
      <div className="min-h-screen bg-base-100 flex flex-col">
        <Navbar />
        <div className="text-center py-16 text-base-content/40">
          <p className="text-lg">No dataset index found.</p>
          <p className="text-sm mt-2">
            Run{" "}
            <code className="font-mono bg-base-200 px-1 rounded">
              node scripts/sync-model-cards.mjs
            </code>{" "}
            to sync.
          </p>
        </div>
      </div>
    )
  }

  // Compute sidebar options from full card list
  const allLanguages = Array.from(
    new Set(data.cards.flatMap((c) => (c.language ? extractBaseLanguages(c.language) : [])))
  ).sort()

  const allFlagKeys = Array.from(new Set(data.cards.flatMap((c) => c.flags))).sort()
  const allFlags = allFlagKeys.map((k) => ({ key: k, label: FLAG_LABELS[k] ?? k }))

  // Filter cards
  let cards = data.cards

  if (q) {
    cards = cards.filter(
      (c) =>
        c.citation.title.toLowerCase().includes(q) ||
        c.citation.author.toLowerCase().includes(q) ||
        (c.language && extractBaseLanguages(c.language).some((l) => l.toLowerCase().includes(q))) ||
        c.flags.some((f) => (FLAG_LABELS[f] ?? f).toLowerCase().includes(q))
    )
  }

  if (selectedLanguages.length) {
    cards = cards.filter((c) => {
      if (!c.language) return false
      const cardLangs = extractBaseLanguages(c.language)
      return selectedLanguages.some((l) => cardLangs.includes(l))
    })
  }

  if (selectedDecades.length) {
    cards = cards.filter((c) => {
      if (!c.citation.year) return false
      return selectedDecades.some((decade) => {
        const range = DECADE_LABELS[decade]
        return range && c.citation.year! >= range[0] && c.citation.year! <= range[1]
      })
    })
  }

  if (selectedFlags.length) {
    cards = cards.filter((c) => selectedFlags.every((f) => c.flags.includes(f)))
  }

  const hasFilters = q || selectedLanguages.length || selectedDecades.length || selectedFlags.length

  const downloadParams = new URLSearchParams()
  if (q) downloadParams.set("q", q)
  selectedLanguages.forEach((l) => downloadParams.append("lang", l))
  selectedDecades.forEach((d) => downloadParams.append("decade", d))
  selectedFlags.forEach((f) => downloadParams.append("flag", f))
  const downloadHref = `/api/download/datasets${downloadParams.size ? `?${downloadParams}` : ""}`

  const syncDate = new Date(data.syncedAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex flex-1 w-full px-10 py-8 gap-8">
        <Suspense fallback={<div className="w-56 shrink-0" />}>
          <DatasetFilters allLanguages={allLanguages} allFlags={allFlags} />
        </Suspense>

        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-1">Datasets</h1>
            <p className="text-base-content/60 text-sm">
              Word norm datasets from the{" "}
              <a
                href="https://github.com/SemanticPriming/semanticprimeR"
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary"
              >
                SemanticPrimeR
              </a>{" "}
              collection, synced {syncDate}.
            </p>
          </div>

          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-base-content/60">
              <span className="font-semibold text-base-content">{cards.length}</span>{" "}
              {cards.length === 1 ? "dataset" : "datasets"}
              {hasFilters && " match your filters"}
            </p>
            <div className="flex items-center gap-2">
              <a href={downloadHref} className="btn btn-outline btn-sm">
                Download CSV
              </a>
              <SuggestDatasetButton />
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="text-center py-16 text-base-content/40">
              <p className="text-lg">No results match your filters.</p>
              <a href="/datasets" className="link link-primary text-sm mt-2 inline-block">
                Clear filters
              </a>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-base-200">
              {cards.map((card) => (
                <li
                  key={card.bibtex}
                  className="py-5 hover:bg-base-200/40 px-3 -mx-3 rounded-lg transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-base leading-snug mb-1">
                        {capFirst(card.citation.title)}
                      </h2>
                      {card.citation.author && (
                        <p className="text-sm text-base-content/60 mb-2 line-clamp-1">
                          {card.citation.author}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50 mb-2">
                        {card.citation.year && <span>{card.citation.year}</span>}
                        {card.citation.journal && (
                          <>
                            <span>·</span>
                            <span className="italic">{card.citation.journal}</span>
                          </>
                        )}
                        {card.language && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-base-content/70">
                              {extractBaseLanguages(card.language).join(", ")}
                            </span>
                          </>
                        )}
                        {card.nRows != null && (
                          <>
                            <span>·</span>
                            <span>{card.nRows.toLocaleString()} stimuli</span>
                          </>
                        )}
                      </div>
                      {card.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {card.flags.map((f) => (
                            <span key={f} className="badge badge-sm badge-ghost text-xs">
                              {FLAG_LABELS[f] ?? f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <DatasetFavoriteButton
                        bibtex={card.bibtex}
                        initialFavorited={favoritedBibtexSet.has(card.bibtex)}
                        isLoggedIn={!!userId}
                      />
                      {card.citation.doi && (
                        <a
                          href={`https://doi.org/${card.citation.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline btn-sm"
                        >
                          DOI
                        </a>
                      )}
                      <a
                        href={`https://github.com/SemanticPriming/semanticprimeR/releases/download/v0.0.1/${card.bibtex}.csv`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                      >
                        CSV
                      </a>
                      <a href={`/datasets/${card.bibtex}`} className="btn btn-outline btn-sm">
                        View
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

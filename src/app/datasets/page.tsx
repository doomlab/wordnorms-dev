import fs from "fs"
import path from "path"
import { Navbar } from "../components/Navbar"

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
}

type DataFile = {
  syncedAt: string
  cards: Card[]
}

const FLAG_LABELS: Record<string, string> = {
  accuracy: "Accuracy",
  ambiguity: "Ambiguity",
  aoa: "AoA",
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

function loadData(): DataFile | null {
  const p = path.join(process.cwd(), "data", "model-cards", "_data.json")
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as DataFile
  } catch {
    return null
  }
}

function displayLanguage(lang: string): string {
  return lang
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function capFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default async function DatasetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const q = params.q?.trim().toLowerCase() || undefined

  const data = loadData()

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="w-full px-10 py-8">
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
            collection. Search by title, author, language, or norm type.
          </p>
        </div>

        {!data ? (
          <div className="text-center py-16 text-base-content/40">
            <p className="text-lg">No dataset index found.</p>
            <p className="text-sm mt-2">
              Run <code className="font-mono bg-base-200 px-1 rounded">node scripts/sync-model-cards.mjs</code> to sync.
            </p>
          </div>
        ) : (
          <>
            {/* Search */}
            <form method="get" className="mb-5 flex gap-2 max-w-lg">
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search title, author, language, norm…"
                className="input input-bordered input-sm flex-1"
              />
              <button type="submit" className="btn btn-sm btn-primary">Search</button>
              {q && (
                <a href="/datasets" className="btn btn-sm btn-ghost">Clear</a>
              )}
            </form>

            <DatasetList data={data} q={q} />
          </>
        )}
      </div>
    </div>
  )
}

function DatasetList({ data, q }: { data: DataFile; q: string | undefined }) {
  const cards = data.cards.filter((card) => {
    if (!q) return true
    return (
      card.citation.title.toLowerCase().includes(q) ||
      card.citation.author.toLowerCase().includes(q) ||
      (card.language && displayLanguage(card.language).toLowerCase().includes(q)) ||
      card.flags.some((f) => (FLAG_LABELS[f] ?? f).toLowerCase().includes(q))
    )
  })

  const syncDate = new Date(data.syncedAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })

  return (
    <>
      <p className="text-sm text-base-content/60 mb-5">
        <span className="font-semibold text-base-content">{cards.length}</span>{" "}
        {cards.length === 1 ? "dataset" : "datasets"}
        {q && " match your search"}
        <span className="ml-3 text-base-content/40">· synced {syncDate}</span>
      </p>

      {cards.length === 0 ? (
        <div className="text-center py-16 text-base-content/40">
          <p className="text-lg">No results match your search.</p>
          <a href="/datasets" className="link link-primary text-sm mt-2 inline-block">
            Clear search
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
                          {displayLanguage(card.language)}
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
                {card.citation.doi && (
                  <div className="shrink-0">
                    <a
                      href={`https://doi.org/${card.citation.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      DOI
                    </a>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

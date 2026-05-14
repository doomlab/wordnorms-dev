import { notFound } from "next/navigation"
import fs from "fs"
import path from "path"
import { Navbar } from "../../components/Navbar"
import { DatasetFavoriteButton } from "../../components/DatasetFavoriteButton"
import { getBlitzContext } from "../../blitz-server"
import db from "db"

export const dynamic = "force-dynamic"

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

function loadCard(bibtex: string): Card | null {
  const p = path.join(process.cwd(), "data", "model-cards", "_data.json")
  if (!fs.existsSync(p)) return null
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8")) as { cards: Card[] }
    return data.cards.find((c) => c.bibtex === bibtex) ?? null
  } catch {
    return null
  }
}

function extractBaseLanguages(raw: string): string[] {
  const seen = new Set<string>()
  for (const part of raw.split(",")) {
    const base = part.trim().split("_")[0].toLowerCase()
    if (!base) continue
    seen.add(base.charAt(0).toUpperCase() + base.slice(1))
  }
  return Array.from(seen)
}

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export async function generateMetadata({ params }: { params: Promise<{ bibtex: string }> }) {
  const { bibtex } = await params
  const card = loadCard(bibtex)
  return {
    title: card ? `${capFirst(card.citation.title)} – WordNorms` : "Dataset – WordNorms",
  }
}

export default async function DatasetDetailPage({
  params,
}: {
  params: Promise<{ bibtex: string }>
}) {
  const { bibtex } = await params
  const card = loadCard(bibtex)
  if (!card) notFound()

  const ctx = await getBlitzContext()
  const userId = ctx.session.userId as number | undefined

  const doiUrl = card.citation.doi ? `https://doi.org/${card.citation.doi}` : null
  const languages = card.language ? extractBaseLanguages(card.language) : []
  const normColumns = card.rawColumns.filter((c) => !card.wordColumns.includes(c))

  const linkedPaperByDoi = card.citation.doi
    ? await db.paper.findFirst({
        where: {
          doi: { equals: card.citation.doi, mode: "insensitive" },
          status: { in: ["ACCEPTED", "ADDED_TO_TRAINING"] },
        },
        select: { id: true },
      })
    : null
  const linkedPaper =
    linkedPaperByDoi ??
    (await db.paper.findFirst({
      where: {
        title: { equals: card.citation.title, mode: "insensitive" },
        status: { in: ["ACCEPTED", "ADDED_TO_TRAINING"] },
      },
      select: { id: true },
    }))

  const isFavorited = userId
    ? await db.userDatasetFavorite
        .findUnique({ where: { userId_bibtex: { userId, bibtex } } })
        .then(Boolean)
    : false

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="w-full px-10 py-10">
        <a
          href="/datasets"
          className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
        >
          ← Back to datasets
        </a>

        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold leading-snug">{capFirst(card.citation.title)}</h1>
          <div className="shrink-0 pt-1">
            <DatasetFavoriteButton
              bibtex={bibtex}
              initialFavorited={isFavorited}
              isLoggedIn={!!userId}
            />
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-2 mb-8">
          {doiUrl && (
            <a
              href={doiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              View DOI
            </a>
          )}
          <a
            href={`https://github.com/SemanticPriming/semanticprimeR/releases/download/v0.0.1/${bibtex}.csv`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
          >
            Download CSV
          </a>
          {linkedPaper && (
            <a href={`/norms/${linkedPaper.id}`} className="btn btn-ghost btn-outline btn-sm">
              View Database Entry
            </a>
          )}
        </div>

        <div className="divide-y divide-base-200 text-sm">
          {/* Publication */}
          <Section title="Publication">
            <Row label="Authors" value={card.citation.author || undefined} />
            <Row label="Year" value={card.citation.year?.toString()} />
            <Row label="Journal" value={card.citation.journal ?? undefined} italic />
            {doiUrl && (
              <div className="flex gap-3 py-1.5">
                <span className="w-36 shrink-0 font-medium text-base-content/70">DOI</span>
                <a
                  href={doiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary break-all"
                >
                  {card.citation.doi}
                </a>
              </div>
            )}
          </Section>

          {/* Dataset */}
          <Section title="Dataset">
            <Row label="Language" value={languages.join(", ") || undefined} />
            <Row
              label="Stimuli count"
              value={card.nRows != null ? card.nRows.toLocaleString() : undefined}
            />
            {card.flags.length > 0 && (
              <div className="flex gap-3 py-1.5">
                <span className="w-36 shrink-0 font-medium text-base-content/70">Norms</span>
                <div className="flex flex-wrap gap-1">
                  {card.flags.map((f) => (
                    <span key={f} className="badge badge-sm badge-ghost">
                      {FLAG_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Variables */}
          {(card.wordColumns.length > 0 || normColumns.length > 0) && (
            <Section title="Variables">
              {card.wordColumns.length > 0 && (
                <Row label="Word columns" value={card.wordColumns.join(", ")} />
              )}
              {normColumns.length > 0 && (
                <div className="flex gap-3 py-1.5">
                  <span className="w-36 shrink-0 font-medium text-base-content/70">
                    Norm columns
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {normColumns.map((col) => (
                      <span key={col} className="badge badge-sm badge-ghost font-mono text-xs">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Related */}
          {card.parentBibtex && (
            <Section title="Related">
              <div className="flex gap-3 py-1.5">
                <span className="w-36 shrink-0 font-medium text-base-content/70">Part of</span>
                <a href={`/datasets/${card.parentBibtex}`} className="link link-primary">
                  {card.parentBibtex}
                </a>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/40 mb-3">
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  italic,
}: {
  label: string
  value: string | undefined
  italic?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-1.5">
      <span className="w-36 shrink-0 font-medium text-base-content/70">{label}</span>
      <span className={`text-base-content/80 ${italic ? "italic" : ""}`}>{value}</span>
    </div>
  )
}

import fs from "fs"
import path from "path"
import { DECADE_LABELS } from "src/app/data/datasets"

export type Card = {
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

export const FLAG_LABELS: Record<string, string> = {
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
export function extractBaseLanguages(raw: string): string[] {
  const seen = new Set<string>()
  for (const part of raw.split(",")) {
    const base = part.trim().split("_")[0].toLowerCase()
    if (!base) continue
    const label = base.charAt(0).toUpperCase() + base.slice(1)
    seen.add(label)
  }
  return Array.from(seen)
}

export function loadDatasetData(): DataFile | null {
  const p = path.join(process.cwd(), "data", "model-cards", "_data.json")
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as DataFile
  } catch {
    return null
  }
}

// Exclude R1/R123 sub-variants (response-level splits of the same study)
export function baseCards(data: DataFile): Card[] {
  return data.cards.filter((c) => !/_R1(23)?$/.test(c.bibtex))
}

export type DatasetFilters = {
  q?: string
  languages: string[]
  decades: string[]
  flags: string[]
}

export type DatasetFilterSearchParams = {
  q?: string
  lang?: string | string[]
  decade?: string | string[]
  flag?: string | string[]
}

const toArray = (v: string | string[] | undefined) => (v ? (Array.isArray(v) ? v : [v]) : [])

export function parseDatasetFilterParams(params: DatasetFilterSearchParams): DatasetFilters {
  return {
    q: params.q?.trim().toLowerCase() || undefined,
    languages: toArray(params.lang),
    decades: toArray(params.decade),
    flags: toArray(params.flag),
  }
}

export function parseDatasetFilterQueryString(query: string): DatasetFilters {
  const sp = new URLSearchParams(query)
  return parseDatasetFilterParams({
    q: sp.get("q") ?? undefined,
    lang: sp.getAll("lang"),
    decade: sp.getAll("decade"),
    flag: sp.getAll("flag"),
  })
}

export function filterDatasetCards(cards: Card[], filters: DatasetFilters): Card[] {
  let result = cards

  if (filters.q) {
    const q = filters.q
    result = result.filter(
      (c) =>
        c.citation.title.toLowerCase().includes(q) ||
        c.citation.author.toLowerCase().includes(q) ||
        (c.language && extractBaseLanguages(c.language).some((l) => l.toLowerCase().includes(q))) ||
        c.flags.some((f) => (FLAG_LABELS[f] ?? f).toLowerCase().includes(q))
    )
  }

  if (filters.languages.length) {
    result = result.filter((c) => {
      if (!c.language) return false
      const cardLangs = extractBaseLanguages(c.language)
      return filters.languages.some((l) => cardLangs.includes(l))
    })
  }

  if (filters.decades.length) {
    result = result.filter((c) => {
      if (!c.citation.year) return false
      return filters.decades.some((decade) => {
        const range = DECADE_LABELS[decade]
        return range && c.citation.year! >= range[0] && c.citation.year! <= range[1]
      })
    })
  }

  if (filters.flags.length) {
    result = result.filter((c) => filters.flags.every((f) => c.flags.includes(f)))
  }

  return result
}

export function describeDatasetFilters(filters: DatasetFilters): string[] {
  const chips: string[] = []
  if (filters.q) chips.push(`"${filters.q}"`)
  filters.languages.forEach((l) => chips.push(l))
  filters.decades.forEach((d) => chips.push(d))
  filters.flags.forEach((f) => chips.push(FLAG_LABELS[f] ?? f))
  return chips
}

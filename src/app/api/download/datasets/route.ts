import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { DECADE_LABELS } from "../../../data/datasets"
import { getBlitzContext } from "../../../blitz-server"

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

function extractBaseLanguages(raw: string): string[] {
  const seen = new Set<string>()
  for (const part of raw.split(",")) {
    const base = part.trim().split("_")[0].toLowerCase()
    if (!base) continue
    seen.add(base.charAt(0).toUpperCase() + base.slice(1))
  }
  return Array.from(seen)
}

function csvCell(val: string | number | null | undefined): string {
  if (val == null) return ""
  const s = String(val)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",")
}

type Card = {
  bibtex: string
  citation: { author: string; year: number | null; title: string; journal: string | null; doi: string | null }
  language: string | null
  nRows: number | null
  flags: string[]
}

export async function GET(request: NextRequest) {
  const ctx = await getBlitzContext()
  if (!ctx.session.userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { searchParams } = request.nextUrl

  const q = searchParams.get("q")?.trim().toLowerCase() || undefined
  const selectedLanguages = searchParams.getAll("lang")
  const selectedDecades = searchParams.getAll("decade")
  const selectedFlags = searchParams.getAll("flag")

  const p = path.join(process.cwd(), "data", "model-cards", "_data.json")
  if (!fs.existsSync(p)) {
    return new NextResponse("Dataset index not found", { status: 404 })
  }

  const { cards: allCards } = JSON.parse(fs.readFileSync(p, "utf8")) as { cards: Card[] }

  let cards = allCards

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

  const header = csvRow(["title", "author", "year", "journal", "doi", "language", "stimuli_count", "norms_collected", "dataset_key"])

  const rows = cards.map((c) => {
    const langs = c.language ? extractBaseLanguages(c.language).join("; ") : null
    const norms = c.flags.map((f) => FLAG_LABELS[f] ?? f).join("; ")
    return csvRow([
      c.citation.title.charAt(0).toUpperCase() + c.citation.title.slice(1),
      c.citation.author,
      c.citation.year,
      c.citation.journal,
      c.citation.doi,
      langs,
      c.nRows,
      norms,
      c.bibtex,
    ])
  })

  const csv = [header, ...rows].join("\r\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wordnorms-datasets.csv"`,
    },
  })
}

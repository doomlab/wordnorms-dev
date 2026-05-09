export interface Dataset {
  id: string
  name: string
  description: string
  languages: string[]
  year: number
  citation: string
  normTypes: string[]
  wordCount: number
}

export const DATASETS: Dataset[] = [
  {
    id: "warriner-2013",
    name: "Warriner et al. (2013) — Valence, Arousal, Dominance",
    description:
      "Affective ratings for 13,915 English lemmas on valence, arousal, and dominance. The largest English affective norm set to date, extending ANEW.",
    languages: ["English"],
    year: 2013,
    citation: "Warriner, A. B., Kuperman, V., & Brysbaert, M. (2013). Behavior Research Methods.",
    normTypes: ["Valence", "Arousal", "Dominance"],
    wordCount: 13915,
  },
  {
    id: "brysbaert-2014",
    name: "Brysbaert et al. (2014) — Concreteness Ratings",
    description:
      "Concreteness ratings for 37,058 English words and two-word phrases, collected from over 4,000 participants via Amazon Mechanical Turk.",
    languages: ["English"],
    year: 2014,
    citation: "Brysbaert, M., Warriner, A. B., & Kuperman, V. (2014). Behavior Research Methods.",
    normTypes: ["Concreteness"],
    wordCount: 37058,
  },
  {
    id: "kuperman-2012",
    name: "Kuperman et al. (2012) — Age of Acquisition",
    description:
      "Age of acquisition ratings for 30,121 English words collected via web-based crowdsourcing. Covers a wide range of vocabulary including rare and abstract words.",
    languages: ["English"],
    year: 2012,
    citation: "Kuperman, V., Stadthagen-Gonzalez, H., & Brysbaert, M. (2012). Behavior Research Methods.",
    normTypes: ["Age of Acquisition"],
    wordCount: 30121,
  },
  {
    id: "subtlex-us",
    name: "SUBTLEX-US — Word Frequency",
    description:
      "Word frequency norms based on 51 million words from American film and TV subtitles. Outperforms traditional corpus-based frequencies in predicting lexical decision times.",
    languages: ["English"],
    year: 2009,
    citation: "Brysbaert, M., & New, B. (2009). Behavior Research Methods.",
    normTypes: ["Frequency"],
    wordCount: 74286,
  },
  {
    id: "anew-1999",
    name: "ANEW — Affective Norms for English Words",
    description:
      "The original affective word norms: valence, arousal, and dominance ratings for 1,034 English words, widely used as a benchmark in affective computing.",
    languages: ["English"],
    year: 1999,
    citation: "Bradley, M. M., & Lang, P. J. (1999). Technical Report, University of Florida.",
    normTypes: ["Valence", "Arousal", "Dominance"],
    wordCount: 1034,
  },
  {
    id: "lynott-2009",
    name: "Lynott & Connell (2009) — Perceptual Strength",
    description:
      "Modality-specific perceptual strength ratings (auditory, gustatory, haptic, olfactory, visual) for 423 property words.",
    languages: ["English"],
    year: 2009,
    citation: "Lynott, D., & Connell, L. (2009). Behavior Research Methods.",
    normTypes: ["Perceptual Strength"],
    wordCount: 423,
  },
  {
    id: "imbault-2018",
    name: "Imbault et al. (2018) — French Affective Norms",
    description:
      "Valence and arousal ratings for 1,000 French words, normed on a French-speaking sample. Provides a parallel to English affective databases.",
    languages: ["French"],
    year: 2018,
    citation: "Imbault, C., Knol, D., & Kuperman, V. (2018). Behavior Research Methods.",
    normTypes: ["Valence", "Arousal"],
    wordCount: 1000,
  },
  {
    id: "stadthagen-2017",
    name: "Stadthagen-Gonzalez et al. (2017) — Spanish Concreteness",
    description:
      "Concreteness and imageability ratings for 3,080 Spanish words, collected via crowdsourcing from native Spanish speakers.",
    languages: ["Spanish"],
    year: 2017,
    citation: "Stadthagen-Gonzalez, H., et al. (2017). Behavior Research Methods.",
    normTypes: ["Concreteness", "Imageability"],
    wordCount: 3080,
  },
  {
    id: "mrc",
    name: "MRC Psycholinguistic Database",
    description:
      "Multi-dimensional psycholinguistic norms (familiarity, imageability, concreteness, meaningfulness, AoA) for over 150,000 English words.",
    languages: ["English"],
    year: 1981,
    citation: "Coltheart, M. (1981). Attention and Performance IX.",
    normTypes: ["Concreteness", "Imageability", "Familiarity", "Age of Acquisition"],
    wordCount: 150837,
  },
  {
    id: "scott-2019",
    name: "Scott et al. (2019) — Glasgow Norms",
    description:
      "Nine psycholinguistic norms (arousal, valence, dominance, concreteness, imageability, familiarity, age of acquisition, size, gender) for 5,553 English words.",
    languages: ["English"],
    year: 2019,
    citation: "Scott, G. G., et al. (2019). Behavior Research Methods.",
    normTypes: ["Valence", "Arousal", "Dominance", "Concreteness", "Imageability"],
    wordCount: 5553,
  },
]

export const ALL_LANGUAGES = Array.from(new Set(DATASETS.flatMap((d) => d.languages))).sort()
export const ALL_YEARS = Array.from(new Set(DATASETS.map((d) => d.year))).sort((a, b) => b - a)

export const DECADE_LABELS: Record<string, [number, number]> = {
  "2020s": [2020, 2029],
  "2010s": [2010, 2019],
  "2000s": [2000, 2009],
  "1990s": [1990, 1999],
  "1980s": [1980, 1989],
}

export function filterDatasets(
  datasets: Dataset[],
  {
    q,
    languages,
    decades,
  }: { q?: string; languages?: string[]; decades?: string[] }
): Dataset[] {
  return datasets.filter((d) => {
    if (q) {
      const lower = q.toLowerCase()
      if (
        !d.name.toLowerCase().includes(lower) &&
        !d.description.toLowerCase().includes(lower) &&
        !d.normTypes.some((t) => t.toLowerCase().includes(lower))
      )
        return false
    }
    if (languages?.length) {
      if (!d.languages.some((l) => languages.includes(l))) return false
    }
    if (decades?.length) {
      const inRange = decades.some((decade) => {
        const range = DECADE_LABELS[decade]
        return range && d.year >= range[0] && d.year <= range[1]
      })
      if (!inRange) return false
    }
    return true
  })
}

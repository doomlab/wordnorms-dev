import { NextResponse } from "next/server"

const ROWS: [string, string, string][] = [
  ["column", "description", "values"],
  // Paper metadata
  ["paper_id", "Internal WordNorms paper ID", "integer"],
  ["title", "Title of the paper", "text"],
  ["authors", "Semicolon-separated list of author names", "text"],
  ["year", "Publication year", "integer"],
  ["journal", "Journal or conference name", "text"],
  ["doi", "Digital Object Identifier", "text (e.g. 10.1000/xyz123)"],
  ["abstract", "Abstract of the paper", "text"],
  // AI extraction
  [
    "ai_extracted_by",
    "AI model used to extract metadata from the paper",
    "text (e.g. gpt-4o)",
  ],
  [
    "ai_extracted_at",
    "Timestamp when the AI extraction was performed",
    "ISO 8601 datetime (UTC)",
  ],
  [
    "ai_language",
    "Language(s) of stimuli used in the study, as extracted by AI (semicolon-separated)",
    "text (e.g. English; French)",
  ],
  [
    "ai_participant_count",
    "Number of participants in the study, as extracted by AI",
    "integer",
  ],
  [
    "ai_participant_type",
    "Description of participant population, as extracted by AI",
    "text (e.g. undergraduate students; MTurk workers)",
  ],
  [
    "ai_stimuli_type",
    "Type(s) of stimuli used, as extracted by AI (semicolon-separated)",
    "text (e.g. words; pictures)",
  ],
  [
    "ai_stimuli_count",
    "Number of stimuli items, as extracted by AI",
    "integer",
  ],
  [
    "ai_norms_collected",
    "Types of norms collected in the study, as extracted by AI (semicolon-separated)",
    "text (e.g. valence; arousal; concreteness)",
  ],
  [
    "ai_instructions",
    "Task instructions given to participants, as extracted by AI",
    "text",
  ],
  [
    "ai_participant_level_data",
    "Whether participant-level (trial-by-trial) data are publicly available, as extracted by AI",
    "true / false",
  ],
  [
    "ai_reliabilities",
    "Reliability statistics reported in the paper, as extracted by AI (e.g. inter-rater agreement, split-half reliability)",
    "JSON object",
  ],
  [
    "ai_license_url",
    "URL to the data license or terms of use, as extracted by AI",
    "text (URL)",
  ],
  [
    "ai_data_source",
    "URL or reference to where the raw data can be accessed, as extracted by AI",
    "text",
  ],
  [
    "ai_confidence",
    "AI model's self-reported confidence in the extraction (0 = lowest, 1 = highest)",
    "decimal 0.000–1.000",
  ],
  [
    "ai_source_snippets",
    "Verbatim text passages from the paper that the AI cited as evidence for each extracted field",
    "JSON object (keys are field names, values are quoted text passages)",
  ],
  [
    "ai_needs_review",
    "Whether the AI flagged this extraction as uncertain and in need of human review",
    "true / false",
  ],
  // Human verification
  [
    "verified",
    "Whether a human reviewer has verified or corrected the extraction",
    "true / false",
  ],
  [
    "verified_at",
    "Timestamp when a human reviewer verified the extraction",
    "ISO 8601 datetime (UTC)",
  ],
  [
    "human_language",
    "Language(s) of stimuli as corrected by a human reviewer (blank if no correction was submitted)",
    "text (e.g. English; French)",
  ],
  [
    "human_participant_count",
    "Number of participants as corrected by a human reviewer (blank if no correction was submitted)",
    "integer",
  ],
  [
    "human_participant_type",
    "Participant population description as corrected by a human reviewer (blank if no correction was submitted)",
    "text",
  ],
  [
    "human_stimuli_type",
    "Stimuli type(s) as corrected by a human reviewer (blank if no correction was submitted)",
    "text",
  ],
  [
    "human_stimuli_count",
    "Number of stimuli as corrected by a human reviewer (blank if no correction was submitted)",
    "integer",
  ],
  [
    "human_norms_collected",
    "Norms collected as corrected by a human reviewer (blank if no correction was submitted)",
    "text",
  ],
  [
    "human_instructions",
    "Task instructions as corrected by a human reviewer (blank if no correction was submitted)",
    "text",
  ],
  [
    "human_url",
    "URL to data or supplementary materials provided by the human reviewer",
    "text (URL)",
  ],
  [
    "human_license_url",
    "URL to the data license or terms of use, as corrected by a human reviewer (blank if not provided)",
    "text (URL)",
  ],
  [
    "human_data_source",
    "URL or reference to where the raw data can be accessed, as corrected by a human reviewer (blank if not provided)",
    "text (URL)",
  ],
  [
    "human_participant_level_data",
    "Participant-level data availability as corrected by a human reviewer (blank if no correction was submitted)",
    "true / false",
  ],
  [
    "human_reliabilities",
    "Reliability statistics as corrected by a human reviewer (blank if no correction was submitted)",
    "JSON object",
  ],
  [
    "human_note",
    "Free-text note left by the human reviewer explaining their corrections",
    "text",
  ],
  [
    "human_source_evidence",
    "References or links the human reviewer cited as evidence for their corrections",
    "JSON object",
  ],
  [
    "human_model_answers",
    "The AI model's raw answer object that was displayed to the human reviewer when they filled in their correction (useful for comparing AI vs human responses)",
    "JSON object",
  ],
  [
    "human_model_snippets",
    "The text snippets from the paper that were displayed to the human reviewer alongside the AI answers",
    "JSON object (keys are field names, values are text passages)",
  ],
]

function csvCell(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(",")
}

export async function GET() {
  const csv = ROWS.map(csvRow).join("\r\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wordnorms-validation-data-codebook.csv"`,
    },
  })
}

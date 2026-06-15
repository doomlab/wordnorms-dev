import { NextResponse } from "next/server"
import db from "db"

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function csvCell(val: string | number | boolean | null | undefined): string {
  if (val == null) return ""
  const s = String(val)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvCell).join(",")
}

function jsonCell(val: unknown): string | null {
  if (val == null) return null
  return JSON.stringify(val)
}

export async function GET() {
  const papers = await db.paper.findMany({
    where: {
      status: "ACCEPTED",
      canonicalPaperId: null,
    },
    include: {
      extraction: {
        select: {
          language: true,
          participantCount: true,
          participantType: true,
          stimuliType: true,
          stimuliCount: true,
          normsCollected: true,
          instructions: true,
          licenseUrl: true,
          dataSource: true,
          participantLevelData: true,
          reliabilities: true,
          confidence: true,
          needsReview: true,
          sourceSnippets: true,
          extractedBy: true,
          extractedAt: true,
          verifiedAt: true,
        },
      },
      extractionEdits: {
        where: { resolved: true },
        select: {
          language: true,
          participantCount: true,
          participantType: true,
          stimuliType: true,
          stimuliCount: true,
          normsCollected: true,
          instructions: true,
          url: true,
          licenseUrl: true,
          dataSource: true,
          participantLevelData: true,
          reliabilities: true,
          note: true,
          sourceEvidence: true,
          modelAnswers: true,
          modelSnippets: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ year: { sort: "desc", nulls: "last" } }, { title: "asc" }],
  })

  const header = csvRow([
    // Paper metadata
    "paper_id",
    "title",
    "authors",
    "year",
    "journal",
    "doi",
    "abstract",
    // AI extraction
    "ai_extracted_by",
    "ai_extracted_at",
    "ai_language",
    "ai_participant_count",
    "ai_participant_type",
    "ai_stimuli_type",
    "ai_stimuli_count",
    "ai_norms_collected",
    "ai_instructions",
    "ai_participant_level_data",
    "ai_reliabilities",
    "ai_license_url",
    "ai_data_source",
    "ai_confidence",
    "ai_source_snippets",
    "ai_needs_review",
    // Human verification
    "verified",
    "verified_at",
    "human_language",
    "human_participant_count",
    "human_participant_type",
    "human_stimuli_type",
    "human_stimuli_count",
    "human_norms_collected",
    "human_instructions",
    "human_url",
    "human_license_url",
    "human_data_source",
    "human_participant_level_data",
    "human_reliabilities",
    "human_note",
    "human_source_evidence",
    "human_model_answers",
    "human_model_snippets",
  ])

  const rows = papers.map((p) => {
    const ext = p.extraction
    const h = p.extractionEdits[0] ?? null

    return csvRow([
      // Paper metadata
      p.id,
      capFirst(p.title),
      p.authors.join("; "),
      p.year,
      p.journal,
      p.doi,
      p.abstract,
      // AI extraction
      ext?.extractedBy,
      ext?.extractedAt?.toISOString(),
      ext?.language.join("; "),
      ext?.participantCount,
      ext?.participantType,
      ext?.stimuliType.join("; "),
      ext?.stimuliCount,
      ext?.normsCollected.join("; "),
      ext?.instructions,
      ext != null ? String(ext.participantLevelData) : null,
      jsonCell(ext?.reliabilities),
      ext?.licenseUrl,
      ext?.dataSource,
      ext?.confidence != null ? ext.confidence.toFixed(3) : null,
      jsonCell(ext?.sourceSnippets),
      ext != null ? String(ext.needsReview) : null,
      // Human verification
      ext?.verifiedAt ? "true" : "false",
      ext?.verifiedAt?.toISOString(),
      h?.language.join("; "),
      h?.participantCount,
      h?.participantType,
      h?.stimuliType.join("; "),
      h?.stimuliCount,
      h?.normsCollected.join("; "),
      h?.instructions,
      h?.url,
      h?.licenseUrl,
      h?.dataSource,
      h != null && h.participantLevelData != null ? String(h.participantLevelData) : null,
      jsonCell(h?.reliabilities),
      h?.note,
      jsonCell(h?.sourceEvidence),
      jsonCell(h?.modelAnswers),
      jsonCell(h?.modelSnippets),
    ])
  })

  const csv = [header, ...rows].join("\r\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wordnorms-validation-data.csv"`,
    },
  })
}

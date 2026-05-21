import { NextRequest, NextResponse } from "next/server"
import db from "db"
import { DECADE_LABELS } from "../../../data/datasets"

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const q = searchParams.get("q")?.trim() || undefined
  const languages = searchParams.getAll("lang")
  const decades = searchParams.getAll("decade")
  const stimuliTypes = searchParams.getAll("stimuli")

  const authorMatchIds = q
    ? (
        await db.$queryRaw<{ id: number }[]>`
          SELECT id FROM "Paper"
          WHERE EXISTS (SELECT 1 FROM unnest(authors) AS a WHERE a ILIKE ${`%${q}%`})
        `
      ).map((r) => r.id)
    : []

  const andClauses: object[] = []

  if (q) {
    andClauses.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { abstract: { contains: q, mode: "insensitive" } },
        { extraction: { normsCollected: { hasSome: [q] } } },
        ...(authorMatchIds.length ? [{ id: { in: authorMatchIds } }] : []),
      ],
    })
  }

  if (decades.length) {
    andClauses.push({
      OR: decades.flatMap((decade) => {
        const range = DECADE_LABELS[decade]
        return range ? [{ year: { gte: range[0], lte: range[1] } }] : []
      }),
    })
  }

  const where = {
    status: "ACCEPTED" as const,
    canonicalPaperId: null,
    ...(languages.length || stimuliTypes.length
      ? {
          extraction: {
            ...(languages.length ? { language: { hasSome: languages } } : {}),
            ...(stimuliTypes.length ? { stimuliType: { hasSome: stimuliTypes } } : {}),
          },
        }
      : {}),
    ...(andClauses.length ? { AND: andClauses } : {}),
  }

  const papers = await db.paper.findMany({
    where,
    include: {
      extraction: {
        select: {
          language: true,
          stimuliType: true,
          stimuliCount: true,
          normsCollected: true,
          verifiedAt: true,
        },
      },
    },
    orderBy: [{ year: { sort: "desc", nulls: "last" } }, { title: "asc" }],
  })

  const header = csvRow(["title", "authors", "year", "journal", "doi", "language", "stimuli_type", "stimuli_count", "norms_collected", "verified"])

  const rows = papers.map((p) => {
    const ext = p.extraction
    return csvRow([
      capFirst(p.title),
      p.authors.join("; "),
      p.year,
      p.journal,
      p.doi,
      ext?.language.join("; "),
      ext?.stimuliType.join("; "),
      ext?.stimuliCount,
      ext?.normsCollected.join("; "),
      ext?.verifiedAt ? "yes" : "no",
    ])
  })

  const csv = [header, ...rows].join("\r\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wordnorms.csv"`,
    },
  })
}

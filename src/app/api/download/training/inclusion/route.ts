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

export async function GET() {
  const papers = await db.paper.findMany({
    where: {
      status: { in: ["ACCEPTED", "EXCLUDED"] },
      canonicalPaperId: null,
    },
    select: {
      title: true,
      abstract: true,
      authors: true,
      doi: true,
      status: true,
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
  })

  const header = csvRow(["title", "abstract", "authors", "doi", "label"])

  const rows = papers.map((p) =>
    csvRow([
      capFirst(p.title),
      p.abstract,
      p.authors.join("; "),
      p.doi,
      p.status === "ACCEPTED" ? "included" : "excluded",
    ])
  )

  const csv = [header, ...rows].join("\r\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wordnorms-inclusion-labels.csv"`,
    },
  })
}

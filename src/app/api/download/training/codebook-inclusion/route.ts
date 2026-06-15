import { NextResponse } from "next/server"

const ROWS: [string, string, string][] = [
  ["column", "description", "values"],
  [
    "title",
    "Title of the paper",
    "text",
  ],
  [
    "abstract",
    "Abstract of the paper",
    "text",
  ],
  [
    "authors",
    "Semicolon-separated list of author names",
    "text",
  ],
  [
    "doi",
    "Digital Object Identifier",
    "text (e.g. 10.1000/xyz123)",
  ],
  [
    "label",
    "Whether the paper was included in the WordNorms database as a word norm study",
    "included / excluded",
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
      "Content-Disposition": `attachment; filename="wordnorms-inclusion-labels-codebook.csv"`,
    },
  })
}

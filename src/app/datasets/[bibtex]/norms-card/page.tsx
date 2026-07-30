import { notFound } from "next/navigation"
import { Navbar } from "../../../components/Navbar"
import db from "db"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ bibtex: string }> }) {
  const { bibtex } = await params
  return { title: `Norms Card: ${bibtex} - WordNorms` }
}

export default async function NormsCardPage({ params }: { params: Promise<{ bibtex: string }> }) {
  const { bibtex } = await params
  const row = await db.normsCard.findUnique({ where: { bibtex } })
  if (!row) notFound()

  const card = row.card as Record<string, unknown>
  const layer1 = (card.layer1 ?? {}) as Record<string, unknown>
  const datasetName = typeof layer1.dataset_name === "string" ? layer1.dataset_name : bibtex
  const schemaVersion = typeof card.schema_version === "string" ? card.schema_version : "?"

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="w-full px-10 py-10">
        <a
          href={`/datasets/${bibtex}`}
          className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
        >
          Back to dataset
        </a>

        <div className="mb-6">
          <h1 className="text-2xl font-bold leading-snug">Norms Card: {datasetName}</h1>
          <p className="text-sm text-base-content/60 mt-1">
            A structured documentation record for this norms dataset (constructs, scales,
            participants, provenance, and reporting gaps). Schema v{schemaVersion}.
          </p>
        </div>

        <pre className="bg-base-200 rounded-lg p-6 text-xs leading-relaxed overflow-x-auto whitespace-pre">
          {JSON.stringify(card, null, 2)}
        </pre>
      </div>
    </div>
  )
}

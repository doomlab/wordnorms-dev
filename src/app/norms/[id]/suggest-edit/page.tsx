import { notFound, redirect } from "next/navigation"
import { getBlitzContext } from "../../../blitz-server"
import { Navbar } from "../../../components/Navbar"
import { SuggestExtractionEditsPage } from "../../../components/SuggestExtractionEditsPage"
import db from "db"

export default async function SuggestEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session } = await getBlitzContext()
  const userId = session.userId as number | null

  if (!userId) redirect(`/login?next=/norms/${id}/suggest-edit`)

  const paper = await db.paper.findUnique({
    where: { id: Number(id), status: "ACCEPTED" },
    include: {
      extraction: { include: { verifiedBy: { select: { name: true } } } },
    },
  })

  if (!paper || !paper.extraction) notFound()

  if (paper.canonicalPaperId) redirect(`/norms/${paper.canonicalPaperId}/suggest-edit`)

  const ext = paper.extraction
  const hasPriorSuggestion = await db.extractionEditSuggestion
    .findUnique({ where: { userId_paperId: { userId, paperId: paper.id } } })
    .then(Boolean)

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <a href={`/norms/${paper.id}`} className="text-sm text-base-content/50 hover:text-base-content">
            ← Back to paper
          </a>
          <div className="flex items-start justify-between gap-4 mt-2 mb-0.5">
            <h1 className="text-xl font-bold">{paper.title.charAt(0).toUpperCase() + paper.title.slice(1)}</h1>
            {paper.pdfUrl && (
              <a
                href={paper.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm shrink-0"
              >
                View PDF
              </a>
            )}
          </div>
          <p className="text-sm text-base-content/50">Suggest corrections to the extracted data</p>
        </div>

        <SuggestExtractionEditsPage
          paperId={paper.id}
          ext={{
            language: ext.language,
            participantCount: ext.participantCount,
            participantType: ext.participantType,
            stimuliType: ext.stimuliType,
            stimuliCount: ext.stimuliCount,
            normsCollected: ext.normsCollected,
            instructions: ext.instructions,
            participantLevelData: ext.participantLevelData,
            reliabilities: ext.reliabilities,
            licenseUrl: ext.licenseUrl,
            dataSource: ext.dataSource,
            sourceSnippets: ext.sourceSnippets as Record<string, string> | null,
            paperText: ext.paperText,
          }}
          hasPriorSuggestion={hasPriorSuggestion}
        />
      </div>
    </div>
  )
}

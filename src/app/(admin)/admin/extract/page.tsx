import db from "db"
import { ExtractButton } from "./ExtractButton"
import { UrlEditor } from "../review/UrlEditor"

export const metadata = { title: "Extraction – Admin" }

export default async function AdminExtractPage() {
  const [needsReview, pending, extracted] = await Promise.all([
    db.paper.findMany({
      where: {
        status: { in: ["ACCEPTED", "ADDED_TO_TRAINING"] },
        extraction: { needsReview: true },
      },
      select: {
        id: true, title: true, year: true, doi: true,
        extraction: {
          select: {
            language: true, normsCollected: true, confidence: true, extractedBy: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.paper.findMany({
      where: { status: "ACCEPTED", extraction: null },
      select: { id: true, title: true, year: true, doi: true, url: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.paper.findMany({
      where: { status: "ADDED_TO_TRAINING", extraction: { needsReview: false } },
      select: {
        id: true, title: true, year: true,
        extraction: {
          select: {
            language: true, participantCount: true, stimuliType: true,
            normsCollected: true, confidence: true, needsReview: true, extractedBy: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ])

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Extraction</h1>
      <p className="text-base-content/60 mb-8">
        Extract structured metadata from accepted papers using the LLM pipeline.
      </p>

      {/* Needs review */}
      {needsReview.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">
            Needs review
            <span className="badge badge-error ml-2">{needsReview.length}</span>
          </h2>
          <p className="text-sm text-base-content/60 mb-4">
            Extraction ran but flagged low confidence or incomplete data.
          </p>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>ID</th><th>Title</th><th>Year</th><th>Language</th><th>Norms</th><th>Confidence</th><th></th>
                </tr>
              </thead>
              <tbody>
                {needsReview.map((p) => {
                  const e = p.extraction
                  return (
                    <tr key={p.id}>
                      <td className="text-base-content/50">{p.id}</td>
                      <td className="max-w-xs truncate">{p.title}</td>
                      <td>{p.year ?? "—"}</td>
                      <td>{e?.language?.join(", ") ?? "—"}</td>
                      <td className="max-w-xs truncate">{e?.normsCollected?.join(", ") ?? "—"}</td>
                      <td>
                        {e?.confidence != null ? (
                          <span className="text-warning">
                            {(e.confidence * 100).toFixed(0)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <a href={`/norms/${p.id}`} className="btn btn-xs btn-outline" target="_blank">
                          View
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pending extraction */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">
          Pending extraction
          <span className="badge badge-warning ml-2">{pending.length}</span>
        </h2>

        {pending.length === 0 ? (
          <p className="text-base-content/40">No papers waiting for extraction.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>ID</th><th>Title</th><th>Year</th><th>URL</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id}>
                    <td className="text-base-content/50">{p.id}</td>
                    <td>{p.title}</td>
                    <td>{p.year ?? "—"}</td>
                    <td><UrlEditor paperId={p.id} initialUrl={p.url} /></td>
                    <td><ExtractButton paperId={p.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recently extracted */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recently extracted</h2>

        {extracted.length === 0 ? (
          <p className="text-base-content/40">No extractions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Title</th><th>Language</th><th>N</th>
                  <th>Stimuli</th><th>Norms</th><th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {extracted.map((p) => {
                  const e = p.extraction
                  return (
                    <tr key={p.id}>
                      <td className="max-w-xs truncate">{p.title}</td>
                      <td>{e?.language?.join(", ") ?? "—"}</td>
                      <td>{e?.participantCount ?? "—"}</td>
                      <td>{e?.stimuliType?.join(", ") ?? "—"}</td>
                      <td className="max-w-xs truncate">{e?.normsCollected?.join(", ") ?? "—"}</td>
                      <td>
                        {e?.confidence != null ? (
                          <span className={e.confidence < 0.6 ? "text-warning" : "text-success"}>
                            {(e.confidence * 100).toFixed(0)}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

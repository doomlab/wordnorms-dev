import { notFound } from "next/navigation"
import db from "db"
import { ReportActions } from "../ReportActions"
import { MetadataReportActions } from "../MetadataReportActions"

export const metadata = { title: "Review Report – Admin" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const REASON_LABELS: Record<string, string> = {
  WRONG_CLASSIFICATION: "Incorrectly classified",
  DUPLICATE: "Duplicate entry",
  OTHER: "Other",
}

const STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Included",
  EXCLUDED: "Excluded",
  PENDING_REVIEW: "Pending",
}

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const report = await db.paperReport.findUnique({
    where: { id: Number(id), resolved: false },
    include: {
      user: { select: { email: true } },
      paper: {
        include: { extraction: true },
      },
    },
  })

  if (!report) notFound()

  const paper = report.paper
  const ext = paper.extraction

  return (
    <>
      <a
        href="/admin/reports"
        className="text-sm text-base-content/50 hover:text-base-content mb-6 inline-block"
      >
        ← Back to reports
      </a>

      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold leading-snug">{cap(paper.title)}</h1>
        <span
          className={`badge shrink-0 mt-1 ${
            paper.status === "EXCLUDED" ? "badge-error" : "badge-success"
          }`}
        >
          {STATUS_LABELS[paper.status] ?? paper.status}
        </span>
      </div>

      {(paper.doi || paper.pdfUrl) && (
        <div className="flex flex-wrap gap-2 mb-8">
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
            >
              View DOI
            </a>
          )}
          {paper.pdfUrl && (
            <a
              href={paper.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
            >
              View PDF
            </a>
          )}
        </div>
      )}

      <div className="divide-y divide-base-200 text-sm mb-10">
        <Section title="Report">
          <Row label="Reported by" value={report.user.email} />
          <Row label="Reason" value={REASON_LABELS[report.reason] ?? report.reason} />
          <Row label="Note" value={report.note ?? undefined} />
          <Row
            label="Date"
            value={new Date(report.createdAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          />
        </Section>

        <Section title="Publication">
          <Row label="Authors" value={paper.authors.join(", ") || undefined} />
          <Row label="Year" value={paper.year?.toString()} />
          <Row label="Journal" value={paper.journal ?? undefined} italic />
          <Row label="DOI" value={paper.doi ?? undefined} />
        </Section>

        {paper.abstract && (
          <Section title="Abstract">
            <p className="text-base-content/70 leading-relaxed">{paper.abstract}</p>
          </Section>
        )}

        {ext && (
          <Section title="Extracted Metadata">
            <Row label="Language" value={ext.language?.join(", ") || undefined} />
            <Row label="Participants" value={ext.participantCount?.toString()} />
            <Row label="Participant type" value={ext.participantType ?? undefined} />
            <Row label="Stimuli type" value={ext.stimuliType?.join(", ") || undefined} />
            <Row label="Stimuli count" value={ext.stimuliCount?.toString()} />
            <Row label="Norms collected" value={ext.normsCollected?.join(", ") || undefined} />
            <Row label="Instructions" value={ext.instructions ?? undefined} />
          </Section>
        )}
      </div>

      <div className="border-t border-base-200 pt-8 text-center">
        {report.reason === "WRONG_METADATA" ? (
          <>
            <p className="text-sm text-base-content/60 mb-4">
              Is the metadata correct?
            </p>
            <MetadataReportActions
              reportId={report.id}
              paperId={paper.id}
              hasExtraction={!!paper.extraction}
            />
          </>
        ) : (
          <>
            <p className="text-sm text-base-content/60 mb-4">
              Is this classification correct?
            </p>
            <ReportActions
              reportId={report.id}
              paperId={paper.id}
              currentStatus={paper.status as "ACCEPTED" | "EXCLUDED"}
            />
          </>
        )}
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/40 mb-3">
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Row({ label, value, italic }: { label: string; value: string | undefined; italic?: boolean }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-1.5">
      <span className="w-36 shrink-0 font-medium text-base-content/70">{label}</span>
      <span className={`text-base-content/80 ${italic ? "italic" : ""}`}>{value}</span>
    </div>
  )
}

import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const ReliabilityEntry = z.object({
  norm: z.string(),
  value: z.number().nullable().optional(),
  metric: z.string().nullable().optional(),
})

const ExtractionEntry = z.object({
  paperId: z.number().nullable().optional(),
  doi: z.string().nullable().optional(),
  language: z.array(z.string()).optional(),
  participantCount: z.number().nullable().optional(),
  participantType: z.string().nullable().optional(),
  participantLevelData: z.boolean().optional(),
  stimuliType: z.array(z.string()).optional(),
  stimuliCount: z.number().nullable().optional(),
  normsCollected: z.array(z.string()).optional(),
  instructions: z.string().nullable().optional(),
  licenseUrl: z.string().nullable().optional(),
  dataSource: z.enum(["ai", "human"]).nullable().optional(),
  reliabilities: z.array(ReliabilityEntry).optional(),
  confidence: z.number().nullable().optional(),
  sourceSnippets: z.record(z.string(), z.any()).nullable().optional(),
  extractedBy: z.string().optional(),
  markVerified: z.boolean().optional(),
})

type ResultRow = {
  index: number
  paperId: number | null
  title: string | null
  status: "created" | "updated" | "skipped" | "error"
  message: string
}

export default resolver.pipe(
  resolver.zod(z.object({ entries: z.array(ExtractionEntry).min(1).max(200) })),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ entries }, ctx) => {
    const results: ResultRow[] = []

    for (const [index, entry] of entries.entries()) {
      try {
        let paperId = entry.paperId ?? null
        if (!paperId && entry.doi) {
          const byDoi = await db.paper.findUnique({ where: { doi: entry.doi } })
          paperId = byDoi?.id ?? null
        }
        if (!paperId) {
          results.push({
            index,
            paperId: null,
            title: null,
            status: "skipped",
            message: "No matching paper — provide a valid paperId or doi",
          })
          continue
        }

        const paper = await db.paper.findUnique({ where: { id: paperId } })
        if (!paper) {
          results.push({
            index,
            paperId,
            title: null,
            status: "skipped",
            message: `Paper #${paperId} not found`,
          })
          continue
        }

        const existing = await db.paperExtraction.findUnique({ where: { paperId } })

        const confidence = entry.confidence ?? null
        const data = {
          language: entry.language ?? [],
          participantCount: entry.participantCount ?? null,
          participantType: entry.participantType ?? null,
          participantLevelData: entry.participantLevelData ?? false,
          stimuliType: entry.stimuliType ?? [],
          stimuliCount: entry.stimuliCount ?? null,
          normsCollected: entry.normsCollected ?? [],
          instructions: entry.instructions ?? null,
          licenseUrl: entry.licenseUrl ?? null,
          dataSource: entry.dataSource ?? null,
          reliabilities: entry.reliabilities ?? [],
          confidence,
          needsReview: entry.markVerified ? false : confidence == null ? true : confidence < 0.6,
          sourceSnippets: entry.sourceSnippets ?? undefined,
          extractedBy: entry.extractedBy ?? "manual-llm-import",
          extractedAt: new Date(),
          ...(entry.markVerified
            ? { verifiedAt: new Date(), verifiedById: ctx.session.userId }
            : {}),
        }

        await db.paperExtraction.upsert({
          where: { paperId },
          create: { paperId, ...data },
          update: data,
        })

        results.push({
          index,
          paperId,
          title: paper.title,
          status: existing ? "updated" : "created",
          message: existing ? "Updated existing extraction" : "Created new extraction",
        })
      } catch (e: any) {
        results.push({
          index,
          paperId: entry.paperId ?? null,
          title: null,
          status: "error",
          message: e.message ?? "Unknown error",
        })
      }
    }

    return { results }
  }
)

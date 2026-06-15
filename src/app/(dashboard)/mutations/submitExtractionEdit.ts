import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import db from "db"

const SubmitExtractionEdit = z.object({
  paperId: z.number(),
  language: z.array(z.string()),
  participantCount: z.number().int().nullable(),
  participantType: z.string().nullable(),
  stimuliType: z.array(z.string()),
  stimuliCount: z.number().int().nullable(),
  normsCollected: z.array(z.string()),
  instructions: z.string().nullable(),
  url: z.string().nullable(),
  licenseUrl: z.string().nullable().optional(),
  dataSource: z.string().nullable().optional(),
  participantLevelData: z.boolean().nullable().optional(),
  reliabilities: z.array(z.any()).nullable().optional(),
  note: z.string().max(1000).optional(),
  sourceEvidence: z.record(z.string()).optional(),
  modelAnswers: z.record(z.any()).optional(),
  modelSnippets: z.record(z.string()).optional(),
})

export default resolver.pipe(
  resolver.zod(SubmitExtractionEdit),
  resolver.authorize(),
  async ({ paperId, reliabilities, modelAnswers, modelSnippets, ...data }, ctx) => {
    const userId = ctx.session.userId as number
    const reliabilitiesValue = reliabilities === null ? Prisma.JsonNull : (reliabilities ?? undefined)
    await db.extractionEditSuggestion.upsert({
      where: { userId_paperId: { userId, paperId } },
      create: { userId, paperId, ...data, reliabilities: reliabilitiesValue, modelAnswers, modelSnippets },
      update: { ...data, reliabilities: reliabilitiesValue, modelAnswers, modelSnippets, resolved: false },
    })
    return { ok: true }
  }
)

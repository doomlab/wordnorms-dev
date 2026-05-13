import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
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
  note: z.string().max(1000).optional(),
})

export default resolver.pipe(
  resolver.zod(SubmitExtractionEdit),
  resolver.authorize(),
  async ({ paperId, ...data }, ctx) => {
    const userId = ctx.session.userId as number
    await db.extractionEditSuggestion.upsert({
      where: { userId_paperId: { userId, paperId } },
      create: { userId, paperId, ...data },
      update: { ...data, resolved: false },
    })
    return { ok: true }
  }
)

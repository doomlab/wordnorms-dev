import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(z.object({ suggestionId: z.number() })),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ suggestionId }, ctx) => {
    const suggestion = await db.extractionEditSuggestion.findUniqueOrThrow({
      where: { id: suggestionId },
    })
    const [, resolved] = await db.$transaction([
      db.paperExtraction.update({
        where: { paperId: suggestion.paperId },
        data: {
          language: suggestion.language,
          participantCount: suggestion.participantCount,
          participantType: suggestion.participantType,
          stimuliType: suggestion.stimuliType,
          stimuliCount: suggestion.stimuliCount,
          normsCollected: suggestion.normsCollected,
          instructions: suggestion.instructions,
          verifiedAt: new Date(),
          verifiedById: ctx.session.userId,
        },
      }),
      db.extractionEditSuggestion.update({
        where: { id: suggestionId },
        data: { resolved: true },
      }),
      db.user.update({
        where: { id: suggestion.userId },
        data: { points: { increment: 5 } },
      }),
    ])
    return resolved
  }
)

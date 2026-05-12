import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const ToggleFavorite = z.object({
  paperId: z.number(),
})

export default resolver.pipe(
  resolver.zod(ToggleFavorite),
  resolver.authorize(),
  async ({ paperId }, ctx) => {
    const userId = ctx.session.userId as number
    const existing = await db.userFavorite.findUnique({
      where: { userId_paperId: { userId, paperId } },
    })
    if (existing) {
      await db.userFavorite.delete({ where: { id: existing.id } })
      return { favorited: false }
    }
    await db.userFavorite.create({ data: { userId, paperId } })
    return { favorited: true }
  }
)

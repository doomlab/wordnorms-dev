import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const ToggleDatasetFavorite = z.object({
  bibtex: z.string(),
})

export default resolver.pipe(
  resolver.zod(ToggleDatasetFavorite),
  resolver.authorize(),
  async ({ bibtex }, ctx) => {
    const userId = ctx.session.userId as number
    const existing = await db.userDatasetFavorite.findUnique({
      where: { userId_bibtex: { userId, bibtex } },
    })
    if (existing) {
      await db.userDatasetFavorite.delete({ where: { id: existing.id } })
      return { favorited: false }
    }
    await db.userDatasetFavorite.create({ data: { userId, bibtex } })
    return { favorited: true }
  }
)

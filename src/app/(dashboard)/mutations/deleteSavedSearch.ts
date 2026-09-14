import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const DeleteSavedSearch = z.object({
  id: z.number(),
})

export default resolver.pipe(
  resolver.zod(DeleteSavedSearch),
  resolver.authorize(),
  async ({ id }, ctx) => {
    const userId = ctx.session.userId as number
    await db.savedSearch.deleteMany({ where: { id, userId } })
    return { ok: true }
  }
)

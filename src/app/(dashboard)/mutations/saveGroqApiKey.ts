import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(z.object({ apiKey: z.string().trim().max(500) })),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ apiKey }, ctx) => {
    await db.user.update({
      where: { id: ctx.session.userId as number },
      data: { groqApiKey: apiKey || null },
    })
  }
)

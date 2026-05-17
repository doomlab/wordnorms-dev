import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"
import { ResendMsg } from "integrations/mailer"
import { createAdminRequestMsg } from "integrations/emails"

const RequestAdminAccess = z.object({
  reason: z.string().max(500).optional(),
})

export default resolver.pipe(
  resolver.zod(RequestAdminAccess),
  resolver.authorize(),
  async ({ reason }, ctx) => {
    const user = await db.user.findUniqueOrThrow({
      where: { id: ctx.session.userId },
      select: { email: true, name: true, institution: true, role: true },
    })

    if (user.role !== "USER") {
      throw new Error("You already have elevated access.")
    }

    await ResendMsg(createAdminRequestMsg({ ...user, reason }))
  }
)

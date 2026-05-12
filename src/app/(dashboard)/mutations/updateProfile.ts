import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const UpdateProfile = z.object({
  name: z.string().max(100).optional(),
  institution: z.string().max(200).optional(),
})

export default resolver.pipe(
  resolver.zod(UpdateProfile),
  resolver.authorize(),
  async ({ name, institution }, ctx) => {
    return db.user.update({
      where: { id: ctx.session.userId },
      data: { name, institution },
    })
  }
)

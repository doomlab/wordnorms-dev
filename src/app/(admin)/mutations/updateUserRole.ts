import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

const UpdateUserRole = z.object({
  userId: z.number(),
  role: z.enum(["USER", "ADMIN"]),
})

export default resolver.pipe(
  resolver.zod(UpdateUserRole),
  resolver.authorize("SUPER_ADMIN"),
  async ({ userId, role }) => {
    return db.user.update({ where: { id: userId }, data: { role } })
  }
)

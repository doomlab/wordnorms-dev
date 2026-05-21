import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(
    z.object({
      groupKey: z.string(),
      groupType: z.string(),
      label: z.string(),
      dismiss: z.boolean(),
    })
  ),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ groupKey, groupType, label, dismiss }) => {
    if (dismiss) {
      await db.duplicateGroupIgnore.upsert({
        where: { groupKey_groupType: { groupKey, groupType } },
        create: { groupKey, groupType, label },
        update: {},
      })
    } else {
      await db.duplicateGroupIgnore.deleteMany({ where: { groupKey, groupType } })
    }
    return { ok: true }
  }
)

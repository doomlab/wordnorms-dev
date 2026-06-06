"use server"

import { revalidateTag } from "next/cache"
import { getBlitzContext } from "../../blitz-server"
import db from "db"

export async function toggleMaintenanceMode(enabled: boolean) {
  const ctx = await getBlitzContext()
  if (ctx.session.role !== "SUPER_ADMIN") throw new Error("Unauthorized")

  await db.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, maintenanceMode: enabled },
    update: { maintenanceMode: enabled },
  })

  revalidateTag("maintenance")
}

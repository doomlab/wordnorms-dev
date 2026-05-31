"use server"

import { cookies } from "next/headers"
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

  const cookieStore = await cookies()
  if (enabled) {
    cookieStore.set("site_maintenance", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
  } else {
    cookieStore.delete("site_maintenance")
  }
}

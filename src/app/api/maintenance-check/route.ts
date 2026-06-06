import { unstable_cache } from "next/cache"
import db from "db"
import { NextResponse } from "next/server"

const getMaintenanceMode = unstable_cache(
  async () => {
    const settings = await db.siteSettings.findFirst({ where: { id: 1 } })
    return settings?.maintenanceMode ?? false
  },
  ["maintenance-mode"],
  { tags: ["maintenance"], revalidate: 60 }
)

export async function GET() {
  const maintenance = await getMaintenanceMode()
  return NextResponse.json({ maintenance })
}

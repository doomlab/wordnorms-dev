import { NextRequest, NextResponse } from "next/server"
import { getBlitzContext } from "../../../blitz-server"
import db from "db"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBlitzContext()
  if (!ctx.session.role || !["ADMIN", "SUPER_ADMIN"].includes(ctx.session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const run = await db.pipelineRun.findUnique({
    where: { id: Number(id) },
    select: { status: true, step: true, finishedAt: true },
  })

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(run)
}

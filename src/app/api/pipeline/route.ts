import { NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import { getBlitzContext } from "../../blitz-server"
import db from "db"

export async function POST() {
  const ctx = await getBlitzContext()
  if (!ctx.session.role || !["ADMIN", "SUPER_ADMIN"].includes(ctx.session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const run = await db.pipelineRun.create({
    data: { startedById: ctx.session.userId as number | undefined },
  })

  const scriptPath = path.join(process.cwd(), "pipeline", "run_pipeline.py")
  const proc = spawn("python3", [scriptPath, "--run-id", String(run.id)], {
    detached: true,
    stdio: "ignore",
  })
  proc.unref()

  return NextResponse.json({ id: run.id })
}

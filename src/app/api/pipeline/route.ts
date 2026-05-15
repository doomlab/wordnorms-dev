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

  const [admin, run] = await Promise.all([
    db.user.findUnique({
      where: { id: ctx.session.userId as number },
      select: { groqApiKey: true },
    }),
    db.pipelineRun.create({
      data: { startedById: ctx.session.userId as number | undefined },
    }),
  ])

  const scriptPath = path.join(process.cwd(), "pipeline", "run_pipeline.py")
  if (!admin?.groqApiKey) {
    await db.pipelineRun.delete({ where: { id: run.id } })
    return NextResponse.json({ error: "Groq API key required" }, { status: 403 })
  }

  const proc = spawn("/Users/erinbuchanan/.pyenv/versions/3.9.18/bin/python3", [scriptPath, "--run-id", String(run.id)], {
    env: { ...process.env, GROQ_API_KEY: admin.groqApiKey },
    detached: true,
    stdio: "ignore",
  })
  proc.unref()

  return NextResponse.json({ id: run.id })
}

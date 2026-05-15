import { NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import { getBlitzContext } from "../../blitz-server"
import db from "db"

function runScript(scriptPath: string): Promise<{ output: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("python", [scriptPath])
    let output = ""
    proc.stdout.on("data", (d) => (output += d.toString()))
    proc.stderr.on("data", (d) => (output += d.toString()))
    proc.on("close", (code) => resolve({ output, code: code ?? 1 }))
  })
}

async function runPipeline(runId: number) {
  const pipelineDir = path.join(process.cwd(), "pipeline")

  await db.pipelineRun.update({ where: { id: runId }, data: { step: "fetch" } })
  const fetch = await runScript(path.join(pipelineDir, "fetch.py"))
  if (fetch.code !== 0) {
    await db.pipelineRun.update({
      where: { id: runId },
      data: { status: "FAILED", step: "fetch", output: fetch.output, finishedAt: new Date() },
    })
    return
  }

  await db.pipelineRun.update({ where: { id: runId }, data: { step: "predict" } })
  const predict = await runScript(path.join(pipelineDir, "predict.py"))
  await db.pipelineRun.update({
    where: { id: runId },
    data: {
      status: predict.code === 0 ? "DONE" : "FAILED",
      step: predict.code === 0 ? null : "predict",
      output: fetch.output + predict.output,
      finishedAt: new Date(),
    },
  })
}

export async function POST() {
  const ctx = await getBlitzContext()
  if (!ctx.session.role || !["ADMIN", "SUPER_ADMIN"].includes(ctx.session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const run = await db.pipelineRun.create({
    data: { startedById: ctx.session.userId as number | undefined },
  })

  // fire and forget — don't await
  runPipeline(run.id).catch(console.error)

  return NextResponse.json({ id: run.id })
}

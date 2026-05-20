import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import os from "os"
import fs from "fs/promises"
import db from "db"
import { getBlitzContext } from "../../blitz-server"

export async function POST(req: NextRequest) {
  const ctx = await getBlitzContext()
  if (!ctx.session.role || !["ADMIN", "SUPER_ADMIN"].includes(ctx.session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: ctx.session.userId as number },
    select: { groqApiKey: true },
  })
  if (!user?.groqApiKey) {
    return NextResponse.json({ error: "Groq API key required" }, { status: 403 })
  }

  const scriptPath = path.join(process.cwd(), "pipeline", "extract.py")
  let paperId: number
  let tmpPath: string | null = null

  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData()
    paperId = Number(form.get("paperId"))
    const file = form.get("file") as File | null
    if (!paperId || !file) {
      return NextResponse.json({ error: "paperId and file required" }, { status: 400 })
    }
    tmpPath = path.join(os.tmpdir(), `paper-${paperId}-${Date.now()}.pdf`)
    await fs.writeFile(tmpPath, new Uint8Array(await file.arrayBuffer()))
  } else {
    const body = await req.json()
    paperId = body.paperId
    if (!paperId) return NextResponse.json({ error: "paperId required" }, { status: 400 })
  }

  const args = ["--paper-id", String(paperId)]
  if (tmpPath) args.push("--pdf-path", tmpPath)

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(process.env.PIPELINE_PYTHON ?? "python3", [scriptPath, ...args], {
      env: { ...process.env, GROQ_API_KEY: user.groqApiKey ?? undefined },
    })

    let output = ""
    proc.stdout.on("data", (d: Buffer) => (output += d.toString()))
    proc.stderr.on("data", (d: Buffer) => (output += d.toString()))

    proc.on("close", async (code: number) => {
      if (tmpPath) await fs.unlink(tmpPath).catch(() => {})
      console.log(`[extract] paper=${paperId} exit=${code} output=${output}`)
      if (code === 0) {
        const skipped = /skipped:/.test(output)
        resolve(NextResponse.json({ ok: true, skipped, output }))
      } else {
        resolve(NextResponse.json({ ok: false, output }, { status: 500 }))
      }
    })
  })
}

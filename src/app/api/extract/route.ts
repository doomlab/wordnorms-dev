import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import { getBlitzContext } from "../../blitz-server"

export async function POST(req: NextRequest) {
  const ctx = await getBlitzContext()
  if (!ctx.session.role || !["ADMIN", "SUPER_ADMIN"].includes(ctx.session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { paperId } = await req.json()
  if (!paperId) return NextResponse.json({ error: "paperId required" }, { status: 400 })

  const scriptPath = path.join(process.cwd(), "pipeline", "extract.py")

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn("python", [scriptPath, "--paper-id", String(paperId)])

    let output = ""
    proc.stdout.on("data", (d) => (output += d.toString()))
    proc.stderr.on("data", (d) => (output += d.toString()))

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(NextResponse.json({ ok: true, output }))
      } else {
        resolve(NextResponse.json({ ok: false, output }, { status: 500 }))
      }
    })
  })
}

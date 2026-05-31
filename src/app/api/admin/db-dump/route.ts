import { getBlitzContext } from "../../../blitz-server"
import { spawn } from "child_process"

export async function GET() {
  const ctx = await getBlitzContext()
  if (ctx.session.role !== "SUPER_ADMIN") {
    return new Response("Unauthorized", { status: 403 })
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return new Response("DATABASE_URL not set", { status: 500 })

  const date = new Date().toISOString().split("T")[0]
  const filename = `wordnorms-${date}.sql`

  const proc = spawn("pg_dump", [dbUrl, "--format=plain", "--no-owner", "--no-acl"])

  const stream = new ReadableStream({
    start(controller) {
      proc.stdout.on("data", (chunk: Buffer) => controller.enqueue(chunk))
      proc.stdout.on("end", () => controller.close())
      proc.stdout.on("error", (err: Error) => controller.error(err))
      proc.stderr.on("data", (chunk: Buffer) => console.error("[db-dump]", chunk.toString()))
      proc.on("error", (err: Error) => controller.error(err))
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

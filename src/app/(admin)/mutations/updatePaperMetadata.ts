import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"

export default resolver.pipe(
  resolver.zod(
    z.object({
      paperId: z.number(),
      title: z.string().min(1),
      authors: z.array(z.string()),
      year: z.number().nullable(),
      doi: z.string().nullable(),
      journal: z.string().nullable(),
      abstract: z.string().nullable(),
      pdfUrl: z.string().nullable(),
      openAlexId: z.string().nullable(),
    })
  ),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ paperId, openAlexId, ...data }) => {
    return db.paper.update({
      where: { id: paperId },
      data: { ...data, openAlexId: openAlexId?.replace("https://openalex.org/", "") ?? null },
    })
  }
)

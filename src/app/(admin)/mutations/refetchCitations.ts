import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import db from "db"
import { fetchAndStoreCitations } from "src/lib/fetchAndStoreCitations"

const RefetchCitations = z.object({
  paperId: z.number(),
})

export default resolver.pipe(
  resolver.zod(RefetchCitations),
  resolver.authorize(["ADMIN", "SUPER_ADMIN"]),
  async ({ paperId }) => {
    const paper = await db.paper.findUnique({
      where: { id: paperId },
      select: { openAlexId: true, doi: true },
    })

    if (!paper?.openAlexId) throw new Error("Paper has no OpenAlex ID")

    const count = await fetchAndStoreCitations(paperId, paper.openAlexId, paper.doi)
    return { count }
  }
)

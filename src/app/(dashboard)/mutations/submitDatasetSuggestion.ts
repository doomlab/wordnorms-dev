import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import { ResendMsg } from "integrations/mailer"
import { createDatasetSuggestionMsg } from "integrations/emails"

const SubmitDatasetSuggestion = z.object({
  datasetUrl: z.string().url().max(1000),
  doi: z.string().max(200).optional(),
  contactEmail: z.string().email().max(200).optional(),
  note: z.string().max(1000).optional(),
})

export default resolver.pipe(resolver.zod(SubmitDatasetSuggestion), async (input) => {
  await ResendMsg(createDatasetSuggestionMsg(input))
  return { ok: true }
})

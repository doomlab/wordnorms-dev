import { resolver } from "@blitzjs/rpc"
import { z } from "zod"
import { ResendMsg } from "integrations/mailer"
import { createFeedbackMsg } from "integrations/emails"

const SubmitFeedback = z.object({
  message: z.string().min(1).max(2000),
  name: z.string().max(200).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
})

export default resolver.pipe(resolver.zod(SubmitFeedback), async ({ message, name, email }) => {
  await ResendMsg(
    createFeedbackMsg({
      message,
      name: name || undefined,
      email: email || undefined,
    })
  )
  return { ok: true }
})

import { resolver } from "@blitzjs/rpc"
import db from "db"
import { SecurePassword } from "@blitzjs/auth/secure-password"
import { email, password } from "../validations"
import { z } from "zod"

const SignupInput = z.object({ email, password })
import { Role } from "types"

export default resolver.pipe(resolver.zod(SignupInput), async ({ email, password }, ctx) => {
  const hashedPassword = await SecurePassword.hash(password)
  const user = await db.user.create({
    data: { email, hashedPassword },
  })

  await ctx.session.$create({ userId: user.id, role: "USER" as Role })

  return { userId: ctx.session.userId, ...user }
})

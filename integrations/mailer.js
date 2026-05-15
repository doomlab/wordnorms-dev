import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function ResendMsg(msg) {
  try {
    const response = await resend.emails.send(msg)

    if (response.error) {
      return { success: false, error: response.error }
    }

    return { success: true, data: response }
  } catch (error) {
    return { success: false, error }
  }
}

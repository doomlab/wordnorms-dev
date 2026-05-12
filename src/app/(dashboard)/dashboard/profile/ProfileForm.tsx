"use client"

import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import { Form, FORM_ERROR } from "src/app/components/Form"
import { LabeledTextField } from "src/app/components/LabeledTextField"
import updateProfile from "../../mutations/updateProfile"
import { z } from "zod"

const schema = z.object({
  name: z.string().max(100).optional(),
  institution: z.string().max(200).optional(),
})

export function ProfileForm({ name, institution }: { name?: string | null; institution?: string | null }) {
  const [update] = useMutation(updateProfile)
  const router = useRouter()

  return (
    <Form
      schema={schema}
      submitText="Save"
      initialValues={{ name: name ?? "", institution: institution ?? "" }}
      onSubmit={async (values) => {
        try {
          await update(values)
          router.refresh()
        } catch {
          return { [FORM_ERROR]: "Failed to save. Please try again." }
        }
      }}
    >
      <LabeledTextField name="name" label="Name" placeholder="Your name" />
      <LabeledTextField name="institution" label="Institution" placeholder="University or organization" />
    </Form>
  )
}

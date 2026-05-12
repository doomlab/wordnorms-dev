"use client"

import { useMutation } from "@blitzjs/rpc"
import { useState } from "react"
import { Form, FORM_ERROR } from "src/app/components/Form"
import { LabeledTextField } from "src/app/components/LabeledTextField"
import changePassword from "src/app/(auth)/mutations/changePassword"
import { ChangePassword } from "src/app/(auth)/validations"

export function ChangePasswordForm() {
  const [update] = useMutation(changePassword)
  const [success, setSuccess] = useState(false)

  return (
    <Form
      schema={ChangePassword}
      submitText="Update password"
      initialValues={{ currentPassword: "", newPassword: "" }}
      onSubmit={async (values) => {
        try {
          await update(values)
          setSuccess(true)
        } catch {
          return { [FORM_ERROR]: "Current password is incorrect." }
        }
      }}
    >
      <LabeledTextField name="currentPassword" label="Current password" type="password" placeholder="••••••••" />
      <LabeledTextField name="newPassword" label="New password" type="password" placeholder="••••••••" />
      {success && <p className="text-success text-sm">Password updated.</p>}
    </Form>
  )
}

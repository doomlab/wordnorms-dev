"use client"
import { LabeledTextField } from "src/app/components/LabeledTextField"
import { Form, FORM_ERROR } from "src/app/components/Form"
import { ResetPassword } from "../validations"
import resetPassword from "../mutations/resetPassword"
import { useMutation } from "@blitzjs/rpc"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams?.get("token")?.toString()
  const [resetPasswordMutation, { isSuccess }] = useMutation(resetPassword)

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm bg-base-200 shadow-sm">
        <div className="card-body gap-0">
          <h1 className="text-2xl font-bold mb-6">Set a new password</h1>

          {isSuccess ? (
            <div className="text-center py-4">
              <p className="text-base-content/70 mb-4">Your password has been reset. You are now logged in.</p>
              <Link href="/" className="btn btn-primary btn-sm">
                Go to browse
              </Link>
            </div>
          ) : (
            <Form
              submitText="Reset password"
              schema={ResetPassword}
              initialValues={{ password: "", passwordConfirmation: "", token }}
              onSubmit={async (values) => {
                try {
                  await resetPasswordMutation({ ...values, token })
                } catch (error: any) {
                  if (error.name === "ResetPasswordError") {
                    return { [FORM_ERROR]: error.message }
                  }
                  return { [FORM_ERROR]: "Sorry, we had an unexpected error. Please try again." }
                }
              }}
            >
              <LabeledTextField name="password" label="New password" type="password" placeholder="••••••••" />
              <LabeledTextField name="passwordConfirmation" label="Confirm new password" type="password" placeholder="••••••••" />
            </Form>
          )}
        </div>
      </div>
    </div>
  )
}

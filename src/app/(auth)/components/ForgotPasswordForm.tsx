"use client"
import { LabeledTextField } from "src/app/components/LabeledTextField"
import { Form, FORM_ERROR } from "src/app/components/Form"
import { ForgotPassword } from "../validations"
import forgotPassword from "../mutations/forgotPassword"
import { useMutation } from "@blitzjs/rpc"
import Link from "next/link"

export function ForgotPasswordForm() {
  const [forgotPasswordMutation, { isSuccess }] = useMutation(forgotPassword)

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm bg-base-200 shadow-sm">
        <div className="card-body gap-0">
          <h1 className="text-2xl font-bold mb-6">Forgot password?</h1>

          {isSuccess ? (
            <div className="text-center py-4">
              <p className="text-base-content/70 mb-4">
                If your email is in our system, you will receive reset instructions shortly.
              </p>
              <Link href="/login" className="btn btn-primary btn-sm">
                Back to log in
              </Link>
            </div>
          ) : (
            <>
              <Form
                submitText="Send reset instructions"
                schema={ForgotPassword}
                initialValues={{ email: "" }}
                onSubmit={async (values) => {
                  try {
                    await forgotPasswordMutation(values)
                  } catch {
                    return { [FORM_ERROR]: "Sorry, we had an unexpected error. Please try again." }
                  }
                }}
              >
                <LabeledTextField name="email" label="Email" placeholder="you@example.com" type="email" />
              </Form>

              <div className="divider mt-4 mb-2" />
              <div className="flex justify-center">
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Back to log in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

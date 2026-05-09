"use client"

import { LabeledTextField } from "src/app/components/LabeledTextField"
import { Form, FORM_ERROR } from "src/app/components/Form"
import signup from "../mutations/signup"
import { Signup } from "../validations"
import { useMutation } from "@blitzjs/rpc"
import { useRouter } from "next/navigation"
import Link from "next/link"

type SignupFormProps = {
  onSuccess?: () => void
}

export const SignupForm = (props: SignupFormProps) => {
  const [signupMutation] = useMutation(signup)
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
      <div className="card w-full max-w-sm bg-base-200 shadow-lg">
        <div className="card-body gap-0">
          <h1 className="text-2xl font-bold mb-1">Create an account</h1>
          <p className="text-sm text-base-content/60 mb-6">
            Already have one?{" "}
            <Link href="/login" className="link link-primary">
              Log in
            </Link>
          </p>

          <Form
            submitText="Sign up"
            schema={Signup}
            initialValues={{ email: "", password: "", passwordConfirmation: "" }}
            onSubmit={async ({ email, password }) => {
              try {
                await signupMutation({ email, password })
                router.refresh()
                router.push("/")
              } catch (error: any) {
                if (error.code === "P2002" && error.meta?.target?.includes("email")) {
                  return { email: "This email is already being used" }
                } else {
                  return { [FORM_ERROR]: error.toString() }
                }
              }
            }}
          >
            <LabeledTextField name="email" label="Email" placeholder="you@example.com" type="email" />
            <LabeledTextField name="password" label="Password" placeholder="••••••••" type="password" />
            <LabeledTextField name="passwordConfirmation" label="Confirm password" placeholder="••••••••" type="password" />
          </Form>
        </div>
      </div>
    </div>
  )
}

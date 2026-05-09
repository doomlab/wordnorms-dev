"use client"

import { AuthenticationError, PromiseReturnType } from "blitz"
import Link from "next/link"
import { LabeledTextField } from "src/app/components/LabeledTextField"
import { Form, FORM_ERROR } from "src/app/components/Form"
import login from "../mutations/login"
import { Login } from "../validations"
import { useMutation } from "@blitzjs/rpc"
import { useSearchParams, useRouter } from "next/navigation"
import type { Route } from "next"

type LoginFormProps = {
  onSuccess?: (user: PromiseReturnType<typeof login>) => void
}

export const LoginForm = (props: LoginFormProps) => {
  const [loginMutation] = useMutation(login)
  const router = useRouter()
  const next = useSearchParams()?.get("next")

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
      <div className="card w-full max-w-sm bg-base-200 shadow-lg">
        <div className="card-body gap-0">
          <h1 className="text-2xl font-bold mb-1">Log in</h1>
          <p className="text-sm text-base-content/60 mb-6">
            No account?{" "}
            <Link href="/signup" className="link link-primary">
              Sign up
            </Link>
          </p>

          <Form
            submitText="Log in"
            schema={Login}
            initialValues={{ email: "", password: "" }}
            onSubmit={async (values) => {
              try {
                await loginMutation(values)
                router.refresh()
                router.push(next ? (next as Route) : "/")
              } catch (error: any) {
                if (error instanceof AuthenticationError) {
                  return { [FORM_ERROR]: "Invalid email or password" }
                } else {
                  return { [FORM_ERROR]: "An unexpected error occurred. Please try again." }
                }
              }
            }}
          >
            <LabeledTextField name="email" label="Email" placeholder="you@example.com" type="email" />
            <LabeledTextField name="password" label="Password" placeholder="••••••••" type="password" />
          </Form>

          <div className="text-center mt-4">
            <Link href="/forgot-password" className="link link-primary text-sm">
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

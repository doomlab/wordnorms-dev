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
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm bg-base-200 shadow-sm">
        <div className="card-body gap-0">
          <h1 className="text-2xl font-bold mb-6">Log in</h1>

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

          <div className="divider mt-4 mb-2" />
          <div className="flex gap-2 justify-center flex-wrap">
            <Link href="/signup" className="btn btn-secondary btn-outline btn-sm">
              Create an account
            </Link>
            <Link href="/forgot-password" className="btn btn-accent btn-outline btn-sm">
              Forgot password
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

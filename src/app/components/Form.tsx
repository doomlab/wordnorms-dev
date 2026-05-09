import { useState, ReactNode, PropsWithoutRef } from "react"
import { Formik, FormikProps } from "formik"
import { validateZodSchema } from "blitz"
import { z } from "zod"

export interface FormProps<S extends z.ZodType<any, any>>
  extends Omit<PropsWithoutRef<React.JSX.IntrinsicElements["form"]>, "onSubmit"> {
  children?: ReactNode
  submitText?: string
  schema?: S
  onSubmit: (values: z.infer<S>) => Promise<void | OnSubmitResult>
  initialValues?: FormikProps<z.infer<S>>["initialValues"]
}

interface OnSubmitResult {
  FORM_ERROR?: string
  [prop: string]: any
}

export const FORM_ERROR = "FORM_ERROR"

export function Form<S extends z.ZodType<any, any>>({
  children,
  submitText,
  schema,
  initialValues,
  onSubmit,
  ...props
}: FormProps<S>) {
  const [formError, setFormError] = useState<string | null>(null)
  return (
    <Formik
      initialValues={initialValues || {}}
      validate={validateZodSchema(schema)}
      onSubmit={async (values, { setErrors }) => {
        const { FORM_ERROR, ...otherErrors } = (await onSubmit(values)) || {}
        if (FORM_ERROR) setFormError(FORM_ERROR)
        if (Object.keys(otherErrors).length > 0) setErrors(otherErrors)
      }}
    >
      {({ handleSubmit, isSubmitting }) => (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" {...props}>
          {children}

          {formError && (
            <div role="alert" className="alert alert-error text-sm py-2">
              {formError}
            </div>
          )}

          {submitText && (
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full mt-1">
              {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : submitText}
            </button>
          )}
        </form>
      )}
    </Formik>
  )
}

export default Form

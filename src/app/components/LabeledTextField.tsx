import { forwardRef, PropsWithoutRef } from "react"
import { useField, useFormikContext, ErrorMessage } from "formik"

export interface LabeledTextFieldProps
  extends PropsWithoutRef<React.JSX.IntrinsicElements["input"]> {
  name: string
  label: string
  type?: "text" | "password" | "email" | "number"
  outerProps?: PropsWithoutRef<React.JSX.IntrinsicElements["div"]>
}

export const LabeledTextField = forwardRef<HTMLInputElement, LabeledTextFieldProps>(
  ({ name, label, outerProps, ...props }, ref) => {
    const [input] = useField(name)
    const { isSubmitting } = useFormikContext()

    return (
      <div className="form-control w-full" {...outerProps}>
        <label className="label pb-1">
          <span className="label-text font-medium">{label}</span>
        </label>
        <input
          {...input}
          disabled={isSubmitting}
          {...props}
          ref={ref}
          className="input input-bordered w-full"
        />
        <ErrorMessage name={name}>
          {(msg) => (
            <p role="alert" className="text-error text-xs mt-1">
              {msg}
            </p>
          )}
        </ErrorMessage>
      </div>
    )
  }
)

LabeledTextField.displayName = "LabeledTextField"

export default LabeledTextField

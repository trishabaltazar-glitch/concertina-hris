import { cn } from "@/lib/utils"
import { SubmitButton } from "@/components/ui/submit-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  error,
  setup,
  onSubmit,
  ...props
}: React.ComponentProps<"div"> & {
  error?: string
  setup?: string
  onSubmit: (formData: FormData) => Promise<void>
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to manage your time and leaves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error === "InvalidCredentials" && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              Invalid email or password. Please try again.
            </div>
          )}

          {error === "AuthSystem" && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              Sign-in is temporarily unavailable. Please try again in a moment.
            </div>
          )}

          {setup === "success" && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              Account activated successfully. You can sign in now.
            </div>
          )}

          <form action={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" name="password" type="password" required />
              </Field>
              <Field>
                <SubmitButton className="w-full">Sign In</SubmitButton>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

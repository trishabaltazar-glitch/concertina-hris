import { signIn } from "@/auth"
import { LoginForm } from "@/components/login-form"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import Image from "next/image"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; setup?: string; reset?: string }>
}) {
  const params = await searchParams

  return (
    <div className="light flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Image
            src="/assets/egs-logo.avif"
            alt="EGS"
            width={220}
            height={84}
            className="h-auto w-auto max-h-14"
            priority
          />
        </div>
        <LoginForm
          error={params?.error}
          setup={params?.setup}
          reset={params?.reset}
          onSubmit={async (formData) => {
            "use server"

            try {
              await signIn("credentials", formData)
            } catch (error) {
              if (error instanceof AuthError) {
                if (error.type === "CredentialsSignin" || error.type === "CallbackRouteError") {
                  redirect("/login?error=InvalidCredentials")
                }

                redirect("/login?error=AuthSystem")
              }

              throw error
            }
          }}
        />
      </div>
    </div>
  )
}

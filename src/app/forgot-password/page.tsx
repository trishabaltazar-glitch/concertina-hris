import Link from "next/link";
import Image from "next/image";
import { MailCheck } from "lucide-react";

import { requestPasswordReset } from "@/app/actions/password-reset";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;
  const isSent = params?.sent === "1";

  return (
    <div className="light flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Image
            src="/assets/egs-logo.avif"
            alt="EGS"
            width={220}
            height={84}
            className="h-auto max-h-14 w-auto"
            priority
          />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Reset password</CardTitle>
            <CardDescription>
              Enter your work email and we&apos;ll send reset instructions if the account exists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSent ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <MailCheck className="size-4" />
                  Check your email
                </div>
                <p className="leading-6">
                  If that email is linked to an active account, a password reset link has been sent.
                </p>
              </div>
            ) : (
              <form action={requestPasswordReset}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </Field>
                  <Field>
                    <SubmitButton className="w-full">Send Reset Link</SubmitButton>
                  </Field>
                </FieldGroup>
              </form>
            )}

            <div className="mt-5 text-center text-sm">
              <Link href="/login" className="font-medium text-brand-steel hover:text-brand-red">
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

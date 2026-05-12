import Link from "next/link";
import Image from "next/image";

import { resetPassword } from "@/app/actions/password-reset";
import prisma from "@/lib/prisma";
import { hashPasswordResetToken } from "@/lib/password-reset-token";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const errorCopy: Record<string, string> = {
  invalid: "This reset link is invalid or has expired. Request a new password reset link.",
  missing: "Please complete all password fields.",
  mismatch: "Passwords do not match.",
  short: "Password must be at least 8 characters long.",
  system: "Password reset is temporarily unavailable. Please try again.",
};

async function isResetTokenValid(token: string) {
  if (!token) return false;

  const tokenHash = hashPasswordResetToken(token);
  const tokens = await prisma.$queryRaw<{ expiresAt: Date }[]>`
    SELECT "expiresAt"
    FROM "PasswordResetToken"
    WHERE "tokenHash" = ${tokenHash}
    LIMIT 1
  `;
  const resetToken = tokens[0];

  return !!resetToken && resetToken.expiresAt >= new Date();
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token || "";
  const hasValidToken = await isResetTokenValid(token);
  const error = params?.error
    ? errorCopy[params.error]
    : token && !hasValidToken
      ? errorCopy.invalid
      : null;

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
            <CardTitle className="text-xl">Create new password</CardTitle>
            <CardDescription>Choose a new password for your Concertina HR account.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {!token ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                Reset link is missing. Request a new password reset link.
              </div>
            ) : !hasValidToken ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                This reset link is invalid, expired, or already used.
              </div>
            ) : (
              <form action={resetPassword}>
                <input type="hidden" name="token" value={token} />
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="password">New password</FieldLabel>
                    <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                    <PasswordInput id="confirmPassword" name="confirmPassword" required minLength={8} autoComplete="new-password" />
                  </Field>
                  <Field>
                    <SubmitButton className="w-full">Update Password</SubmitButton>
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

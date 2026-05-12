import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { completeInviteSetup } from "@/app/actions/onboarding";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SetupAccountProps = {
    searchParams: Promise<{
        token?: string;
        error?: string;
        success?: string;
    }>;
};

export default async function SetupAccountPage({ searchParams }: SetupAccountProps) {
    const params = await searchParams;
    const token = params?.token || "";
    const error = params?.error;
    const success = params?.success;

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
                        <CardTitle className="text-xl">Set your password</CardTitle>
                        <CardDescription>
                            Complete account setup to activate your Concertina HR access.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!token && (
                            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                                Invalid setup link. Ask an admin for a new invite.
                            </div>
                        )}

                        {!!error && (
                            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                                {error}
                            </div>
                        )}

                        {!!success && (
                            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                                {success}
                            </div>
                        )}

                        <form
                            action={async (formData) => {
                                "use server";

                                const result = await completeInviteSetup(formData);

                                if (result.success) {
                                    redirect("/login?setup=success");
                                }

                                const safeToken = encodeURIComponent((formData.get("token") as string) || "");
                                const safeError = encodeURIComponent(result.error || "Account setup failed.");
                                redirect(`/setup-account?token=${safeToken}&error=${safeError}`);
                            }}
                        >
                            <input type="hidden" name="token" value={token} />
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="password">New password</FieldLabel>
                                    <PasswordInput
                                        id="password"
                                        name="password"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        placeholder="At least 8 characters"
                                        disabled={!token}
                                    />
                                </Field>

                                <Field>
                                    <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                                    <PasswordInput
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        placeholder="Re-enter your password"
                                        disabled={!token}
                                    />
                                </Field>

                                <Field>
                                    <SubmitButton className="w-full" disabled={!token}>
                                        Activate Account
                                    </SubmitButton>
                                </Field>
                            </FieldGroup>
                        </form>

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

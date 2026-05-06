import { redirect } from "next/navigation";
import { completeInviteSetup } from "@/app/actions/onboarding";
import { SubmitButton } from "@/components/ui/submit-button";

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
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-lg">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Set Your Password</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                        Complete account setup to activate your HR portal access.
                    </p>
                </div>

                {!token && (
                    <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm mb-6 border border-red-500/20 font-medium">
                        Invalid setup link. Ask an admin for a new invite.
                    </div>
                )}

                {!!error && (
                    <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm mb-6 border border-red-500/20 font-medium">
                        {error}
                    </div>
                )}

                {!!success && (
                    <div className="bg-emerald-500/10 text-emerald-500 p-3 rounded-lg text-sm mb-6 border border-emerald-500/20 font-medium">
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
                    className="space-y-4"
                >
                    <input type="hidden" name="token" value={token} />

                    <div className="space-y-2">
                        <label className="text-sm font-medium">New Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            minLength={8}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm"
                            placeholder="At least 8 characters"
                            disabled={!token}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Confirm Password</label>
                        <input
                            name="confirmPassword"
                            type="password"
                            required
                            minLength={8}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm"
                            placeholder="Re-enter your password"
                            disabled={!token}
                        />
                    </div>

                    <SubmitButton variant="gradient" size="lg" disabled={!token}>
                        Activate Account
                    </SubmitButton>
                </form>
            </div>
        </div>
    );
}

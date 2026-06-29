"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

import { changePassword } from "@/app/actions/password";
import { Button } from "@/components/ui/button";

export function PasswordForm() {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleAction(formData: FormData) {
    setIsPending(true);
    setMessage(null);

    try {
      const result = await changePassword(formData);
      if (result.success) {
        setMessage({ type: "success", text: "Password successfully updated." });
        const form = document.getElementById("password-form") as HTMLFormElement | null;
        form?.reset();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to update password." });
      }
    } catch {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Security</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Use at least 8 characters for your account password.</p>
        </div>
      </div>

      <form id="password-form" action={handleAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">New password</span>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              required
              minLength={8}
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
              placeholder="Enter new password"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Confirm password</span>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={8}
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
              placeholder="Re-enter password"
            />
          </label>
        </div>

        {message && (
          <div
            className={
              message.type === "success"
                ? "flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
                : "flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            }
          >
            {message.type === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="min-w-36">
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

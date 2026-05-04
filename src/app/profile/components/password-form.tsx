"use client";

import { useState } from "react";
import { changePassword } from "@/app/actions/password";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";

export function PasswordForm() {
    const [isPending, setIsPending] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

    async function handleAction(formData: FormData) {
        setIsPending(true);
        setMessage(null);
        
        try {
            const result = await changePassword(formData);
            if (result.success) {
                setMessage({ type: "success", text: "Password successfully updated!" });
                // Reset form fields using standard DOM methods
                const form = document.getElementById("password-form") as HTMLFormElement;
                if (form) form.reset();
            } else {
                setMessage({ type: "error", text: result.error || "Failed to update password." });
            }
        } catch (err) {
            setMessage({ type: "error", text: "An unexpected error occurred." });
        } finally {
            setIsPending(false);
        }
    }

    return (
        <div className="bg-[#11131A] border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="size-5 text-emerald-400" />
                <h2 className="text-xl font-semibold text-white">Security Settings</h2>
            </div>
            
            <form id="password-form" action={handleAction} className="space-y-4">
                <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-1">
                        New Password
                    </label>
                    <input 
                        type="password" 
                        id="newPassword" 
                        name="newPassword" 
                        required
                        minLength={8}
                        className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="••••••••"
                    />
                </div>
                
                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1">
                        Confirm New Password
                    </label>
                    <input 
                        type="password" 
                        id="confirmPassword" 
                        name="confirmPassword" 
                        required
                        minLength={8}
                        className="w-full bg-[#1A1D27] border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="••••••••"
                    />
                </div>

                {message && (
                    <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                        message.type === "success" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                        {message.type === "success" && <CheckCircle2 className="size-4 shrink-0 mt-0.5" />}
                        {message.text}
                    </div>
                )}

                <div className="pt-2">
                    <button 
                        type="submit" 
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold bg-white text-black rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            "Update Password"
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

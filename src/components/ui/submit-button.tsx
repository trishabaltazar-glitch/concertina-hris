"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function SubmitButton({
    children,
    className,
    variant = "default"
}: {
    children: React.ReactNode,
    className?: string,
    variant?: "default" | "destructive" | "outline" | "success"
}) {
    const { pending } = useFormStatus();

    let baseClass = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-10 px-4 py-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full";

    if (variant === "default") {
        baseClass += " bg-primary text-primary-foreground hover:bg-primary/90";
    } else if (variant === "destructive") {
        baseClass += " bg-destructive text-destructive-foreground hover:bg-destructive/90";
    } else if (variant === "outline") {
        baseClass += " border border-input bg-background hover:bg-accent hover:text-accent-foreground";
    } else if (variant === "success") {
        baseClass += " bg-emerald-600 text-white hover:bg-emerald-700";
    }

    const finalClassName = className ? `${baseClass} ${className}` : baseClass;

    return (
        <button type="submit" disabled={pending} className={finalClassName}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {children}
        </button>
    );
}

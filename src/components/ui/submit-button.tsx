"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function SubmitButton({
    children,
    className,
    variant = "default",
    size = "default",
    disabled
}: {
    children: React.ReactNode,
    className?: string,
    variant?: "default" | "gradient" | "destructive" | "destructive-subtle" | "destructive-outline" | "outline" | "secondary" | "ghost" | "success",
    size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg",
    disabled?: boolean
}) {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending || disabled}
            className={cn(buttonVariants({ variant, size }), "w-full", className)}
        >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {children}
        </button>
    );
}

"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = React.ComponentProps<typeof Input>;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasToggled, setHasToggled] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={isVisible ? "text" : "password"}
        className={cn(
          "pr-10 transition-[box-shadow,border-color] duration-200",
          hasToggled && "ring-2 ring-brand-steel/20",
          className
        )}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 grid size-5 -translate-y-1/2 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        onClick={() => {
          setIsVisible((visible) => !visible);
          setHasToggled(true);
          window.setTimeout(() => setHasToggled(false), 220);
        }}
        aria-label={isVisible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        <span
          className={cn(
            "grid transition duration-200 ease-out",
            hasToggled && "scale-90 rotate-6 opacity-80"
          )}
        >
          {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </span>
      </button>
    </div>
  );
}

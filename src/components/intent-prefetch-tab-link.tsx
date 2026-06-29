"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/utils";

type IntentPrefetchTabLinkProps = React.ComponentProps<typeof Link> & {
  active?: boolean;
};

export function IntentPrefetchTabLink({
  active = false,
  className,
  href,
  onClick,
  onFocus,
  onMouseEnter,
  onTouchStart,
  children,
  ...props
}: IntentPrefetchTabLinkProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const prefetch = React.useCallback(() => {
    const target = typeof href === "string" ? href : href.toString();
    router.prefetch(target);
  }, [href, router]);

  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      aria-busy={isPending || undefined}
      onMouseEnter={(event) => {
        prefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetch();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetch();
        onTouchStart?.(event);
      }}
      onClick={(event) => {
        if (!active) setIsPending(true);
        onClick?.(event);
      }}
      className={cn(className, isPending && !active && "opacity-70")}
    >
      {children}
    </Link>
  );
}

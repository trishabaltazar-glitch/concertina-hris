"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Moon01Icon,
  Moon02Icon,
  Sun01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const THEMES = [
  {
    label: "Light",
    value: "light",
    icon: Sun03Icon,
  },
  {
    label: "Dark",
    value: "dark",
    icon: Moon02Icon,
  },
] as const

type ThemeValue = (typeof THEMES)[number]["value"]

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const currentTheme = (resolvedTheme === "light" ? "light" : "dark") as ThemeValue

  return (
    <div className="grid gap-1.5">
      <p className="px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
        Appearance
      </p>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((theme) => {
          const isActive = currentTheme === theme.value

          return (
            <Button
              key={theme.value}
              type="button"
              variant="ghost"
              onClick={() => setTheme(theme.value)}
              className={cn(
                "h-10 justify-start rounded-xl border border-transparent px-3 text-sm font-medium",
                "hover:bg-accent hover:text-accent-foreground",
                isActive && "border-border bg-accent text-accent-foreground"
              )}
            >
              <HugeiconsIcon icon={theme.icon} size={18} strokeWidth={1.8} />
              {theme.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export function ThemeIconToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-lg border border-border/70 bg-card/80 hover:bg-accent"
        aria-label="Toggle theme"
        title="Toggle theme"
        disabled
      >
        <HugeiconsIcon
          icon={Sun01Icon}
          size={18}
          strokeWidth={1.9}
        />
      </Button>
    )
  }

  const isLight = resolvedTheme !== "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="h-9 w-9 rounded-lg border border-border/70 bg-card/80 hover:bg-accent"
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      <HugeiconsIcon
        icon={isLight ? Moon01Icon : Sun01Icon}
        size={18}
        strokeWidth={1.9}
      />
    </Button>
  )
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

type TimesheetFilterBarProps = {
  selectedRange: string;
  fromValue: string;
  toValue: string;
  displayRange: string;
};

function updateParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

export function TimesheetFilterBar({
  selectedRange,
  fromValue,
  toValue,
  displayRange,
}: TimesheetFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [rangeValue, setRangeValue] = useState(selectedRange);

  const applyParams = useCallback((params: URLSearchParams) => {
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router]);

  const applyRange = useCallback((value: string) => {
    const days = Math.min(90, Math.max(1, Number.parseInt(value, 10) || 7));
    const params = new URLSearchParams();
    params.set("range", String(days));
    applyParams(params);
  }, [applyParams]);

  const handleDateChange = (key: "from" | "to", value: string) => {
    const params = new URLSearchParams();
    params.set("range", selectedRange);
    updateParam(params, "from", key === "from" ? value : fromValue);
    updateParam(params, "to", key === "to" ? value : toValue);
    applyParams(params);
  };

  useEffect(() => {
    setRangeValue(selectedRange);
  }, [selectedRange]);

  useEffect(() => {
    if (rangeValue === selectedRange) return;

    const timer = window.setTimeout(() => {
      applyRange(rangeValue);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [applyRange, rangeValue, selectedRange]);

  return (
    <div className="inline-flex max-w-full overflow-hidden rounded-lg border border-border bg-background text-sm shadow-sm">
      <label className="flex h-9 items-center gap-1 border-r border-border bg-background px-3 text-xs font-medium text-foreground">
        <span>Last</span>
        <input
          type="number"
          min={1}
          max={90}
          value={rangeValue}
          onChange={(event) => setRangeValue(event.target.value)}
          onBlur={(event) => applyRange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="h-7 w-10 rounded-md border border-transparent bg-muted/45 px-1 text-center text-xs font-semibold text-foreground outline-none [appearance:textfield] focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label="Number of days to show"
        />
        <span>days</span>
      </label>

      <details className="group relative">
        <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-3 text-xs font-medium text-foreground marker:hidden">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          <span className="whitespace-nowrap">{displayRange}</span>
        </summary>
        <div className="absolute left-0 top-10 z-20 grid w-64 gap-3 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            From
            <input
              type="date"
              value={fromValue}
              onChange={(event) => handleDateChange("from", event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            To
            <input
              type="date"
              value={toValue}
              onChange={(event) => handleDateChange("to", event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
        </div>
      </details>
    </div>
  );
}

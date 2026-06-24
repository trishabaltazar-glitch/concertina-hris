"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type TimesheetFilterBarProps = {
  fromValue: string;
  toValue: string;
  showEmptyDays: boolean;
};

function updateParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

function parseDateValue(value: string) {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function getCalendarDays(month: Date) {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });
}

export function TimesheetFilterBar({
  fromValue,
  toValue,
  showEmptyDays,
}: TimesheetFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentFrom = parseDateValue(fromValue) ?? new Date();
  const currentTo = parseDateValue(toValue) ?? currentFrom;
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(startOfMonth(currentFrom));
  const [draftFrom, setDraftFrom] = useState<Date | null>(currentFrom);
  const [draftTo, setDraftTo] = useState<Date | null>(currentTo);

  const applyParams = useCallback((params: URLSearchParams) => {
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router]);

  const setShowEmptyParam = useCallback((params: URLSearchParams, value = showEmptyDays) => {
    if (value) {
      params.set("empty", "1");
    } else {
      params.delete("empty");
    }
  }, [showEmptyDays]);

  const applyCustomRange = useCallback((from: Date | null, to: Date | null) => {
    if (!from || !to) return;

    const [safeFrom, safeTo] = isBefore(to, from) ? [to, from] : [from, to];
    const params = new URLSearchParams();
    setShowEmptyParam(params);
    updateParam(params, "from", format(safeFrom, "yyyy-MM-dd"));
    updateParam(params, "to", format(safeTo, "yyyy-MM-dd"));
    applyParams(params);
  }, [applyParams, setShowEmptyParam]);

  const openCalendar = () => {
    const nextFrom = parseDateValue(fromValue) ?? new Date();
    const nextTo = parseDateValue(toValue) ?? nextFrom;
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    setViewMonth(startOfMonth(nextFrom));
    setIsCalendarOpen((value) => !value);
  };

  const handleDateSelect = (day: Date) => {
    if (!draftFrom || draftTo || isBefore(day, draftFrom)) {
      setDraftFrom(day);
      setDraftTo(null);
      return;
    }

    setDraftTo(day);
  };

  const handleApplyRange = () => {
    applyCustomRange(draftFrom, draftTo);
    setIsCalendarOpen(false);
  };

  const handleShowEmptyChange = (value: boolean) => {
    const params = new URLSearchParams();
    updateParam(params, "from", fromValue);
    updateParam(params, "to", toValue);
    setShowEmptyParam(params, value);
    applyParams(params);
  };

  const calendarDays = getCalendarDays(viewMonth);
  const canApplyRange = Boolean(draftFrom && draftTo);

  return (
    <div className="relative flex max-w-full flex-wrap items-center gap-0 rounded-lg border border-border bg-background text-sm shadow-sm">
      <button
        type="button"
        onClick={openCalendar}
        className="group flex h-10 items-center gap-2 border-r border-border bg-muted/45 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={isCalendarOpen}
        aria-label="Open calendar date range picker"
      >
        <CalendarDays className="size-3.5 text-brand-red" />
        <span className="whitespace-nowrap">Date range</span>
        <span className="hidden rounded-md bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border sm:inline-flex">
          Open calendar
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform group-hover:text-foreground",
            isCalendarOpen && "rotate-180"
          )}
        />
      </button>

      <button
        type="button"
        onClick={openCalendar}
        className="flex h-10 items-center gap-2 border-r border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="whitespace-nowrap text-muted-foreground">
          {draftFrom ? format(draftFrom, "MMM d, yyyy") : "Start date"}
        </span>
        <span className="text-muted-foreground">to</span>
        <span className="whitespace-nowrap text-muted-foreground">
          {draftTo ? format(draftTo, "MMM d, yyyy") : "End date"}
        </span>
      </button>

      <label className="flex h-10 cursor-pointer items-center gap-2 border-r border-border bg-background px-3 text-xs font-medium text-foreground">
        <input
          type="checkbox"
          checked={showEmptyDays}
          onChange={(event) => handleShowEmptyChange(event.target.checked)}
          className="size-3.5 rounded border-input accent-foreground"
        />
        <span className="whitespace-nowrap">Show empty days</span>
      </label>

      {isCalendarOpen && (
        <div className="absolute left-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setViewMonth((month) => addMonths(month, -1))}
              className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-semibold text-foreground">
              {format(viewMonth, "MMMM yyyy")}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth((month) => addMonths(month, 1))}
              className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isRangeStart = draftFrom ? isSameDay(day, draftFrom) : false;
              const isRangeEnd = draftTo ? isSameDay(day, draftTo) : false;
              const isInsideRange =
                draftFrom && draftTo && isAfter(day, draftFrom) && isBefore(day, draftTo);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={cn(
                    "h-9 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                    !isSameMonth(day, viewMonth) && "text-muted-foreground/45",
                    isInsideRange && "bg-muted text-foreground",
                    (isRangeStart || isRangeEnd) && "bg-foreground text-background hover:bg-foreground/90",
                    !isRangeStart && !isRangeEnd && !isInsideRange && "hover:bg-muted"
                  )}
                  aria-pressed={isRangeStart || isRangeEnd}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className="min-w-0 text-xs text-muted-foreground">
              {draftFrom && draftTo
                ? `${format(draftFrom, "MMM d")} - ${format(draftTo, "MMM d, yyyy")}`
                : "Select a start and end date"}
            </p>
            <button
              type="button"
              onClick={handleApplyRange}
              disabled={!canApplyRange}
              className="inline-flex h-8 items-center justify-center rounded-md bg-foreground px-3 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

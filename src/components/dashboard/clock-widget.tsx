"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Play, Square } from "lucide-react";

import { toggleClockStatus, getClockStatus } from "@/app/actions/time";
import { cn } from "@/lib/utils";

function formatElapsedTime(now: Date, clockInTime: Date | null) {
  if (!clockInTime) {
    return format(now, "HH:mm:ss");
  }

  const totalSeconds = Math.max(
    0,
    Math.floor((now.getTime() - clockInTime.getTime()) / 1000)
  );
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

export function ClockWidget() {
  const [time, setTime] = useState<Date | null>(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [hasLoadedStatus, setHasLoadedStatus] = useState(false);

  useEffect(() => {
    getClockStatus().then((status) => {
      setIsClockedIn(status.isClockedIn);
      setClockInTime(status.clockInTime ? new Date(status.clockInTime) : null);
      setHasLoadedStatus(true);
    });

    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleClock = async () => {
    if (isPending || !hasLoadedStatus) return;

    setIsPending(true);
    try {
      const res = await toggleClockStatus();
      if (res.success) {
        const nextStatus = await getClockStatus();
        setIsClockedIn(nextStatus.isClockedIn);
        setClockInTime(nextStatus.clockInTime ? new Date(nextStatus.clockInTime) : null);
      }
    } finally {
      setIsPending(false);
    }
  };

  if (!time) {
    return (
      <div className="rounded-[24px] border border-border/70 bg-background/70 p-5">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-24 rounded-full bg-muted" />
          <div className="space-y-3">
            <div className="mx-auto h-3 w-20 rounded-full bg-muted" />
            <div className="mx-auto h-12 w-36 rounded-2xl bg-muted" />
          </div>
          <div className="mx-auto h-10 w-28 rounded-full bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-border/70 bg-background/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Clock-in</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Live attendance tracker
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold",
            !hasLoadedStatus && "bg-muted text-muted-foreground",
            hasLoadedStatus &&
              (isClockedIn
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground")
          )}
        >
          {!hasLoadedStatus ? "Loading" : isClockedIn ? "Ongoing" : "Ready"}
        </span>
      </div>

      <div className="mt-8 rounded-3xl bg-card px-6 py-8 text-center ring-1 ring-border/70">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {isClockedIn ? "Time since clock-in" : "Current time"}
        </p>
        <h2 className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-foreground">
          {isClockedIn
            ? formatElapsedTime(time, clockInTime)
            : format(time, "HH:mm:ss")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isClockedIn && clockInTime
            ? `Clocked in at ${format(clockInTime, "h:mm a")} | ${format(clockInTime, "EEEE, MMM d")}`
            : format(time, "EEEE, MMM d")}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handleToggleClock}
          disabled={isPending || !hasLoadedStatus}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
            isClockedIn
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary/92",
            (isPending || !hasLoadedStatus) && "opacity-70"
          )}
        >
          {isPending ? (
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isClockedIn ? (
            <>
              <Square className="size-4 fill-current" />
              Clock-out
            </>
          ) : (
            <>
              <Play className="size-4 fill-current" />
              Clock-in
            </>
          )}
        </button>
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
        {!hasLoadedStatus
          ? "Checking your current attendance status."
          : isClockedIn
            ? "You are currently clocked in."
            : "You are currently clocked out and ready to begin."}
      </p>
    </div>
  );
}

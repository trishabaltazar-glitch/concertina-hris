"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Coffee, Play, Square } from "lucide-react";

import { toggleBreakStatus, toggleClockStatus, getClockStatus } from "@/app/actions/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ClockStatus = Awaited<ReturnType<typeof getClockStatus>>;

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
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isBreakPending, setIsBreakPending] = useState(false);
  const [hasLoadedStatus, setHasLoadedStatus] = useState(false);

  const applyClockStatus = useCallback((status: ClockStatus) => {
    setIsClockedIn(status.isClockedIn);
    setIsOnBreak(status.isOnBreak);
    setClockInTime(status.clockInTime ? new Date(status.clockInTime) : null);
    setBreakStartTime(status.breakStartTime ? new Date(status.breakStartTime) : null);
  }, []);

  useEffect(() => {
    getClockStatus().then((status) => {
      applyClockStatus(status);
      setHasLoadedStatus(true);
    });

    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [applyClockStatus]);

  const handleToggleClock = async () => {
    if (isPending || !hasLoadedStatus) return;

    setIsPending(true);
    try {
      const res = await toggleClockStatus(projectName, notes);
      if (res.success) {
        const nextStatus = res.status || (await getClockStatus());
        applyClockStatus(nextStatus);
        if (nextStatus.isClockedIn) {
          setProjectName("");
          setNotes("");
        }
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleToggleBreak = async () => {
    if (isBreakPending || !hasLoadedStatus || !isClockedIn) return;

    setIsBreakPending(true);
    try {
      const res = await toggleBreakStatus();
      if (res.success) {
        applyClockStatus(res.status || (await getClockStatus()));
      }
    } finally {
      setIsBreakPending(false);
    }
  };

  if (!time) {
    return (
      <div className="rounded-lg border border-border/70 bg-background/70 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="mx-auto h-3 w-20 rounded-full bg-muted" />
            <div className="mx-auto h-10 w-32 rounded-lg bg-muted" />
          </div>
          <div className="mx-auto h-9 w-28 rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Clock-in</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Live attendance tracker
          </p>
        </div>
        <span
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold",
            !hasLoadedStatus && "bg-muted text-muted-foreground",
            hasLoadedStatus &&
              (isClockedIn
                ? isOnBreak
                  ? "bg-sky-500/12 text-sky-700 dark:text-sky-300"
                  : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground")
          )}
        >
          {!hasLoadedStatus ? "Loading" : isOnBreak ? "On break" : isClockedIn ? "Ongoing" : "Ready"}
        </span>
      </div>

      <div className="mt-4 rounded-lg bg-card px-4 py-5 text-center ring-1 ring-border/70">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {isOnBreak ? "Break time" : isClockedIn ? "Time since clock-in" : "Current time"}
        </p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
          {isOnBreak
            ? formatElapsedTime(time, breakStartTime)
            : isClockedIn
            ? formatElapsedTime(time, clockInTime)
            : format(time, "HH:mm:ss")}
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {isClockedIn && clockInTime
            ? `Clocked in at ${format(clockInTime, "h:mm a")} | ${format(clockInTime, "EEEE, MMM d")}`
            : format(time, "EEEE, MMM d")}
        </p>
      </div>

      {!isClockedIn && (
        <div className="mt-4 grid gap-2">
          <Input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Project or work item (optional)"
            maxLength={120}
          />
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes (optional)"
            maxLength={500}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {isClockedIn && (
          <Button
            type="button"
            onClick={handleToggleBreak}
            disabled={isBreakPending || isPending || !hasLoadedStatus}
            variant={isOnBreak ? "secondary" : "outline"}
            size="sm"
            className="rounded-md"
          >
            {isBreakPending ? (
              <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                <Coffee className="size-4" />
                {isOnBreak ? "End break" : "Start break"}
              </>
            )}
          </Button>
        )}
        <Button
          type="button"
          onClick={handleToggleClock}
          disabled={isPending || isBreakPending || !hasLoadedStatus}
          variant={isClockedIn ? "destructive" : "default"}
          size="lg"
          className={cn(
            "h-12 min-w-36 rounded-md px-6 text-sm font-semibold shadow-sm ring-2 ring-transparent transition-all",
            !isClockedIn &&
              "bg-brand-red text-brand-red-foreground shadow-brand-red/20 hover:bg-brand-red/90 hover:shadow-md focus-visible:ring-brand-red/35",
            isClockedIn && "focus-visible:ring-destructive/35",
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
              <Play className="size-5 fill-current" />
              Clock-in
            </>
          )}
        </Button>
      </div>

      <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
        {!hasLoadedStatus
          ? "Checking your current attendance status."
          : isOnBreak
            ? "Break time is being tracked and will be deducted from worked time."
          : isClockedIn
            ? "You are currently clocked in."
            : "You are currently clocked out and ready to begin."}
      </p>
    </div>
  );
}

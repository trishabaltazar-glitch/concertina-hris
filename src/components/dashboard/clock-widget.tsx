"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Coffee, Loader2, Play, Square, TimerReset } from "lucide-react";

import { toggleBreakStatus, toggleClockStatus, getClockStatus } from "@/app/actions/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ClockStatus = Awaited<ReturnType<typeof getClockStatus>>;
type PendingAction = "clock-in" | "clock-out" | "break-start" | "break-end" | null;

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
  const [isPending, setIsPending] = useState(false);
  const [isBreakPending, setIsBreakPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [hasLoadedStatus, setHasLoadedStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyClockStatus = useCallback((status: ClockStatus) => {
    setIsClockedIn(status.isClockedIn);
    setIsOnBreak(status.isOnBreak);
    setClockInTime(status.clockInTime ? new Date(status.clockInTime) : null);
    setBreakStartTime(status.breakStartTime ? new Date(status.breakStartTime) : null);
  }, []);

  const currentStatus = useCallback(
    (): ClockStatus => ({
      isClockedIn,
      isOnBreak,
      clockInTime,
      breakStartTime,
    }),
    [breakStartTime, clockInTime, isClockedIn, isOnBreak]
  );

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

    const previousStatus = currentStatus();
    const action: PendingAction = isClockedIn ? "clock-out" : "clock-in";
    const optimisticClockTime = new Date();

    setErrorMessage(null);
    setPendingAction(action);
    applyClockStatus(
      isClockedIn
        ? {
            isClockedIn: false,
            isOnBreak: false,
            clockInTime: null,
            breakStartTime: null,
          }
        : {
            isClockedIn: true,
            isOnBreak: false,
            clockInTime: optimisticClockTime,
            breakStartTime: null,
          }
    );
    setIsPending(true);
    try {
      const res = await toggleClockStatus();
      if (res.success) {
        const nextStatus = res.status || (await getClockStatus());
        applyClockStatus(nextStatus);
      } else {
        applyClockStatus(previousStatus);
        setErrorMessage(res.error || "Could not update your clock status.");
      }
    } finally {
      setIsPending(false);
      setPendingAction(null);
    }
  };

  const handleToggleBreak = async () => {
    if (isBreakPending || !hasLoadedStatus || !isClockedIn) return;

    const previousStatus = currentStatus();
    const action: PendingAction = isOnBreak ? "break-end" : "break-start";
    const optimisticBreakTime = new Date();

    setErrorMessage(null);
    setPendingAction(action);
    applyClockStatus({
      isClockedIn: true,
      clockInTime,
      isOnBreak: !isOnBreak,
      breakStartTime: isOnBreak ? null : optimisticBreakTime,
    });
    setIsBreakPending(true);
    try {
      const res = await toggleBreakStatus();
      if (res.success) {
        applyClockStatus(res.status || (await getClockStatus()));
      } else {
        applyClockStatus(previousStatus);
        setErrorMessage(res.error || "Could not update your break status.");
      }
    } finally {
      setIsBreakPending(false);
      setPendingAction(null);
    }
  };

  const isSyncing = isPending || isBreakPending;
  const syncLabel =
    pendingAction === "clock-in"
      ? "Clock-in noted. Syncing securely..."
      : pendingAction === "clock-out"
        ? "Clock-out noted. Syncing securely..."
        : pendingAction === "break-start"
          ? "Break start noted. Syncing securely..."
          : pendingAction === "break-end"
            ? "Break end noted. Syncing securely..."
            : null;

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
    <div className="flex h-full flex-col rounded-lg border border-border/70 bg-background/70 p-4">
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
            isSyncing && "bg-brand-steel/12 text-brand-steel",
            hasLoadedStatus &&
              !isSyncing &&
              (isClockedIn
                ? isOnBreak
                  ? "bg-sky-500/12 text-sky-700 dark:text-sky-300"
                  : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground")
          )}
        >
          {!hasLoadedStatus ? "Loading" : isSyncing ? "Syncing" : isOnBreak ? "On break" : isClockedIn ? "Ongoing" : "Ready"}
        </span>
      </div>

      <div
        className={cn(
          "relative mt-4 flex min-h-36 flex-col justify-center overflow-hidden rounded-lg bg-card px-4 py-5 text-center ring-1 ring-border/70",
          isSyncing && "ring-brand-steel/35"
        )}
      >
        {isSyncing && (
          <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-brand-steel/10">
            <div className="h-full w-1/3 loading-sweep brand-gradient" />
          </div>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {isSyncing ? "Syncing attendance" : isOnBreak ? "Break time" : isClockedIn ? "Time since clock-in" : "Current time"}
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

      {(isSyncing || errorMessage) && (
        <div
          className={cn(
            "mt-3 overflow-hidden rounded-lg border px-3 py-3 text-xs shadow-sm",
            errorMessage
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-brand-steel/25 bg-brand-steel/10 text-brand-navy dark:text-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            {errorMessage ? (
              <span className="size-2 rounded-full bg-destructive" />
            ) : (
              <div className="relative grid size-9 shrink-0 place-items-center rounded-md bg-card text-brand-steel ring-1 ring-brand-steel/20">
                <TimerReset className="size-4" />
                <span className="absolute inset-1 rounded-full border border-brand-steel/25 border-t-brand-steel loading-orbit" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{errorMessage ? "Update failed" : syncLabel}</p>
              {!errorMessage && (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <span className="h-1.5 rounded-full bg-brand-steel loading-breathe" />
                  <span className="h-1.5 rounded-full bg-brand-red loading-breathe [animation-delay:120ms]" />
                  <span className="h-1.5 rounded-full bg-brand-steel loading-breathe [animation-delay:240ms]" />
                </div>
              )}
              {errorMessage && <p className="mt-1 text-muted-foreground">{errorMessage}</p>}
            </div>
          </div>
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
              <>
                <Loader2 className="size-4 animate-spin" />
                Syncing
              </>
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
            <>
              <CheckCircle2 className="size-4" />
              Syncing
            </>
          ) : isClockedIn ? (
            <>
              <Square className="size-4 fill-current" />
              Clock out
            </>
          ) : (
            <>
              <Play className="size-5 fill-current" />
              Clock in
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Clock3, Play, Square, TimerReset } from "lucide-react";

import { toggleClockStatus, getClockStatus } from "@/app/actions/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ClockStatus = Awaited<ReturnType<typeof getClockStatus>>;
type PendingAction = "clock-in" | "clock-out" | null;
type ClockWidgetProps = {
  initialStatus?: {
    isClockedIn: boolean;
    clockInTime: Date | string | null;
  };
};

const DEFAULT_CLOCK_STATUS: ClockStatus = {
  isClockedIn: false,
  clockInTime: null,
};

function parseClockInTime(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value);
}

function getCurrentTimeParts(date: Date) {
  return {
    time: format(date, "h:mm:ss"),
    meridiem: format(date, "a"),
  };
}

function formatElapsedTime(now: Date, clockInTime: Date | null) {
  if (!clockInTime) {
    return getCurrentTimeParts(now).time;
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

export function ClockWidget({ initialStatus = DEFAULT_CLOCK_STATUS }: ClockWidgetProps) {
  const [time, setTime] = useState<Date | null>(null);
  const [isClockedIn, setIsClockedIn] = useState(initialStatus.isClockedIn);
  const [clockInTime, setClockInTime] = useState<Date | null>(() =>
    parseClockInTime(initialStatus.clockInTime)
  );
  const [isPending, setIsPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [hasLoadedStatus] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyClockStatus = useCallback((status: ClockStatus) => {
    setIsClockedIn(status.isClockedIn);
    setClockInTime(status.clockInTime ? new Date(status.clockInTime) : null);
  }, []);

  const currentStatus = useCallback(
    (): ClockStatus => ({
      isClockedIn,
      clockInTime,
    }),
    [clockInTime, isClockedIn]
  );

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
            clockInTime: null,
          }
        : {
            isClockedIn: true,
            clockInTime: optimisticClockTime,
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

  const isSyncing = isPending;
  const syncLabel =
    pendingAction === "clock-in"
      ? "Clock-in noted. Syncing securely..."
      : pendingAction === "clock-out"
        ? "Clock-out noted. Syncing securely..."
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

  const currentTime = getCurrentTimeParts(time);

  return (
    <div className="flex flex-col rounded-lg border border-border/70 bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-brand-red">
            <Clock3 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Clock-in / out</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Live attendance tracker
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold",
            !hasLoadedStatus && "bg-muted text-muted-foreground",
            isSyncing && "bg-brand-steel/12 text-brand-steel",
            hasLoadedStatus &&
              !isSyncing &&
              (isClockedIn
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground")
          )}
        >
          {!hasLoadedStatus ? "Loading" : isSyncing ? "Syncing" : isClockedIn ? "Ongoing" : "Ready"}
        </span>
      </div>

      <div
        className={cn(
          "relative mt-3 overflow-hidden rounded-lg border border-border/70 bg-background/70 p-3",
          isSyncing && "ring-brand-steel/35"
        )}
      >
        {isSyncing && (
          <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-brand-steel/10">
            <div className="h-full w-1/3 loading-sweep brand-gradient" />
          </div>
        )}
        <div className="flex flex-col items-center text-center">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {isSyncing ? "Syncing attendance" : isClockedIn ? "Time since clock-in" : "Current time"}
            </p>
            {isClockedIn ? (
              <h2 className="mt-1 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
                {formatElapsedTime(time, clockInTime)}
              </h2>
            ) : (
              <div className="mt-1 flex items-start justify-center gap-2 text-foreground">
                <span className="text-5xl font-semibold tracking-tight sm:text-6xl">
                  {currentTime.time}
                </span>
                <span className="mt-1 flex flex-col items-start leading-none sm:mt-2">
                  <span className="text-base font-semibold uppercase text-foreground sm:text-lg">
                    {currentTime.meridiem}
                  </span>
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    PHT
                  </span>
                </span>
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {isClockedIn && clockInTime
                ? `Clocked in at ${format(clockInTime, "h:mm a")} | ${format(clockInTime, "EEEE, MMM d")}`
                : format(time, "EEEE, MMM d")}
            </p>
          </div>

          <Button
            type="button"
            onClick={handleToggleClock}
            disabled={isPending || !hasLoadedStatus}
            variant={isClockedIn ? "destructive" : "default"}
            size="default"
            className={cn(
              "mt-4 h-12 w-full rounded-md px-5 text-base font-semibold shadow-sm ring-2 ring-transparent transition-all",
              !isClockedIn &&
                "bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-md focus-visible:ring-emerald-500/35",
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

      <p className="mt-2 rounded-md bg-muted/35 px-3 py-2 text-center text-xs leading-5 text-muted-foreground">
        {!hasLoadedStatus
          ? "Checking your current attendance status."
          : isClockedIn
            ? "You are currently clocked in."
            : "You are currently clocked out and ready to begin."}
      </p>
    </div>
  );
}

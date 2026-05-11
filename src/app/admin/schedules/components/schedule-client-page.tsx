"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, Clock3, Pencil, Search, Users, X } from "lucide-react";
import { upsertBulkSchedules, upsertWeeklySchedule } from "@/app/actions/schedules";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const UNPAID_BREAK_HOURS = 1;
const SHIFT_STYLES = [
  "border-l-brand-red bg-brand-red/10 text-brand-red ring-brand-red/15",
  "border-l-brand-steel bg-brand-steel/15 text-brand-steel ring-brand-steel/15",
  "border-l-amber-500 bg-amber-100 text-amber-700 ring-amber-500/15 dark:bg-amber-500/15 dark:text-amber-300",
  "border-l-emerald-500 bg-emerald-100 text-emerald-700 ring-emerald-500/15 dark:bg-emerald-500/15 dark:text-emerald-300",
  "border-l-stone-500 bg-stone-200/70 text-stone-700 ring-stone-500/15 dark:bg-stone-400/15 dark:text-stone-300",
  "border-l-pink-500 bg-pink-100 text-pink-700 ring-pink-500/15 dark:bg-pink-500/15 dark:text-pink-300",
];

type Schedule = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  position?: string | null;
  schedules: Schedule[];
};

function initials(name: string) {
  const letters = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return letters || "?";
}

function parseTime(time?: string) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours + minutes / 60;
}

function formatTime(time?: string) {
  const parsed = parseTime(time);
  if (parsed === null) return "";
  const hours = Math.floor(parsed);
  const minutes = Math.round((parsed - hours) * 60);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""} ${period}`;
}

function formatHour(hour: number) {
  return `${hour % 12 || 12} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatCompactHour(hour: number) {
  return String(hour % 12 || 12);
}

function formatEditableTime(time: string) {
  const parsed = parseTime(time);
  if (parsed === null) return time;

  const hours = Math.floor(parsed);
  const minutes = Math.round((parsed - hours) * 60);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function parseEditableTime(value: string) {
  const cleanValue = value.trim().toUpperCase();
  if (!cleanValue) return "";

  const match = cleanValue.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? "00");
  const period = match[3];

  if (minute < 0 || minute > 59) return null;

  if (period) {
    if (hour < 1 || hour > 12) return null;

    const normalizedHour = period === "PM" ? (hour % 12) + 12 : hour % 12;
    return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  if (hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function hasValidTimeRange(startTime: string, endTime: string) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  return start !== null && end !== null && end > start;
}

function TimeTextField({ label, name, value, onChange }: {
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const parsedValue = parseEditableTime(value);

  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      {label}
      {name ? <input type="hidden" name={name} value={parsedValue ?? ""} /> : null}
      <input
        type="text"
        inputMode="text"
        placeholder="9:00 AM"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          const parsed = parseEditableTime(value);
          if (parsed) onChange(formatEditableTime(parsed));
        }}
        className={cn(
          "h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40",
          parsedValue === null ? "border-destructive focus:ring-destructive/30" : "border-input"
        )}
      />
      <span className={cn("text-xs", parsedValue === null ? "text-destructive" : "text-muted-foreground")}>
        {parsedValue === null ? "Use a time like 9:00 AM or 18:00." : "Example: 9:00 AM, 1:30 PM, or 18:00"}
      </span>
    </label>
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekDates(date: Date) {
  const start = addDays(date, -date.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getMonthDates(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(firstDay, -firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function formatDateHeader(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMonthHeader(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getScheduleHours(schedule?: Schedule) {
  const start = parseTime(schedule?.startTime);
  const end = parseTime(schedule?.endTime);
  if (start === null || end === null || end <= start) return 0;
  return Math.max(0, end - start - UNPAID_BREAK_HOURS);
}

function getTotalWeeklyHours(schedules: Schedule[]) {
  return schedules.reduce((total, schedule) => total + getScheduleHours(schedule), 0);
}

function updateUsersDaySchedule(users: User[], userIds: string[], dayOfWeek: number, startTime: string, endTime: string) {
  return users.map((user) => {
    if (!userIds.includes(user.id)) return user;

    const otherSchedules = user.schedules.filter((schedule) => schedule.dayOfWeek !== dayOfWeek);

    return {
      ...user,
      schedules:
        startTime && endTime
          ? [...otherSchedules, { dayOfWeek, startTime, endTime }].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          : otherSchedules,
    };
  });
}

function updateUserSelectedDaysSchedule(
  users: User[],
  userId: string,
  dayOfWeeks: number[],
  startTime: string,
  endTime: string
) {
  return users.map((user) => {
    if (user.id !== userId) return user;

    const otherSchedules = user.schedules.filter((schedule) => !dayOfWeeks.includes(schedule.dayOfWeek));

    return {
      ...user,
      schedules:
        startTime && endTime
          ? [
              ...otherSchedules,
              ...dayOfWeeks.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime })),
            ].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          : otherSchedules,
    };
  });
}

export function ScheduleClientPage({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [overviewMode, setOverviewMode] = useState<"MONTH" | "WEEK">("WEEK");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedUserId, setSelectedUserId] = useState(initialUsers[0]?.id ?? "");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isEmployeeDaysModalOpen, setIsEmployeeDaysModalOpen] = useState(false);
  const [modalUserId, setModalUserId] = useState(initialUsers[0]?.id ?? "");
  const [bulkUserIds, setBulkUserIds] = useState<string[]>([]);
  const [bulkDaySelection, setBulkDaySelection] = useState<number[]>([new Date().getDay()]);
  const [bulkStartTime, setBulkStartTime] = useState("9:00 AM");
  const [bulkEndTime, setBulkEndTime] = useState("6:00 PM");
  const [employeeDaySelection, setEmployeeDaySelection] = useState<number[]>([new Date().getDay()]);
  const [employeeDaysStartTime, setEmployeeDaysStartTime] = useState("9:00 AM");
  const [employeeDaysEndTime, setEmployeeDaysEndTime] = useState("6:00 PM");
  const [bulkTimeError, setBulkTimeError] = useState("");
  const [employeeDaysTimeError, setEmployeeDaysTimeError] = useState("");

  const today = new Date();
  const selectedDay = selectedDate.getDay();
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthDates = useMemo(() => getMonthDates(selectedDate), [selectedDate]);
  const roleOptions = useMemo(() => {
    return Array.from(new Set(users.map((user) => user.role).filter(Boolean))).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query) ||
        (user.department ?? "").toLowerCase().includes(query) ||
        (user.position ?? "").toLowerCase().includes(query);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

      return matchesQuery && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? filteredUsers[0] ?? users[0];
  const modalUser = users.find((user) => user.id === modalUserId);
  const selectedWeeklyHours = getTotalWeeklyHours(selectedUser?.schedules ?? []);
  const selectedScheduledDays = selectedUser?.schedules.length ?? 0;
  const selectedDaySchedules = filteredUsers
    .map((user) => ({
      user,
      schedule: user.schedules.find((schedule) => schedule.dayOfWeek === selectedDay),
    }))
    .filter((item) => item.schedule);

  const scheduledStartHours = selectedDaySchedules
    .map((item) => parseTime(item.schedule?.startTime))
    .filter((hour): hour is number => hour !== null)
    .map((hour) => Math.floor(hour));
  const scheduledEndHours = selectedDaySchedules
    .map((item) => parseTime(item.schedule?.endTime))
    .filter((hour): hour is number => hour !== null)
    .map((hour) => Math.ceil(hour));
  const timelineStart = Math.min(8, ...scheduledStartHours);
  const timelineEnd = Math.max(20, ...scheduledEndHours);
  const timelineSpan = Math.max(timelineEnd - timelineStart, 1);
  const hours = Array.from({ length: timelineSpan + 1 }, (_, index) => timelineStart + index);
  const visibleTimelineHours = hours;

  function openBulkModal() {
    setBulkUserIds(filteredUsers.map((user) => user.id));
    setBulkDaySelection([]);
    setBulkStartTime("9:00 AM");
    setBulkEndTime("6:00 PM");
    setIsBulkModalOpen(true);
  }

  function openEmployeeDaysModal() {
    if (selectedUser) {
      setModalUserId(selectedUser.id);
      const schedule = selectedUser.schedules.find((item) => item.dayOfWeek === selectedDay);
      setEmployeeDaysStartTime(formatEditableTime(schedule?.startTime || "09:00"));
      setEmployeeDaysEndTime(formatEditableTime(schedule?.endTime || "18:00"));
    }
    setEmployeeDaySelection([selectedDay]);
    setIsEmployeeDaysModalOpen(true);
  }

  function changeEmployeeDaysUser(userId: string) {
    const user = users.find((item) => item.id === userId);
    const schedule = user?.schedules.find((item) => item.dayOfWeek === selectedDay);

    setModalUserId(userId);
    setEmployeeDaysStartTime(formatEditableTime(schedule?.startTime || "09:00"));
    setEmployeeDaysEndTime(formatEditableTime(schedule?.endTime || "18:00"));
  }

  function toggleBulkUser(userId: string) {
    setBulkUserIds((currentIds) => {
      return currentIds.includes(userId)
        ? currentIds.filter((currentId) => currentId !== userId)
        : [...currentIds, userId];
    });
  }

  function toggleBulkDay(dayOfWeek: number) {
    setBulkDaySelection((currentDays) => {
      return currentDays.includes(dayOfWeek)
        ? currentDays.filter((currentDay) => currentDay !== dayOfWeek)
        : [...currentDays, dayOfWeek].sort((a, b) => a - b);
    });
  }

  function toggleEmployeeDay(dayOfWeek: number) {
    setEmployeeDaySelection((currentDays) => {
      return currentDays.includes(dayOfWeek)
        ? currentDays.filter((currentDay) => currentDay !== dayOfWeek)
        : [...currentDays, dayOfWeek].sort((a, b) => a - b);
    });
  }

  async function saveBulkDaySchedule(formData: FormData) {
    const userIds = formData.getAll("userIds") as string[];
    const dayOfWeeks = (formData.getAll("bulkDayOfWeeks") as string[]).map(Number);
    const startTime = parseEditableTime(bulkStartTime);
    const endTime = parseEditableTime(bulkEndTime);

    if (userIds.length === 0 || dayOfWeeks.length === 0 || startTime === null || endTime === null) return;
    if (!hasValidTimeRange(startTime, endTime)) {
      setBulkTimeError("End time must be after start time.");
      return;
    }

    const schedules = dayOfWeeks.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime }));

    await upsertBulkSchedules(userIds, schedules);
    setUsers((currentUsers) =>
      dayOfWeeks.reduce(
        (updatedUsers, dayOfWeek) => updateUsersDaySchedule(updatedUsers, userIds, dayOfWeek, startTime, endTime),
        currentUsers
      )
    );
    setBulkTimeError("");
    setIsBulkModalOpen(false);
  }

  async function saveEmployeeSelectedDaysSchedule(formData: FormData) {
    const userId = formData.get("userId") as string;
    const dayOfWeeks = (formData.getAll("dayOfWeeks") as string[]).map(Number);
    const startTime = parseEditableTime(employeeDaysStartTime);
    const endTime = parseEditableTime(employeeDaysEndTime);

    if (dayOfWeeks.length === 0 || startTime === null || endTime === null) return;
    if (!hasValidTimeRange(startTime, endTime)) {
      setEmployeeDaysTimeError("End time must be after start time.");
      return;
    }

    const schedules = dayOfWeeks.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime }));

    await upsertWeeklySchedule(userId, schedules);
    setUsers((currentUsers) =>
      updateUserSelectedDaysSchedule(currentUsers, userId, dayOfWeeks, startTime, endTime)
    );
    setSelectedUserId(userId);
    setEmployeeDaysTimeError("");
    setIsEmployeeDaysModalOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-background ring-1 ring-border">
              <CalendarDays className="size-4 text-brand-steel" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Schedule Manager</div>
              <div className="text-xs text-muted-foreground">{formatDateHeader(selectedDate)}</div>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Previous day"
                onClick={() => setSelectedDate((date) => addDays(date, -1))}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Next day"
                onClick={() => setSelectedDate((date) => addDays(date, 1))}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(14rem,18rem)_minmax(9rem,12rem)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground shadow-sm transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <select
              aria-label="Filter team by role"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="ALL">All roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid min-h-[30rem] gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-border lg:max-h-[36rem] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Users className="size-3.5" />
                Team
              </div>
              <div className="flex items-center gap-2">
                {roleFilter !== "ALL" ? (
                  <button
                    type="button"
                    onClick={() => setRoleFilter("ALL")}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {roleFilter}
                  </button>
                ) : null}
                <div className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {filteredUsers.length}
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {filteredUsers.map((user, index) => {
                const weeklyHours = getTotalWeeklyHours(user.schedules);
                const isSelected = user.id === selectedUser?.id;

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted",
                      isSelected && "border-border bg-muted shadow-sm"
                    )}
                  >
                    <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-xs font-semibold text-foreground ring-1 ring-border">
                      {initials(user.name)}
                      <span
                        className={cn(
                          "absolute -right-1 -top-1 size-2.5 rounded-full ring-2 ring-card",
                          index % 2 === 0 ? "bg-brand-red" : "bg-brand-steel"
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{user.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{user.position || user.department || user.role}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div className="font-semibold text-foreground">{weeklyHours.toFixed(weeklyHours % 1 ? 1 : 0)}</div>
                      <div>hrs</div>
                    </div>
                  </button>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No employees match the current search and role filter.
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 overflow-hidden">
            {selectedUser ? (
              <>
                <div className="border-b border-border px-3 py-3">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                        {initials(selectedUser.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold text-foreground">{selectedUser.name}</div>
                        <div className="truncate text-sm text-muted-foreground">
                          {selectedUser.email} - {selectedUser.position || selectedUser.department || selectedUser.role}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(2,minmax(132px,1fr))_minmax(150px,auto)]">
                      <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-steel/10 text-brand-steel">
                              <Clock3 className="size-3.5" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-muted-foreground">Weekly hours</div>
                              <div className="mt-0.5 text-lg font-semibold leading-none text-foreground">
                                {selectedWeeklyHours.toFixed(selectedWeeklyHours % 1 ? 1 : 0)}
                                <span className="ml-1 text-xs font-medium text-muted-foreground">hrs</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand-steel"
                            style={{ width: `${Math.min((selectedWeeklyHours / 40) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-red/10 text-brand-red">
                              <CalendarDays className="size-3.5" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-muted-foreground">Scheduled days</div>
                              <div className="mt-0.5 text-lg font-semibold leading-none text-foreground">
                                {selectedScheduledDays}
                                <span className="ml-1 text-xs font-medium text-muted-foreground">of 7</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-1">
                          {DAYS.map((day, dayIndex) => {
                            const hasSchedule = selectedUser.schedules.some((schedule) => schedule.dayOfWeek === dayIndex);

                            return (
                              <span
                                key={day}
                                title={day}
                                className={cn(
                                  "h-1.5 rounded-full",
                                  hasSchedule ? "bg-brand-red" : "bg-muted"
                                )}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <div className="col-span-2 grid gap-2 sm:col-span-1">
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 justify-start sm:min-w-44"
                          onClick={openEmployeeDaysModal}
                        >
                          <Pencil className="size-4" />
                          Edit Employee Days
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 justify-start sm:min-w-44"
                          onClick={openBulkModal}
                        >
                          <Users className="size-4" />
                          Bulk Edit Multiple
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {overviewMode === "MONTH" ? "Monthly overview" : "Weekly overview"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Select a calendar day to preview team coverage below.
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:items-end">
                        <div className="flex rounded-lg border border-border bg-background p-1 text-xs">
                          <button
                            type="button"
                            onClick={() => setOverviewMode("MONTH")}
                            className={cn(
                              "h-8 rounded-md px-3 font-semibold transition-colors",
                              overviewMode === "MONTH"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Month
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverviewMode("WEEK")}
                            className={cn(
                              "h-8 rounded-md px-3 font-semibold transition-colors",
                              overviewMode === "WEEK"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Week
                          </button>
                        </div>
                        <div className="flex max-w-full items-center gap-1 rounded-lg border border-border bg-background p-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={overviewMode === "MONTH" ? "Previous month" : "Previous week"}
                            onClick={() =>
                              setSelectedDate((date) =>
                                overviewMode === "MONTH"
                                  ? new Date(date.getFullYear(), date.getMonth() - 1, 1)
                                  : addDays(date, -7)
                              )
                            }
                          >
                            <ChevronLeft className="size-3.5" />
                          </Button>
                          <div className="min-w-0 px-2 text-center text-xs font-medium text-muted-foreground sm:min-w-36">
                            {overviewMode === "MONTH" ? formatMonthHeader(selectedDate) : formatDateHeader(weekDates[0])}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={overviewMode === "MONTH" ? "Next month" : "Next week"}
                            onClick={() =>
                              setSelectedDate((date) =>
                                overviewMode === "MONTH"
                                  ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
                                  : addDays(date, 7)
                              )
                            }
                          >
                            <ChevronRight className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {overviewMode === "MONTH" ? (
                      <div className="space-y-1.5">
                        <div className="hidden grid-cols-7 gap-1.5 lg:grid">
                          {DAYS.map((day) => (
                            <div key={day} className="px-2 text-xs font-semibold text-muted-foreground">
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
                          {monthDates.map((date) => {
                          const schedule = selectedUser.schedules.find((item) => item.dayOfWeek === date.getDay());
                          const isSelectedDate = date.toDateString() === selectedDate.toDateString();
                          const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
                          const isToday = date.toDateString() === today.toDateString();

                          return (
                            <button
                              key={`${selectedUser.id}-${date.toISOString()}`}
                              type="button"
                              onClick={() => setSelectedDate(date)}
                              className={cn(
                                "min-h-20 rounded-lg border border-border bg-background p-2 text-left shadow-sm transition-colors hover:bg-muted/50",
                                isSelectedDate && "border-primary bg-primary/5 ring-2 ring-primary/10",
                                isToday && !isSelectedDate && "border-brand-red ring-2 ring-brand-red/15",
                                !isCurrentMonth && "opacity-60"
                              )}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div
                                    className={cn(
                                      "flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                                      isSelectedDate
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : isToday
                                          ? "border-brand-red bg-brand-red text-brand-red-foreground"
                                        : "border-border bg-card text-foreground"
                                    )}
                                  >
                                    {date.getDate()}
                                  </div>
                                  <div className="truncate text-xs font-semibold text-foreground lg:hidden">{DAYS[date.getDay()]}</div>
                                </div>
                                {isToday ? (
                                  <span className="rounded-full bg-brand-red/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-red">
                                    Today
                                  </span>
                                ) : null}
                              </div>
                              <div
                                className={cn(
                                  "truncate rounded-md px-2 py-1 text-[11px] font-semibold",
                                  schedule
                                    ? "bg-muted text-foreground"
                                    : "bg-transparent px-0 font-medium text-muted-foreground"
                                )}
                              >
                                {schedule ? `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}` : "No schedule"}
                              </div>
                            </button>
                          );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="hidden grid-cols-7 gap-1.5 lg:grid">
                          {DAYS.map((day) => (
                            <div key={day} className="px-2 text-xs font-semibold text-muted-foreground">
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-7">
                          {DAYS.map((day, dayIndex) => {
                          const schedule = selectedUser.schedules.find((item) => item.dayOfWeek === dayIndex);
                          const isSelectedDay = selectedDay === dayIndex;
                          const isToday = weekDates[dayIndex].toDateString() === today.toDateString();

                          return (
                            <button
                              key={`${selectedUser.id}-${dayIndex}`}
                              type="button"
                              onClick={() => setSelectedDate(weekDates[dayIndex])}
                              className={cn(
                                "min-h-20 rounded-lg border border-border bg-background p-2 text-left shadow-sm transition-colors hover:bg-muted/50",
                                isSelectedDay && "border-primary bg-primary/5 ring-2 ring-primary/10",
                                isToday && !isSelectedDay && "border-brand-red ring-2 ring-brand-red/15"
                              )}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div
                                    className={cn(
                                      "flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                                      isSelectedDay
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : isToday
                                          ? "border-brand-red bg-brand-red text-brand-red-foreground"
                                        : "border-border bg-card text-foreground"
                                    )}
                                  >
                                    {weekDates[dayIndex].getDate()}
                                  </div>
                                  <div className="truncate text-xs font-semibold text-foreground lg:hidden">{day}</div>
                                </div>
                                {isToday ? (
                                  <span className="rounded-full bg-brand-red/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-red">
                                    Today
                                  </span>
                                ) : null}
                              </div>
                              <div
                                className={cn(
                                  "truncate rounded-md px-2 py-1 text-[11px] font-semibold",
                                  schedule
                                    ? "bg-muted text-foreground"
                                    : "bg-transparent px-0 font-medium text-muted-foreground"
                                )}
                              >
                                {schedule ? `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}` : "No schedule"}
                              </div>
                            </button>
                          );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </>
            ) : (
              <div className="px-4 py-14 text-center text-sm text-muted-foreground">
                Select an employee to manage their weekly schedule.
              </div>
            )}
          </main>
        </div>

        <div className="border-t border-border p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BriefcaseBusiness className="size-4 text-muted-foreground" />
                {DAYS[selectedDay]} team timeline
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDateHeader(selectedDate)} - {selectedDaySchedules.length} scheduled team members - {formatHour(timelineStart)} to {formatHour(timelineEnd)}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
            <div>
              <div className="grid h-9 grid-cols-[92px_minmax(0,1fr)] border-b border-border bg-muted/35 sm:grid-cols-[160px_minmax(0,1fr)]">
                <div className="flex items-center px-3 text-xs font-semibold uppercase text-muted-foreground">
                  Employee
                </div>
                <div className="relative px-3">
                  <div className="relative h-full text-[9px] font-medium text-muted-foreground sm:text-[11px]">
                    {visibleTimelineHours.map((hour) => {
                      const left = ((hour - timelineStart) / timelineSpan) * 100;

                      return (
                        <span
                          key={hour}
                          className={cn(
                            "absolute top-1/2 whitespace-nowrap -translate-y-1/2",
                            left === 0
                              ? "left-0"
                              : left === 100
                                ? "right-0"
                                : "-translate-x-1/2"
                          )}
                          style={left !== 0 && left !== 100 ? { left: `${left}%` } : undefined}
                        >
                          <span className="sm:hidden">{formatCompactHour(hour)}</span>
                          <span className="hidden sm:inline">{formatHour(hour)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {selectedDaySchedules.map(({ user, schedule }, index) => {
                const start = parseTime(schedule?.startTime);
                const end = parseTime(schedule?.endTime);
                const rawLeft = start === null ? 0 : ((Math.max(start, timelineStart) - timelineStart) / timelineSpan) * 100;
                const left = Math.max(0, Math.min(100, rawLeft));
                const rawWidth =
                  start === null || end === null
                    ? 0
                    : ((Math.min(end, timelineEnd) - Math.max(start, timelineStart)) / timelineSpan) * 100;
                const width = Math.max(6, Math.min(rawWidth, 100 - left));

                return (
                  <div
                    key={user.id}
                    className={cn(
                      "grid h-14 grid-cols-[92px_minmax(0,1fr)] border-b border-border transition-colors last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)]",
                      selectedUser?.id === user.id && "bg-muted/45"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2 px-2 sm:px-2.5">
                      <div className="hidden size-7 shrink-0 items-center justify-center rounded-md bg-card text-[11px] font-semibold ring-1 ring-border sm:flex">
                        {initials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-foreground">{user.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{user.department || user.role}</div>
                      </div>
                    </div>
                    <div className="relative overflow-hidden">
                      {hours.map((hour) => {
                        const lineLeft = ((hour - timelineStart) / timelineSpan) * 100;
                        if (lineLeft <= 0 || lineLeft >= 100) return null;

                        return (
                          <div
                            key={hour}
                            className="absolute top-0 h-full border-l border-dashed border-border"
                          style={{ left: `${lineLeft}%` }}
                          />
                        );
                      })}
                      {schedule && width > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className={cn(
                            "absolute top-2 flex h-10 items-center justify-between gap-2 rounded-md border-l-4 px-2.5 text-xs font-semibold shadow-sm ring-1 transition-transform hover:scale-[1.01]",
                            SHIFT_STYLES[index % SHIFT_STYLES.length]
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <span className="truncate">
                            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                          </span>
                          <span className="hidden truncate text-[11px] opacity-80 md:inline">
                            {user.department || user.position || user.role}
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {selectedDaySchedules.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-muted">
                    <CalendarDays className="size-5 text-muted-foreground" />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-foreground">No schedules for {DAYS[selectedDay]}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Select an employee and edit their weekly schedule to add coverage.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isBulkModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-schedule-title"
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card text-card-foreground shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/30 px-4 py-3">
              <div>
                <h2 id="bulk-schedule-title" className="text-base font-semibold text-foreground">
                  Bulk Edit Multiple Employees
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose employees and one or more days, then apply one time range.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close bulk edit dialog"
                onClick={() => setIsBulkModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form action={saveBulkDaySchedule} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-3 overflow-y-auto px-4 py-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TimeTextField label="Start" name="startTime" value={bulkStartTime} onChange={setBulkStartTime} />
                  <TimeTextField label="End" name="endTime" value={bulkEndTime} onChange={setBulkEndTime} />
                </div>
                {bulkTimeError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {bulkTimeError}
                  </div>
                ) : null}

                <div className="rounded-lg border border-border bg-background">
                  <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Days to update</div>
                      <div className="text-xs text-muted-foreground">{bulkDaySelection.length} selected</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setBulkDaySelection([1, 2, 3, 4, 5])}
                      >
                        Weekdays
                      </Button>
                      <Button type="button" variant="outline" size="xs" onClick={() => setBulkDaySelection(DAYS.map((_, index) => index))}>
                        All
                      </Button>
                      <Button type="button" variant="outline" size="xs" onClick={() => setBulkDaySelection([])}>
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-1.5 p-2 sm:grid-cols-2">
                    {DAYS.map((day, dayIndex) => {
                      const checked = bulkDaySelection.includes(dayIndex);

                      return (
                        <label
                          key={day}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:bg-muted",
                            checked && "border-border bg-muted"
                          )}
                        >
                          <input
                            type="checkbox"
                            name="bulkDayOfWeeks"
                            value={dayIndex}
                            checked={checked}
                            onChange={() => toggleBulkDay(dayIndex)}
                            className="size-4 rounded border-input"
                          />
                          <div className="text-sm font-semibold text-foreground">{day}</div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background">
                  <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Employees to update</div>
                      <div className="text-xs text-muted-foreground">{bulkUserIds.length} selected</div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="xs" onClick={() => setBulkUserIds(filteredUsers.map((user) => user.id))}>
                        Select All
                      </Button>
                      <Button type="button" variant="outline" size="xs" onClick={() => setBulkUserIds([])}>
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="grid max-h-64 gap-1 overflow-y-auto p-2 sm:grid-cols-2">
                    {filteredUsers.map((user) => {
                      const schedulesToShow = bulkDaySelection
                        .map((dayOfWeek) => {
                          const schedule = user.schedules.find((item) => item.dayOfWeek === dayOfWeek);
                          return schedule ? `${DAYS[dayOfWeek]} ${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}` : null;
                        })
                        .filter(Boolean);
                      const checked = bulkUserIds.includes(user.id);

                      return (
                        <label
                          key={user.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:bg-muted",
                            checked && "border-border bg-muted"
                          )}
                        >
                          <input
                            type="checkbox"
                            name="userIds"
                            value={user.id}
                            checked={checked}
                            onChange={() => toggleBulkUser(user.id)}
                            className="size-4 rounded border-input"
                          />
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-xs font-semibold ring-1 ring-border">
                            {initials(user.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-foreground">{user.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {schedulesToShow.length > 0 ? schedulesToShow.join(", ") : "No current schedule on selected days"}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setIsBulkModalOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton size="default" className="w-full sm:w-40" disabled={bulkUserIds.length === 0 || bulkDaySelection.length === 0}>
                  Apply Bulk Edit
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEmployeeDaysModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-days-title"
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card text-card-foreground shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/30 px-4 py-3">
              <div>
                <h2 id="employee-days-title" className="text-base font-semibold text-foreground">
                  Edit Employee Days
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose an employee, select one or more days, then apply one time range.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close selected days dialog"
                onClick={() => setIsEmployeeDaysModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form
              action={saveEmployeeSelectedDaysSchedule}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="space-y-3 overflow-y-auto px-4 py-3">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Employee
                    <select
                      name="userId"
                      value={modalUserId}
                      onChange={(event) => changeEmployeeDaysUser(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                    >
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <TimeTextField
                    label="Start"
                    name="startTime"
                    value={employeeDaysStartTime}
                    onChange={setEmployeeDaysStartTime}
                  />
                  <TimeTextField
                    label="End"
                    name="endTime"
                    value={employeeDaysEndTime}
                    onChange={setEmployeeDaysEndTime}
                  />
                </div>
                {employeeDaysTimeError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {employeeDaysTimeError}
                  </div>
                ) : null}

                <div className="rounded-lg border border-border bg-background">
                  <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Days to update</div>
                      <div className="text-xs text-muted-foreground">{employeeDaySelection.length} selected</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setEmployeeDaySelection([1, 2, 3, 4, 5])}
                      >
                        Weekdays
                      </Button>
                      <Button type="button" variant="outline" size="xs" onClick={() => setEmployeeDaySelection(DAYS.map((_, index) => index))}>
                        All
                      </Button>
                      <Button type="button" variant="outline" size="xs" onClick={() => setEmployeeDaySelection([])}>
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-1.5 p-2 sm:grid-cols-2">
                    {DAYS.map((day, dayIndex) => {
                      const schedule = modalUser?.schedules.find((item) => item.dayOfWeek === dayIndex);
                      const checked = employeeDaySelection.includes(dayIndex);

                      return (
                        <label
                          key={day}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:bg-muted",
                            checked && "border-border bg-muted"
                          )}
                        >
                          <input
                            type="checkbox"
                            name="dayOfWeeks"
                            value={dayIndex}
                            checked={checked}
                            onChange={() => toggleEmployeeDay(dayIndex)}
                            className="size-4 rounded border-input"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground">{day}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {schedule ? `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}` : "No current schedule"}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setIsEmployeeDaysModalOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton size="default" className="w-full sm:w-40" disabled={employeeDaySelection.length === 0}>
                  Apply to Days
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  Loader2,
  Lock,
  ShieldAlert,
  Timer,
  Users,
} from "lucide-react";
import {
  generateExceptionReport,
  generateLeaveReport,
  generateTimesheetReport,
  getReportPreview,
} from "@/app/actions/reports";
import { Button } from "@/components/ui/button";

type PreviewData = Awaited<ReturnType<typeof getReportPreview>>;
type MetricItem = {
  label: string;
  value: string | number;
  Icon: typeof Timer;
  tone?: "default" | "warn" | "danger" | "success";
};

const today = new Date();

const DATE_PRESETS = [
  { value: "CURRENT_CUTOFF", label: "Current cutoff" },
  { value: "PREVIOUS_CUTOFF", label: "Previous cutoff" },
  { value: "THIS_MONTH", label: "This month" },
  { value: "LAST_30", label: "Last 30 days" },
  { value: "CUSTOM", label: "Custom range" },
];

function getCutoffRange(date: Date) {
  const day = date.getDate();
  const start = day <= 15 ? new Date(date.getFullYear(), date.getMonth(), 1) : new Date(date.getFullYear(), date.getMonth(), 16);
  const end = day <= 15 ? new Date(date.getFullYear(), date.getMonth(), 15) : endOfMonth(date);
  return { start, end };
}

function getPresetRange(preset: string) {
  if (preset === "CURRENT_CUTOFF") return getCutoffRange(today);
  if (preset === "PREVIOUS_CUTOFF") {
    const current = getCutoffRange(today);
    return getCutoffRange(subDays(current.start, 1));
  }
  if (preset === "THIS_MONTH") return { start: startOfMonth(today), end: endOfMonth(today) };
  return { start: subDays(today, 30), end: today };
}

function downloadCsv(filename: string, csvStr: string) {
  const url = "data:text/csv;charset=utf-8," + encodeURIComponent(csvStr);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Ready"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
      : status === "Needs review"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
        : "border-rose-500/20 bg-rose-500/10 text-rose-600";

  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}

function getMetricClass(tone: MetricItem["tone"]) {
  if (tone === "danger") return "border-rose-500/20 bg-rose-500/10";
  if (tone === "warn") return "border-amber-500/20 bg-amber-500/10";
  if (tone === "success") return "border-emerald-500/20 bg-emerald-500/10";
  return "border-border bg-background/60";
}

function getReadinessInsight(preview: PreviewData | null) {
  if (!preview) return "Select a period to load payroll readiness.";
  if (preview.summary.readinessStatus === "Ready") return "No exceptions found for this payroll period.";

  const blocked = preview.exceptions.filter((exception) => exception.severity === "Blocked").length;
  const review = preview.exceptions.length - blocked;

  if (blocked > 0) {
    return `${blocked} blocking ${blocked === 1 ? "exception needs" : "exceptions need"} correction before payroll export.`;
  }

  return `${review} review ${review === 1 ? "item needs" : "items need"} HR confirmation before payroll export.`;
}

function getExceptionBreakdown(preview: PreviewData | null) {
  if (!preview) return [];

  return Array.from(
    preview.exceptions.reduce((items, exception) => {
      items.set(exception.type, (items.get(exception.type) ?? 0) + 1);
      return items;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);
}

export default function AdminReportsPage() {
  const initialRange = getPresetRange("CURRENT_CUTOFF");
  const [preset, setPreset] = useState("CURRENT_CUTOFF");
  const [startDate, setStartDate] = useState(format(initialRange.start, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(initialRange.end, "yyyy-MM-dd"));
  const [department, setDepartment] = useState("ALL");
  const [managerId, setManagerId] = useState("ALL");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const filters = useMemo(() => ({ department, managerId }), [department, managerId]);

  useEffect(() => {
    if (preset === "CUSTOM") return;
    const range = getPresetRange(preset);
    setStartDate(format(range.start, "yyyy-MM-dd"));
    setEndDate(format(range.end, "yyyy-MM-dd"));
  }, [preset]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    getReportPreview(startDate, endDate, filters)
      .then((data) => {
        if (isCurrent) setPreview(data);
      })
      .catch((error) => {
        console.error(error);
        if (isCurrent) setPreview(null);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [startDate, endDate, filters]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
  };

  const runExport = async (type: string, action: () => Promise<void>) => {
    setExporting(type);
    try {
      await action();
    } catch (error) {
      console.error(error);
      alert("Failed to export report.");
    } finally {
      setExporting(null);
    }
  };

  const query = new URLSearchParams({
    startDate,
    endDate,
    department,
    managerId,
  }).toString();
  const readinessInsight = getReadinessInsight(preview);
  const exceptionBreakdown = getExceptionBreakdown(preview);
  const isPayrollBlocked = preview?.summary.readinessStatus === "Blocked";
  const activeFilterCount = Number(department !== "ALL") + Number(managerId !== "ALL");
  const metrics: MetricItem[] = [
    { label: "Total hours", value: preview?.summary.totalHours.toFixed(2) ?? "-", Icon: Timer },
    { label: "Late logs", value: preview?.summary.lateLogs ?? "-", Icon: AlertTriangle, tone: preview?.summary.lateLogs ? "warn" : "default" },
    { label: "Missing outs", value: preview?.summary.missingClockOuts ?? "-", Icon: ShieldAlert, tone: preview?.summary.missingClockOuts ? "danger" : "default" },
    { label: "Undertime", value: preview?.summary.undertimeFlags ?? "-", Icon: AlertTriangle, tone: preview?.summary.undertimeFlags ? "warn" : "default" },
    { label: "PFFD used", value: preview?.summary.pffdDays.toFixed(2) ?? "-", Icon: CheckCircle2, tone: "success" },
    { label: "Exceptions", value: preview?.summary.exceptions ?? "-", Icon: ShieldAlert, tone: preview?.summary.exceptions ? "danger" : "success" },
  ];

  return (
    <div className="w-full space-y-6">
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                <FileSpreadsheet className="size-3.5" />
              </span>
              <h1 className="text-sm font-semibold text-foreground">Reports dashboard</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {format(new Date(`${startDate}T00:00:00`), "MMM d, yyyy")} to {format(new Date(`${endDate}T00:00:00`), "MMM d, yyyy")}
              {activeFilterCount > 0 ? ` · ${activeFilterCount} active ${activeFilterCount === 1 ? "filter" : "filters"}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : preview && <StatusBadge status={preview.summary.readinessStatus} />}
          </div>
        </div>

        <div className="border-b px-4 py-4">
          <div className={`rounded-lg border px-4 py-3 ${
            !preview
              ? "border-border bg-background/60"
              : preview.summary.readinessStatus === "Ready"
              ? "border-emerald-500/20 bg-emerald-500/10"
              : preview.summary.readinessStatus === "Needs review"
                ? "border-amber-500/20 bg-amber-500/10"
                : "border-rose-500/20 bg-rose-500/10"
          }`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background/70 text-foreground">
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : isPayrollBlocked ? <Lock className="size-4" /> : <CheckCircle2 className="size-4" />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Payroll readiness</p>
                    {preview && <StatusBadge status={preview.summary.readinessStatus} />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{isLoading ? "Checking attendance exceptions..." : readinessInsight}</p>
                </div>
              </div>

              {exceptionBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {exceptionBreakdown.slice(0, 4).map(([type, count]) => (
                    <span key={type} className="inline-flex items-center rounded-md border border-border bg-background/80 px-2 py-1 text-xs font-medium text-foreground">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b px-4 py-3 lg:grid-cols-[minmax(190px,1fr)_repeat(4,minmax(150px,1fr))]">
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={preset}
              onChange={(event) => handlePresetChange(event.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-10 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
            >
              {DATE_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <input
            type="date"
            value={startDate}
            onChange={(event) => {
              setPreset("CUSTOM");
              setStartDate(event.target.value);
            }}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
          />

          <input
            type="date"
            value={endDate}
            onChange={(event) => {
              setPreset("CUSTOM");
              setEndDate(event.target.value);
            }}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
          />

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-10 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="ALL">All departments</option>
              {preview?.filters.departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="relative">
            <Users className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={managerId}
              onChange={(event) => setManagerId(event.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-input bg-background pl-10 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="ALL">All managers</option>
              {preview?.filters.managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="grid gap-2 border-b px-4 py-3 sm:grid-cols-2 xl:grid-cols-6">
          {metrics.map(({ label, value, Icon, tone }) => (
            <div key={label} className={`rounded-lg border px-3 py-2 ${getMetricClass(tone)}`}>
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <Icon className="size-3.5" />
                {label}
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 px-4 py-4 lg:grid-cols-4">
          <Button
            type="button"
            variant="success"
            disabled={exporting !== null || !preview || isPayrollBlocked || isLoading}
            onClick={() => runExport("payroll", async () => { window.location.href = `/api/reports/payroll?${query}`; })}
            title={isPayrollBlocked ? "Resolve blocked exceptions before exporting payroll." : undefined}
          >
            {exporting === "payroll" ? <Loader2 className="size-4 animate-spin" /> : isPayrollBlocked ? <Lock className="size-4" /> : <Download className="size-4" />}
            {isPayrollBlocked ? "Payroll Blocked" : "Payroll CSV"}
          </Button>
          <Button
            type="button"
            disabled={exporting !== null}
            onClick={() => runExport("timesheets", async () => downloadCsv(`timesheets_${startDate}_to_${endDate}.csv`, await generateTimesheetReport(startDate, endDate, filters)))}
          >
            {exporting === "timesheets" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Timesheets CSV
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={exporting !== null}
            onClick={() => runExport("pffd", async () => downloadCsv(`pffd_${startDate}_to_${endDate}.csv`, await generateLeaveReport(startDate, endDate, filters)))}
          >
            {exporting === "pffd" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            PFFD CSV
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={exporting !== null}
            onClick={() => runExport("exceptions", async () => downloadCsv(`exceptions_${startDate}_to_${endDate}.csv`, await generateExceptionReport(startDate, endDate, filters)))}
          >
            {exporting === "exceptions" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Exception CSV
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Employee preview</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {preview?.employeeRows.length ? `${preview.employeeRows.length} employees in preview` : "One row per employee for the selected payroll period."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Manager</th>
                <th className="px-4 py-3 font-semibold">Hours</th>
                <th className="px-4 py-3 font-semibold">Late</th>
                <th className="px-4 py-3 font-semibold">Missing</th>
                <th className="px-4 py-3 font-semibold">PFFD</th>
                <th className="px-4 py-3 font-semibold">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading report preview...</td></tr>
              ) : preview?.employeeRows.length ? (
                preview.employeeRows.slice(0, 25).map((row) => (
                  <tr key={row.employeeId} className="hover:bg-muted/50">
                    <td className="px-4 py-3"><div className="font-medium text-foreground">{row.employeeName}</div><div className="text-xs text-muted-foreground">{row.email}</div></td>
                    <td className="px-4 py-3 text-muted-foreground">{row.department}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.managerName}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{row.totalHours.toFixed(2)}</td>
                    <td className="px-4 py-3">{row.lateCount}</td>
                    <td className="px-4 py-3">{row.missingClockOuts}</td>
                    <td className="px-4 py-3">{row.pffdDays.toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.scheduleCompliance}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No employees found for these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && preview && preview.employeeRows.length > 25 && (
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">
            Showing first 25 employees. Export Timesheets CSV or Payroll CSV for the full report.
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-col gap-2 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Exception report</h2>
              <p className="mt-1 text-xs text-muted-foreground">Records that need HR review before payroll export.</p>
            </div>
            {preview?.exceptions.length ? <StatusBadge status={`${preview.exceptions.length} open`} /> : null}
          </div>
          <div className="divide-y">
            {isLoading ? (
              <div className="px-4 py-10 text-center text-muted-foreground">Checking exceptions...</div>
            ) : preview?.exceptions.length ? (
              preview.exceptions.slice(0, 12).map((exception, index) => (
                <div key={`${exception.email}-${exception.date}-${exception.type}-${index}`} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_120px_130px] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{exception.employeeName}</p>
                      <StatusBadge status={exception.severity} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{exception.type} · {exception.detail}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{exception.date}</p>
                  <p className="text-sm text-muted-foreground">{exception.department}</p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">No exceptions found</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Audit trail</h2>
            </div>
          </div>
          <div className="divide-y">
            {preview?.auditLogs.length ? (
              preview.auditLogs.map((log) => (
                <div key={log.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{log.action.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{log.actor} · {format(new Date(log.createdAt), "MMM d, h:mm a")}</p>
                </div>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No recent audit activity for this period.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const STATUS_OPTIONS = ["ALL", "PENDING", "APPROVED", "REJECTED"];

type ApprovalTableControlsProps = {
  itemLabel: string;
  query: string;
  status: string;
  page: number;
  pageSize: number;
  totalItems: number;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
};

export function ApprovalTableControls({
  itemLabel,
  query,
  status,
  page,
  pageSize,
  totalItems,
  onQueryChange,
  onStatusChange,
  onPageChange,
  onPageSizeChange,
}: ApprovalTableControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_130px] lg:w-[560px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              onPageChange(1);
            }}
            placeholder={`Search ${itemLabel}...`}
            className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <select
          value={status}
          onChange={(event) => {
            onStatusChange(event.target.value);
            onPageChange(1);
          }}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? "All statuses" : option.charAt(0) + option.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        <select
          value={pageSize}
          onChange={(event) => {
            onPageSizeChange(Math.min(100, Number(event.target.value) || 25));
            onPageChange(1);
          }}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} / page
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground lg:justify-end">
        <span className="rounded-full border border-border px-2 py-1 font-medium">
          {totalItems} shown
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="min-w-16 text-center font-medium">
            {Math.min(page, totalPages)} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

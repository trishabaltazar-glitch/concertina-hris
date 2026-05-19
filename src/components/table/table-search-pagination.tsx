"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";

type TableSearchPaginationProps = {
  tableId: string;
  itemLabel?: string;
  statusOptions?: string[];
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function TableSearchPagination({
  tableId,
  itemLabel = "items",
  statusOptions = ["PENDING", "APPROVED", "REJECTED"],
}: TableSearchPaginationProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [matchCount, setMatchCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(matchCount / pageSize));
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedStatuses = useMemo(() => ["ALL", ...statusOptions], [statusOptions]);

  useEffect(() => {
    const table = document.getElementById(tableId);
    const rows = Array.from(table?.querySelectorAll<HTMLTableRowElement>("tbody tr[data-table-row]") ?? []);
    const matchingRows = rows.filter((row) => {
      const rowStatus = row.dataset.status || "";
      const matchesStatus = status === "ALL" || rowStatus === status;
      const matchesQuery = !normalizedQuery || (row.textContent || "").toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });

    const maxPage = Math.max(1, Math.ceil(matchingRows.length / pageSize));
    const safePage = Math.min(page, maxPage);
    const startIndex = (safePage - 1) * pageSize;
    const visibleRows = new Set(matchingRows.slice(startIndex, startIndex + pageSize));

    rows.forEach((row) => {
      row.hidden = !visibleRows.has(row);
    });

    queueMicrotask(() => {
      setMatchCount(matchingRows.length);
      if (page > maxPage) setPage(maxPage);
    });
  }, [normalizedQuery, page, pageSize, status, tableId]);

  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_130px] lg:w-[560px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={`Search ${itemLabel}...`}
            className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Filter by status"
        >
          {normalizedStatuses.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? "All statuses" : option.charAt(0) + option.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        <select
          value={pageSize}
          onChange={(event) => {
            setPageSize(Math.min(100, Number(event.target.value) || 25));
            setPage(1);
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
          {matchCount} shown
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
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
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

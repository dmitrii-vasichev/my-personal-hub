"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ApplicationStatus, Job } from "@/types/job";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_BG_COLORS,
} from "@/types/job";
import { InlineEditSelect } from "@/components/ui/inline-edit-select";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { useChangeJobStatus } from "@/hooks/use-jobs";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_LABELS: Record<string, string> = Object.fromEntries(
  PAGE_SIZE_OPTIONS.map((n) => [String(n), `${n} / page`])
);

const STATUS_OPTIONS = (Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[]).map(
  (s) => ({ value: s, label: APPLICATION_STATUS_LABELS[s] })
);

const columnHelper = createColumnHelper<Job>();

function MatchScoreBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null;
  const cls =
    score >= 80
      ? "bg-accent-teal-muted text-accent-teal border-accent-teal/20"
      : score >= 60
      ? "bg-accent-amber-muted text-accent-amber border-accent-amber/20"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border ${cls}`}
    >
      {score}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border"
      style={{
        color: APPLICATION_STATUS_COLORS[status as keyof typeof APPLICATION_STATUS_COLORS],
        backgroundColor: APPLICATION_STATUS_BG_COLORS[status as keyof typeof APPLICATION_STATUS_BG_COLORS],
        borderColor: "transparent",
      }}
    >
      {APPLICATION_STATUS_LABELS[status as keyof typeof APPLICATION_STATUS_LABELS] ?? status}
    </span>
  );
}

function StatusCell({ jobId, status }: { jobId: number; status?: ApplicationStatus }) {
  const changeStatus = useChangeJobStatus();

  if (!status) {
    return <span className="text-xs text-[var(--text-tertiary)]">—</span>;
  }

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <InlineEditSelect
        value={status}
        options={STATUS_OPTIONS}
        onSave={async (newValue) => {
          await changeStatus.mutateAsync({
            id: jobId,
            data: { new_status: newValue as ApplicationStatus },
          });
        }}
        renderValue={(opt) => <StatusBadge status={opt?.value ?? status} />}
      />
    </span>
  );
}

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ArrowUp className="h-3 w-3" />;
  if (isSorted === "desc") return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 opacity-40" />;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface JobsTableProps {
  jobs: Job[];
  isLoading: boolean;
  error: Error | null;
}

export function JobsTable({ jobs, isLoading, error }: JobsTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        cell: (info) => (
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">
              {info.getValue()}
            </div>
            <div className="text-xs text-[var(--text-secondary)] truncate">
              {info.row.original.company}
            </div>
          </div>
        ),
        size: 280,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <StatusCell jobId={info.row.original.id} status={info.getValue()} />
        ),
        size: 140,
      }),
      columnHelper.accessor("match_score", {
        header: "Match",
        cell: (info) => <MatchScoreBadge score={info.getValue()} />,
        size: 80,
      }),
      columnHelper.accessor("source", {
        header: "Source",
        cell: (info) => (
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {info.getValue()}
          </span>
        ),
        size: 100,
      }),
      columnHelper.accessor("created_at", {
        header: "Added",
        cell: (info) => (
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {formatDate(info.getValue())}
          </span>
        ),
        size: 120,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: jobs,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Clamp pageIndex when filters reduce the row count below the current page
  // (e.g., user is on page 3, then applies a filter leaving only 1 page).
  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(jobs.length / pagination.pageSize));
    if (pagination.pageIndex >= pageCount) {
      setPagination((p) => ({ ...p, pageIndex: pageCount - 1 }));
    }
  }, [jobs.length, pagination.pageSize, pagination.pageIndex]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="animate-pulse">
          <div className="h-10 bg-[var(--surface-hover)]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 px-4 py-3 border-t border-[rgba(255,255,255,0.03)]"
            >
              <div className="h-4 bg-[var(--surface-hover)] rounded w-1/3" />
              <div className="h-4 bg-[var(--surface-hover)] rounded w-1/6" />
              <div className="h-4 bg-[var(--surface-hover)] rounded w-1/12" />
              <div className="h-4 bg-[var(--surface-hover)] rounded w-1/6" />
              <div className="h-4 bg-[var(--surface-hover)] rounded w-1/6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--destructive)]">
        Failed to load jobs
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)]">
          <Briefcase className="h-5 w-5 text-[var(--text-tertiary)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">No jobs found</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Add a job to start tracking your applications
          </p>
        </div>
      </div>
    );
  }

  const pageCount = table.getPageCount();
  const firstRowOnPage = pagination.pageIndex * pagination.pageSize + 1;
  const lastRowOnPage = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    jobs.length
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-[var(--surface-hover)]">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-[10.5px] uppercase tracking-[0.5px] font-mono font-medium text-[var(--text-tertiary)] cursor-pointer select-none hover:text-[var(--text-secondary)] transition-colors"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon isSorted={header.column.getIsSorted()} />
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                onClick={() => router.push(`/jobs/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-hover)]/40 px-4 py-2">
        <div className="flex items-center gap-3">
          <SelectRoot
            value={String(pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
            labels={PAGE_SIZE_LABELS}
          >
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectRoot>
          <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
            {firstRowOnPage}–{lastRowOnPage} of {jobs.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)]"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 text-[11px] font-mono text-[var(--text-secondary)]">
            Page {pagination.pageIndex + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)]"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

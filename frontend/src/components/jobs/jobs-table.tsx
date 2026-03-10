"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Briefcase } from "lucide-react";
import type { Job } from "@/types/job";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_BG_COLORS,
} from "@/types/job";

const columnHelper = createColumnHelper<Job>();

function MatchScoreBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null;
  const cls =
    score >= 80
      ? "bg-[rgba(52,211,153,0.1)] text-[#34d399] border-[rgba(52,211,153,0.2)]"
      : score >= 60
      ? "bg-[rgba(251,191,36,0.1)] text-[#fbbf24] border-[rgba(251,191,36,0.2)]"
      : "bg-[var(--muted)] text-[var(--text-secondary)] border-[var(--border)]";
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
        cell: (info) => {
          const status = info.getValue();
          if (!status) return <span className="text-xs text-[var(--text-tertiary)]">—</span>;
          return <StatusBadge status={status} />;
        },
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
      columnHelper.accessor("found_at", {
        header: "Found",
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
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
    </div>
  );
}

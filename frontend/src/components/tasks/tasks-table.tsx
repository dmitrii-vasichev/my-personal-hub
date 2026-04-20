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
import { ArrowDown, ArrowUp, ArrowUpDown, ListChecks, Calendar } from "lucide-react";
import type { Task, TaskStatus, TaskPriority } from "@/types/task";
import { TASK_STATUS_LABELS, PRIORITY_LABELS } from "@/types/task";
import { TagPills } from "./tag-pill";

const columnHelper = createColumnHelper<Task>();

const STATUS_COLORS: Record<TaskStatus, { color: string; bg: string }> = {
  backlog: { color: "var(--tertiary)", bg: "var(--muted)" },
  new: { color: "var(--primary)", bg: "var(--accent-muted)" },
  in_progress: { color: "var(--accent-amber)", bg: "var(--accent-amber-muted)" },
  review: { color: "var(--accent-violet)", bg: "var(--accent-violet-muted, var(--accent-muted))" },
  done: { color: "var(--accent-teal)", bg: "var(--accent-teal-muted)" },
  cancelled: { color: "var(--tertiary)", bg: "var(--muted)" },
};

const PRIORITY_BADGE_COLORS: Record<TaskPriority, { color: string; bg: string }> = {
  urgent: { color: "var(--destructive)", bg: "var(--destructive-muted)" },
  high: { color: "var(--accent-amber)", bg: "var(--accent-amber-muted)" },
  medium: { color: "var(--accent-foreground)", bg: "var(--accent-muted)" },
  low: { color: "var(--tertiary)", bg: "var(--muted)" },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const colors = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex px-2 py-0.5 text-[11px] font-mono font-medium uppercase tracking-[1.5px]"
      style={{ color: colors.color, backgroundColor: colors.bg }}
    >
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const colors = PRIORITY_BADGE_COLORS[priority];
  return (
    <span
      className="inline-flex px-2 py-0.5 text-[11px] font-mono font-medium uppercase tracking-[1.5px]"
      style={{ color: colors.color, backgroundColor: colors.bg }}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ArrowUp className="h-3 w-3" />;
  if (isSorted === "desc") return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 opacity-40" />;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isDeadlineOverdue(deadline: string): boolean {
  return new Date(deadline) < new Date();
}

interface TasksTableProps {
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
}

export function TasksTable({ tasks, isLoading, error }: TasksTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Title",
        cell: (info) => (
          <div className="min-w-0">
            <div className="text-sm font-medium text-[color:var(--ink)] truncate">
              {info.getValue()}
            </div>
            {info.row.original.owner_name && (
              <div className="text-xs text-[color:var(--ink-3)] truncate">
                {info.row.original.owner_name}
              </div>
            )}
          </div>
        ),
        size: 280,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
        size: 130,
      }),
      columnHelper.accessor("priority", {
        header: "Priority",
        cell: (info) => <PriorityBadge priority={info.getValue()} />,
        size: 100,
      }),
      columnHelper.display({
        id: "tags",
        header: "Tags",
        cell: (info) => <TagPills tags={info.row.original.tags} limit={2} />,
        size: 150,
      }),
      columnHelper.accessor("deadline", {
        header: "Deadline",
        cell: (info) => {
          const val = info.getValue();
          if (!val) return <span className="text-xs text-[color:var(--ink-3)]">—</span>;
          const overdue = isDeadlineOverdue(val);
          return (
            <span
              className={`inline-flex items-center gap-1 text-xs font-mono uppercase tracking-[1.5px] ${
                overdue ? "text-[color:var(--accent-2)]" : "text-[color:var(--ink-2)]"
              }`}
            >
              <Calendar className="h-3 w-3" />
              {formatDate(val)}
            </span>
          );
        },
        size: 110,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] overflow-hidden">
        <div className="animate-pulse">
          <div className="h-10 bg-[color:var(--bg)]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 px-4 py-3 border-t border-[color:var(--line)]"
            >
              <div className="h-4 bg-[color:var(--bg)] w-1/3" />
              <div className="h-4 bg-[color:var(--bg)] w-1/6" />
              <div className="h-4 bg-[color:var(--bg)] w-1/12" />
              <div className="h-4 bg-[color:var(--bg)] w-1/6" />
              <div className="h-4 bg-[color:var(--bg)] w-1/6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-[color:var(--accent-2)] font-mono uppercase tracking-[1.5px] text-[11px]">
        Failed to load tasks
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center bg-[color:var(--bg-2)] border-[1.5px] border-[color:var(--line)]">
          <ListChecks className="h-5 w-5 text-[color:var(--ink-3)]" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-2)]">
            No tasks found
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--ink-3)] font-mono">
            Create a task to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="bg-[color:var(--bg)] border-b-[1.5px] border-[color:var(--line)]"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-[10.5px] uppercase tracking-[1.5px] font-mono font-medium text-[color:var(--ink-3)] cursor-pointer select-none hover:text-[color:var(--ink)] transition-colors"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <SortIcon isSorted={header.column.getIsSorted()} />
                      )}
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
                className="border-t border-[color:var(--line)] hover:bg-[color:var(--bg)] cursor-pointer transition-colors"
                onClick={() => router.push(`/tasks/${row.original.id}`)}
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

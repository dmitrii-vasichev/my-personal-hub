"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Users } from "lucide-react";
import type { Lead } from "@/types/lead";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_BG_COLORS,
  getReachChannel,
} from "@/types/lead";
import { ChannelBadge } from "./channel-chips";

const columnHelper = createColumnHelper<Lead>();

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border"
      style={{
        color: LEAD_STATUS_COLORS[status as keyof typeof LEAD_STATUS_COLORS],
        backgroundColor: LEAD_STATUS_BG_COLORS[status as keyof typeof LEAD_STATUS_BG_COLORS],
        borderColor: "transparent",
      }}
    >
      {LEAD_STATUS_LABELS[status as keyof typeof LEAD_STATUS_LABELS] ?? status}
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

interface LeadsTableProps {
  leads: Lead[];
  isLoading: boolean;
  error: Error | null;
  onLeadClick?: (lead: Lead) => void;
}

export function LeadsTable({ leads, isLoading, error, onLeadClick }: LeadsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("business_name", {
        header: "Business",
        cell: (info) => (
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">
              {info.getValue()}
            </div>
            {info.row.original.contact_person && (
              <div className="text-xs text-[var(--text-secondary)] truncate">
                {info.row.original.contact_person}
              </div>
            )}
          </div>
        ),
        size: 240,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
        size: 120,
      }),
      columnHelper.display({
        id: "channel",
        header: "Channel",
        cell: (info) => <ChannelBadge channel={getReachChannel(info.row.original)} />,
        size: 100,
      }),
      columnHelper.accessor("email", {
        header: "Email",
        cell: (info) => (
          <span className="text-xs font-mono text-[var(--text-secondary)] truncate block">
            {info.getValue() || "—"}
          </span>
        ),
        size: 200,
      }),
      columnHelper.accessor("phone", {
        header: "Phone",
        cell: (info) => (
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {info.getValue() || "—"}
          </span>
        ),
        size: 140,
      }),
      columnHelper.accessor("industry", {
        header: "Industry",
        cell: (info) => (
          <span className="text-xs text-[var(--text-secondary)]">
            {info.getValue()?.name || "—"}
          </span>
        ),
        size: 140,
      }),
      columnHelper.accessor("created_at", {
        header: "Added",
        cell: (info) => (
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {formatDate(info.getValue())}
          </span>
        ),
        size: 110,
      }),
    ],
    []
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns function helpers by design.
  const table = useReactTable({
    data: leads,
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
              <div className="h-4 bg-[var(--surface-hover)] rounded w-1/4" />
              <div className="h-4 bg-[var(--surface-hover)] rounded w-1/6" />
              <div className="h-4 bg-[var(--surface-hover)] rounded w-1/5" />
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
        Failed to load leads
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)]">
          <Users className="h-5 w-5 text-[var(--text-tertiary)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">No leads found</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Add a lead to start tracking your outreach
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
                onClick={() => onLeadClick?.(row.original)}
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

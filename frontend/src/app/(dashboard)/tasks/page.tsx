"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { BarChart2 } from "lucide-react";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TasksTable } from "@/components/tasks/tasks-table";
import { TasksViewToggle, type TasksViewMode } from "@/components/tasks/view-toggle";
import { BulkActionToolbar } from "@/components/tasks/bulk-action-toolbar";
import { TaskFiltersBar } from "@/components/tasks/task-filters";
import { ColumnVisibilityButton } from "@/components/tasks/column-visibility-button";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useKanbanTasks, useTasks, useUpdateTask, useReorderTask } from "@/hooks/use-tasks";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import type { KanbanBoard as KanbanBoardType, TaskFilters, TaskStatus } from "@/types/task";
import { DEFAULT_HIDDEN_COLUMNS } from "@/types/task";

function parseTagsParam(param: string): TaskFilters {
  const parts = param.split(",").filter(Boolean);
  const includeUntagged = parts.includes("untagged");
  const tagIds = parts.filter((p) => p !== "untagged").map(Number).filter((n) => !isNaN(n));
  return {
    tag_ids: tagIds.length > 0 ? tagIds : [],
    include_untagged: includeUntagged,
  };
}

function buildTagsParam(filters: TaskFilters): string | null {
  // "All selected" = no filtering = no param
  if (filters.tag_ids === undefined && filters.include_untagged === undefined) {
    return null;
  }
  const parts: string[] = [];
  if (filters.tag_ids?.length) parts.push(...filters.tag_ids.map(String));
  if (filters.include_untagged) parts.push("untagged");
  return parts.length > 0 ? parts.join(",") : null;
}

const EMPTY_BOARD: KanbanBoardType = {
  backlog: [],
  new: [],
  in_progress: [],
  review: [],
  done: [],
  cancelled: [],
};

export default function TasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filters, setFilters] = useState<TaskFilters>(() => {
    // 1. Try URL params first
    const tagsParam = searchParams.get("tags");
    if (tagsParam) {
      return parseTagsParam(tagsParam);
    }
    // 2. Try sessionStorage fallback
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("tasks-filter-tags");
      if (saved) {
        return parseTagsParam(saved);
      }
    }
    // 3. Default: all tags (no filtering)
    return {};
  });
  const [viewMode, setViewMode] = useState<TasksViewMode>("kanban");
  const [createDialogStatus, setCreateDialogStatus] = useState<TaskStatus | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());

  const handleToggleSelect = useCallback((taskId: number) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  // Sync tag filter to URL + sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tag"); // Remove old single-tag param
    const tagValue = buildTagsParam(filters);
    if (tagValue) {
      params.set("tags", tagValue);
      sessionStorage.setItem("tasks-filter-tags", tagValue);
    } else {
      params.delete("tags");
      sessionStorage.removeItem("tasks-filter-tags");
    }
    const newUrl = params.toString() ? `?${params.toString()}` : "/tasks";
    router.replace(newUrl, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.tag_ids, filters.include_untagged]);

  const { data: board, isLoading: kanbanLoading, error: kanbanError } = useKanbanTasks(filters);
  const { data: tasksList = [], isLoading: tableLoading, error: tableError } = useTasks(filters);
  const updateTask = useUpdateTask();
  const reorderTask = useReorderTask();

  const isLoading = viewMode === "kanban" ? kanbanLoading : tableLoading;
  const error = viewMode === "kanban" ? kanbanError : tableError;

  // Column visibility from settings
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Derive hidden columns: use saved setting if non-empty, else defaults
  const savedHidden = settings?.kanban_hidden_columns;
  const [hiddenColumns, setHiddenColumns] = useState<TaskStatus[]>(DEFAULT_HIDDEN_COLUMNS);

  // Sync from server settings once loaded
  useEffect(() => {
    if (savedHidden !== undefined) {
      setHiddenColumns(
        savedHidden.length > 0 ? (savedHidden as TaskStatus[]) : DEFAULT_HIDDEN_COLUMNS
      );
    }
  }, [savedHidden]);

  const handleHiddenColumnsChange = useCallback(
    (columns: TaskStatus[]) => {
      setHiddenColumns(columns);
      // Debounced save to API
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateSettings.mutate({ kanban_hidden_columns: columns });
      }, 500);
    },
    [updateSettings]
  );

  // Optimistic status change
  const [optimisticBoard, setOptimisticBoard] = useState<KanbanBoardType | null>(null);

  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    if (!board) return;

    // Build optimistic state
    const currentBoard = optimisticBoard ?? board;
    const newBoard: KanbanBoardType = {
      backlog: [...currentBoard.backlog],
      new: [...currentBoard.new],
      in_progress: [...currentBoard.in_progress],
      review: [...currentBoard.review],
      done: [...currentBoard.done],
      cancelled: [...currentBoard.cancelled],
    };

    // Find and move the task — place at TOP of target column
    for (const col of Object.keys(newBoard) as TaskStatus[]) {
      const idx = newBoard[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        const [task] = newBoard[col].splice(idx, 1);
        newBoard[newStatus].unshift({ ...task, status: newStatus });
        break;
      }
    }
    setOptimisticBoard(newBoard);

    try {
      await updateTask.mutateAsync({ taskId, data: { status: newStatus } });
    } catch {
      setOptimisticBoard(null); // Revert on error
    } finally {
      setOptimisticBoard(null);
    }
  };

  const handleReorder = async (
    taskId: number,
    afterTaskId: number | null,
    beforeTaskId: number | null
  ) => {
    if (!board) return;

    // Build optimistic state for reorder
    const currentBoard = optimisticBoard ?? board;
    const newBoard: KanbanBoardType = {
      backlog: [...currentBoard.backlog],
      new: [...currentBoard.new],
      in_progress: [...currentBoard.in_progress],
      review: [...currentBoard.review],
      done: [...currentBoard.done],
      cancelled: [...currentBoard.cancelled],
    };

    // Find the task and its column, reorder within column
    for (const col of Object.keys(newBoard) as TaskStatus[]) {
      const taskIdx = newBoard[col].findIndex((t) => t.id === taskId);
      if (taskIdx !== -1) {
        const [task] = newBoard[col].splice(taskIdx, 1);

        // Find the target position based on after/before
        if (afterTaskId !== null) {
          const afterIdx = newBoard[col].findIndex((t) => t.id === afterTaskId);
          newBoard[col].splice(afterIdx + 1, 0, task);
        } else if (beforeTaskId !== null) {
          const beforeIdx = newBoard[col].findIndex((t) => t.id === beforeTaskId);
          newBoard[col].splice(Math.max(0, beforeIdx), 0, task);
        } else {
          newBoard[col].unshift(task);
        }
        break;
      }
    }
    setOptimisticBoard(newBoard);

    try {
      await reorderTask.mutateAsync({
        task_id: taskId,
        after_task_id: afterTaskId,
        before_task_id: beforeTaskId,
      });
    } catch {
      setOptimisticBoard(null);
    } finally {
      setOptimisticBoard(null);
    }
  };

  const displayBoard = optimisticBoard ?? board ?? EMPTY_BOARD;

  // Subline counts — mirror HeroCells.openTasks + HeroCells.tasksDueToday semantics.
  const { openCount, dueTodayCount } = useMemo(() => {
    const today0 = new Date().setHours(0, 0, 0, 0);
    const tomorrow0 = today0 + 86_400_000;
    let open = 0;
    let dueToday = 0;
    for (const t of tasksList) {
      if (t.status === "done" || t.status === "cancelled") continue;
      open += 1;
      if (t.deadline) {
        const ts = new Date(t.deadline).getTime();
        if (ts >= today0 && ts < tomorrow0) dueToday += 1;
      }
    }
    return { openCount: open, dueTodayCount: dueToday };
  }, [tasksList]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Page header · brutalist .ph */}
      <header className="border-b-[1.5px] border-[color:var(--line)] pb-[14px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono">
              Module · Tasks
            </div>
            <h1 className="mt-1 font-bold text-[28px] leading-[1.1] tracking-[-0.4px] text-[color:var(--ink)]">
              TASKS_
            </h1>
            <p className="mt-1 text-[12px] text-[color:var(--ink-3)] font-mono">
              {openCount} open · {dueTodayCount} due today
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/tasks/analytics"
              className="inline-flex items-center gap-1.5 border-[1.5px] border-[color:var(--line)] px-3 py-1.5 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)] hover:text-[color:var(--ink)] hover:border-[color:var(--line-2)] transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Analytics
            </Link>
            <button
              type="button"
              onClick={() => setCreateDialogStatus("new")}
              className="border-[1.5px] border-[color:var(--accent)] bg-[color:var(--accent)] px-3 py-1.5 text-[11px] uppercase tracking-[1.5px] text-[color:var(--bg)] font-mono font-bold"
            >
              + New Task
            </button>
          </div>
        </div>
      </header>

      {/* Filters + view toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <TaskFiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            extraButtons={
              viewMode === "kanban" ? (
                <ColumnVisibilityButton
                  hiddenColumns={hiddenColumns}
                  onHiddenColumnsChange={handleHiddenColumnsChange}
                />
              ) : undefined
            }
          />
        </div>
        <TasksViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Content — table or kanban */}
      {viewMode === "table" ? (
        <TasksTable
          tasks={tasksList}
          isLoading={tableLoading}
          error={tableError as Error | null}
        />
      ) : isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[var(--text-tertiary)]">
          Loading tasks…
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center text-[var(--danger)]">
          Failed to load tasks
        </div>
      ) : (
        <KanbanBoard
          board={displayBoard}
          onStatusChange={handleStatusChange}
          onReorder={handleReorder}
          isPending={updateTask.isPending}
          hiddenColumns={hiddenColumns}
          onAddTask={setCreateDialogStatus}
          selectedTaskIds={selectedTaskIds}
          onToggleSelect={handleToggleSelect}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Bulk action toolbar */}
      {selectedTaskIds.size > 0 && (
        <BulkActionToolbar
          selectedTaskIds={selectedTaskIds}
          board={displayBoard}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Dialogs */}
      {createDialogStatus !== null && (
        <TaskDialog
          initialStatus={createDialogStatus}
          onClose={() => setCreateDialogStatus(null)}
        />
      )}
    </div>
  );
}

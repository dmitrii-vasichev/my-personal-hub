"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { BulkActionToolbar } from "@/components/tasks/bulk-action-toolbar";
import { TaskFiltersBar } from "@/components/tasks/task-filters";
import { ColumnVisibilityButton } from "@/components/tasks/column-visibility-button";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useKanbanTasks, useUpdateTask, useReorderTask } from "@/hooks/use-tasks";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import type { KanbanBoard as KanbanBoardType, TaskFilters, TaskStatus } from "@/types/task";
import { DEFAULT_HIDDEN_COLUMNS } from "@/types/task";

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

  const initialTagId = searchParams.get("tag") ? Number(searchParams.get("tag")) : undefined;
  const [filters, setFilters] = useState<TaskFilters>({
    tag_id: initialTagId,
  });
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

  // Sync tag filter to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filters.tag_id) {
      params.set("tag", String(filters.tag_id));
    } else {
      params.delete("tag");
    }
    const newUrl = params.toString() ? `?${params.toString()}` : "/tasks";
    router.replace(newUrl, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.tag_id]);

  const { data: board, isLoading, error } = useKanbanTasks(filters);
  const updateTask = useUpdateTask();
  const reorderTask = useReorderTask();

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

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Tasks</h1>
        <div className="flex items-center gap-2">
          <Link href="/tasks/analytics">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <BarChart2 className="h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => setCreateDialogStatus("new")}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <TaskFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        extraButtons={
          <ColumnVisibilityButton
            hiddenColumns={hiddenColumns}
            onHiddenColumnsChange={handleHiddenColumnsChange}
          />
        }
      />

      {/* Board */}
      {isLoading ? (
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

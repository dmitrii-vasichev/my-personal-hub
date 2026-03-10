"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskFiltersBar } from "@/components/tasks/task-filters";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useKanbanTasks, useUpdateTask } from "@/hooks/use-tasks";
import type { KanbanBoard as KanbanBoardType, TaskFilters, TaskStatus } from "@/types/task";

const EMPTY_BOARD: KanbanBoardType = {
  new: [],
  in_progress: [],
  review: [],
  done: [],
  cancelled: [],
};

export default function TasksPage() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: board, isLoading, error } = useKanbanTasks(filters);
  const updateTask = useUpdateTask();

  // Optimistic status change
  const [optimisticBoard, setOptimisticBoard] = useState<KanbanBoardType | null>(null);

  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    if (!board) return;

    // Build optimistic state
    const currentBoard = optimisticBoard ?? board;
    const newBoard: KanbanBoardType = {
      new: [...currentBoard.new],
      in_progress: [...currentBoard.in_progress],
      review: [...currentBoard.review],
      done: [...currentBoard.done],
      cancelled: [...currentBoard.cancelled],
    };

    // Find and move the task
    for (const col of Object.keys(newBoard) as TaskStatus[]) {
      const idx = newBoard[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        const [task] = newBoard[col].splice(idx, 1);
        newBoard[newStatus].push({ ...task, status: newStatus });
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
            onClick={() => setShowCreateDialog(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <TaskFiltersBar filters={filters} onFiltersChange={setFilters} />

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
          isPending={updateTask.isPending}
        />
      )}

      {/* Dialogs */}
      {showCreateDialog && (
        <TaskDialog
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}

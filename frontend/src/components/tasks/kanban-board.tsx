"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { KanbanBoard as KanbanBoardType, Task, TaskStatus } from "@/types/task";
import { TASK_STATUS_ORDER } from "@/types/task";
import { KanbanColumn } from "./kanban-column";
import { TaskCardOverlay } from "./task-card";

interface KanbanBoardProps {
  board: KanbanBoardType;
  onStatusChange: (taskId: number, newStatus: TaskStatus) => void;
  onReorder: (taskId: number, afterTaskId: number | null, beforeTaskId: number | null) => void;
  isPending?: boolean;
  hiddenColumns?: TaskStatus[];
  onAddTask?: (status: TaskStatus) => void;
}

function findTaskColumn(board: KanbanBoardType, taskId: number): TaskStatus | null {
  for (const status of TASK_STATUS_ORDER) {
    if (board[status]?.some((t) => t.id === taskId)) {
      return status;
    }
  }
  return null;
}

export function KanbanBoard({ board, onStatusChange, onReorder, isPending, hiddenColumns = [], onAddTask }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { data } = event.active;
    if (data.current?.task) {
      setActiveTask(data.current.task as Task);
    }
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Could be used for live preview, but we handle everything in onDragEnd
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as number;
    const overId = over.id;
    const activeStatus = (active.data.current?.status as TaskStatus) ?? null;

    // Check if dropped over a column (status string)
    const isColumnDrop = typeof overId === "string" && TASK_STATUS_ORDER.includes(overId as TaskStatus);

    if (isColumnDrop) {
      const newStatus = overId as TaskStatus;
      if (newStatus !== activeStatus) {
        onStatusChange(taskId, newStatus);
      }
      return;
    }

    // Dropped over another task
    const overTaskId = overId as number;
    if (overTaskId === taskId) return;

    // Find which column the over task is in
    const overColumn = findTaskColumn(board, overTaskId);
    if (!overColumn) return;

    if (overColumn !== activeStatus) {
      // Cross-column: change status (task goes to top of target column)
      onStatusChange(taskId, overColumn);
    } else {
      // Same column: reorder
      const columnTasks = board[overColumn] ?? [];
      const overIndex = columnTasks.findIndex((t) => t.id === overTaskId);
      if (overIndex === -1) return;

      // Determine after/before based on position
      const afterTaskId = overIndex > 0 ? columnTasks[overIndex - 1].id : null;
      const beforeTaskId = overIndex < columnTasks.length - 1 ? columnTasks[overIndex + 1].id : null;

      // Check if dragged task was above or below the target
      const activeIndex = columnTasks.findIndex((t) => t.id === taskId);
      if (activeIndex < overIndex) {
        // Dragged down: place after the over task
        onReorder(taskId, columnTasks[overIndex].id, beforeTaskId);
      } else {
        // Dragged up: place before the over task
        onReorder(taskId, afterTaskId, columnTasks[overIndex].id);
      }
    }
  };

  const visibleStatuses = TASK_STATUS_ORDER.filter(
    (status) => !hiddenColumns.includes(status)
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className={`flex gap-4 overflow-x-auto pb-4 transition-opacity ${isPending ? "opacity-70" : ""}`}
      >
        {visibleStatuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={board[status] ?? []}
            activeTaskId={activeTask?.id ?? null}
            onAddTask={onAddTask ? () => onAddTask(status) : undefined}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

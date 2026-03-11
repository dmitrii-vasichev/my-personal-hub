"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { KanbanBoard as KanbanBoardType, Task, TaskStatus } from "@/types/task";
import { TASK_STATUS_ORDER } from "@/types/task";
import { KanbanColumn } from "./kanban-column";
import { TaskCardOverlay } from "./task-card";

interface KanbanBoardProps {
  board: KanbanBoardType;
  onStatusChange: (taskId: number, newStatus: TaskStatus) => void;
  isPending?: boolean;
  hiddenColumns?: TaskStatus[];
}

export function KanbanBoard({ board, onStatusChange, isPending, hiddenColumns = [] }: KanbanBoardProps) {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const taskId = active.id as number;
    const oldStatus = (active.data.current?.status as TaskStatus) ?? null;

    if (newStatus !== oldStatus) {
      onStatusChange(taskId, newStatus);
    }
  };

  const visibleStatuses = TASK_STATUS_ORDER.filter(
    (status) => !hiddenColumns.includes(status)
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
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
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

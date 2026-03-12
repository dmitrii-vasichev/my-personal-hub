"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CreateTaskInput,
  CreateUpdateInput,
  KanbanBoard,
  Task,
  TaskFilters,
  TaskUpdateItem,
  UpdateTaskInput,
} from "@/types/task";

function buildTaskQuery(filters: TaskFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assignee_id) params.set("assignee_id", String(filters.assignee_id));
  if (filters.search) params.set("search", filters.search);
  if (filters.tag_id) params.set("tag_id", String(filters.tag_id));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const TASKS_KEY = "tasks";
export const KANBAN_KEY = "kanban";

export function useKanbanTasks(filters: TaskFilters = {}) {
  const qs = buildTaskQuery(filters);
  return useQuery<KanbanBoard>({
    queryKey: [KANBAN_KEY, filters],
    queryFn: () => api.get<KanbanBoard>(`/api/tasks/kanban${qs}`),
  });
}

export function useTasks(filters: TaskFilters = {}) {
  const qs = buildTaskQuery(filters);
  return useQuery<Task[]>({
    queryKey: [TASKS_KEY, filters],
    queryFn: () => api.get<Task[]>(`/api/tasks/${qs}`),
  });
}

export function useTask(taskId: number) {
  return useQuery<Task>({
    queryKey: [TASKS_KEY, taskId],
    queryFn: () => api.get<Task>(`/api/tasks/${taskId}`),
    enabled: !!taskId,
  });
}

export function useTaskUpdates(taskId: number) {
  return useQuery<TaskUpdateItem[]>({
    queryKey: ["task-updates", taskId],
    queryFn: () => api.get<TaskUpdateItem[]>(`/api/tasks/${taskId}/updates`),
    enabled: !!taskId,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => api.post<Task>("/api/tasks/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KANBAN_KEY] });
      qc.invalidateQueries({ queryKey: [TASKS_KEY] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: UpdateTaskInput }) =>
      api.patch<Task>(`/api/tasks/${taskId}`, data),
    onSuccess: (updatedTask) => {
      qc.invalidateQueries({ queryKey: [KANBAN_KEY] });
      qc.invalidateQueries({ queryKey: [TASKS_KEY] });
      qc.setQueryData([TASKS_KEY, updatedTask.id], updatedTask);
    },
  });
}

export function useReorderTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { task_id: number; after_task_id: number | null; before_task_id: number | null }) =>
      api.post<Task>("/api/tasks/reorder", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KANBAN_KEY] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => api.delete(`/api/tasks/${taskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KANBAN_KEY] });
      qc.invalidateQueries({ queryKey: [TASKS_KEY] });
    },
  });
}

export function useCreateTaskUpdate(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUpdateInput) =>
      api.post<TaskUpdateItem>(`/api/tasks/${taskId}/updates`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-updates", taskId] });
    },
  });
}

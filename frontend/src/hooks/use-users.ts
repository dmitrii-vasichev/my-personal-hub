"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CreateUserInput,
  CreateUserResponse,
  ResetPasswordResponse,
  UpdateUserInput,
  UserListItem,
} from "@/types/user";

export const USERS_KEY = "users";

export function useUsers() {
  return useQuery<UserListItem[]>({
    queryKey: [USERS_KEY],
    queryFn: () => api.get<UserListItem[]>("/api/users/"),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) =>
      api.post<CreateUserResponse>("/api/users/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserInput }) =>
      api.patch<UserListItem>(`/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (id: number) =>
      api.post<ResetPasswordResponse>(`/api/users/${id}/reset-password`),
  });
}

export function useResetDemoData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/users/demo/reset"),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

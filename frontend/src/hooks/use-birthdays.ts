"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Birthday,
  CreateBirthdayInput,
  UpdateBirthdayInput,
} from "@/types/birthday";

const BIRTHDAYS_KEY = "birthdays";

export function useBirthdays() {
  return useQuery<Birthday[]>({
    queryKey: [BIRTHDAYS_KEY],
    queryFn: () => api.get<Birthday[]>("/api/reminders/birthdays/"),
  });
}

export function useCreateBirthday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBirthdayInput) =>
      api.post<Birthday>("/api/reminders/birthdays/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BIRTHDAYS_KEY] }),
  });
}

export function useUpdateBirthday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateBirthdayInput & { id: number }) =>
      api.patch<Birthday>(`/api/reminders/birthdays/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BIRTHDAYS_KEY] }),
  });
}

export function useDeleteBirthday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/reminders/birthdays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [BIRTHDAYS_KEY] }),
  });
}

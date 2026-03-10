"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  UserProfile,
  ProfileUpdateInput,
  ProfileImportInput,
} from "@/types/profile";

export const USER_PROFILE_KEY = "user-profile";

export function useUserProfile() {
  return useQuery<UserProfile | null>({
    queryKey: [USER_PROFILE_KEY],
    queryFn: async () => {
      try {
        return await api.get<UserProfile>("/api/profile/");
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.toLowerCase().includes("not found")
        ) {
          return null;
        }
        throw err;
      }
    },
  });
}

export function useUpdateUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileUpdateInput) =>
      api.put<UserProfile>("/api/profile/", data),
    onSuccess: (data) => {
      qc.setQueryData([USER_PROFILE_KEY], data);
    },
  });
}

export function useImportProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileImportInput) =>
      api.post<UserProfile>("/api/profile/import", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [USER_PROFILE_KEY] });
    },
  });
}

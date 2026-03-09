"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProfileResponse, UpdateProfileInput } from "@/types/user";

export const PROFILE_KEY = "profile";

export function useProfile() {
  return useQuery<ProfileResponse>({
    queryKey: [PROFILE_KEY],
    queryFn: () => api.get<ProfileResponse>("/api/auth/profile"),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileInput) =>
      api.put<ProfileResponse>("/api/auth/profile", data),
    onSuccess: (data) => {
      queryClient.setQueryData([PROFILE_KEY], data);
      // Also invalidate /me endpoint used by auth context
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

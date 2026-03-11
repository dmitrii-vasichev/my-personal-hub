"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Note, NoteTreeNode } from "@/types/note";

export const NOTES_TREE_KEY = "notes-tree";
export const NOTES_KEY = "notes";
export const NOTE_CONTENT_KEY = "note-content";

export function useNotesTree() {
  return useQuery<NoteTreeNode>({
    queryKey: [NOTES_TREE_KEY],
    queryFn: () => api.get<NoteTreeNode>("/api/notes/tree"),
  });
}

export function useNoteContent(fileId: string | null) {
  return useQuery<string>({
    queryKey: [NOTE_CONTENT_KEY, fileId],
    queryFn: () => api.get<string>(`/api/notes/${fileId}/content`),
    enabled: !!fileId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNotes() {
  return useQuery<Note[]>({
    queryKey: [NOTES_KEY],
    queryFn: () => api.get<Note[]>("/api/notes/"),
  });
}

export function useRefreshNotesTree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/notes/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTES_TREE_KEY] });
      queryClient.invalidateQueries({ queryKey: [NOTES_KEY] });
    },
  });
}

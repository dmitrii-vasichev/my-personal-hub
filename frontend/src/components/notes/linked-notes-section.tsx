"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link2, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useNotes } from "@/hooks/use-notes";
import type { LinkedNoteBrief } from "@/types/note";

interface LinkedNotesSectionProps {
  notes: LinkedNoteBrief[];
  isLoading: boolean;
  onLink: (noteId: number) => void;
  onUnlink: (noteId: number) => void;
  isLinking?: boolean;
}

export function LinkedNotesSection({
  notes,
  isLoading,
  onLink,
  onUnlink,
  isLinking,
}: LinkedNotesSectionProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: allNotes = [] } = useNotes();

  const linkedIds = new Set(notes.map((n) => n.id));
  const filteredNotes = allNotes.filter((n) => {
    if (linkedIds.has(n.id)) return false;
    if (search) {
      return n.title.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleLink = (noteId: number) => {
    onLink(noteId);
    setDialogOpen(false);
    setSearch("");
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            Linked Notes
          </h3>
          {notes.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--surface-hover)] text-[var(--text-tertiary)]">
              {notes.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={isLinking}
          className="h-7 px-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <Plus className="h-3 w-3" />
          Link Note
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
          <Link2 className="mx-auto mb-1.5 h-4 w-4 text-[var(--text-tertiary)]" />
          <p className="text-xs text-[var(--text-tertiary)]">
            No notes linked
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                <button
                  onClick={() =>
                    router.push(`/notes?file=${note.google_file_id}`)
                  }
                  className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] truncate transition-colors cursor-pointer"
                >
                  {note.title}
                </button>
                {note.folder_path && (
                  <span className="shrink-0 text-[10px] font-mono text-[var(--text-tertiary)] truncate max-w-[150px]">
                    {note.folder_path}
                  </span>
                )}
              </div>
              <Tooltip content="Unlink note">
                <button
                  onClick={() => onUnlink(note.id)}
                  className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--destructive)] hover:bg-[var(--destructive-muted)] transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      {/* Link Note Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="w-full max-w-md p-6">
            <DialogClose />
            <DialogTitle className="mb-4">Link Note</DialogTitle>
            <Input
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
            />
            <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
              {filteredNotes.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                  No notes found
                </p>
              ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => handleLink(note.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-[var(--text-primary)] truncate block">
                        {note.title}
                      </span>
                      {note.folder_path && (
                        <span className="text-[10px] font-mono text-[var(--text-tertiary)] truncate block">
                          {note.folder_path}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  );
}

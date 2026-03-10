"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEventNote, useUpdateEventNote, useDeleteEventNote } from "@/hooks/use-calendar";
import type { EventNote } from "@/types/calendar";
import { toast } from "sonner";

interface EventNotesProps {
  eventId: number;
  notes: EventNote[];
}

function NoteItem({
  note,
  eventId,
}: {
  note: EventNote;
  eventId: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note.content);
  const updateNote = useUpdateEventNote();
  const deleteNote = useDeleteEventNote();

  const handleSave = async () => {
    if (!value.trim()) return;
    try {
      await updateNote.mutateAsync({ noteId: note.id, eventId, content: value.trim() });
      setEditing(false);
    } catch {
      toast.error("Failed to update note");
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteNote.mutateAsync({ noteId: note.id, eventId });
    } catch {
      toast.error("Failed to delete note");
    }
    setShowDeleteConfirm(false);
  };

  return (
    <div className="group bg-[--surface] border border-[--border] rounded p-3">
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={updateNote.isPending}>
              <Check size={12} className="mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(note.content); }}>
              <X size={12} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-[--text-primary] whitespace-pre-wrap flex-1">{note.content}</p>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-[--text-tertiary] hover:text-[--text-primary] p-0.5 transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[--text-tertiary] hover:text-[--danger] p-0.5 transition-colors"
              disabled={deleteNote.isPending}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-[--text-tertiary] mt-1.5">
        {new Date(note.created_at).toLocaleString()}
      </p>
      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Note"
        description="Delete this note? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteNote.isPending}
      />
    </div>
  );
}

export function EventNotes({ eventId, notes }: EventNotesProps) {
  const [newNote, setNewNote] = useState("");
  const createNote = useCreateEventNote();

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    try {
      await createNote.mutateAsync({ eventId, data: { content: newNote.trim() } });
      setNewNote("");
    } catch {
      toast.error("Failed to add note");
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[--text-secondary] uppercase tracking-wide">
        Notes ({notes.length})
      </h3>

      {/* Add note */}
      <div className="space-y-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
          }}
        />
        <Button size="sm" onClick={handleAdd} disabled={createNote.isPending || !newNote.trim()}>
          {createNote.isPending ? "Adding..." : "Add Note"}
        </Button>
      </div>

      {/* Existing notes */}
      {notes.length > 0 && (
        <div className="space-y-2 mt-4">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} eventId={eventId} />
          ))}
        </div>
      )}
    </div>
  );
}

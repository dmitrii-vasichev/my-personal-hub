"use client";

import { useState } from "react";
import { Pencil, Trash2, Radio, Pause, Save, X } from "lucide-react";
import {
  usePulseSources,
  useUpdatePulseSource,
  useDeletePulseSource,
} from "@/hooks/use-pulse-sources";
import { CATEGORY_LABELS } from "@/types/pulse-source";
import type { PulseSource, PulseSourceUpdate } from "@/types/pulse-source";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface SourcesListProps {
  onAddClick: () => void;
}

export function SourcesList({ onAddClick }: SourcesListProps) {
  const { data: sources, isLoading } = usePulseSources();
  const updateSource = useUpdatePulseSource();
  const deleteSource = useDeletePulseSource();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<PulseSourceUpdate>({});
  const [deleteTarget, setDeleteTarget] = useState<PulseSource | null>(null);

  const startEdit = (source: PulseSource) => {
    setEditingId(source.id);
    setEditData({
      category: source.category,
      subcategory: source.subcategory ?? "",
      keywords: source.keywords ?? [],
      is_active: source.is_active,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    await updateSource.mutateAsync({ id: editingId, data: editData });
    cancelEdit();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteSource.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const toggleActive = async (source: PulseSource) => {
    await updateSource.mutateAsync({
      id: source.id,
      data: { is_active: !source.is_active },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Loading sources...
      </div>
    );
  }

  if (!sources || sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Radio className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground mb-4">
          No sources yet. Add your first Telegram channel or group to start monitoring.
        </p>
        <Button size="sm" onClick={onAddClick}>
          Add Source
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-tertiary">
                Title
              </th>
              <th className="pb-2 pr-4 font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-tertiary">
                Category
              </th>
              <th className="pb-2 pr-4 font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-tertiary">
                Subcategory
              </th>
              <th className="pb-2 pr-4 font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-tertiary">
                Status
              </th>
              <th className="pb-2 pr-4 font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-tertiary">
                Last Polled
              </th>
              <th className="pb-2 font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-tertiary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr
                key={source.id}
                className="border-b border-border-subtle hover:bg-surface-hover/50 transition-colors"
              >
                <td className="py-2.5 pr-4">
                  <div className="font-medium text-foreground">{source.title}</div>
                  {source.username && (
                    <div className="text-xs text-muted-foreground">@{source.username}</div>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  {editingId === source.id ? (
                    <Select
                      value={editData.category ?? source.category}
                      onChange={(e) =>
                        setEditData({ ...editData, category: (e.target as HTMLSelectElement).value })
                      }
                      className="text-xs w-24"
                    >
                      <option value="news">News</option>
                      <option value="jobs">Jobs</option>
                      <option value="learning">Learning</option>
                    </Select>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-surface-hover px-2 py-0.5 text-xs font-medium text-foreground">
                      {CATEGORY_LABELS[source.category] ?? source.category}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {editingId === source.id ? (
                    <Input
                      value={editData.subcategory ?? ""}
                      onChange={(e) =>
                        setEditData({ ...editData, subcategory: e.target.value })
                      }
                      placeholder="—"
                      className="text-xs w-28 h-7"
                    />
                  ) : (
                    source.subcategory || "—"
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <button
                    onClick={() => toggleActive(source)}
                    className="cursor-pointer"
                    title={source.is_active ? "Pause" : "Activate"}
                  >
                    {source.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--success)]/15 px-2 py-0.5 text-xs font-medium text-[var(--success)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <Pause className="h-3 w-3" />
                        Paused
                      </span>
                    )}
                  </button>
                </td>
                <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                  {source.last_polled_at
                    ? new Date(source.last_polled_at).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-1">
                    {editingId === source.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={saveEdit}
                          disabled={updateSource.isPending}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={cancelEdit}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => startEdit(source)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-[var(--danger)]"
                          onClick={() => setDeleteTarget(source)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Source"
        description={`Remove "${deleteTarget?.title}" from your sources? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        loading={deleteSource.isPending}
      />
    </>
  );
}

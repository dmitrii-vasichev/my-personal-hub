"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ExperienceEntry } from "@/types/profile";

interface ExperienceEditorProps {
  experience: ExperienceEntry[];
  onChange: (experience: ExperienceEntry[]) => void;
}

const EMPTY: ExperienceEntry = {
  title: "",
  company: "",
  location: "",
  start_date: "",
  end_date: "",
  description: "",
};

export function ExperienceEditor({
  experience,
  onChange,
}: ExperienceEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ExperienceEntry>({ ...EMPTY });

  const toggleExpand = (i: number) => {
    setExpandedIndex(expandedIndex === i ? null : i);
  };

  const updateEntry = (i: number, patch: Partial<ExperienceEntry>) => {
    const updated = experience.map((e, idx) =>
      idx === i ? { ...e, ...patch } : e
    );
    onChange(updated);
  };

  const removeEntry = (i: number) => {
    onChange(experience.filter((_, idx) => idx !== i));
    if (expandedIndex === i) setExpandedIndex(null);
  };

  const addEntry = () => {
    if (!draft.title.trim() || !draft.company.trim()) return;
    onChange([...experience, { ...draft }]);
    setDraft({ ...EMPTY });
    setAdding(false);
  };

  const formatDateRange = (e: ExperienceEntry) => {
    if (!e.start_date && !e.end_date) return "";
    const parts = [];
    if (e.start_date) parts.push(e.start_date);
    parts.push("—");
    parts.push(e.end_date || "Present");
    return parts.join(" ");
  };

  return (
    <div className="space-y-3">
      {experience.map((entry, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-[var(--background)] p-3"
        >
          <div
            className="flex cursor-pointer items-center justify-between"
            onClick={() => toggleExpand(i)}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{entry.title}</div>
              <div className="text-xs text-muted-foreground">
                {entry.company}
                {entry.location ? ` \u00B7 ${entry.location}` : ""}
                {formatDateRange(entry)
                  ? ` \u00B7 ${formatDateRange(entry)}`
                  : ""}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeEntry(i);
                }}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-[var(--danger)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {expandedIndex === i ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {expandedIndex === i && (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Title *
                  </Label>
                  <Input
                    value={entry.title}
                    onChange={(e) =>
                      updateEntry(i, { title: e.target.value })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Company *
                  </Label>
                  <Input
                    value={entry.company}
                    onChange={(e) =>
                      updateEntry(i, { company: e.target.value })
                    }
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Location
                  </Label>
                  <Input
                    value={entry.location ?? ""}
                    onChange={(e) =>
                      updateEntry(i, { location: e.target.value })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Start Date
                  </Label>
                  <Input
                    value={entry.start_date ?? ""}
                    onChange={(e) =>
                      updateEntry(i, { start_date: e.target.value })
                    }
                    placeholder="YYYY-MM"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">
                    End Date
                  </Label>
                  <Input
                    value={entry.end_date ?? ""}
                    onChange={(e) =>
                      updateEntry(i, { end_date: e.target.value })
                    }
                    placeholder="YYYY-MM or empty"
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  value={entry.description ?? ""}
                  onChange={(e) =>
                    updateEntry(i, { description: e.target.value })
                  }
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Title *
              </Label>
              <Input
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Company *
              </Label>
              <Input
                value={draft.company}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, company: e.target.value }))
                }
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Location
              </Label>
              <Input
                value={draft.location ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, location: e.target.value }))
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Start Date
              </Label>
              <Input
                value={draft.start_date ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, start_date: e.target.value }))
                }
                placeholder="YYYY-MM"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                End Date
              </Label>
              <Input
                value={draft.end_date ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, end_date: e.target.value }))
                }
                placeholder="YYYY-MM or empty"
                className="text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              Description
            </Label>
            <Textarea
              value={draft.description ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
              rows={3}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={addEntry}
              disabled={!draft.title.trim() || !draft.company.trim()}
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setDraft({ ...EMPTY });
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setAdding(true)}
          className="w-full"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add experience
        </Button>
      )}
    </div>
  );
}

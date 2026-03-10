"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { EducationEntry } from "@/types/profile";

interface EducationEditorProps {
  education: EducationEntry[];
  onChange: (education: EducationEntry[]) => void;
}

const EMPTY: EducationEntry = {
  degree: "",
  institution: "",
  year: undefined,
};

export function EducationEditor({
  education,
  onChange,
}: EducationEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<EducationEntry>({ ...EMPTY });

  const toggleExpand = (i: number) => {
    setExpandedIndex(expandedIndex === i ? null : i);
  };

  const updateEntry = (i: number, patch: Partial<EducationEntry>) => {
    const updated = education.map((e, idx) =>
      idx === i ? { ...e, ...patch } : e
    );
    onChange(updated);
  };

  const removeEntry = (i: number) => {
    onChange(education.filter((_, idx) => idx !== i));
    if (expandedIndex === i) setExpandedIndex(null);
  };

  const addEntry = () => {
    if (!draft.degree.trim() || !draft.institution.trim()) return;
    onChange([...education, { ...draft }]);
    setDraft({ ...EMPTY });
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {education.map((entry, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-[var(--background)] p-3"
        >
          <div
            className="flex cursor-pointer items-center justify-between"
            onClick={() => toggleExpand(i)}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{entry.degree}</div>
              <div className="text-xs text-muted-foreground">
                {entry.institution}
                {entry.year ? ` \u00B7 ${entry.year}` : ""}
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
                    Degree *
                  </Label>
                  <Input
                    value={entry.degree}
                    onChange={(e) =>
                      updateEntry(i, { degree: e.target.value })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Institution *
                  </Label>
                  <Input
                    value={entry.institution}
                    onChange={(e) =>
                      updateEntry(i, { institution: e.target.value })
                    }
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">
                  Year
                </Label>
                <Input
                  type="number"
                  value={entry.year ?? ""}
                  onChange={(e) =>
                    updateEntry(i, {
                      year: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="YYYY"
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
                Degree *
              </Label>
              <Input
                value={draft.degree}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, degree: e.target.value }))
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Institution *
              </Label>
              <Input
                value={draft.institution}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, institution: e.target.value }))
                }
                className="text-sm"
              />
            </div>
          </div>
          <div className="w-32 space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              Year
            </Label>
            <Input
              type="number"
              value={draft.year ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  year: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                }))
              }
              placeholder="YYYY"
              className="text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={addEntry}
              disabled={!draft.degree.trim() || !draft.institution.trim()}
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
          Add education
        </Button>
      )}
    </div>
  );
}

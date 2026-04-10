"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { SkillEntry } from "@/types/profile";

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"] as const;

const LEVEL_LABELS: Record<string, string> = {
  "": "Level",
  ...Object.fromEntries(LEVELS.map((l) => [l, l])),
};

interface SkillsEditorProps {
  skills: SkillEntry[];
  onChange: (skills: SkillEntry[]) => void;
}

export function SkillsEditor({ skills, onChange }: SkillsEditorProps) {
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [newYears, setNewYears] = useState("");

  const addSkill = () => {
    const name = newName.trim();
    if (!name) return;
    if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;

    const entry: SkillEntry = { name };
    if (newLevel) entry.level = newLevel;
    if (newYears) entry.years = parseFloat(newYears);

    onChange([...skills, entry]);
    setNewName("");
    setNewLevel("");
    setNewYears("");
  };

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  const formatLabel = (s: SkillEntry) => {
    const parts = [s.name];
    if (s.level) parts.push(s.level);
    if (s.years) parts.push(`${s.years} yr${s.years !== 1 ? "s" : ""}`);
    return parts.join(" \u00B7 ");
  };

  return (
    <div className="space-y-3">
      {/* Skill chips */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 font-mono text-[11px]"
              style={{
                background: "rgba(45,212,191,0.08)",
                color: "var(--accent-teal)",
                borderColor: "rgba(45,212,191,0.18)",
              }}
            >
              {formatLabel(skill)}
              <button
                type="button"
                onClick={() => removeSkill(i)}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-[rgba(248,113,113,0.15)] hover:text-[var(--danger)]"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add skill row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skill name..."
            className="text-sm"
          />
        </div>
        <div className="w-32">
          <SelectRoot
            value={newLevel}
            onValueChange={setNewLevel}
            labels={LEVEL_LABELS}
          >
            <SelectTrigger>
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="">Level</SelectItem>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectPopup>
          </SelectRoot>
        </div>
        <div className="w-20">
          <Input
            type="number"
            value={newYears}
            onChange={(e) => setNewYears(e.target.value)}
            placeholder="Yrs"
            min={0}
            step={0.5}
            className="text-sm"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={addSkill}
          disabled={!newName.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

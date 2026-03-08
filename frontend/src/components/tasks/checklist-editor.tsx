"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChecklistItem } from "@/types/task";

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
  const [newText, setNewText] = useState("");

  const addItem = () => {
    const text = newText.trim();
    if (!text) return;
    onChange([...items, { id: generateId(), text, completed: false }]);
    setNewText("");
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const toggleItem = (id: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)));
  };

  const updateText = (id: string, text: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.completed}
            onChange={() => toggleItem(item.id)}
            className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--accent)]"
          />
          <input
            value={item.text}
            onChange={(e) => updateText(item.id, e.target.value)}
            className={`flex-1 bg-transparent text-sm outline-none text-[var(--text-primary)] ${item.completed ? "line-through text-[var(--text-tertiary)]" : ""}`}
          />
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add checklist item…"
          className="h-7 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={addItem}
          className="h-7 w-7 shrink-0"
          disabled={!newText.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoModeBadge } from "@/components/ui/demo-mode-badge";
import { SourcesList } from "@/components/pulse/sources-list";
import { AddSourceDialog } from "@/components/pulse/add-source-dialog";
import { useAuth } from "@/lib/auth";

export default function PulseSourcesPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { isDemo } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 animate-[fadeIn_0.4s_ease_both]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pulse Sources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage Telegram channels and groups to monitor
          </p>
        </div>
        {isDemo ? (
          <DemoModeBadge compact feature="Source Management" description="Add and manage Telegram sources" />
        ) : (
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Source
          </Button>
        )}
      </div>

      {/* Sources list */}
      <SourcesList onAddClick={() => setAddDialogOpen(true)} />

      {/* Add dialog */}
      <AddSourceDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/app/(dashboard)/settings/page";
import { useResetDemoData } from "@/hooks/use-users";
import { useAuth } from "@/lib/auth";

interface GeneralTabProps {
  targetRoles: string[];
  setTargetRoles: React.Dispatch<React.SetStateAction<string[]>>;
  excludedCompanies: string[];
  setExcludedCompanies: React.Dispatch<React.SetStateAction<string[]>>;
  location: string;
  setLocation: React.Dispatch<React.SetStateAction<string>>;
  minScore: string;
  setMinScore: React.Dispatch<React.SetStateAction<string>>;
  staleDays: string;
  setStaleDays: React.Dispatch<React.SetStateAction<string>>;
}

export function GeneralTab({
  targetRoles,
  setTargetRoles,
  excludedCompanies,
  setExcludedCompanies,
  location,
  setLocation,
  minScore,
  setMinScore,
  staleDays,
  setStaleDays,
}: GeneralTabProps) {
  const { isDemo } = useAuth();
  const resetDemo = useResetDemoData();
  const [confirmReset, setConfirmReset] = useState(false);

  const handleResetDemo = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    try {
      await resetDemo.mutateAsync();
      toast.success("Demo data reset successfully");
      setConfirmReset(false);
    } catch {
      toast.error("Failed to reset demo data");
      setConfirmReset(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-border p-5">
      <h2 className="text-sm font-medium">Job Search</h2>

      <div className="space-y-1">
        <Label className="text-xs uppercase text-muted-foreground">Target Roles</Label>
        <TagInput
          tags={targetRoles}
          onAdd={(t) => setTargetRoles((p) => [...p, t])}
          onRemove={(t) => setTargetRoles((p) => p.filter((r) => r !== t))}
          placeholder="e.g. Product Manager, UX Designer"
        />
        <p className="text-xs text-muted-foreground">Press Enter or comma to add</p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs uppercase text-muted-foreground">Default Location</Label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. London, UK or Remote"
          className="text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs uppercase text-muted-foreground">Excluded Companies</Label>
        <TagInput
          tags={excludedCompanies}
          onAdd={(t) => setExcludedCompanies((p) => [...p, t])}
          onRemove={(t) => setExcludedCompanies((p) => p.filter((c) => c !== t))}
          placeholder="e.g. Company A, Company B"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Min Match Score</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Stale After (days)</Label>
          <Input
            type="number"
            min={1}
            value={staleDays}
            onChange={(e) => setStaleDays(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {isDemo && (
        <div className="border-t border-border pt-4">
          <h2 className="text-sm font-medium mb-2">Demo Mode</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Reset all demo data to defaults. This will recreate all tasks, jobs, notes, and other data.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDemo}
            disabled={resetDemo.isPending}
            className={confirmReset ? "border-danger text-danger hover:bg-danger/10" : ""}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {resetDemo.isPending
              ? "Resetting…"
              : confirmReset
                ? "Click again to confirm"
                : "Reset Demo Data"}
          </Button>
          {confirmReset && !resetDemo.isPending && (
            <button
              onClick={() => setConfirmReset(false)}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </section>
  );
}

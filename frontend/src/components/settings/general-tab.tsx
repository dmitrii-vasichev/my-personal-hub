"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/app/(dashboard)/settings/page";

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
    </section>
  );
}

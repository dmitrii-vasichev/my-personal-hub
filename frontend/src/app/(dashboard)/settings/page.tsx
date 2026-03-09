"use client";

import { useState, KeyboardEvent } from "react";
import { Save, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useAuth } from "@/lib/auth";
import { UserManagementTable } from "@/components/settings/user-management-table";
import type { UpdateSettingsInput } from "@/types/settings";

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      const value = input.trim().replace(/,$/, "");
      if (value && !tags.includes(value)) {
        onAdd(value);
      }
      setInput("");
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    }
  };

  return (
    <div className="flex min-h-[36px] flex-wrap gap-1 rounded-md border border-border bg-background px-2 py-1 focus-within:border-accent">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-accent/15 text-accent"
        >
          {tag}
          <button
            type="button"
            onClick={() => onRemove(tag)}
            className="hover:text-danger"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function ApiKeyInput({
  label,
  hasKey,
  value,
  onChange,
}: {
  label: string;
  hasKey: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder={hasKey ? "••••••••••••••• (set)" : "Not configured"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-9 text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// Type guard for admin settings response
function hasApiKeys(s: unknown): s is {
  has_api_key_openai: boolean;
  has_api_key_anthropic: boolean;
  has_api_key_gemini: boolean;
  has_api_key_adzuna: boolean;
  has_api_key_serpapi: boolean;
  has_api_key_jsearch: boolean;
  llm_provider: string;
} {
  return !!s && typeof s === "object" && "has_api_key_openai" in s;
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";

  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [staleDays, setStaleDays] = useState("14");
  const [llmProvider, setLlmProvider] = useState("openai");
  const [apiKeys, setApiKeys] = useState({
    openai: "",
    anthropic: "",
    gemini: "",
    adzuna_id: "",
    adzuna_key: "",
    serpapi: "",
    jsearch: "",
  });
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    setTargetRoles(settings.target_roles ?? []);
    setExcludedCompanies(settings.excluded_companies ?? []);
    setLocation(settings.default_location ?? "");
    setMinScore(String(settings.min_match_score ?? 0));
    setStaleDays(String(settings.stale_threshold_days ?? 14));
    if (hasApiKeys(settings)) {
      setLlmProvider(settings.llm_provider ?? "openai");
    }
    setInitialized(true);
  }

  const handleSave = async () => {
    const payload: UpdateSettingsInput = {
      target_roles: targetRoles,
      excluded_companies: excludedCompanies,
      default_location: location || undefined,
      min_match_score: parseInt(minScore) || 0,
      stale_threshold_days: parseInt(staleDays) || 14,
    };

    if (isAdmin) {
      payload.llm_provider = llmProvider;
      if (apiKeys.openai) payload.api_key_openai = apiKeys.openai;
      if (apiKeys.anthropic) payload.api_key_anthropic = apiKeys.anthropic;
      if (apiKeys.gemini) payload.api_key_gemini = apiKeys.gemini;
      if (apiKeys.adzuna_id) payload.api_key_adzuna_id = apiKeys.adzuna_id;
      if (apiKeys.adzuna_key) payload.api_key_adzuna_key = apiKeys.adzuna_key;
      if (apiKeys.serpapi) payload.api_key_serpapi = apiKeys.serpapi;
      if (apiKeys.jsearch) payload.api_key_jsearch = apiKeys.jsearch;
    }

    try {
      await update.mutateAsync(payload);
      if (isAdmin) {
        setApiKeys({ openai: "", anthropic: "", gemini: "", adzuna_id: "", adzuna_key: "", serpapi: "", jsearch: "" });
      }
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
        Loading settings…
      </div>
    );
  }

  const adminSettings = hasApiKeys(settings) ? settings : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <Button size="sm" onClick={handleSave} disabled={update.isPending}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* User Management — admin only */}
      {isAdmin && (
        <section className="space-y-4 rounded-lg border border-border p-5">
          <UserManagementTable />
        </section>
      )}

      {/* Job Search */}
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

      {/* AI Provider — admin only */}
      {isAdmin && (
        <section className="space-y-4 rounded-lg border border-border p-5">
          <h2 className="text-sm font-medium">AI Provider</h2>

          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Default LLM Provider</Label>
            <Select
              value={llmProvider}
              onChange={(e) => setLlmProvider((e.target as HTMLSelectElement).value)}
              className="text-sm"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Google Gemini</option>
            </Select>
          </div>

          <ApiKeyInput
            label="OpenAI API Key"
            hasKey={adminSettings?.has_api_key_openai ?? false}
            value={apiKeys.openai}
            onChange={(v) => setApiKeys((k) => ({ ...k, openai: v }))}
          />
          <ApiKeyInput
            label="Anthropic API Key"
            hasKey={adminSettings?.has_api_key_anthropic ?? false}
            value={apiKeys.anthropic}
            onChange={(v) => setApiKeys((k) => ({ ...k, anthropic: v }))}
          />
          <ApiKeyInput
            label="Google Gemini API Key"
            hasKey={adminSettings?.has_api_key_gemini ?? false}
            value={apiKeys.gemini}
            onChange={(v) => setApiKeys((k) => ({ ...k, gemini: v }))}
          />
        </section>
      )}

      {/* Job Search API Keys — admin only */}
      {isAdmin && (
        <section className="space-y-4 rounded-lg border border-border p-5">
          <h2 className="text-sm font-medium">Job Search API Keys</h2>

          <div className="grid grid-cols-2 gap-4">
            <ApiKeyInput
              label="Adzuna App ID"
              hasKey={adminSettings?.has_api_key_adzuna ?? false}
              value={apiKeys.adzuna_id}
              onChange={(v) => setApiKeys((k) => ({ ...k, adzuna_id: v }))}
            />
            <ApiKeyInput
              label="Adzuna App Key"
              hasKey={adminSettings?.has_api_key_adzuna ?? false}
              value={apiKeys.adzuna_key}
              onChange={(v) => setApiKeys((k) => ({ ...k, adzuna_key: v }))}
            />
          </div>
          <ApiKeyInput
            label="SerpAPI Key"
            hasKey={adminSettings?.has_api_key_serpapi ?? false}
            value={apiKeys.serpapi}
            onChange={(v) => setApiKeys((k) => ({ ...k, serpapi: v }))}
          />
          <ApiKeyInput
            label="JSearch (RapidAPI) Key"
            hasKey={adminSettings?.has_api_key_jsearch ?? false}
            value={apiKeys.jsearch}
            onChange={(v) => setApiKeys((k) => ({ ...k, jsearch: v }))}
          />
        </section>
      )}
    </div>
  );
}

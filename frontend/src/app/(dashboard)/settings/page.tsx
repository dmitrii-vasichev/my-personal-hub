"use client";

import { useState, KeyboardEvent } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useAuth } from "@/lib/auth";
import { GeneralTab } from "@/components/settings/general-tab";
import { AiApiKeysTab } from "@/components/settings/ai-api-keys-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { UserManagementTable } from "@/components/settings/user-management-table";
import { AiInstructionsTab } from "@/components/settings/ai-instructions-tab";
import { AiKnowledgeBaseTab } from "@/components/settings/ai-knowledge-base-tab";
import { TagsManagementTab } from "@/components/settings/tags-management-tab";
import type { UpdateSettingsInput } from "@/types/settings";

// Type guard for admin settings response
function hasApiKeys(s: unknown): s is {
  has_api_key_openai: boolean;
  has_api_key_anthropic: boolean;
  has_api_key_gemini: boolean;
  has_api_key_adzuna: boolean;
  has_api_key_serpapi: boolean;
  has_api_key_jsearch: boolean;
  has_google_client_id: boolean;
  has_google_client_secret: boolean;
  google_redirect_uri: string | null;
  google_drive_notes_folder_id: string | null;
  llm_provider: string;
} {
  return !!s && typeof s === "object" && "has_api_key_openai" in s;
}

const ADMIN_TABS = [
  { id: "general", label: "General" },
  { id: "tags", label: "Tags" },
  { id: "ai-keys", label: "AI & API Keys" },
  { id: "ai-instructions", label: "AI Instructions" },
  { id: "ai-kb", label: "AI Knowledge Base" },
  { id: "integrations", label: "Integrations" },
  { id: "users", label: "Users" },
] as const;

type TabId = (typeof ADMIN_TABS)[number]["id"];

// ── Shared sub-components ────────────────────────────────────────────────────

export function TagInput({
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
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
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

export function ApiKeyInput({
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
      <label className="text-xs uppercase text-muted-foreground font-medium">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={hasKey ? "••••••••••••••• (set)" : "Not configured"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-8 w-full rounded-lg border border-border bg-background px-3 pr-9 text-sm outline-none focus:border-accent transition-colors placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<TabId>("general");

  // General tab state
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [staleDays, setStaleDays] = useState("14");

  // AI & API Keys tab state
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

  // AI Instructions tab state
  const [instructions, setInstructions] = useState<Record<string, string>>({
    instruction_resume: "",
    instruction_ats_audit: "",
    instruction_gap_analysis: "",
    instruction_cover_letter: "",
  });

  // Integrations tab state
  const [googleKeys, setGoogleKeys] = useState({
    client_id: "",
    client_secret: "",
    redirect_uri: "",
  });
  const [notesFolderId, setNotesFolderId] = useState("");

  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    setTargetRoles(settings.target_roles ?? []);
    setExcludedCompanies(settings.excluded_companies ?? []);
    setLocation(settings.default_location ?? "");
    setMinScore(String(settings.min_match_score ?? 0));
    setStaleDays(String(settings.stale_threshold_days ?? 14));
    if (hasApiKeys(settings)) {
      setLlmProvider(settings.llm_provider ?? "openai");
      setGoogleKeys((k) => ({
        ...k,
        redirect_uri: settings.google_redirect_uri ?? "",
      }));
      setNotesFolderId(settings.google_drive_notes_folder_id ?? "");
      setInstructions({
        instruction_resume: settings.instruction_resume ?? "",
        instruction_ats_audit: settings.instruction_ats_audit ?? "",
        instruction_gap_analysis: settings.instruction_gap_analysis ?? "",
        instruction_cover_letter: settings.instruction_cover_letter ?? "",
      });
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
      if (googleKeys.client_id) payload.google_client_id = googleKeys.client_id;
      if (googleKeys.client_secret) payload.google_client_secret = googleKeys.client_secret;
      if (googleKeys.redirect_uri) payload.google_redirect_uri = googleKeys.redirect_uri;
      if (notesFolderId) payload.google_drive_notes_folder_id = notesFolderId;
      payload.instruction_resume = instructions.instruction_resume || undefined;
      payload.instruction_ats_audit = instructions.instruction_ats_audit || undefined;
      payload.instruction_gap_analysis = instructions.instruction_gap_analysis || undefined;
      payload.instruction_cover_letter = instructions.instruction_cover_letter || undefined;
    }

    try {
      await update.mutateAsync(payload);
      if (isAdmin) {
        setApiKeys({ openai: "", anthropic: "", gemini: "", adzuna_id: "", adzuna_key: "", serpapi: "", jsearch: "" });
        setGoogleKeys((k) => ({ ...k, client_id: "", client_secret: "" }));
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
  const visibleTabs = isAdmin ? ADMIN_TABS : ADMIN_TABS.filter((t) => t.id === "general" || t.id === "tags");

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <Button size="sm" onClick={handleSave} disabled={update.isPending}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Tabs — only show if more than one tab */}
      {visibleTabs.length > 1 && (
        <div className="flex gap-1 border-b border-border">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-foreground rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {activeTab === "general" && (
        <GeneralTab
          targetRoles={targetRoles}
          setTargetRoles={setTargetRoles}
          excludedCompanies={excludedCompanies}
          setExcludedCompanies={setExcludedCompanies}
          location={location}
          setLocation={setLocation}
          minScore={minScore}
          setMinScore={setMinScore}
          staleDays={staleDays}
          setStaleDays={setStaleDays}
        />
      )}

      {activeTab === "tags" && <TagsManagementTab />}

      {activeTab === "ai-keys" && isAdmin && (
        <AiApiKeysTab
          llmProvider={llmProvider}
          setLlmProvider={setLlmProvider}
          apiKeys={apiKeys}
          setApiKeys={setApiKeys}
          adminSettings={adminSettings}
        />
      )}

      {activeTab === "ai-instructions" && isAdmin && (
        <AiInstructionsTab
          instructions={instructions}
          setInstructions={setInstructions}
        />
      )}

      {activeTab === "ai-kb" && isAdmin && (
        <AiKnowledgeBaseTab />
      )}

      {activeTab === "integrations" && isAdmin && (
        <IntegrationsTab
          googleKeys={googleKeys}
          setGoogleKeys={setGoogleKeys}
          adminSettings={adminSettings}
          notesFolderId={notesFolderId}
          setNotesFolderId={setNotesFolderId}
        />
      )}

      {activeTab === "users" && isAdmin && (
        <section className="space-y-4 rounded-lg border border-border p-5">
          <UserManagementTable />
        </section>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
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
import { TelegramTab } from "@/components/settings/telegram-tab";
import { PulseSettingsTab } from "@/components/settings/pulse-settings-tab";
import { RemindersSettingsTab } from "@/components/settings/reminders-settings-tab";
import { GarminSettingsTab } from "@/components/settings/garmin-tab";
import { ApiTokensTab } from "@/components/settings/api-tokens-tab";
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
  { id: "api-tokens", label: "API Tokens" },
  { id: "tags", label: "Tags" },
  { id: "ai-keys", label: "AI & API Keys" },
  { id: "ai-instructions", label: "AI Instructions" },
  { id: "ai-kb", label: "AI Knowledge Base" },
  { id: "integrations", label: "Integrations" },
  { id: "telegram", label: "Telegram" },
  { id: "pulse", label: "Pulse" },
  { id: "reminders", label: "Actions" },
  { id: "garmin", label: "Garmin" },
  { id: "users", label: "Users" },
] as const;

type TabId = (typeof ADMIN_TABS)[number]["id"];

// ── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const { user, isDemo } = useAuth();

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
  const visibleTabs =
    isAdmin && !isDemo
      ? ADMIN_TABS
      : ADMIN_TABS.filter((t) => t.id === "general" || t.id === "tags" || t.id === "api-tokens");

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <Button size="sm" onClick={handleSave} disabled={update.isPending}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Tabs — full width, horizontal scroll */}
      {visibleTabs.length > 1 && (
        <div className="overflow-x-auto border-b border-border">
          <div className="flex gap-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors relative ${
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
        </div>
      )}

      {/* Tab content */}
      <div className="mx-auto max-w-2xl">
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

        {activeTab === "api-tokens" && <ApiTokensTab />}

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

        {activeTab === "telegram" && isAdmin && <TelegramTab />}

        {activeTab === "pulse" && isAdmin && <PulseSettingsTab />}

        {activeTab === "reminders" && isAdmin && <RemindersSettingsTab />}

        {activeTab === "garmin" && isAdmin && <GarminSettingsTab />}

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
    </div>
  );
}

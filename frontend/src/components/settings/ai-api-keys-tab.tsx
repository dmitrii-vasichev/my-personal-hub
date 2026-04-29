"use client";

import { Label } from "@/components/ui/label";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { ApiKeyInput } from "@/components/settings/shared-inputs";

const LLM_PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
};

interface AdminSettings {
  has_api_key_openai: boolean;
  has_api_key_anthropic: boolean;
  has_api_key_gemini: boolean;
  has_api_key_adzuna: boolean;
  has_api_key_serpapi: boolean;
  has_api_key_jsearch: boolean;
}

interface ApiKeysState {
  openai: string;
  anthropic: string;
  gemini: string;
  adzuna_id: string;
  adzuna_key: string;
  serpapi: string;
  jsearch: string;
}

interface AiApiKeysTabProps {
  llmProvider: string;
  setLlmProvider: React.Dispatch<React.SetStateAction<string>>;
  apiKeys: ApiKeysState;
  setApiKeys: React.Dispatch<React.SetStateAction<ApiKeysState>>;
  adminSettings: AdminSettings | null;
}

export function AiApiKeysTab({
  llmProvider,
  setLlmProvider,
  apiKeys,
  setApiKeys,
  adminSettings,
}: AiApiKeysTabProps) {
  return (
    <div className="space-y-6">
      {/* AI Provider */}
      <section className="space-y-4 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">AI Provider</h2>

        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Default LLM Provider</Label>
          <SelectRoot
            value={llmProvider}
            onValueChange={setLlmProvider}
            labels={LLM_PROVIDER_LABELS}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
            </SelectPopup>
          </SelectRoot>
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

      {/* Job Search API Keys */}
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
    </div>
  );
}

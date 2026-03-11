"use client";

import { Calendar, ExternalLink, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiKeyInput } from "@/app/(dashboard)/settings/page";

interface AdminSettings {
  has_google_client_id: boolean;
  has_google_client_secret: boolean;
  google_redirect_uri: string | null;
  google_drive_notes_folder_id: string | null;
}

interface GoogleKeysState {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

interface IntegrationsTabProps {
  googleKeys: GoogleKeysState;
  setGoogleKeys: React.Dispatch<React.SetStateAction<GoogleKeysState>>;
  adminSettings: AdminSettings | null;
  notesFolderId: string;
  setNotesFolderId: (value: string) => void;
}

export function IntegrationsTab({
  googleKeys,
  setGoogleKeys,
  adminSettings,
  notesFolderId,
  setNotesFolderId,
}: IntegrationsTabProps) {
  const isConfigured =
    adminSettings?.has_google_client_id && adminSettings?.has_google_client_secret;
  const isFolderConfigured = !!(notesFolderId || adminSettings?.google_drive_notes_folder_id);

  return (
    <div className="space-y-6">
      {/* Google Calendar */}
      <section className="space-y-4 rounded-lg border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Google Calendar</h2>
          </div>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
              isConfigured
                ? "bg-success/10 text-success border border-success/20"
                : "bg-surface-2 text-muted-foreground border border-border"
            }`}
          >
            {isConfigured ? "✓ Configured" : "Not configured"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Connect Google Calendar to sync events. You need OAuth 2.0 credentials from the{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline inline-flex items-center gap-0.5"
          >
            Google Cloud Console
            <ExternalLink className="h-3 w-3" />
          </a>
          .
        </p>

        <ApiKeyInput
          label="Client ID"
          hasKey={adminSettings?.has_google_client_id ?? false}
          value={googleKeys.client_id}
          onChange={(v) => setGoogleKeys((k) => ({ ...k, client_id: v }))}
        />

        <ApiKeyInput
          label="Client Secret"
          hasKey={adminSettings?.has_google_client_secret ?? false}
          value={googleKeys.client_secret}
          onChange={(v) => setGoogleKeys((k) => ({ ...k, client_secret: v }))}
        />

        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Redirect URI</Label>
          <Input
            value={googleKeys.redirect_uri}
            onChange={(e) => setGoogleKeys((k) => ({ ...k, redirect_uri: e.target.value }))}
            placeholder="http://localhost:8000/api/calendar/oauth/callback"
            className="text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Must match the authorized redirect URI in your Google Cloud project.
          </p>
        </div>
      </section>

      {/* Google Drive — Notes Folder */}
      <section className="space-y-4 rounded-lg border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Google Drive — Notes Folder</h2>
          </div>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
              isFolderConfigured
                ? "bg-success/10 text-success border border-success/20"
                : "bg-surface-2 text-muted-foreground border border-border"
            }`}
          >
            {isFolderConfigured ? "✓ Configured" : "Not configured"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Specify the Google Drive folder that contains your Markdown notes. The folder
          ID is the last segment of the folder URL (e.g.,{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px] font-mono">
            1aBcDeFgHiJkLmNoPqRsTuVwXyZ
          </code>
          ).
        </p>

        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Folder ID
          </Label>
          <Input
            value={notesFolderId}
            onChange={(e) => setNotesFolderId(e.target.value)}
            placeholder={
              adminSettings?.google_drive_notes_folder_id
                ? adminSettings.google_drive_notes_folder_id
                : "Paste Google Drive folder ID"
            }
            className="text-sm font-mono"
          />
        </div>
      </section>
    </div>
  );
}

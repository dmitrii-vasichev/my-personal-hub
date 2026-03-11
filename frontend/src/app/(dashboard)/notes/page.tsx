"use client";

import { useState } from "react";
import { RefreshCw, FileText, AlertCircle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteTree } from "@/components/notes/note-tree";
import { NoteViewer } from "@/components/notes/note-viewer";
import { NoteBreadcrumb } from "@/components/notes/note-breadcrumb";
import { useNotesTree, useNoteContent, useRefreshNotesTree } from "@/hooks/use-notes";
import { useSettings } from "@/hooks/use-settings";
import { useGoogleOAuthStatus } from "@/hooks/use-calendar";
import Link from "next/link";

export default function NotesPage() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: oauthStatus, isLoading: oauthLoading } = useGoogleOAuthStatus();
  const { data: tree, isLoading: treeLoading, error: treeError } = useNotesTree();
  const { data: content, isLoading: contentLoading, error: contentError } = useNoteContent(selectedFileId);
  const refreshTree = useRefreshNotesTree();

  const handleSelectFile = (fileId: string, filePath: string) => {
    setSelectedFileId(fileId);
    setSelectedFilePath(filePath);
  };

  const isGoogleConnected = oauthStatus?.connected === true;
  const hasFolderConfigured = !!settings?.google_drive_notes_folder_id;

  if (settingsLoading || oauthLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Notes</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="size-5 animate-spin text-[var(--text-tertiary)]" />
        </div>
      </div>
    );
  }

  if (!isGoogleConnected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Notes</h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <AlertCircle className="size-10 text-[var(--accent-amber)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Google Account Not Connected
          </h2>
          <p className="max-w-md text-sm text-[var(--text-secondary)]">
            Connect your Google account in the Calendar page to enable Google Drive
            access for Notes.
          </p>
          <Link href="/calendar">
            <Button size="sm">Go to Calendar</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!hasFolderConfigured) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Notes</h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <FolderOpen className="size-10 text-[var(--accent-amber)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Notes Folder Not Configured
          </h2>
          <p className="max-w-md text-sm text-[var(--text-secondary)]">
            Set your Google Drive notes folder ID in Settings &rarr; Integrations to
            start browsing your notes.
          </p>
          <Link href="/settings">
            <Button size="sm">Go to Settings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Notes</h1>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refreshTree.mutate()}
          disabled={refreshTree.isPending}
        >
          <RefreshCw
            className={`size-4 ${refreshTree.isPending ? "animate-spin" : ""}`}
          />
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Tree panel */}
        <div className="h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {treeLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="size-4 animate-spin text-[var(--text-tertiary)]" />
            </div>
          ) : treeError ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <AlertCircle className="size-5 text-[var(--danger)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                Failed to load notes tree
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refreshTree.mutate()}
              >
                Retry
              </Button>
            </div>
          ) : tree ? (
            tree.children && tree.children.length > 0 ? (
              <NoteTree
                tree={tree}
                selectedFileId={selectedFileId}
                onSelectFile={handleSelectFile}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <FolderOpen className="size-5 text-[var(--text-tertiary)]" />
                <p className="text-sm text-[var(--text-secondary)]">
                  No notes found in the configured folder
                </p>
              </div>
            )
          ) : null}
        </div>

        {/* Content panel */}
        <div className="h-[calc(100vh-180px)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          {selectedFileId ? (
            <>
              {selectedFilePath && (
                <div className="mb-4 border-b border-[var(--border)] pb-3">
                  <NoteBreadcrumb path={selectedFilePath} />
                </div>
              )}
              {contentLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="size-4 animate-spin text-[var(--text-tertiary)]" />
                </div>
              ) : contentError ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertCircle className="size-5 text-[var(--danger)]" />
                  <p className="text-sm text-[var(--text-secondary)]">
                    Failed to load note content
                  </p>
                </div>
              ) : content ? (
                <NoteViewer content={content} />
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <FileText className="size-8 text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                Select a file from the tree to view its content
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, FileText, AlertCircle, FolderOpen, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteTree } from "@/components/notes/note-tree";
import { NoteViewer } from "@/components/notes/note-viewer";
import { NoteBreadcrumb } from "@/components/notes/note-breadcrumb";
import { useNotesTree, useNoteContent, useRefreshNotesTree } from "@/hooks/use-notes";
import type { NoteTreeNode } from "@/types/note";
import { useSettings } from "@/hooks/use-settings";
import { useGoogleOAuthStatus } from "@/hooks/use-calendar";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

function findFileInTree(
  node: NoteTreeNode,
  fileId: string,
  parentPath: string
): string | null {
  const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
  if (node.type === "file" && node.google_file_id === fileId) return currentPath;
  if (node.children) {
    for (const child of node.children) {
      const found = findFileInTree(child, fileId, currentPath);
      if (found) return found;
    }
  }
  return null;
}

export default function NotesPage() {
  const searchParams = useSearchParams();
  const { isDemo } = useAuth();
  const fileParam = searchParams.get("file");

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [urlParamApplied, setUrlParamApplied] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: oauthStatus, isLoading: oauthLoading } = useGoogleOAuthStatus();

  const isGoogleConnected = isDemo || oauthStatus?.connected === true;
  const hasFolderConfigured = isDemo || !!settings?.google_drive_notes_folder_id;
  const readyToFetch = isDemo || (!settingsLoading && !oauthLoading && isGoogleConnected && hasFolderConfigured);

  const { data: treeResponse, isLoading: treeLoading, error: treeError, refetch: refetchTree } = useNotesTree(readyToFetch);
  const treeNodes = treeResponse?.tree ?? [];
  const { data: content, isLoading: contentLoading, error: contentError } = useNoteContent(selectedFileId);
  const refreshTree = useRefreshNotesTree();

  // Auto-select file from URL ?file= parameter (deep links)
  if (treeNodes.length > 0 && fileParam && urlParamApplied !== fileParam) {
    let filePath: string | null = null;
    for (const node of treeNodes) {
      filePath = findFileInTree(node, fileParam, "");
      if (filePath) break;
    }
    if (filePath) {
      setSelectedFileId(fileParam);
      setSelectedFilePath(filePath);
    }
    setUrlParamApplied(fileParam);
  }

  const handleSelectFile = (fileId: string, filePath: string) => {
    setSelectedFileId(fileId);
    setSelectedFilePath(filePath);
  };

  // Escape exits expanded mode
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  if (!isDemo && (settingsLoading || oauthLoading)) {
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
        {!isDemo && (
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
        )}
      </div>

      {/* Two-panel layout */}
      <div className={`grid gap-4 transition-[grid-template-columns] duration-300 ease-in-out ${isExpanded ? "grid-cols-1" : "lg:grid-cols-[300px_1fr]"}`}>
        {/* Tree panel */}
        <div className={`h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-all duration-300 ease-in-out ${isExpanded ? "hidden" : ""}`}>
          {treeLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="size-4 animate-spin text-[var(--text-tertiary)]" />
            </div>
          ) : treeError ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <AlertCircle className="size-5 text-[var(--danger)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                {treeError instanceof Error ? treeError.message : "Failed to load notes tree"}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetchTree()}
              >
                Retry
              </Button>
            </div>
          ) : treeNodes.length > 0 ? (
            <NoteTree
              tree={treeNodes}
              selectedFileId={selectedFileId}
              onSelectFile={handleSelectFile}
              autoExpandFileId={selectedFileId}
            />
          ) : treeResponse ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <FolderOpen className="size-5 text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                No notes found in the configured folder
              </p>
            </div>
          ) : null}
        </div>

        {/* Content panel */}
        <div className="flex h-[calc(100vh-180px)] flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {selectedFileId ? (
            <>
              {selectedFilePath && (
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <NoteBreadcrumb path={selectedFilePath} />
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8 shrink-0"
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? "Collapse (Esc)" : "Expand"}
                    data-testid="note-expand-toggle"
                  >
                    {isExpanded ? (
                      <Minimize2 className="size-4" />
                    ) : (
                      <Maximize2 className="size-4" />
                    )}
                  </Button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-6">
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
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
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

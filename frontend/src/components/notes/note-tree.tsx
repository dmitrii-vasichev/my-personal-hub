"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Folder,
  FolderOpen,
  FileText,
} from "lucide-react";
import type { NoteTreeNode } from "@/types/note";
import { cn } from "@/lib/utils";

interface NoteTreeProps {
  tree: NoteTreeNode[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string, filePath: string) => void;
  autoExpandFileId?: string | null;
}

function sortNodes(nodes: NoteTreeNode[]): NoteTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function buildPath(parentPath: string, name: string): string {
  return parentPath ? `${parentPath}/${name}` : name;
}

function containsFile(node: NoteTreeNode, fileId: string): boolean {
  if (node.google_file_id === fileId) return true;
  if (node.children) {
    return node.children.some((child) => containsFile(child, fileId));
  }
  return false;
}

interface TreeNodeProps {
  node: NoteTreeNode;
  depth: number;
  parentPath: string;
  selectedFileId: string | null;
  onSelectFile: (fileId: string, filePath: string) => void;
  defaultExpanded?: boolean;
  autoExpandFileId?: string | null;
}

function TreeNode({
  node,
  depth,
  parentPath,
  selectedFileId,
  onSelectFile,
  defaultExpanded = false,
  autoExpandFileId,
}: TreeNodeProps) {
  const shouldAutoExpand =
    defaultExpanded ||
    (!!autoExpandFileId &&
      node.type === "folder" &&
      containsFile(node, autoExpandFileId));
  const [expanded, setExpanded] = useState(shouldAutoExpand);
  const currentPath = buildPath(parentPath, node.name);
  const isSelected = node.google_file_id === selectedFileId;

  const sortedChildren = useMemo(
    () => (node.children ? sortNodes(node.children) : []),
    [node.children]
  );

  const handleClick = useCallback(() => {
    if (node.type === "folder") {
      setExpanded((prev) => !prev);
    } else {
      onSelectFile(node.google_file_id, currentPath);
    }
  }, [node.type, node.google_file_id, currentPath, onSelectFile]);

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
          "hover:bg-[var(--surface-hover)]",
          isSelected &&
            "bg-[rgba(79,142,247,0.1)] text-[var(--accent)] dark:bg-[rgba(79,142,247,0.1)]",
          !isSelected && "text-[var(--text-secondary)]"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.type === "folder" ? (
          <>
            {expanded ? (
              <ChevronDown className="size-4 shrink-0 opacity-60" />
            ) : (
              <ChevronRight className="size-4 shrink-0 opacity-60" />
            )}
            {expanded ? (
              <FolderOpen className="size-4 shrink-0 text-[var(--accent-amber)]" />
            ) : (
              <Folder className="size-4 shrink-0 text-[var(--accent-amber)]" />
            )}
          </>
        ) : (
          <>
            <span className="size-4 shrink-0" />
            <FileText className="size-4 shrink-0 opacity-60" />
          </>
        )}
        <span className="truncate text-left">{node.name}</span>
      </button>

      {node.type === "folder" && expanded && sortedChildren.length > 0 && (
        <div>
          {sortedChildren.map((child) => (
            <TreeNode
              key={child.google_file_id}
              node={child}
              depth={depth + 1}
              parentPath={currentPath}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
              autoExpandFileId={autoExpandFileId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function NoteTree({ tree, selectedFileId, onSelectFile, autoExpandFileId }: NoteTreeProps) {
  const [allExpanded, setAllExpanded] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const sortedChildren = useMemo(
    () => sortNodes(tree),
    [tree]
  );

  const toggleAll = useCallback(() => {
    setAllExpanded((prev) => !prev);
    setResetKey((prev) => prev + 1);
  }, []);

  return (
    <div className="flex h-full flex-col" data-testid="note-tree">
      <div className="flex items-center justify-end px-2 pt-1.5">
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
          title={allExpanded ? "Collapse all" : "Expand all"}
        >
          <ChevronsUpDown className="size-3.5" />
          <span>{allExpanded ? "Collapse" : "Expand"}</span>
        </button>
      </div>
      <div className="overflow-y-auto py-1">
        {sortedChildren.map((child) => (
          <TreeNode
            key={`${child.google_file_id}-${resetKey}`}
            node={child}
            depth={0}
            parentPath=""
            selectedFileId={selectedFileId}
            onSelectFile={onSelectFile}
            defaultExpanded={allExpanded}
            autoExpandFileId={autoExpandFileId}
          />
        ))}
      </div>
    </div>
  );
}

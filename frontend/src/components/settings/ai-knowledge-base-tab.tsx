"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  RotateCcw,
  Trash2,
  Save,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useKBDocuments,
  useUpdateKBDocument,
  useCreateKBDocument,
  useDeleteKBDocument,
  useResetKBDocument,
} from "@/hooks/use-knowledge-base";
import type { KBDocument } from "@/types/knowledge-base";

const USED_BY_OPTIONS = [
  { value: "resume_generation", label: "Resume Generation" },
  { value: "ats_audit", label: "ATS Audit" },
  { value: "gap_analysis", label: "Gap Analysis" },
  { value: "cover_letter", label: "Cover Letter" },
];

function DocumentList({
  documents,
  onSelect,
  onAdd,
}: {
  documents: KBDocument[];
  onSelect: (doc: KBDocument) => void;
  onAdd: () => void;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">AI Knowledge Base</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Documents that AI uses as context for generating content.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add document
        </Button>
      </div>

      <div className="space-y-2">
        {documents.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => onSelect(doc)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-[var(--background)] p-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{doc.title}</span>
                {doc.is_default && (
                  <span
                    className="inline-flex rounded-[6px] px-1.5 py-0.5 font-mono text-[10px]"
                    style={{
                      background: "rgba(79,142,247,0.08)",
                      color: "var(--accent)",
                      border: "1px solid rgba(79,142,247,0.18)",
                    }}
                  >
                    default
                  </span>
                )}
              </div>
              {doc.used_by.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {doc.used_by.map((u) => (
                    <span
                      key={u}
                      className="rounded-[6px] px-1.5 py-0.5 font-mono text-[10px]"
                      style={{
                        background: "rgba(45,212,191,0.08)",
                        color: "var(--accent-teal)",
                        border: "1px solid rgba(45,212,191,0.18)",
                      }}
                    >
                      {u.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(doc.updated_at).toLocaleDateString()}
            </span>
          </button>
        ))}
        {documents.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No documents yet.
          </p>
        )}
      </div>
    </section>
  );
}

function DocumentEditor({
  document,
  onBack,
}: {
  document: KBDocument | null;
  onBack: () => void;
}) {
  const isNew = !document;
  const [slug, setSlug] = useState(document?.slug ?? "");
  const [title, setTitle] = useState(document?.title ?? "");
  const [content, setContent] = useState(document?.content ?? "");
  const [usedBy, setUsedBy] = useState<string[]>(document?.used_by ?? []);

  const updateDoc = useUpdateKBDocument();
  const createDoc = useCreateKBDocument();
  const deleteDoc = useDeleteKBDocument();
  const resetDoc = useResetKBDocument();

  const isPending =
    updateDoc.isPending ||
    createDoc.isPending ||
    deleteDoc.isPending ||
    resetDoc.isPending;

  const toggleUsedBy = (value: string) => {
    setUsedBy((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      if (isNew) {
        if (!slug.trim()) {
          toast.error("Slug is required");
          return;
        }
        await createDoc.mutateAsync({
          slug: slug.trim(),
          title: title.trim(),
          content,
          used_by: usedBy,
        });
        toast.success("Document created");
      } else {
        await updateDoc.mutateAsync({
          slug: document.slug,
          data: { title: title.trim(), content, used_by: usedBy },
        });
        toast.success("Document saved");
      }
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleDelete = async () => {
    if (!document) return;
    try {
      await deleteDoc.mutateAsync(document.slug);
      toast.success("Document deleted");
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleReset = async () => {
    if (!document) return;
    try {
      await resetDoc.mutateAsync(document.slug);
      toast.success("Document reset to default");
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset");
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-border p-5">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-medium">
          {isNew ? "New Document" : document.title}
        </h2>
      </div>

      <div className="space-y-4">
        {isNew && (
          <div className="space-y-1">
            <Label className="text-xs font-medium uppercase text-muted-foreground">
              Slug
            </Label>
            <Input
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-_]/g, "-")
                )
              }
              placeholder="document-slug"
              className="text-sm"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs font-medium uppercase text-muted-foreground">
            Title
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="text-sm"
            disabled={!isNew && document?.is_default}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium uppercase text-muted-foreground">
            Content (Markdown)
          </Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Document content in Markdown..."
            rows={16}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase text-muted-foreground">
            Used By
          </Label>
          <div className="flex flex-wrap gap-2">
            {USED_BY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5 text-xs transition-colors"
                style={{
                  background: usedBy.includes(opt.value)
                    ? "rgba(79,142,247,0.08)"
                    : "transparent",
                  borderColor: usedBy.includes(opt.value)
                    ? "rgba(79,142,247,0.3)"
                    : "var(--border)",
                  color: usedBy.includes(opt.value)
                    ? "var(--accent)"
                    : "var(--text-secondary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={usedBy.includes(opt.value)}
                  onChange={() => toggleUsedBy(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Save
        </Button>

        {!isNew && document.is_default && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={isPending}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset to default
          </Button>
        )}

        {!isNew && !document.is_default && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
    </section>
  );
}

export function AiKnowledgeBaseTab() {
  const { data: documents, isLoading } = useKBDocuments();
  const [view, setView] = useState<"list" | "editor">("list");
  const [selectedDoc, setSelectedDoc] = useState<KBDocument | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Loading documents...
      </div>
    );
  }

  if (view === "editor") {
    return (
      <DocumentEditor
        document={selectedDoc}
        onBack={() => {
          setView("list");
          setSelectedDoc(null);
        }}
      />
    );
  }

  return (
    <DocumentList
      documents={documents ?? []}
      onSelect={(doc) => {
        setSelectedDoc(doc);
        setView("editor");
      }}
      onAdd={() => {
        setSelectedDoc(null);
        setView("editor");
      }}
    />
  );
}

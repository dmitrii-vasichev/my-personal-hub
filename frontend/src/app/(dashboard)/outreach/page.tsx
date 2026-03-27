"use client";

import { Suspense, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadFiltersBar } from "@/components/outreach/lead-filters";
import { LeadsTable } from "@/components/outreach/leads-table";
import { LeadDialog } from "@/components/outreach/lead-dialog";
import { LeadDetailDialog } from "@/components/outreach/lead-detail-dialog";
import { OutreachKanban } from "@/components/outreach/outreach-kanban";
import { OutreachViewToggle, type OutreachViewMode } from "@/components/outreach/view-toggle";
import { PdfUploadDialog } from "@/components/outreach/pdf-upload-dialog";
import { PdfPreviewDialog } from "@/components/outreach/pdf-preview-dialog";
import { IndustryManager } from "@/components/outreach/industry-manager";
import { OutreachAnalytics } from "@/components/outreach/outreach-analytics";
import { useLeads, useLead } from "@/hooks/use-leads";
import type { Lead, LeadFilters, ParsedLead, PdfParseError } from "@/types/lead";

type PageTab = "leads" | "industries" | "analytics";

function OutreachPageInner() {
  const [activeTab, setActiveTab] = useState<PageTab>("leads");
  const [viewMode, setViewMode] = useState<OutreachViewMode>("table");
  const [filters, setFilters] = useState<LeadFilters>({});

  // Lead create/edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>();

  // Lead detail dialog
  const [detailLeadId, setDetailLeadId] = useState<number | null>(null);
  const { data: detailLead } = useLead(detailLeadId ?? 0);

  // PDF flow state
  const [pdfUploadOpen, setPdfUploadOpen] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [parseErrors, setParseErrors] = useState<PdfParseError[]>([]);
  const [parsedTotalPages, setParsedTotalPages] = useState(0);
  const [parsedFilename, setParsedFilename] = useState("");

  const { data: leads = [], isLoading, error } = useLeads(filters);

  // Click on lead in table → open detail
  const handleLeadClick = (lead: Lead) => {
    setDetailLeadId(lead.id);
  };

  // Click on card in kanban → open detail
  const handleCardClick = (cardId: number) => {
    setDetailLeadId(cardId);
  };

  // From detail → open edit dialog
  const handleEditFromDetail = () => {
    if (detailLead) {
      setDetailLeadId(null);
      setEditingLead(detailLead);
      setEditDialogOpen(true);
    }
  };

  const handlePdfParsed = (
    result: { total_pages: number; leads: ParsedLead[]; errors: PdfParseError[] },
    filename: string
  ) => {
    setParsedLeads(result.leads);
    setParseErrors(result.errors);
    setParsedTotalPages(result.total_pages);
    setParsedFilename(filename);
    setPdfPreviewOpen(true);
  };

  const tabs: { id: PageTab; label: string }[] = [
    { id: "leads", label: "Leads" },
    { id: "industries", label: "Industries" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Outreach</h1>
        {activeTab === "leads" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPdfUploadOpen(true)}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Upload PDF
            </Button>
            <Button
              size="sm"
              onClick={() => { setEditingLead(undefined); setEditDialogOpen(true); }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 border-b border-[var(--border)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[var(--accent)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "leads" && (
          <OutreachViewToggle value={viewMode} onChange={setViewMode} />
        )}
      </div>

      {/* Tab content */}
      {activeTab === "leads" && (
        <>
          {/* Filter bar */}
          <LeadFiltersBar filters={filters} onFiltersChange={setFilters} />

          {/* Content — table or kanban */}
          <div className="flex-1 overflow-auto">
            {viewMode === "table" ? (
              <LeadsTable
                leads={leads}
                isLoading={isLoading}
                error={error as Error | null}
                onLeadClick={handleLeadClick}
              />
            ) : (
              <OutreachKanban onCardClick={handleCardClick} />
            )}
          </div>
        </>
      )}

      {activeTab === "industries" && <IndustryManager />}

      {activeTab === "analytics" && <OutreachAnalytics />}

      {/* Lead create/edit dialog */}
      <LeadDialog
        key={editingLead?.id ?? "create"}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode={editingLead ? "edit" : "create"}
        lead={editingLead}
        onSuccess={() => {
          setEditDialogOpen(false);
          setEditingLead(undefined);
        }}
      />

      {/* Lead detail dialog */}
      {detailLead && (
        <LeadDetailDialog
          key={detailLead.id}
          open={!!detailLeadId}
          onOpenChange={(open) => { if (!open) setDetailLeadId(null); }}
          lead={detailLead}
          onEdit={handleEditFromDetail}
        />
      )}

      <PdfUploadDialog
        open={pdfUploadOpen}
        onOpenChange={setPdfUploadOpen}
        onParsed={handlePdfParsed}
      />

      <PdfPreviewDialog
        key={parsedFilename}
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        leads={parsedLeads}
        errors={parseErrors}
        totalPages={parsedTotalPages}
        filename={parsedFilename}
      />
    </div>
  );
}

export default function OutreachPage() {
  return (
    <Suspense fallback={null}>
      <OutreachPageInner />
    </Suspense>
  );
}

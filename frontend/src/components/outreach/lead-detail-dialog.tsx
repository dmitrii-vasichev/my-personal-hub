"use client";

import { useState } from "react";
import {
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  Pencil,
  Phone,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProposalSection } from "@/components/outreach/proposal-section";
import { useLeadStatusHistory, useChangeLeadStatus } from "@/hooks/use-leads";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_BG_COLORS,
} from "@/types/lead";
import type { Lead, LeadStatus } from "@/types/lead";

interface LeadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onEdit?: () => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Status selector ─────────────────────────────────────────────────────────

const ALL_STATUSES: LeadStatus[] = [
  "new",
  "sent",
  "replied",
  "in_progress",
  "rejected",
  "on_hold",
];

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        color: LEAD_STATUS_COLORS[status],
        backgroundColor: LEAD_STATUS_BG_COLORS[status],
      }}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}

function StatusSelector({ lead }: { lead: Lead }) {
  const changeStatus = useChangeLeadStatus();
  const [open, setOpen] = useState(false);

  const handleChange = (newStatus: LeadStatus) => {
    if (newStatus === lead.status) {
      setOpen(false);
      return;
    }
    changeStatus.mutate(
      { id: lead.id, data: { new_status: newStatus } },
      { onSuccess: () => setOpen(false) }
    );
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="group flex items-center gap-1.5">
        <StatusBadge status={lead.status} />
        <Pencil className="h-3 w-3 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {ALL_STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => handleChange(s)}
          disabled={changeStatus.isPending}
          className={`rounded-md px-2 py-0.5 text-xs font-medium transition-opacity ${
            s === lead.status ? "ring-1 ring-[var(--text-tertiary)]" : "opacity-60 hover:opacity-100"
          }`}
          style={{
            color: LEAD_STATUS_COLORS[s],
            backgroundColor: LEAD_STATUS_BG_COLORS[s],
          }}
        >
          {LEAD_STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

// ── Info row helper ─────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
          {label}
        </span>
        <span className="text-sm text-[var(--text-primary)]">{children}</span>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function LeadDetailDialog({
  open,
  onOpenChange,
  lead,
  onEdit,
}: LeadDetailDialogProps) {
  const { data: history = [] } = useLeadStatusHistory(lead.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogClose />

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex-1">
              <DialogTitle className="text-lg">
                {lead.business_name}
              </DialogTitle>
              {lead.industry && (
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  {lead.industry.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5 h-7 text-xs">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Status + meta */}
            <div className="flex items-center justify-between">
              <StatusSelector lead={lead} />
              <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(lead.created_at)}
                </span>
                <span className="capitalize px-1.5 py-0.5 rounded bg-[var(--surface-secondary)] text-[10px]">
                  {lead.source}
                </span>
              </div>
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-3">
              {lead.contact_person && (
                <InfoRow icon={User} label="Contact">{lead.contact_person}</InfoRow>
              )}
              {lead.email && (
                <InfoRow icon={Mail} label="Email">
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-[var(--accent-foreground)] hover:underline"
                  >
                    {lead.email}
                  </a>
                </InfoRow>
              )}
              {lead.phone && (
                <InfoRow icon={Phone} label="Phone">{lead.phone}</InfoRow>
              )}
              {lead.website && (
                <InfoRow icon={Globe} label="Website">
                  <a
                    href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--accent-foreground)] hover:underline"
                  >
                    {lead.website.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </InfoRow>
              )}
            </div>

            {/* Service description */}
            {lead.service_description && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    Services
                  </span>
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                  {lead.service_description}
                </p>
              </div>
            )}

            {/* Notes */}
            {lead.notes && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                  Notes
                </span>
                <p className="text-sm text-[var(--text-secondary)] mt-1 whitespace-pre-wrap">
                  {lead.notes}
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* Proposal */}
            <ProposalSection lead={lead} />

            {/* Status history */}
            {history.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                  Status History
                </h3>
                <div className="flex flex-col gap-2">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="text-[var(--text-tertiary)] w-[140px] shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(entry.changed_at)}
                      </span>
                      {entry.old_status ? (
                        <span className="text-[var(--text-secondary)]">
                          <StatusBadge status={entry.old_status as LeadStatus} />
                          {" → "}
                          <StatusBadge status={entry.new_status as LeadStatus} />
                        </span>
                      ) : (
                        <span className="text-[var(--text-secondary)]">
                          Created as <StatusBadge status={entry.new_status as LeadStatus} />
                        </span>
                      )}
                      {entry.comment && (
                        <span className="text-[var(--text-tertiary)] italic">
                          {entry.comment}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

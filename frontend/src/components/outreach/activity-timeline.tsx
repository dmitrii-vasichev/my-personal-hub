"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Mail,
  MailOpen,
  MessageSquare,
  Phone,
  PhoneIncoming,
  RefreshCw,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLeadActivities, useCreateActivity, useDeleteActivity, useSendEmail, useGmailStatus, useCheckReplies } from "@/hooks/use-leads";
import type { ActivityType, LeadActivity } from "@/types/lead";
import { ACTIVITY_TYPE_LABELS } from "@/types/lead";

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  outbound_email: Send,
  inbound_email: MailOpen,
  proposal_sent: Mail,
  note: MessageSquare,
  outbound_call: Phone,
  inbound_call: PhoneIncoming,
  meeting: Users,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  outbound_email: "var(--primary)",
  inbound_email: "var(--success, #22c55e)",
  proposal_sent: "var(--accent-purple, #8b5cf6)",
  note: "var(--tertiary)",
  outbound_call: "var(--accent-amber)",
  inbound_call: "var(--accent-teal)",
  meeting: "var(--accent-amber)",
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActivityItem({
  activity,
  onDelete,
  isDeleting,
}: {
  activity: LeadActivity;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const isEmail = activity.activity_type === "outbound_email" || activity.activity_type === "inbound_email";
  const [expanded, setExpanded] = useState(isEmail);
  const Icon = ACTIVITY_ICONS[activity.activity_type] ?? MessageSquare;
  const color = ACTIVITY_COLORS[activity.activity_type] ?? "var(--tertiary)";
  const hasBody = !!activity.body;

  return (
    <div className="group relative flex gap-3 py-2">
      {/* Icon */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {ACTIVITY_TYPE_LABELS[activity.activity_type]}
            </span>
            {activity.subject && (
              <span className="text-xs text-[var(--text-secondary)] truncate">
                — {activity.subject}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <Clock className="h-2.5 w-2.5" />
              {formatDateTime(activity.created_at)}
            </span>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--destructive-muted)]"
            >
              <Trash2 className="h-3 w-3 text-[var(--text-tertiary)] hover:text-[var(--danger)]" />
            </button>
          </div>
        </div>

        {hasBody && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mt-0.5"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "Show details"}
            </button>
            {expanded && (
              <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap rounded bg-[var(--surface-secondary)] p-2">
                {activity.body}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Quick-add activity types available for manual creation
const QUICK_ADD_TYPES: { type: ActivityType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "note", label: "Note", icon: MessageSquare },
  { type: "outbound_call", label: "Call", icon: Phone },
  { type: "meeting", label: "Meeting", icon: Users },
];

function AddActivityForm({
  leadId,
  activityType,
  onClose,
}: {
  leadId: number;
  activityType: ActivityType;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const createActivity = useCreateActivity();
  const Icon = ACTIVITY_ICONS[activityType] ?? MessageSquare;

  const handleSubmit = () => {
    if (!subject.trim() && !body.trim()) return;
    createActivity.mutate(
      {
        leadId,
        data: {
          activity_type: activityType,
          subject: subject.trim() || undefined,
          body: body.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setSubject("");
          setBody("");
          onClose();
        },
      }
    );
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
        <Icon className="h-3.5 w-3.5" />
        {ACTIVITY_TYPE_LABELS[activityType]}
      </div>
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject (optional)"
        className="h-7 text-xs"
        autoFocus
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Details…"
        rows={3}
        className="text-xs resize-none"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={createActivity.isPending || (!subject.trim() && !body.trim())}
          className="h-7 text-xs"
        >
          {createActivity.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function EmailComposeForm({
  leadId,
  leadEmail,
  proposalText,
  proposalSubject,
  onClose,
  onSent,
}: {
  leadId: number;
  leadEmail: string;
  proposalText?: string;
  proposalSubject?: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const sendEmail = useSendEmail();

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) return;
    sendEmail.mutate(
      { leadId, data: { subject: subject.trim(), body: body.trim() } },
      {
        onSuccess: () => {
          setSubject("");
          setBody("");
          onClose();
          onSent?.();
        },
      }
    );
  };

  const handleUseProposal = () => {
    if (proposalText) {
      setBody(proposalText);
    }
    if (proposalSubject && !subject) {
      setSubject(proposalSubject);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
        <Send className="h-3.5 w-3.5" />
        Send Email
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <span>To:</span>
        <span className="text-[var(--text-secondary)]">{leadEmail}</span>
      </div>
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="h-7 text-xs"
        autoFocus
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Email body…"
        rows={6}
        className="text-xs resize-none"
      />
      <div className="flex items-center justify-between">
        <div>
          {proposalText && !body && (
            <Button variant="ghost" size="sm" onClick={handleUseProposal} className="h-7 text-xs gap-1.5 text-[var(--text-tertiary)]">
              <Mail className="h-3 w-3" />
              Use proposal
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sendEmail.isPending || !subject.trim() || !body.trim()}
            className="h-7 text-xs gap-1.5"
          >
            <Send className="h-3 w-3" />
            {sendEmail.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
      {sendEmail.isError && (
        <p className="text-xs text-[var(--danger)]">
          {(sendEmail.error as Error)?.message || "Failed to send email"}
        </p>
      )}
    </div>
  );
}

interface ActivityTimelineProps {
  leadId: number;
  leadEmail?: string;
  proposalText?: string;
  proposalSubject?: string;
}

export function ActivityTimeline({ leadId, leadEmail, proposalText, proposalSubject }: ActivityTimelineProps) {
  const { data: activities = [], isLoading } = useLeadActivities(leadId);
  const deleteActivity = useDeleteActivity();
  const { data: gmailStatus } = useGmailStatus();
  const checkReplies = useCheckReplies();
  const [addingType, setAddingType] = useState<ActivityType | null>(null);
  const [showEmailCompose, setShowEmailCompose] = useState(false);

  const canSendEmail = leadEmail && gmailStatus?.gmail_available;
  const hasTrackedThreads = activities.some((a) => a.gmail_thread_id);

  return (
    <div className="space-y-3">
      {/* Quick-add buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {QUICK_ADD_TYPES.map(({ type, label, icon: BtnIcon }) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            onClick={() => {
              setAddingType(addingType === type ? null : type);
              setShowEmailCompose(false);
            }}
            className={`h-7 text-xs gap-1.5 ${addingType === type ? "ring-1 ring-[var(--primary)]" : ""}`}
          >
            <BtnIcon className="h-3 w-3" />
            {label}
          </Button>
        ))}
        {leadEmail && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowEmailCompose(!showEmailCompose);
              setAddingType(null);
            }}
            disabled={!canSendEmail}
            title={
              !gmailStatus?.connected
                ? "Connect Google account in Settings"
                : gmailStatus?.needs_reauth
                  ? "Re-authorize Google with Gmail permissions"
                  : !leadEmail
                    ? "Lead has no email"
                    : undefined
            }
            className={`h-7 text-xs gap-1.5 ${showEmailCompose ? "ring-1 ring-[var(--primary)]" : ""}`}
          >
            <Send className="h-3 w-3" />
            Send Email
          </Button>
        )}
        {hasTrackedThreads && gmailStatus?.gmail_available && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => checkReplies.mutate()}
            disabled={checkReplies.isPending}
            className="h-7 text-xs gap-1.5 text-[var(--text-tertiary)] ml-auto"
          >
            {checkReplies.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {checkReplies.isPending ? "Checking…" : "Check replies"}
          </Button>
        )}
      </div>

      {/* Gmail status warning */}
      {leadEmail && gmailStatus && !gmailStatus.gmail_available && (
        <p className="text-xs text-[var(--accent-amber)]">
          {gmailStatus.needs_reauth
            ? "Gmail requires re-authorization. Reconnect Google in Settings to enable email sending."
            : !gmailStatus.connected
              ? "Connect Google account in Settings to send emails."
              : null}
        </p>
      )}

      {/* Inline form */}
      {addingType && (
        <AddActivityForm
          leadId={leadId}
          activityType={addingType}
          onClose={() => setAddingType(null)}
        />
      )}

      {/* Email compose form */}
      {showEmailCompose && leadEmail && (
        <EmailComposeForm
          leadId={leadId}
          leadEmail={leadEmail}
          proposalText={proposalText}
          proposalSubject={proposalSubject}
          onClose={() => setShowEmailCompose(false)}
        />
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-7 w-7 rounded-full bg-[var(--surface-hover)]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-[var(--surface-hover)]" />
                <div className="h-2.5 w-48 rounded bg-[var(--surface-hover)]" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-4">
          No activities recorded yet
        </p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {activities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              onDelete={() =>
                deleteActivity.mutate({ activityId: activity.id, leadId })
              }
              isDeleting={deleteActivity.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

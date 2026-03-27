"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateLead, useUpdateLead, useIndustries } from "@/hooks/use-leads";
import type { Lead } from "@/types/lead";

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  lead?: Lead;
  onSuccess?: () => void;
}

export function LeadDialog({ open, onOpenChange, mode, lead, onSuccess }: LeadDialogProps) {
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const { data: industries = [] } = useIndustries();

  const [businessName, setBusinessName] = useState(lead?.business_name ?? "");
  const [contactPerson, setContactPerson] = useState(lead?.contact_person ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [website, setWebsite] = useState(lead?.website ?? "");
  const [industryId, setIndustryId] = useState<string>(
    lead?.industry_id?.toString() ?? ""
  );
  const [serviceDescription, setServiceDescription] = useState(
    lead?.service_description ?? ""
  );
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [errors, setErrors] = useState<{ business_name?: string }>({});

  const isLoading = createLead.isPending || updateLead.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName.trim()) {
      setErrors({ business_name: "Business name is required" });
      return;
    }
    setErrors({});

    try {
      if (mode === "create") {
        await createLead.mutateAsync({
          business_name: businessName.trim(),
          contact_person: contactPerson.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          industry_id: industryId ? Number(industryId) : undefined,
          service_description: serviceDescription.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else if (lead) {
        await updateLead.mutateAsync({
          id: lead.id,
          data: {
            business_name: businessName.trim(),
            contact_person: contactPerson.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            website: website.trim() || null,
            industry_id: industryId ? Number(industryId) : null,
            service_description: serviceDescription.trim() || null,
            notes: notes.trim() || null,
          },
        });
      }
      onSuccess?.();
    } catch (err) {
      setErrors({
        business_name: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isLoading && onOpenChange(isOpen)}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <DialogClose />

          <DialogTitle className="mb-5">
            {mode === "create" ? "Add Lead" : "Edit Lead"}
          </DialogTitle>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Business Name */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="lead-business"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Business Name *
              </Label>
              <Input
                id="lead-business"
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  if (errors.business_name) setErrors({});
                }}
                placeholder="e.g. Dental Plus LLC"
                autoFocus
              />
              {errors.business_name && (
                <p className="text-xs text-[var(--danger)]">{errors.business_name}</p>
              )}
            </div>

            {/* Contact Person + Industry */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="lead-contact"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Contact Person
                </Label>
                <Input
                  id="lead-contact"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Ivan Petrov"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="lead-industry"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Industry
                </Label>
                <Select
                  id="lead-industry"
                  value={industryId}
                  onChange={(e) => setIndustryId(e.target.value)}
                >
                  <option value="">None</option>
                  {industries.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {ind.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="lead-email"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Email
                </Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@dentalplus.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="lead-phone"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Phone
                </Label>
                <Input
                  id="lead-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {/* Website */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="lead-website"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Website
              </Label>
              <Input
                id="lead-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://dentalplus.com"
              />
            </div>

            {/* Service Description */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="lead-service"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Service Description
              </Label>
              <Textarea
                id="lead-service"
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder="What services does this business offer…"
                rows={3}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="lead-notes"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Notes
              </Label>
              <Textarea
                id="lead-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes…"
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? mode === "create"
                    ? "Adding…"
                    : "Saving…"
                  : mode === "create"
                    ? "Add Lead"
                    : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

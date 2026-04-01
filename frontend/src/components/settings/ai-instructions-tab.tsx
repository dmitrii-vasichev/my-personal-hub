"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface InstructionField {
  key: string;
  label: string;
  description: string;
}

const FIELDS: InstructionField[] = [
  {
    key: "instruction_resume",
    label: "Resume Generation",
    description:
      "Custom instructions for how AI should generate tailored resumes.",
  },
  {
    key: "instruction_ats_audit",
    label: "ATS Audit",
    description:
      "Custom instructions for how AI should audit resumes against job descriptions.",
  },
  {
    key: "instruction_gap_analysis",
    label: "Gap Analysis",
    description:
      "Custom instructions for how AI should analyze skill/experience gaps.",
  },
  {
    key: "instruction_cover_letter",
    label: "Cover Letter",
    description:
      "Custom instructions for how AI should generate cover letters.",
  },
  {
    key: "instruction_outreach_industry",
    label: "Outreach Industry Cases",
    description:
      "Master prompt for generating custom Outreach B2B Industry instructions (controls Tone of Voice, Micro-Automation focus, etc).",
  },
];

interface AiInstructionsTabProps {
  instructions: Record<string, string>;
  setInstructions: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
}

export function AiInstructionsTab({
  instructions,
  setInstructions,
}: AiInstructionsTabProps) {
  return (
    <section className="space-y-6 rounded-lg border border-border p-5">
      <div>
        <h2 className="text-sm font-medium">AI Instructions</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Customize how AI processes your data for each operation. Leave empty
          to use defaults.
        </p>
      </div>
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label className="text-xs font-medium uppercase text-muted-foreground">
            {field.label}
          </Label>
          <p className="text-xs text-muted-foreground">{field.description}</p>
          <Textarea
            value={instructions[field.key] ?? ""}
            onChange={(e) =>
              setInstructions((prev) => ({
                ...prev,
                [field.key]: e.target.value,
              }))
            }
            placeholder={`Custom ${field.label.toLowerCase()} instructions...`}
            rows={4}
            className="mt-1 text-sm"
          />
        </div>
      ))}
    </section>
  );
}

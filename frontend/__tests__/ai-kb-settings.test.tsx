import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiInstructionsTab } from "@/components/settings/ai-instructions-tab";

// ── AiInstructionsTab ────────────────────────────────────────────────────────

describe("AiInstructionsTab", () => {
  it("renders all 4 instruction fields", () => {
    const instructions = {
      instruction_resume: "",
      instruction_ats_audit: "",
      instruction_gap_analysis: "",
      instruction_cover_letter: "",
    };
    render(
      <AiInstructionsTab
        instructions={instructions}
        setInstructions={() => {}}
      />
    );

    expect(screen.getByText("Resume Generation")).toBeInTheDocument();
    expect(screen.getByText("ATS Audit")).toBeInTheDocument();
    expect(screen.getByText("Gap Analysis")).toBeInTheDocument();
    expect(screen.getByText("Cover Letter")).toBeInTheDocument();
  });

  it("renders instructions with existing values", () => {
    const instructions = {
      instruction_resume: "Use STAR format",
      instruction_ats_audit: "",
      instruction_gap_analysis: "",
      instruction_cover_letter: "",
    };
    render(
      <AiInstructionsTab
        instructions={instructions}
        setInstructions={() => {}}
      />
    );

    const textareas = screen.getAllByRole("textbox");
    const resumeTextarea = textareas.find(
      (t) => (t as HTMLTextAreaElement).value === "Use STAR format"
    );
    expect(resumeTextarea).toBeInTheDocument();
  });

  it("calls setInstructions when editing a field", async () => {
    const user = userEvent.setup();
    const setInstructions = vi.fn();
    const instructions = {
      instruction_resume: "",
      instruction_ats_audit: "",
      instruction_gap_analysis: "",
      instruction_cover_letter: "",
    };
    render(
      <AiInstructionsTab
        instructions={instructions}
        setInstructions={setInstructions}
      />
    );

    const textareas = screen.getAllByRole("textbox");
    await user.type(textareas[0], "A");

    expect(setInstructions).toHaveBeenCalled();
  });

  it("shows helper descriptions for each field", () => {
    const instructions = {
      instruction_resume: "",
      instruction_ats_audit: "",
      instruction_gap_analysis: "",
      instruction_cover_letter: "",
    };
    render(
      <AiInstructionsTab
        instructions={instructions}
        setInstructions={() => {}}
      />
    );

    expect(
      screen.getByText(/how AI should generate tailored resumes/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/how AI should audit resumes/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/how AI should analyze skill/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/how AI should generate cover letters/)
    ).toBeInTheDocument();
  });
});

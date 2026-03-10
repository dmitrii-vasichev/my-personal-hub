import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkillsEditor } from "@/components/profile/skills-editor";
import { ExperienceEditor } from "@/components/profile/experience-editor";
import { EducationEditor } from "@/components/profile/education-editor";
import type { SkillEntry, ExperienceEntry, EducationEntry } from "@/types/profile";

// ── SkillsEditor ─────────────────────────────────────────────────────────────

describe("SkillsEditor", () => {
  it("renders existing skills as chips", () => {
    const skills: SkillEntry[] = [
      { name: "TypeScript", level: "Expert", years: 5 },
      { name: "React" },
    ];
    render(<SkillsEditor skills={skills} onChange={() => {}} />);
    expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
    expect(screen.getByText(/React/)).toBeInTheDocument();
  });

  it("adds a new skill on Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SkillsEditor skills={[]} onChange={onChange} />);

    const input = screen.getByPlaceholderText("Skill name...");
    await user.type(input, "Python{Enter}");

    expect(onChange).toHaveBeenCalledWith([{ name: "Python" }]);
  });

  it("removes a skill when X is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const skills: SkillEntry[] = [{ name: "Go" }, { name: "Rust" }];
    render(<SkillsEditor skills={skills} onChange={onChange} />);

    const removeButtons = screen.getAllByRole("button", { hidden: true });
    // Find the X button inside the "Go" chip
    const goChip = screen.getByText(/^Go/).closest("span");
    const xButton = goChip?.querySelector("button");
    if (xButton) await user.click(xButton);

    expect(onChange).toHaveBeenCalledWith([{ name: "Rust" }]);
  });

  it("does not add duplicate skills", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const skills: SkillEntry[] = [{ name: "TypeScript" }];
    render(<SkillsEditor skills={skills} onChange={onChange} />);

    const input = screen.getByPlaceholderText("Skill name...");
    await user.type(input, "typescript{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });
});

// ── ExperienceEditor ─────────────────────────────────────────────────────────

describe("ExperienceEditor", () => {
  it("renders existing experience entries", () => {
    const experience: ExperienceEntry[] = [
      { title: "Senior Engineer", company: "Acme Corp" },
    ];
    render(<ExperienceEditor experience={experience} onChange={() => {}} />);
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });

  it("shows add form when Add button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExperienceEditor experience={[]} onChange={() => {}} />);

    await user.click(screen.getByText("Add experience"));
    expect(screen.getByText("Title *")).toBeInTheDocument();
    expect(screen.getByText("Company *")).toBeInTheDocument();
  });

  it("removes entry on delete", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const experience: ExperienceEntry[] = [
      { title: "Dev", company: "Co1" },
      { title: "Lead", company: "Co2" },
    ];
    render(
      <ExperienceEditor experience={experience} onChange={onChange} />
    );

    // Click the first delete button
    const deleteButtons = screen.getAllByRole("button").filter((b) => {
      const svg = b.querySelector("svg");
      return svg && b.closest("[class*='rounded-lg']");
    });
    // Trash icons
    const trashButtons = screen.getByText("Dev")
      .closest("[class*='rounded-lg']")
      ?.querySelectorAll("button");
    if (trashButtons && trashButtons[0]) {
      await user.click(trashButtons[0]);
    }

    expect(onChange).toHaveBeenCalledWith([{ title: "Lead", company: "Co2" }]);
  });
});

// ── EducationEditor ──────────────────────────────────────────────────────────

describe("EducationEditor", () => {
  it("renders existing education entries", () => {
    const education: EducationEntry[] = [
      { degree: "MSc Computer Science", institution: "MIT", year: 2020 },
    ];
    render(<EducationEditor education={education} onChange={() => {}} />);
    expect(screen.getByText("MSc Computer Science")).toBeInTheDocument();
    expect(screen.getByText(/MIT/)).toBeInTheDocument();
  });

  it("shows add form when Add button is clicked", async () => {
    const user = userEvent.setup();
    render(<EducationEditor education={[]} onChange={() => {}} />);

    await user.click(screen.getByText("Add education"));
    expect(screen.getByText("Degree *")).toBeInTheDocument();
    expect(screen.getByText("Institution *")).toBeInTheDocument();
  });

  it("removes entry on delete", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const education: EducationEntry[] = [
      { degree: "BSc", institution: "Harvard" },
      { degree: "PhD", institution: "Stanford" },
    ];
    render(
      <EducationEditor education={education} onChange={onChange} />
    );

    const bscEntry = screen.getByText("BSc").closest("[class*='rounded-lg']");
    const trashButton = bscEntry?.querySelectorAll("button")[0];
    if (trashButton) {
      await user.click(trashButton);
    }

    expect(onChange).toHaveBeenCalledWith([
      { degree: "PhD", institution: "Stanford" },
    ]);
  });
});

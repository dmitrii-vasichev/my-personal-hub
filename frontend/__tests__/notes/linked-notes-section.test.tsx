import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinkedNotesSection } from "@/components/notes/linked-notes-section";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock use-notes hook
const mockNotes = [
  {
    id: 10,
    user_id: 1,
    google_file_id: "gf_10",
    title: "Meeting Notes",
    folder_path: "Work/Meetings",
    mime_type: "text/markdown",
    last_synced_at: "2026-03-10T10:00:00Z",
    created_at: "2026-03-10T10:00:00Z",
    updated_at: "2026-03-10T10:00:00Z",
  },
  {
    id: 20,
    user_id: 1,
    google_file_id: "gf_20",
    title: "Project Plan",
    folder_path: "Work/Projects",
    mime_type: "text/markdown",
    last_synced_at: "2026-03-10T10:00:00Z",
    created_at: "2026-03-10T10:00:00Z",
    updated_at: "2026-03-10T10:00:00Z",
  },
  {
    id: 30,
    user_id: 1,
    google_file_id: "gf_30",
    title: "Daily Log",
    folder_path: "Personal",
    mime_type: "text/markdown",
    last_synced_at: "2026-03-10T10:00:00Z",
    created_at: "2026-03-10T10:00:00Z",
    updated_at: "2026-03-10T10:00:00Z",
  },
];

vi.mock("@/hooks/use-notes", () => ({
  useNotes: () => ({ data: mockNotes }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

const linkedNotes = [
  { id: 10, title: "Meeting Notes", folder_path: "Work/Meetings", google_file_id: "gf_10", file_id: "gf_10" },
];

describe("LinkedNotesSection", () => {
  it("renders loading state", () => {
    const { container } = render(
      <LinkedNotesSection
        notes={[]}
        isLoading={true}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders empty state when no notes linked", () => {
    render(
      <LinkedNotesSection
        notes={[]}
        isLoading={false}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("No notes linked")).toBeInTheDocument();
    expect(screen.getByText("Link Note")).toBeInTheDocument();
  });

  it("renders list of linked notes with titles and folder paths", () => {
    render(
      <LinkedNotesSection
        notes={linkedNotes}
        isLoading={false}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
    expect(screen.getByText("Work/Meetings")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // count badge
  });

  it("calls onUnlink with correct noteId when unlink button clicked", () => {
    const onUnlink = vi.fn();
    render(
      <LinkedNotesSection
        notes={linkedNotes}
        isLoading={false}
        onLink={vi.fn()}
        onUnlink={onUnlink}
      />,
      { wrapper: createWrapper() }
    );

    // The X button is inside the Tooltip, click directly
    const xButton = document.querySelector(
      'button[class*="hover:text-[var(--destructive)]"]'
    ) as HTMLElement;
    expect(xButton).not.toBeNull();
    fireEvent.click(xButton);

    expect(onUnlink).toHaveBeenCalledWith(10);
  });

  it("opens dialog when Link Note button is clicked", () => {
    render(
      <LinkedNotesSection
        notes={[]}
        isLoading={false}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText("Link Note"));

    // Dialog should show search input and available notes
    expect(screen.getByPlaceholderText("Search notes...")).toBeInTheDocument();
    expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
    expect(screen.getByText("Project Plan")).toBeInTheDocument();
    expect(screen.getByText("Daily Log")).toBeInTheDocument();
  });

  it("filters notes by search term in dialog", () => {
    render(
      <LinkedNotesSection
        notes={[]}
        isLoading={false}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText("Link Note"));

    const searchInput = screen.getByPlaceholderText("Search notes...");
    fireEvent.change(searchInput, { target: { value: "project" } });

    expect(screen.getByText("Project Plan")).toBeInTheDocument();
    expect(screen.queryByText("Meeting Notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Daily Log")).not.toBeInTheDocument();
  });

  it("calls onLink when clicking a note in dialog", () => {
    const onLink = vi.fn();
    render(
      <LinkedNotesSection
        notes={[]}
        isLoading={false}
        onLink={onLink}
        onUnlink={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText("Link Note"));
    fireEvent.click(screen.getByText("Project Plan"));

    expect(onLink).toHaveBeenCalledWith(20);
  });

  it("navigates to notes page when clicking a linked note title", () => {
    render(
      <LinkedNotesSection
        notes={linkedNotes}
        isLoading={false}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText("Meeting Notes"));
    expect(mockPush).toHaveBeenCalledWith("/notes?file=gf_10");
  });

  it("marks the primary draft note and can set another linked note as primary", () => {
    const onSetPrimary = vi.fn();
    render(
      <LinkedNotesSection
        notes={[
          ...linkedNotes,
          {
            id: 20,
            title: "Project Plan",
            folder_path: "Work/Projects",
            google_file_id: "gf_20",
            file_id: "gf_20",
          },
        ]}
        isLoading={false}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
        primaryNoteId={10}
        onSetPrimary={onSetPrimary}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Draft")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Set as draft"));
    expect(onSetPrimary).toHaveBeenCalledWith(20);
  });
});

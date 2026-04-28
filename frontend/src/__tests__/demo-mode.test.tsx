import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { DemoModeBadge } from "@/components/ui/demo-mode-badge";
import type { Job } from "@/types/job";

// --- Mock setup ---

const mockUser = {
  id: 99,
  email: "demo@example.com",
  display_name: "Demo User",
  role: "demo",
  must_change_password: false,
  is_blocked: false,
  theme: "dark",
  last_login_at: null,
};

let currentUser = mockUser;

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: currentUser,
    isLoading: false,
    isDemo: currentUser?.role === "demo",
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
  AuthContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-resumes", () => ({
  useResumes: () => ({ data: [], isLoading: false }),
  useGenerateResume: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCoverLetters: () => ({ data: [], isLoading: false }),
  useGenerateCoverLetter: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRunAtsAudit: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRunGapAnalysis: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-job-match", () => ({
  useRunJobMatch: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

vi.mock("@/hooks/use-search", () => ({
  useJobSearch: () => ({
    results: [],
    isSearching: false,
    error: null,
    hasMore: false,
    search: vi.fn(),
    loadMore: vi.fn(),
    autoSearch: vi.fn(),
  }),
  useSaveSearchResult: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({
    data: { target_roles: [], excluded_companies: [], stale_threshold_days: 14 },
    isLoading: false,
  }),
  useUpdateSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-users", () => ({
  useUsers: () => ({
    data: [
      { id: 1, display_name: "Admin", email: "admin@test.com", role: "admin", is_blocked: false, last_login_at: null },
      { id: 99, display_name: "Demo", email: "demo@test.com", role: "demo", is_blocked: false, last_login_at: null },
    ],
    isLoading: false,
  }),
  useResetDemoData: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResetPassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { display_name: "Demo User", email: "demo@test.com", role: "demo" } }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-user-profile", () => ({
  useUserProfile: () => ({ data: null, isLoading: false }),
  useUpdateUserProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useImportProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-calendar", () => ({
  useCalendarEvents: () => ({ data: [], isLoading: false }),
  useGoogleOAuthStatus: () => ({ data: { connected: false }, isLoading: false }),
}));

vi.mock("@/hooks/use-notes", () => ({
  useNotesTree: () => ({ data: { tree: [] }, isLoading: false, error: null }),
  useNoteContent: () => ({ data: null, isLoading: false, error: null }),
  useRefreshNotesTree: () => ({ mutate: vi.fn(), isPending: false }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// --- Tests ---

describe("DemoModeBadge", () => {
  it("renders default variant with feature and description", () => {
    render(
      <DemoModeBadge feature="AI Resume" description="Generate tailored resumes" />
    );
    expect(screen.getByText("Demo Mode")).toBeInTheDocument();
    expect(screen.getByText(/AI Resume/)).toBeInTheDocument();
    expect(screen.getByText(/Generate tailored resumes/)).toBeInTheDocument();
  });

  it("renders compact variant", () => {
    render(
      <DemoModeBadge compact feature="AI" description="test" />
    );
    expect(screen.getByText("Demo Mode")).toBeInTheDocument();
    // Compact variant should not show description
    expect(screen.queryByText(/test/)).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <DemoModeBadge feature="Test" description="desc" className="my-custom" />
    );
    expect(container.firstChild).toHaveClass("my-custom");
  });
});

describe("Auth context isDemo", () => {
  beforeEach(() => {
    currentUser = { ...mockUser, role: "demo" };
  });

  it("returns isDemo: true for demo role", async () => {
    const { useAuth } = await import("@/lib/auth");
    const result = useAuth();
    expect(result.isDemo).toBe(true);
  });

  it("returns isDemo: false for admin role", async () => {
    currentUser = { ...mockUser, role: "admin" };
    const { useAuth } = await import("@/lib/auth");
    const result = useAuth();
    expect(result.isDemo).toBe(false);
  });

  it("returns isDemo: false for member role", async () => {
    currentUser = { ...mockUser, role: "member" };
    const { useAuth } = await import("@/lib/auth");
    const result = useAuth();
    expect(result.isDemo).toBe(false);
  });
});

describe("ResumeSection demo mode", () => {
  beforeEach(() => {
    currentUser = { ...mockUser, role: "demo" };
  });

  it("shows DemoModeBadge instead of generate button", async () => {
    const { ResumeSection } = await import(
      "@/components/jobs/resume-section"
    );
    render(<ResumeSection jobId={1} />, { wrapper: createWrapper() });
    expect(screen.getByText("Demo Mode")).toBeInTheDocument();
    expect(screen.getByText(/AI Resume Generation/)).toBeInTheDocument();
    expect(screen.queryByText("Generate Resume")).not.toBeInTheDocument();
  });
});

describe("CoverLetterSection demo mode", () => {
  beforeEach(() => {
    currentUser = { ...mockUser, role: "demo" };
  });

  it("shows DemoModeBadge instead of generate button", async () => {
    const { CoverLetterSection } = await import(
      "@/components/jobs/cover-letter-section"
    );
    render(<CoverLetterSection jobId={1} />, { wrapper: createWrapper() });
    expect(screen.getByText("Demo Mode")).toBeInTheDocument();
    expect(screen.getByText(/AI Cover Letter/)).toBeInTheDocument();
    expect(screen.queryByText("Generate Cover Letter")).not.toBeInTheDocument();
  });
});

describe("JobMatchSection demo mode", () => {
  beforeEach(() => {
    currentUser = { ...mockUser, role: "demo" };
  });

  it("shows DemoModeBadge instead of match button", async () => {
    const { JobMatchSection } = await import(
      "@/components/jobs/job-match-section"
    );
    const job = { id: 1, match_result: null } as unknown as Job;
    render(<JobMatchSection job={job} />, { wrapper: createWrapper() });
    expect(screen.getByText("Demo Mode")).toBeInTheDocument();
    expect(screen.getByText(/AI Job Matching/)).toBeInTheDocument();
    expect(screen.queryByText("Run Match")).not.toBeInTheDocument();
  });
});

describe("JobSearch demo mode", () => {
  beforeEach(() => {
    currentUser = { ...mockUser, role: "demo" };
  });

  it("shows DemoModeBadge instead of search form", async () => {
    const { JobSearch } = await import(
      "@/components/jobs/job-search"
    );
    render(<JobSearch />, { wrapper: createWrapper() });
    expect(screen.getByText("Demo Mode")).toBeInTheDocument();
    expect(screen.getByText(/External Job Search/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Job title, keywords…")).not.toBeInTheDocument();
  });
});

describe("Settings tabs demo mode", () => {
  beforeEach(() => {
    currentUser = { ...mockUser, role: "demo" };
  });

  it("shows only General and Tags tabs for demo user", async () => {
    const SettingsPage = (await import("@/app/(dashboard)/settings/page")).default;
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.queryByText("AI & API Keys")).not.toBeInTheDocument();
    expect(screen.queryByText("Integrations")).not.toBeInTheDocument();
    expect(screen.queryByText("Telegram")).not.toBeInTheDocument();
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  }, 10_000);
});

describe("Profile page demo mode", () => {
  beforeEach(() => {
    currentUser = { ...mockUser, role: "demo" };
  });

  it("hides import button for demo user", async () => {
    const ProfilePage = (await import("@/app/(dashboard)/profile/page")).default;
    render(<ProfilePage />, { wrapper: createWrapper() });
    expect(screen.queryByText("Import from text")).not.toBeInTheDocument();
  });
});

describe("UserManagementTable reset button", () => {
  beforeEach(() => {
    currentUser = { ...mockUser, role: "admin" };
  });

  it("shows Reset Demo Data button when demo user exists", async () => {
    const { UserManagementTable } = await import(
      "@/components/settings/user-management-table"
    );
    render(<UserManagementTable />, { wrapper: createWrapper() });
    expect(screen.getByText("Reset Demo Data")).toBeInTheDocument();
  });
});

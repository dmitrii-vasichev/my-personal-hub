import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobMatchSection } from "@/components/jobs/job-match-section";
import type { Job, MatchResult } from "@/types/job";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "test@test.com", display_name: "Test", role: "member", must_change_password: false, is_blocked: false, theme: "dark", last_login_at: null },
    isLoading: false,
    isDemo: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// Mock the hook
vi.mock("@/hooks/use-job-match", () => ({
  useRunJobMatch: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
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

const baseJob: Job = {
  id: 1,
  user_id: 1,
  title: "Senior Developer",
  company: "Acme",
  source: "manual",
  salary_currency: "USD",
  tags: [],
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

describe("JobMatchSection", () => {
  it("renders Run Match button when no match result", () => {
    render(<JobMatchSection job={baseJob} />, { wrapper: createWrapper() });

    expect(screen.getByText("Run Match")).toBeInTheDocument();
    expect(
      screen.getByText("Compare this job against your profile")
    ).toBeInTheDocument();
  });

  it("renders match breakdown when result exists", () => {
    const matchResult: MatchResult = {
      score: 85,
      matched_skills: ["Python", "FastAPI"],
      missing_skills: ["Kubernetes"],
      strengths: ["Strong backend experience"],
      recommendations: ["Learn Kubernetes"],
    };

    const jobWithMatch: Job = {
      ...baseJob,
      match_score: 85,
      match_result: matchResult,
    };

    render(<JobMatchSection job={jobWithMatch} />, {
      wrapper: createWrapper(),
    });

    // Score displayed
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("Strong match")).toBeInTheDocument();

    // Skills tags
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("FastAPI")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();

    // Strengths and recommendations
    expect(screen.getByText("Strong backend experience")).toBeInTheDocument();
    expect(screen.getByText("Learn Kubernetes")).toBeInTheDocument();

    // Re-run button available
    expect(screen.getByText("Re-run")).toBeInTheDocument();
  });

  it("renders correct match level text for different scores", () => {
    const lowMatch: Job = {
      ...baseJob,
      match_score: 30,
      match_result: {
        score: 30,
        matched_skills: [],
        missing_skills: [],
        strengths: [],
        recommendations: [],
      },
    };

    render(<JobMatchSection job={lowMatch} />, { wrapper: createWrapper() });
    expect(screen.getByText("Low match")).toBeInTheDocument();
  });

  it("renders loading state when pending", async () => {
    const { useRunJobMatch } = await import("@/hooks/use-job-match");
    vi.mocked(useRunJobMatch).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRunJobMatch>);

    render(<JobMatchSection job={baseJob} />, { wrapper: createWrapper() });
    expect(screen.getByText("Analyzing match...")).toBeInTheDocument();
  });
});

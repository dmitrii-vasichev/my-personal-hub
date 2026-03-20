import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobSearch } from "@/components/jobs/job-search";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock search hooks
const mockSearch = vi.fn();
const mockAutoSearch = vi.fn();
const mockLoadMore = vi.fn();
const mockSaveMutateAsync = vi.fn();

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

vi.mock("@/hooks/use-search", () => ({
  useJobSearch: () => ({
    results: [],
    isSearching: false,
    error: null,
    hasMore: false,
    search: mockSearch,
    loadMore: mockLoadMore,
    autoSearch: mockAutoSearch,
  }),
  useSaveSearchResult: () => ({
    mutateAsync: mockSaveMutateAsync,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("JobSearch improvements", () => {
  beforeEach(() => {
    mockSearch.mockClear();
    mockAutoSearch.mockClear();
    mockLoadMore.mockClear();
    mockSaveMutateAsync.mockClear();
  });

  it("renders Max results input with default value", () => {
    renderWithClient(<JobSearch />);

    const limitInput = screen.getByPlaceholderText("Max results");
    expect(limitInput).toBeInTheDocument();
    expect(limitInput).toHaveValue(10);
  });

  it("passes limit to search function on submit", async () => {
    const user = userEvent.setup();
    renderWithClient(<JobSearch />);

    const queryInput = screen.getByPlaceholderText("Job title, keywords…");
    await user.type(queryInput, "python developer");

    const form = queryInput.closest("form")!;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, query: "python developer" })
    );
  });

  it("renders empty state when no results", () => {
    renderWithClient(<JobSearch />);

    expect(screen.getByText("Search for jobs across external job boards")).toBeInTheDocument();
  });

  it("renders provider selector with options", () => {
    renderWithClient(<JobSearch />);

    expect(screen.getByText("Adzuna")).toBeInTheDocument();
    expect(screen.getByText("SerpAPI (Google Jobs)")).toBeInTheDocument();
    expect(screen.getByText("JSearch (RapidAPI)")).toBeInTheDocument();
  });

  it("renders Auto search button", () => {
    renderWithClient(<JobSearch />);

    const autoBtn = screen.getByText("Auto");
    expect(autoBtn).toBeInTheDocument();
  });

  it("calls autoSearch with limit on Auto click", async () => {
    const user = userEvent.setup();
    renderWithClient(<JobSearch />);

    await user.click(screen.getByText("Auto"));

    expect(mockAutoSearch).toHaveBeenCalledTimes(1);
    expect(mockAutoSearch).toHaveBeenCalledWith(10);
  });

  it("search button is disabled when query is empty", () => {
    renderWithClient(<JobSearch />);

    const searchBtn = screen.getByText("Search");
    expect(searchBtn).toBeDisabled();
  });
});

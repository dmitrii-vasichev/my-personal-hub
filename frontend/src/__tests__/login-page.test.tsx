import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mockLogin = vi.fn();
const mockPush = vi.fn();
const mockClear = vi.fn();

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isDemo: false,
    login: mockLogin,
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
  AuthContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: mockClear }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}));

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders split-screen layout elements", () => {
    render(<LoginPage />);

    // Left panel content
    expect(screen.getByText("Personal Hub")).toBeInTheDocument();
    expect(
      screen.getByText("All-in-one productivity dashboard")
    ).toBeInTheDocument();

    // Module grid
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Jobs")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Pulse")).toBeInTheDocument();
    expect(screen.getByText("Vitals")).toBeInTheDocument();

    // Demo button
    expect(screen.getByTestId("demo-login-btn")).toBeInTheDocument();
    expect(screen.getByText("Explore Demo")).toBeInTheDocument();

    // Footer — author link
    const authorLink = screen.getByText("Dmitrii Vasichev");
    expect(authorLink).toBeInTheDocument();
    expect(authorLink.closest("a")).toHaveAttribute(
      "href",
      "https://dmitrii-vasichev.com/"
    );
    expect(
      screen.getByText("Next.js · FastAPI · PostgreSQL")
    ).toBeInTheDocument();

    // Social links
    expect(screen.getByLabelText("GitHub")).toBeInTheDocument();
    expect(screen.getByLabelText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByLabelText("Telegram")).toBeInTheDocument();

    // Right panel
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders 'or try demo' link", () => {
    render(<LoginPage />);
    expect(screen.getByTestId("demo-try-link")).toBeInTheDocument();
    expect(screen.getByText("or try demo →")).toBeInTheDocument();
  });

  it("calls demo login API when 'Explore Demo' is clicked", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "demo-token-123" }),
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByTestId("demo-login-btn"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/demo-login", {
        method: "POST",
      });
    });
  });

  it("calls demo login API when 'or try demo' link is clicked", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "demo-token-123" }),
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByTestId("demo-try-link"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/demo-login", {
        method: "POST",
      });
    });
  });

  it("stores token and redirects on successful demo login", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "demo-token-xyz" }),
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByTestId("demo-login-btn"));

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "access_token",
        "demo-token-xyz"
      );
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows error on failed demo login", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByTestId("demo-login-btn"));

    await waitFor(() => {
      expect(screen.getByText("Demo login failed")).toBeInTheDocument();
    });
  });

  it("clears react-query cache on demo login to prevent stale data", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "demo-token-abc" }),
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByTestId("demo-login-btn"));

    await waitFor(() => {
      expect(mockClear).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("calls login function on form submit", async () => {
    mockLogin.mockResolvedValueOnce({ must_change_password: false });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("user@example.com", "secret");
    });
  });
});

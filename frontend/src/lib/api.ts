import type {
  DailyPlan,
  PlanItem,
  PatchPlanItemBody,
  PlannerContext,
  AnalyticsResponse,
} from "@/types/plan";
import type {
  FocusSession,
  FocusSessionTodayResponse,
  StartFocusBody,
} from "@/types/focus-session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  /**
   * Thrown errors carry a `.status` property equal to the HTTP response status
   * (e.g. 409, 404, 500) so callers can branch on it — cast via
   * `(err as { status?: number }).status`. `.message` remains the server's
   * error detail.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      let message = "Request failed";
      if (typeof error.detail === "string") {
        message = error.detail;
      } else if (Array.isArray(error.detail) && error.detail.length > 0) {
        // Pydantic validation errors: extract readable messages
        message = error.detail.map((e: { msg?: string }) => e.msg ?? String(e)).join("; ");
      }
      const err = new Error(message) as Error & { status: number };
      err.status = response.status;
      throw err;
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return undefined as T;
    }

    return response.json();
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete(path: string) {
    return this.request<void>(path, { method: "DELETE" });
  }

  /**
   * Upload a file via multipart/form-data.
   * Does NOT set Content-Type — lets the browser add the boundary.
   */
  async upload<T>(path: string, formData: FormData): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Upload failed" }));
      const message =
        typeof error.detail === "string"
          ? error.detail
          : Array.isArray(error.detail)
            ? error.detail.map((e: { msg?: string }) => e.msg ?? String(e)).join("; ")
            : "Upload failed";
      throw new Error(message);
    }

    return response.json();
  }
}

export const api = new ApiClient();

export const plannerApi = {
  getPlansToday: () => api.get<DailyPlan>("/api/planner/plans/today"),

  patchTodayItem: (itemId: number, body: PatchPlanItemBody) =>
    api.patch<PlanItem>(`/api/planner/plans/today/items/${itemId}`, body),

  getContext: (date: string) =>
    api.get<PlannerContext>(
      `/api/planner/context?date=${encodeURIComponent(date)}`,
    ),

  getAnalytics: (from: string, to: string) =>
    api.get<AnalyticsResponse>(
      `/api/planner/analytics?from=${from}&to=${to}`,
    ),
};

export const focusSessionsApi = {
  start: (body: StartFocusBody) =>
    api.post<FocusSession>("/api/focus-sessions/start", body),

  stop: (id: number) =>
    api.patch<FocusSession>(`/api/focus-sessions/${id}/stop`),

  getActive: () =>
    api.get<FocusSession | null>("/api/focus-sessions/active"),

  getToday: () =>
    api.get<FocusSessionTodayResponse>("/api/focus-sessions/today"),
};

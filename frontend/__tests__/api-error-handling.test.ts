import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the ApiClient error extraction logic by importing api and mocking fetch
const originalFetch = globalThis.fetch;

describe("ApiClient error handling", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue("fake-token"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  async function callApiPost(responseStatus: number, responseBody: unknown) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: responseStatus,
      json: () => Promise.resolve(responseBody),
      headers: new Headers(),
    });
    // Re-import to get fresh instance with mocked fetch
    const { api } = await import("@/lib/api");
    return api.post("/api/tags", { name: "test" });
  }

  it("extracts string detail from backend error", async () => {
    await expect(
      callApiPost(409, { detail: "Tag with this name already exists" }),
    ).rejects.toThrow("Tag with this name already exists");
  });

  it("extracts readable message from Pydantic validation error array", async () => {
    await expect(
      callApiPost(422, {
        detail: [
          { loc: ["body", "name"], msg: "Field required", type: "missing" },
        ],
      }),
    ).rejects.toThrow("Field required");
  });

  it("joins multiple Pydantic validation errors", async () => {
    await expect(
      callApiPost(422, {
        detail: [
          { loc: ["body", "name"], msg: "Field required", type: "missing" },
          { loc: ["body", "color"], msg: "String too long", type: "string_too_long" },
        ],
      }),
    ).rejects.toThrow("Field required; String too long");
  });

  it("falls back to 'Request failed' when JSON parsing fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
      headers: new Headers(),
    });
    const { api } = await import("@/lib/api");
    await expect(api.post("/api/tags", { name: "test" })).rejects.toThrow("Request failed");
  });
});

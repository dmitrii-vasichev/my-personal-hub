import "@testing-library/jest-dom/vitest";

// jsdom lacks ResizeObserver; Radix UI (via cmdk) requires it.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom lacks Element.scrollIntoView; cmdk calls it during keyboard navigation.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

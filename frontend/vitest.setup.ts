import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

function installLocalStorage() {
  const replacement = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: replacement,
    configurable: true,
    writable: true,
  });
  if (typeof window !== "undefined" && window !== globalThis) {
    Object.defineProperty(window, "localStorage", {
      value: replacement,
      configurable: true,
      writable: true,
    });
  }
}

installLocalStorage();
beforeEach(() => {
  installLocalStorage();
});

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

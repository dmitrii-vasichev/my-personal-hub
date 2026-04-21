import { useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook via useSyncExternalStore.
 * Returns `false` on server / in environments without matchMedia.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
  };

  const getSnapshot = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

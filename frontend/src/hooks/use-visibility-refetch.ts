"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useVisibilityRefetch(keys: readonly unknown[][]) {
  const qc = useQueryClient();
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      for (const key of keys) qc.invalidateQueries({ queryKey: key });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qc, keys]);
}

"use client";

import { useState } from "react";
import { api, type ContextSource } from "@/api/api";
import { useRemote } from "@/components/performance/use-remote";

const NONE: ContextSource[] = [];

/** A product's Context Library: what it holds now, and a way to load it again after it changed. */
export function useContextLibrary(productId: string) {
  const [version, setVersion] = useState(0);
  const remote = useRemote(`${productId}:${version}`, () => api.contextSources({ productId }));
  return {
    // Kept while a reload is under way, so the list does not flash empty after each change.
    sources: remote.data ?? NONE,
    loading: remote.loading && remote.data === null,
    // True when what is held is the answer to the latest request, so it can be trusted to say what is gone.
    settled: !remote.loading && !remote.error,
    error: remote.error,
    reload: () => setVersion((current) => current + 1),
  };
}

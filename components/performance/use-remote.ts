"use client";

import { useEffect, useState } from "react";

export interface Remote<T> {
  /** The latest answer, kept while the next one loads so the page dims instead of emptying. */
  data: T | null;
  error: string | null;
  /** Nothing has arrived for the current key yet. */
  loading: boolean;
}

/**
 * Loads something whenever `key` changes. The answer is stored with the key it was asked for, so "loading" is worked
 * out (the stored key differs from the current one) rather than set in an effect.
 */
export function useRemote<T>(key: string, load: () => Promise<T>): Remote<T> {
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    load()
      .then((data) => active && setState({ key, data, error: null }))
      .catch((failure) => active && setState({ key, data: null, error: failure instanceof Error ? failure.message : "Could not load." }));
    return () => {
      active = false;
    };
    // `load` is a fresh closure every render; the key says when the request really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data: state?.data ?? null, error: state?.error ?? null, loading: state?.key !== key };
}

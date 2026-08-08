"use client";

import { useEffect, type DependencyList } from "react";

/**
 * Run an effect whose callback performs asynchronous work that sets state.
 *
 * Invocation is deferred to a microtask so setState never runs synchronously
 * inside the effect body (avoids react-hooks/set-state-in-effect).
 */
export function useAsyncEffect(
  effect: () => Promise<unknown> | void,
  deps: DependencyList
) {
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) void effect();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

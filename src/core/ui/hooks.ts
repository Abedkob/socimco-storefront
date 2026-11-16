"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** True while the media query matches; false during server render. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Milliseconds until `iso`, refreshed every 30 seconds. */
export function useCountdown(iso: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [iso]);
  return iso ? Date.parse(iso) - now : 0;
}

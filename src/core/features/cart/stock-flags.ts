"use client";

import { useSyncExternalStore } from "react";
import { isApiError } from "@/core/contract";

/**
 * Lines the API reported as short on stock (OUT_OF_STOCK details), keyed by product id → units available.
 * Checkout sets these before sending the buyer back to the cart, so the cart can flag the line and offer a fix.
 */
export type ShortLines = Record<string, number>;

const KEY = "storefront.shortLines";
const listeners = new Set<() => void>();
const EMPTY: ShortLines = {};
let cache: { raw: string | null; value: ShortLines } = { raw: null, value: EMPTY };

function read(): ShortLines {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.value;
  let value: ShortLines = EMPTY;
  try {
    value = raw ? (JSON.parse(raw) as ShortLines) : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function write(next: ShortLines) {
  try {
    if (Object.keys(next).length === 0) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the cart simply won't flag the line */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useShortLines(): ShortLines {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Reads `{ lines: [{ productId, available }] }` from an OUT_OF_STOCK error. Returns null for any other error. */
export function shortLinesFromError(error: unknown): ShortLines | null {
  if (!isApiError(error) || error.code !== "OUT_OF_STOCK") return null;
  const lines = (error.details as { lines?: { productId?: unknown; available?: unknown }[] } | undefined)?.lines ?? [];
  const out: ShortLines = {};
  for (const l of lines) if (typeof l.productId === "string" && typeof l.available === "number") out[l.productId] = l.available;
  return out;
}

export function flagShortLines(lines: ShortLines) {
  write({ ...read(), ...lines });
}

export function clearShortLine(productId: string) {
  const next = { ...read() };
  delete next[productId];
  write(next);
}

"use client";

import { useSyncExternalStore } from "react";
import { customerOffersMade, lastCustomerOffer, lastSellerPrice, OPEN_NEGOTIATION_STATUSES, type Negotiation, type NegotiationStatus } from "@/core/contract";

/** Final states: nothing more can happen on the quote. */
export const CLOSED_STATUSES: readonly NegotiationStatus[] = ["rejected", "expired", "cancelled", "ordered"];

export const isQuoteOpen = (n?: Pick<Negotiation, "status"> | null) => !!n && OPEN_NEGOTIATION_STATUSES.includes(n.status);
export const isQuoteClosed = (n?: Pick<Negotiation, "status"> | null) => !!n && CLOSED_STATUSES.includes(n.status);

/**
 * The store's offer limit isn't exposed to the storefront, so derive it from the quote itself
 * (offers made + offers left). Before the first round it falls back to the default of 3.
 */
export const DEFAULT_MAX_OFFERS = 3;
export function maxOffers(n?: Pick<Negotiation, "rounds" | "customerRoundsLeft"> | null): number {
  if (!n) return DEFAULT_MAX_OFFERS;
  return Math.max(1, customerOffersMade(n) + n.customerRoundsLeft);
}

/** Totals at each stage of a quote, for the summary panels. */
export function quoteTotals(n: Pick<Negotiation, "lines" | "rounds">) {
  const listTotalCents = n.lines.reduce((s, l) => s + l.listUnitPriceCents * l.quantity, 0);
  const offered = n.rounds.some((r) => r.by === "customer" && r.action === "offer");
  const countered = n.rounds.some((r) => r.by === "seller" && r.action === "counter");
  return {
    listTotalCents,
    lastOfferTotalCents: offered ? n.lines.reduce((s, l) => s + lastCustomerOffer(n, l.productId) * l.quantity, 0) : null,
    lastCounterTotalCents: countered ? n.lines.reduce((s, l) => s + lastSellerPrice(n, l.productId) * l.quantity, 0) : null,
  };
}

/** Human quote reference, e.g. neg_0004 → Q-0004. */
export const quoteRef = (id: string) => id.replace(/^neg_/, "Q-");

/*
 * The cart only names the quote while it's open (lockedByNegotiationId). Once a quote closes the lock clears,
 * so the last quote this tab worked on is remembered to keep showing its outcome (declined, ordered…).
 */
const KEY = "storefront.lastQuote";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberQuote(id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(KEY, id);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the page still works from the cart's lock */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRememberedQuote(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

"use client";

import { useState } from "react";
import { isPriceWithinBounds, priceBounds, type Negotiation, type PriceLine } from "@/core/contract";
import { centsToInput, formatMoney, toCents } from "@/core/ui";

type Shape = Pick<Negotiation, "lines" | "rounds">;

/**
 * Per-line price entry, validated with the contract rules before anything is sent:
 * each customer offer must sit above their previous offer and below the seller's last price (or list).
 */
export function useOfferForm(n: Shape) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);

  const lines = n.lines.map((l) => {
    const bounds = priceBounds(n, l.productId);
    const raw = values[l.productId] ?? "";
    const cents = toCents(raw);
    const valid = cents !== null && isPriceWithinBounds(n, { productId: l.productId, unitPriceCents: cents });
    const lowest = bounds.minExclusive + 1;
    const highest = bounds.maxExclusive - 1;
    const hint =
      bounds.minExclusive === 0 ? `Below ${formatMoney(bounds.maxExclusive)}` : `Between ${formatMoney(lowest)} and ${formatMoney(highest)}`;
    const midpoint = Math.round((bounds.minExclusive + bounds.maxExclusive) / 2 / 100) * 100;
    const inRange = (c: number) => c > bounds.minExclusive && c < bounds.maxExclusive;
    const suggestions =
      bounds.minExclusive === 0
        ? [10, 15, 20]
            .map((pct) => ({ label: `${pct}% off`, cents: Math.round((l.listUnitPriceCents * (100 - pct)) / 100 / 100) * 100 }))
            .filter((s) => inRange(s.cents))
        : inRange(midpoint)
          ? [{ label: "Meet halfway", cents: midpoint }]
          : [];
    return {
      ...l,
      suggestions,
      bounds,
      raw,
      cents,
      valid,
      hint,
      error: touched && raw !== "" && !valid ? `Enter a price ${hint.toLowerCase()}.` : touched && raw === "" ? "Enter a price." : null,
    };
  });

  const allValid = lines.every((l) => l.valid);
  const priced: PriceLine[] = lines.flatMap((l) => (l.cents !== null ? [{ productId: l.productId, unitPriceCents: l.cents }] : []));
  const offerTotalCents = allValid ? lines.reduce((s, l) => s + (l.cents ?? 0) * l.quantity, 0) : null;

  return {
    lines,
    allValid,
    priced,
    offerTotalCents,
    set: (productId: string, value: string) => setValues((v) => ({ ...v, [productId]: value })),
    setCents: (productId: string, cents: number) => setValues((v) => ({ ...v, [productId]: centsToInput(cents) })),
    touch: () => setTouched(true),
    reset: () => {
      setValues({});
      setTouched(false);
    },
  };
}

export type OfferForm = ReturnType<typeof useOfferForm>;

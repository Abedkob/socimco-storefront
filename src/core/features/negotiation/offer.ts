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
    const noFloor = bounds.minExclusive === 0;
    // "Inférieur à 100,00 $US" / "Entre 80,01 $US et 89,99 $US"
    const hint = noFloor ? `Inférieur à ${formatMoney(bounds.maxExclusive)}` : `Entre ${formatMoney(lowest)} et ${formatMoney(highest)}`;
    const rangeError = noFloor
      ? `Saisissez un prix inférieur à ${formatMoney(bounds.maxExclusive)}.`
      : `Saisissez un prix entre ${formatMoney(lowest)} et ${formatMoney(highest)}.`;
    const midpoint = Math.round((bounds.minExclusive + bounds.maxExclusive) / 2 / 100) * 100;
    const inRange = (c: number) => c > bounds.minExclusive && c < bounds.maxExclusive;
    const suggestions = noFloor
      ? [10, 15, 20]
          // "−10 %" (narrow no-break space before %, as French typesetting wants)
          .map((pct) => ({ label: `−${pct} %`, cents: Math.round((l.listUnitPriceCents * (100 - pct)) / 100 / 100) * 100 }))
          .filter((s) => inRange(s.cents))
      : inRange(midpoint)
        ? [{ label: "À mi-chemin", cents: midpoint }]
        : [];
    return {
      ...l,
      suggestions,
      bounds,
      raw,
      cents,
      valid,
      hint,
      error: touched && raw !== "" && !valid ? rangeError : touched && raw === "" ? "Saisissez un prix." : null,
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

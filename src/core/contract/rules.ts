import type { Negotiation, NegotiationStatus, PriceLine } from "./schemas";

type NegotiationShape = Pick<Negotiation, "lines" | "rounds">;

export const OPEN_NEGOTIATION_STATUSES: readonly NegotiationStatus[] = ["awaiting_seller", "awaiting_customer"];

export function isNegotiationEligible(
  product: { negotiable: boolean; minNegotiableQty: number | null },
  quantity: number,
): boolean {
  return product.negotiable && product.minNegotiableQty !== null && quantity >= product.minNegotiableQty;
}

function latestPrice(n: NegotiationShape, productId: string, by: "customer" | "seller"): number | null {
  const action = by === "customer" ? "offer" : "counter";
  for (let i = n.rounds.length - 1; i >= 0; i--) {
    const round = n.rounds[i];
    if (round.by !== by || round.action !== action) continue;
    const line = round.lines.find((l) => l.productId === productId);
    if (line) return line.unitPriceCents;
  }
  return null;
}

export function lastCustomerOffer(n: NegotiationShape, productId: string): number {
  return latestPrice(n, productId, "customer") ?? 0;
}

export function lastSellerPrice(n: NegotiationShape, productId: string): number {
  const line = n.lines.find((l) => l.productId === productId);
  return latestPrice(n, productId, "seller") ?? line?.listUnitPriceCents ?? 0;
}

/** The next customer offer or seller counter must lie strictly inside these bounds. */
export function priceBounds(n: NegotiationShape, productId: string): { minExclusive: number; maxExclusive: number } {
  return { minExclusive: lastCustomerOffer(n, productId), maxExclusive: lastSellerPrice(n, productId) };
}

export function isPriceWithinBounds(n: NegotiationShape, line: PriceLine): boolean {
  const { minExclusive, maxExclusive } = priceBounds(n, line.productId);
  return Number.isInteger(line.unitPriceCents) && line.unitPriceCents > minExclusive && line.unitPriceCents < maxExclusive;
}

/** A round must price every negotiated line exactly once, each inside its bounds. */
export function areRoundPricesValid(n: NegotiationShape, lines: PriceLine[]): boolean {
  if (lines.length !== n.lines.length) return false;
  const ids = new Set(lines.map((l) => l.productId));
  if (ids.size !== lines.length) return false;
  return n.lines.every((nl) => {
    const line = lines.find((l) => l.productId === nl.productId);
    return line !== undefined && isPriceWithinBounds(n, line);
  });
}

export function customerOffersMade(n: Pick<Negotiation, "rounds">): number {
  return n.rounds.filter((r) => r.by === "customer" && r.action === "offer").length;
}

export function customerRoundsLeft(n: Pick<Negotiation, "rounds">, maxCustomerRounds: number): number {
  return Math.max(0, maxCustomerRounds - customerOffersMade(n));
}

export function computeTotals(
  lines: { quantity: number; listUnitPriceCents: number; unitPriceCents: number }[],
  extra: { shippingCents: number; taxCents: number } = { shippingCents: 0, taxCents: 0 },
) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.listUnitPriceCents * l.quantity, 0);
  const discountCents = lines.reduce((sum, l) => sum + (l.listUnitPriceCents - l.unitPriceCents) * l.quantity, 0);
  return {
    subtotalCents,
    discountCents,
    shippingCents: extra.shippingCents,
    taxCents: extra.taxCents,
    totalCents: subtotalCents - discountCents + extra.shippingCents + extra.taxCents,
  };
}

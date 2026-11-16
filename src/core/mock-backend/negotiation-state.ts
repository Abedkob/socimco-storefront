import {
  ApiError,
  customerRoundsLeft,
  OPEN_NEGOTIATION_STATUSES,
  type Negotiation,
  type NegotiationSummary,
} from "@/core/contract";
import type { NegotiationRecord } from "./seed";
import type { Deps } from "./state";

function unlockCart({ state }: Deps, rec: NegotiationRecord) {
  const cart = state.carts.get(rec.userId);
  if (cart?.lockedByNegotiationId === rec.id) cart.lockedByNegotiationId = null;
}

/** Expiry is evaluated lazily whenever a negotiation is read or written. */
export function refreshNegotiation(deps: Deps, rec: NegotiationRecord) {
  const due = deps.now().getTime() >= Date.parse(rec.expiresAt);
  if (due && (OPEN_NEGOTIATION_STATUSES.includes(rec.status) || rec.status === "accepted")) {
    rec.status = "expired";
    rec.updatedAt = rec.expiresAt;
    unlockCart(deps, rec);
  }
}

export function refreshCartLock(deps: Deps, userId: string) {
  const lockId = deps.state.carts.get(userId)?.lockedByNegotiationId;
  const rec = lockId ? deps.state.negotiations.get(lockId) : undefined;
  if (rec) refreshNegotiation(deps, rec);
}

export function closeNegotiation(deps: Deps, rec: NegotiationRecord, status: "rejected" | "cancelled") {
  rec.status = status;
  unlockCart(deps, rec);
}

/** Throws unless it's `side`'s turn on an open negotiation. */
export function assertTurn(rec: NegotiationRecord, side: "customer" | "seller") {
  if (rec.status === "expired") throw new ApiError("NEGOTIATION_EXPIRED");
  if (!OPEN_NEGOTIATION_STATUSES.includes(rec.status)) throw new ApiError("NEGOTIATION_CLOSED");
  if (rec.status !== (side === "customer" ? "awaiting_customer" : "awaiting_seller")) {
    throw new ApiError("NEGOTIATION_NOT_YOUR_TURN");
  }
}

function customerRef(deps: Deps, rec: NegotiationRecord) {
  const user = deps.state.users.get(rec.userId);
  return { name: user?.name ?? "Unknown customer", company: user?.company ?? "" };
}

export function toNegotiationView(deps: Deps, rec: NegotiationRecord): Negotiation {
  const agreed = rec.agreedLines;
  const listFor = (productId: string) => rec.lines.find((l) => l.productId === productId)?.listUnitPriceCents ?? 0;
  return {
    id: rec.id,
    status: rec.status,
    currency: deps.state.store.currency,
    customer: customerRef(deps, rec),
    lines: structuredClone(rec.lines),
    rounds: structuredClone(rec.rounds),
    customerRoundsLeft: customerRoundsLeft(rec, deps.state.store.negotiation.maxCustomerRounds),
    agreedLines: agreed ? structuredClone(agreed) : null,
    agreedTotalCents: agreed ? agreed.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0) : null,
    savingsCents: agreed ? agreed.reduce((s, l) => s + (listFor(l.productId) - l.unitPriceCents) * l.quantity, 0) : null,
    expiresAt: rec.expiresAt,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

export function toNegotiationSummary(deps: Deps, rec: NegotiationRecord): NegotiationSummary {
  const listTotalCents = rec.lines.reduce((s, l) => s + l.listUnitPriceCents * l.quantity, 0);
  const qty = (productId: string) => rec.lines.find((l) => l.productId === productId)?.quantity ?? 0;
  const lastPriced = [...rec.rounds].reverse().find((r) => r.lines.length > 0);
  const latestPriceTotalCents = rec.agreedLines
    ? rec.agreedLines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0)
    : lastPriced
      ? lastPriced.lines.reduce((s, l) => s + l.unitPriceCents * qty(l.productId), 0)
      : listTotalCents;
  return {
    id: rec.id,
    status: rec.status,
    customer: customerRef(deps, rec),
    itemCount: rec.lines.reduce((s, l) => s + l.quantity, 0),
    listTotalCents,
    latestPriceTotalCents,
    expiresAt: rec.expiresAt,
    updatedAt: rec.updatedAt,
  };
}

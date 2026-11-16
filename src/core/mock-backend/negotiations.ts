import {
  ApiError,
  areRoundPricesValid,
  customerRoundsLeft,
  isNegotiationEligible,
  lastCustomerOffer,
  lastSellerPrice,
  type RequestContext,
  type ShopBackend,
} from "@/core/contract";
import { requireRole } from "./auth";
import {
  assertTurn,
  closeNegotiation,
  refreshCartLock,
  refreshNegotiation,
  toNegotiationSummary,
  toNegotiationView,
} from "./negotiation-state";
import type { NegotiationRecord } from "./seed";
import { getCart, HOUR_MS, iso, type Deps } from "./state";

function addRound(
  deps: Deps,
  rec: NegotiationRecord,
  round: Omit<NegotiationRecord["rounds"][number], "n" | "createdAt">,
) {
  const nowIso = deps.now().toISOString();
  rec.rounds.push({ ...round, n: rec.rounds.length + 1, createdAt: nowIso });
  rec.updatedAt = nowIso;
}

function extendOpenExpiry(deps: Deps, rec: NegotiationRecord) {
  rec.expiresAt = iso(deps.now().getTime() + deps.state.store.negotiation.offerExpiryHours * HOUR_MS);
}

function accept(deps: Deps, rec: NegotiationRecord, priceOf: (productId: string) => number) {
  const nowMs = deps.now().getTime();
  rec.agreedLines = rec.lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    unitPriceCents: priceOf(l.productId),
  }));
  rec.status = "accepted";
  rec.acceptedAt = iso(nowMs);
  rec.expiresAt = iso(nowMs + deps.state.store.negotiation.acceptedPriceValidHours * HOUR_MS);
}

export function createNegotiations(deps: Deps): ShopBackend["negotiations"] {
  const { state } = deps;

  function owned(ctx: RequestContext, id: string) {
    const user = requireRole(deps, ctx, "customer");
    const rec = state.negotiations.get(id);
    if (!rec || rec.userId !== user.id) throw new ApiError("NOT_FOUND", { message: "Devis introuvable." });
    refreshNegotiation(deps, rec);
    return rec;
  }

  return {
    async create(ctx, body) {
      const user = requireRole(deps, ctx, "customer");
      if (!state.store.negotiation.enabled) throw new ApiError("NEGOTIATION_NOT_ELIGIBLE");
      refreshCartLock(deps, user.id);
      const cart = getCart(state, user.id);
      if (cart.lockedByNegotiationId) throw new ApiError("CART_LOCKED");

      const ids = body.lines.map((l) => l.productId);
      if (new Set(ids).size !== ids.length) {
        throw new ApiError("VALIDATION_FAILED", { message: "Chaque produit ne peut figurer qu'une seule fois." });
      }
      const lines = ids.map((productId) => {
        const item = cart.items.find((i) => i.productId === productId);
        const product = state.products.get(productId);
        if (!item || !product || !isNegotiationEligible(product, item.quantity)) {
          throw new ApiError("NEGOTIATION_NOT_ELIGIBLE", { details: { productId } });
        }
        if (item.quantity > product.stock) {
          throw new ApiError("OUT_OF_STOCK", {
            details: { lines: [{ productId, requested: item.quantity, available: product.stock }] },
          });
        }
        return { productId, name: product.name, quantity: item.quantity, listUnitPriceCents: product.priceCents };
      });

      if (!areRoundPricesValid({ lines, rounds: [] }, body.lines)) throw new ApiError("NEGOTIATION_INVALID_PRICE");

      const nowIso = deps.now().toISOString();
      state.seq.negotiation += 1;
      const rec: NegotiationRecord = {
        id: `neg_${String(state.seq.negotiation).padStart(4, "0")}`,
        userId: user.id,
        status: "awaiting_seller",
        lines,
        rounds: [],
        agreedLines: null,
        acceptedAt: null,
        expiresAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      addRound(deps, rec, { by: "customer", action: "offer", lines: body.lines, message: body.message || null });
      extendOpenExpiry(deps, rec);
      state.negotiations.set(rec.id, rec);
      cart.lockedByNegotiationId = rec.id;
      return toNegotiationView(deps, rec);
    },

    async get(ctx, id) {
      return toNegotiationView(deps, owned(ctx, id));
    },

    async round(ctx, id, body) {
      const rec = owned(ctx, id);
      assertTurn(rec, "customer");
      const message = body.message || null;

      if (body.action === "offer") {
        if (customerRoundsLeft(rec, state.store.negotiation.maxCustomerRounds) === 0) {
          throw new ApiError("NEGOTIATION_NO_ROUNDS_LEFT");
        }
        if (!areRoundPricesValid(rec, body.lines)) throw new ApiError("NEGOTIATION_INVALID_PRICE");
        addRound(deps, rec, { by: "customer", action: "offer", lines: body.lines, message });
        rec.status = "awaiting_seller";
        extendOpenExpiry(deps, rec);
      } else if (body.action === "accept") {
        addRound(deps, rec, { by: "customer", action: "accept", lines: [], message });
        accept(deps, rec, (productId) => lastSellerPrice(rec, productId));
      } else {
        addRound(deps, rec, { by: "customer", action: "reject", lines: [], message });
        closeNegotiation(deps, rec, "rejected");
      }
      return toNegotiationView(deps, rec);
    },

    async cancel(ctx, id) {
      const rec = owned(ctx, id);
      if (rec.status === "expired") throw new ApiError("NEGOTIATION_EXPIRED");
      if (!["awaiting_seller", "awaiting_customer", "accepted"].includes(rec.status)) {
        throw new ApiError("NEGOTIATION_CLOSED");
      }
      rec.updatedAt = deps.now().toISOString();
      closeNegotiation(deps, rec, "cancelled");
      return toNegotiationView(deps, rec);
    },
  };
}

export function createSeller(deps: Deps): ShopBackend["seller"] {
  const { state } = deps;

  function find(ctx: RequestContext, id: string) {
    requireRole(deps, ctx, "seller");
    const rec = state.negotiations.get(id);
    if (!rec) throw new ApiError("NOT_FOUND", { message: "Devis introuvable." });
    refreshNegotiation(deps, rec);
    return rec;
  }

  return {
    async list(ctx, query) {
      requireRole(deps, ctx, "seller");
      const items = [...state.negotiations.values()]
        .map((rec) => {
          refreshNegotiation(deps, rec);
          return rec;
        })
        .filter((rec) => !query.status || rec.status === query.status)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((rec) => toNegotiationSummary(deps, rec));
      return { items };
    },

    async get(ctx, id) {
      return toNegotiationView(deps, find(ctx, id));
    },

    async round(ctx, id, body) {
      const rec = find(ctx, id);
      assertTurn(rec, "seller");
      const message = body.message || null;

      if (body.action === "counter") {
        if (!areRoundPricesValid(rec, body.lines)) throw new ApiError("NEGOTIATION_INVALID_PRICE");
        addRound(deps, rec, { by: "seller", action: "counter", lines: body.lines, message });
        rec.status = "awaiting_customer";
        extendOpenExpiry(deps, rec);
      } else if (body.action === "accept") {
        addRound(deps, rec, { by: "seller", action: "accept", lines: [], message });
        accept(deps, rec, (productId) => lastCustomerOffer(rec, productId));
      } else {
        addRound(deps, rec, { by: "seller", action: "reject", lines: [], message });
        closeNegotiation(deps, rec, "rejected");
      }
      return toNegotiationView(deps, rec);
    },
  };
}

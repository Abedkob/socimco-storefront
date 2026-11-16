import {
  ApiError,
  computeTotals,
  IdempotencyKey,
  type Order,
  type OrderLine,
  type ShopBackend,
} from "@/core/contract";
import { requireRole } from "./auth";
import { refreshCartLock, refreshNegotiation } from "./negotiation-state";
import type { NegotiationRecord, OrderRecord } from "./seed";
import { getCart, getProduct, type Deps } from "./state";

function toOrderView(rec: OrderRecord): Order {
  const { userId: _userId, ...order } = structuredClone(rec);
  return order;
}

export function createOrders(deps: Deps): ShopBackend["orders"] {
  const { state, now } = deps;

  return {
    async place(ctx, body) {
      const user = requireRole(deps, ctx, "customer");

      if (!body.idempotencyKey) throw new ApiError("IDEMPOTENCY_KEY_REQUIRED");
      if (!IdempotencyKey.safeParse(body.idempotencyKey).success) {
        throw new ApiError("VALIDATION_FAILED", { message: "L'en-tête Idempotency-Key doit être un UUID." });
      }
      const idemKey = `${user.id}:${body.idempotencyKey}`;
      const previousId = state.idempotency.get(idemKey);
      const previous = previousId ? state.orders.get(previousId) : undefined;
      if (previous) return { order: toOrderView(previous), created: false };

      refreshCartLock(deps, user.id);
      const cart = getCart(state, user.id);
      if (cart.items.length === 0) throw new ApiError("CART_EMPTY");

      const address = user.addresses.find((a) => a.id === body.shippingAddressId);
      if (!address) throw new ApiError("ADDRESS_NOT_FOUND");

      let negotiation: NegotiationRecord | null = null;
      if (body.negotiationId) {
        const rec = state.negotiations.get(body.negotiationId);
        if (!rec || rec.userId !== user.id) throw new ApiError("NEGOTIATION_NOT_ACCEPTED");
        refreshNegotiation(deps, rec);
        if (rec.status === "expired") throw new ApiError("NEGOTIATION_EXPIRED");
        if (rec.status !== "accepted" || cart.lockedByNegotiationId !== rec.id) {
          throw new ApiError("NEGOTIATION_NOT_ACCEPTED");
        }
        negotiation = rec;
      } else if (cart.lockedByNegotiationId) {
        throw new ApiError("NEGOTIATION_NOT_ACCEPTED", {
          message: "Finalisez ou annulez le devis en cours avant de commander.",
        });
      }

      const short = cart.items
        .map((i) => ({ productId: i.productId, requested: i.quantity, available: getProduct(state, i.productId).stock }))
        .filter((l) => l.requested > l.available);
      if (short.length > 0) throw new ApiError("OUT_OF_STOCK", { details: { lines: short } });

      const lines: OrderLine[] = cart.items.map((item) => {
        const product = getProduct(state, item.productId);
        const agreed = negotiation?.agreedLines?.find((l) => l.productId === item.productId);
        const snapshot = negotiation?.lines.find((l) => l.productId === item.productId);
        const listUnitPriceCents = agreed && snapshot ? snapshot.listUnitPriceCents : product.priceCents;
        return {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          imageUrl: product.images[0],
          quantity: item.quantity,
          listUnitPriceCents,
          unitPriceCents: agreed ? agreed.unitPriceCents : product.priceCents,
          negotiated: Boolean(agreed),
        };
      });

      // Everything below mutates state; all checks have passed.
      const createdAt = now();
      state.seq.order += 1;
      const seq = state.seq.order;
      const { id: _id, isDefault: _isDefault, ...shippingAddress } = address;
      const rec: OrderRecord = {
        id: `ord_${seq}`,
        number: `TP-${createdAt.getUTCFullYear()}-${seq}`,
        userId: user.id,
        status: "confirmed",
        negotiationId: negotiation?.id ?? null,
        currency: state.store.currency,
        lines,
        ...computeTotals(lines),
        shippingAddress,
        createdAt: createdAt.toISOString(),
      };
      for (const item of cart.items) getProduct(state, item.productId).stock -= item.quantity;
      cart.items = [];
      cart.lockedByNegotiationId = null;
      if (negotiation) {
        negotiation.status = "ordered";
        negotiation.updatedAt = rec.createdAt;
      }
      state.orders.set(rec.id, rec);
      state.idempotency.set(idemKey, rec.id);
      return { order: toOrderView(rec), created: true };
    },

    async list(ctx, query) {
      const user = requireRole(deps, ctx, "customer");
      const items = [...state.orders.values()]
        .filter((o) => o.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, query.limit)
        .map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          itemCount: o.lines.reduce((s, l) => s + l.quantity, 0),
          totalCents: o.totalCents,
          negotiated: o.negotiationId !== null,
          savingsCents: o.discountCents,
          createdAt: o.createdAt,
        }));
      return { items };
    },

    async get(ctx, id) {
      const user = requireRole(deps, ctx, "customer");
      const rec = state.orders.get(id);
      if (!rec || rec.userId !== user.id) throw new ApiError("NOT_FOUND", { message: "Commande introuvable." });
      return { order: toOrderView(rec) };
    },
  };
}

import { ApiError, isNegotiationEligible, type Cart, type Product, type ShopBackend } from "@/core/contract";
import { requireRole } from "./auth";
import { refreshCartLock } from "./negotiation-state";
import { getCart, getProduct, type CartRecord, type Deps } from "./state";

const MAX_QUANTITY = 100_000;

export function assertOrderableQuantity(product: Product, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < product.minOrderQty || quantity > MAX_QUANTITY) {
    throw new ApiError("QUANTITY_INVALID", {
      message: `Order at least ${product.minOrderQty}.`,
      details: { productId: product.id, minOrderQty: product.minOrderQty },
    });
  }
  if (quantity > product.stock) {
    throw new ApiError("OUT_OF_STOCK", {
      details: { lines: [{ productId: product.id, requested: quantity, available: product.stock }] },
    });
  }
}

export function toCartView({ state }: Deps, cart: CartRecord): Cart {
  const items = cart.items.map(({ productId, quantity }) => {
    const p = getProduct(state, productId);
    return {
      productId,
      sku: p.sku,
      name: p.name,
      imageUrl: p.images[0],
      unit: p.unit,
      quantity,
      unitPriceCents: p.priceCents,
      lineTotalCents: p.priceCents * quantity,
      negotiationEligible: state.store.negotiation.enabled && isNegotiationEligible(p, quantity),
    };
  });
  return {
    lockedByNegotiationId: cart.lockedByNegotiationId,
    currency: state.store.currency,
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    subtotalCents: items.reduce((s, i) => s + i.lineTotalCents, 0),
  };
}

export function createCartApi(deps: Deps): ShopBackend["cart"] {
  const { state } = deps;

  function unlockedCart(userId: string): CartRecord {
    refreshCartLock(deps, userId);
    const cart = getCart(state, userId);
    if (cart.lockedByNegotiationId) throw new ApiError("CART_LOCKED");
    return cart;
  }

  return {
    async get(ctx) {
      const user = requireRole(deps, ctx, "customer");
      refreshCartLock(deps, user.id);
      return toCartView(deps, getCart(state, user.id));
    },

    async addItem(ctx, body) {
      const user = requireRole(deps, ctx, "customer");
      const cart = unlockedCart(user.id);
      const product = getProduct(state, body.productId);
      const existing = cart.items.find((i) => i.productId === product.id);
      const quantity = (existing?.quantity ?? 0) + body.quantity;
      assertOrderableQuantity(product, quantity);
      if (existing) existing.quantity = quantity;
      else cart.items.push({ productId: product.id, quantity });
      return toCartView(deps, cart);
    },

    async updateItem(ctx, productId, body) {
      const user = requireRole(deps, ctx, "customer");
      const cart = unlockedCart(user.id);
      const item = cart.items.find((i) => i.productId === productId);
      if (!item) throw new ApiError("NOT_FOUND", { message: "This item isn't in your cart." });
      assertOrderableQuantity(getProduct(state, productId), body.quantity);
      item.quantity = body.quantity;
      return toCartView(deps, cart);
    },

    async removeItem(ctx, productId) {
      const user = requireRole(deps, ctx, "customer");
      const cart = unlockedCart(user.id);
      cart.items = cart.items.filter((i) => i.productId !== productId);
      return toCartView(deps, cart);
    },
  };
}

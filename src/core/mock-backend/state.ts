import { ApiError, type Category, type Product, type QrStatus, type StoreConfig } from "@/core/contract";
import type { RateLimiter } from "./rate-limit";
import type { NegotiationRecord, OrderRecord, Seed, SeedUser } from "./seed";

export interface CartRecord {
  items: { productId: string; quantity: number }[];
  lockedByNegotiationId: string | null;
}

export interface SessionRecord {
  userId: string;
  expiresAtMs: number;
}

export interface QrRecord {
  id: string;
  codeHash: string;
  pollTokenHash: string;
  status: QrStatus;
  createdAtMs: number;
  expiresAtMs: number;
  desktopUserAgent: string;
  scannedByUserId: string | null;
  approvedByUserId: string | null;
}

/** Phone sign-in: a code shown by a signed-in computer (the owner) for a phone to scan. */
export interface PhoneCodeRecord {
  id: string;
  codeHash: string;
  ownerUserId: string;
  requireApproval: boolean;
  status: QrStatus;
  createdAtMs: number;
  expiresAtMs: number;
  /** Set when a phone redeems the code in approval mode: binds that phone. */
  phonePollTokenHash: string | null;
  phoneUserAgent: string | null;
}

export interface MockState {
  store: StoreConfig;
  users: Map<string, SeedUser>;
  usersByUsername: Map<string, SeedUser>;
  categories: Category[];
  products: Map<string, Product>;
  productsBySlug: Map<string, Product>;
  carts: Map<string, CartRecord>;
  negotiations: Map<string, NegotiationRecord>;
  orders: Map<string, OrderRecord>;
  idempotency: Map<string, string>;
  sessions: Map<string, SessionRecord>;
  qr: Map<string, QrRecord>;
  qrByCodeHash: Map<string, string>;
  phoneCodes: Map<string, PhoneCodeRecord>;
  phoneCodeByCodeHash: Map<string, string>;
  seq: { negotiation: number; order: number };
}

export interface Deps {
  state: MockState;
  now: () => Date;
  limiter: RateLimiter;
}

export function createState(seed: Seed): MockState {
  const s = structuredClone(seed);
  const products = new Map(s.products.map((p) => [p.id, p]));
  const maxNegotiation = Math.max(0, ...s.negotiations.map((n) => Number(n.id.replace(/\D/g, "")) || 0));
  const maxOrder = Math.max(0, ...s.orders.map((o) => Number(o.number.split("-").at(-1))));
  return {
    store: s.store,
    users: new Map(s.users.map((u) => [u.id, u])),
    usersByUsername: new Map(s.users.map((u) => [u.username.toLowerCase(), u])),
    categories: s.categories,
    products,
    productsBySlug: new Map(s.products.map((p) => [p.slug, p])),
    carts: new Map(),
    negotiations: new Map(s.negotiations.map((n) => [n.id, n])),
    orders: new Map(s.orders.map((o) => [o.id, o])),
    idempotency: new Map(),
    sessions: new Map(),
    qr: new Map(),
    qrByCodeHash: new Map(),
    phoneCodes: new Map(),
    phoneCodeByCodeHash: new Map(),
    seq: { negotiation: maxNegotiation, order: maxOrder },
  };
}

export function getProduct(state: MockState, productId: string): Product {
  const product = state.products.get(productId);
  if (!product) throw new ApiError("NOT_FOUND", { message: "Product not found." });
  return product;
}

export function getCart(state: MockState, userId: string): CartRecord {
  let cart = state.carts.get(userId);
  if (!cart) {
    cart = { items: [], lockedByNegotiationId: null };
    state.carts.set(userId, cart);
  }
  return cart;
}

export const HOUR_MS = 3_600_000;
export const iso = (ms: number) => new Date(ms).toISOString();

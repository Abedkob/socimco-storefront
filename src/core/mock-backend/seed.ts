import { z } from "zod";
import {
  AgreedLine,
  Category,
  computeTotals,
  NegotiationLine,
  NegotiationRound,
  NegotiationStatus,
  Order,
  Product,
  StoreConfig,
  Timestamp,
  User,
} from "@/core/contract";
import categoriesJson from "./data/categories.json";
import negotiationsJson from "./data/negotiations.json";
import ordersJson from "./data/orders.json";
import productsJson from "./data/products.json";
import storeJson from "./data/store.json";
import usersJson from "./data/users.json";

export const SeedUser = User.extend({
  username: z.string().min(1),
  password: z.string().min(1),
  active: z.boolean(),
});
export type SeedUser = z.infer<typeof SeedUser>;

export const NegotiationRecord = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  status: NegotiationStatus,
  lines: z.array(NegotiationLine).min(1),
  rounds: z.array(NegotiationRound),
  agreedLines: z.array(AgreedLine).nullable(),
  acceptedAt: Timestamp.nullable(),
  expiresAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type NegotiationRecord = z.infer<typeof NegotiationRecord>;

export const OrderRecord = Order.extend({ userId: z.string().min(1) });
export type OrderRecord = z.infer<typeof OrderRecord>;

export const Seed = z.object({
  store: StoreConfig,
  users: z.array(SeedUser),
  categories: z.array(Category),
  products: z.array(Product),
  negotiations: z.array(NegotiationRecord),
  orders: z.array(OrderRecord),
});
export type Seed = z.infer<typeof Seed>;

export const RAW_SEED = {
  store: storeJson,
  users: usersJson,
  categories: categoriesJson,
  products: productsJson,
  negotiations: negotiationsJson,
  orders: ordersJson,
};

export function loadSeed(): Seed {
  return Seed.parse(structuredClone(RAW_SEED));
}

/** Facts the contract suite and the browser tests rely on. */
export const REFERENCE_FIXTURE = {
  drill: { id: "prd_drill_18v", priceCents: 10000, stock: 1200, minOrderQty: 1, negotiable: true, minNegotiableQty: 100 },
  hammer: { id: "prd_hammer_16oz", priceCents: 1850, stock: 3000, negotiable: false },
  nextOrderNumber: 1004,
} as const;

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) (seen.has(v) ? dupes : seen).add(v);
  return [...dupes];
}

/** Referential integrity and fixture checks beyond what the zod schemas express. */
export function checkSeedIntegrity(seed: Seed): string[] {
  const issues: string[] = [];
  const unique = (label: string, values: string[]) => {
    for (const d of duplicates(values)) issues.push(`Duplicate ${label}: ${d}`);
  };

  unique("user id", seed.users.map((u) => u.id));
  unique("username", seed.users.map((u) => u.username.toLowerCase()));
  unique("address id", seed.users.flatMap((u) => u.addresses.map((a) => a.id)));
  unique("category id", seed.categories.map((c) => c.id));
  unique("category slug", seed.categories.map((c) => c.slug));
  unique("product id", seed.products.map((p) => p.id));
  unique("product slug", seed.products.map((p) => p.slug));
  unique("product sku", seed.products.map((p) => p.sku));
  unique("negotiation id", seed.negotiations.map((n) => n.id));
  unique("order id", seed.orders.map((o) => o.id));
  unique("order number", seed.orders.map((o) => o.number));

  const users = new Map(seed.users.map((u) => [u.id, u]));
  const categories = new Map(seed.categories.map((c) => [c.id, c]));
  const products = new Map(seed.products.map((p) => [p.id, p]));
  const negotiations = new Map(seed.negotiations.map((n) => [n.id, n]));

  for (const u of seed.users) {
    if (u.role === "seller" && u.addresses.length > 0) issues.push(`Seller ${u.id} should not have addresses`);
    if (u.addresses.filter((a) => a.isDefault).length > 1) issues.push(`User ${u.id} has more than one default address`);
  }

  for (const c of seed.categories) {
    if (c.parentId === null) continue;
    const parent = categories.get(c.parentId);
    if (!parent) issues.push(`Category ${c.id} has unknown parent ${c.parentId}`);
    else if (parent.parentId !== null) issues.push(`Category ${c.id} is nested more than two levels`);
  }

  for (const p of seed.products) {
    if (!categories.has(p.categoryId)) issues.push(`Product ${p.id} has unknown category ${p.categoryId}`);
  }

  for (const n of seed.negotiations) {
    const user = users.get(n.userId);
    if (!user || user.role !== "customer") issues.push(`Negotiation ${n.id} must belong to a customer`);
    for (const l of n.lines) if (!products.has(l.productId)) issues.push(`Negotiation ${n.id} has unknown product ${l.productId}`);
    n.rounds.forEach((r, i) => {
      if (r.n !== i + 1) issues.push(`Negotiation ${n.id} round ${i + 1} is numbered ${r.n}`);
    });
    if (["accepted", "ordered"].includes(n.status) && (!n.agreedLines || !n.acceptedAt)) {
      issues.push(`Negotiation ${n.id} is ${n.status} without agreed lines`);
    }
  }

  for (const o of seed.orders) {
    const user = users.get(o.userId);
    if (!user || user.role !== "customer") issues.push(`Order ${o.id} must belong to a customer`);
    for (const l of o.lines) if (!products.has(l.productId)) issues.push(`Order ${o.id} has unknown product ${l.productId}`);
    const totals = computeTotals(o.lines, { shippingCents: o.shippingCents, taxCents: o.taxCents });
    for (const key of ["subtotalCents", "discountCents", "totalCents"] as const) {
      if (totals[key] !== o[key]) issues.push(`Order ${o.id} ${key} is ${o[key]}, expected ${totals[key]}`);
    }
    if (o.negotiationId !== null) {
      const n = negotiations.get(o.negotiationId);
      if (!n) issues.push(`Order ${o.id} references unknown negotiation ${o.negotiationId}`);
      else if (n.userId !== o.userId || n.status !== "ordered") {
        issues.push(`Order ${o.id} negotiation ${n.id} must be the same customer's and ordered`);
      }
    }
    if (o.lines.some((l) => l.negotiated) !== (o.negotiationId !== null)) {
      issues.push(`Order ${o.id} negotiated lines don't match its negotiationId`);
    }
  }

  const drill = products.get(REFERENCE_FIXTURE.drill.id);
  const ref = REFERENCE_FIXTURE.drill;
  if (
    !drill ||
    drill.priceCents !== ref.priceCents ||
    drill.stock !== ref.stock ||
    drill.minOrderQty !== ref.minOrderQty ||
    drill.negotiable !== ref.negotiable ||
    drill.minNegotiableQty !== ref.minNegotiableQty
  ) {
    issues.push(`Reference product ${ref.id} doesn't match the reference scenario`);
  }
  const hammer = products.get(REFERENCE_FIXTURE.hammer.id);
  const refH = REFERENCE_FIXTURE.hammer;
  if (!hammer || hammer.priceCents !== refH.priceCents || hammer.stock !== refH.stock || hammer.negotiable !== refH.negotiable) {
    issues.push(`Reference product ${refH.id} doesn't match the reference scenario`);
  }

  const byName = new Map(seed.users.map((u) => [u.username, u]));
  const customer = byName.get("demo.customer");
  if (!customer?.active || customer.role !== "customer" || !customer.addresses.some((a) => a.id === "adr_01")) {
    issues.push("demo.customer must be an active customer with address adr_01");
  }
  if (byName.get("demo.inactive")?.active !== false) issues.push("demo.inactive must exist and be inactive");
  if (byName.get("demo.seller")?.role !== "seller") issues.push("demo.seller must exist with role seller");

  const maxNumber = Math.max(0, ...seed.orders.map((o) => Number(o.number.split("-").at(-1))));
  if (maxNumber + 1 !== REFERENCE_FIXTURE.nextOrderNumber) {
    issues.push(`Next order number would be ${maxNumber + 1}, expected ${REFERENCE_FIXTURE.nextOrderNumber}`);
  }

  return issues;
}

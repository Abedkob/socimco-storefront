/**
 * THE FILE TO EDIT when connecting the storefront to the real SOCIMCO backend.
 * Full guide: src/core/api/README.md
 *
 * Turn it on with NEXT_PUBLIC_API_ADAPTER=custom (and NEXT_PUBLIC_API_BASE_URL=<backend origin>).
 * Until then the app uses `contractAdapter`, which expects the backend to speak our contract exactly.
 *
 * How to fill it in, route by route:
 *   1. Only the URL differs?            → add it to `endpoints`.
 *   2. Field names / formats differ?    → reshape in `toRequest` (outgoing) and `fromResponse` (incoming).
 *   3. One screen needs several calls?  → write a `handlers` entry (it can call `request()` as often as needed).
 *   4. Their errors look different?     → map them in `toError`.
 *   5. They use bearer tokens?          → return the token in `readToken`, and set NEXT_PUBLIC_API_AUTH=bearer.
 * Every response is then validated against src/core/contract/schemas.ts; a mismatch is logged with the exact field.
 *
 * Everything below is commented-out EXAMPLES using a made-up backend. Delete what you don't need.
 */
import type { ApiAdapter } from "../adapter";
// import { ApiError } from "@/core/contract";

// ----- Helpers you will probably want -----
// Money: the storefront uses integer cents. "100.00" or 100 (units) → 10000.
// const toCents = (v: string | number) => Math.round(Number(v) * 100);
// Status names: map theirs to ours.
// const QUOTE_STATUS: Record<string, string> = { PENDING_SELLER: "awaiting_seller", COUNTERED: "awaiting_customer", AGREED: "accepted" };

export const customAdapter: ApiAdapter = {
  // 1. Their URLs for our routes (method defaults to ours). Full list of routes: src/core/contract/routes.ts
  endpoints: {
    // login: { path: "/v1/auth/login" },
    // me: { path: "/v1/auth/me" },
    // products: { path: "/v1/catalog/products" },
    // product: { path: "/v1/catalog/products/:slug" },
    // cart: { path: "/v1/cart" },
    // cartAdd: { path: "/v1/cart/lines" },
    // orders: { path: "/v1/orders" },
  },

  // 2a. Our request → theirs.
  // toRequest: (route, input) => {
  //   if (route === "login") {
  //     const b = input.body as { username: string; password: string };
  //     return { body: { email: b.username, password: b.password } };
  //   }
  //   if (route === "products") {
  //     const q = input.query as { page: number; sort: string; category?: string; q?: string };
  //     return { query: { offset: (q.page - 1) * 24, limit: 24, order: q.sort, category: q.category, search: q.q } };
  //   }
  //   return input;
  // },

  // 2b. Their response → our contract's shape (see schemas.ts for every field).
  // fromResponse: (route, json) => {
  //   const j = json as any;
  //   if (route === "login" || route === "me") return { user: mapUser(j.data) };
  //   if (route === "product") return { product: mapProduct(j.data) };
  //   if (route === "products") return { items: j.data.map(mapListItem), page: j.meta.page, pageSize: j.meta.per_page, total: j.meta.total };
  //   return json;
  // },

  // 3. Routes that need more than one call (all to the same backend).
  handlers: {
    // product: async ({ params }, { request }) => {
    //   const p = (await request(`/v1/products/${params.slug}`)) as any;
    //   const stock = (await request(`/v1/inventory/${p.id}`)) as any;
    //   return { product: { ...mapProduct(p), stock: stock.available } };
    // },
    // cart: async (_input, { request }) => {
    //   const c = (await request("/v1/cart")) as any;
    //   const items = c.lines.map((l: any) => ({ ...mapCartLine(l), lineTotalCents: toCents(l.price) * l.qty }));
    //   return { lockedByNegotiationId: c.quote_id ?? null, currency: "USD", items, itemCount: items.reduce((s: number, i: any) => s + i.quantity, 0), subtotalCents: items.reduce((s: number, i: any) => s + i.lineTotalCents, 0) };
    // },
  },

  // 4. Their error body → our error codes (codes: src/core/contract/errors.ts). Return null to fall back to the HTTP status.
  // toError: (status, json) => {
  //   const code = (json as any)?.error_code;
  //   if (code === "BAD_LOGIN") return new ApiError("INVALID_CREDENTIALS");
  //   if (code === "NOT_ENOUGH_STOCK") return new ApiError("OUT_OF_STOCK");
  //   return null;
  // },

  // 5. Bearer tokens only.
  // readToken: (_route, json) => (json as any)?.access_token ?? null,
};

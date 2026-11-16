import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/core/contract";
import { createApiRoute } from "@/core/api/server";
import { createMockBackend, loadSeed } from "@/core/mock-backend";
import { createHttpClient, createStorefrontApi, createTokenStore, type ApiAdapter } from "./index";

const ORIGIN = "http://localhost:3001";
const DRILL = "prd_drill_18v";

/** A fetch that behaves like a browser on the storefront's origin: sends Origin, keeps a cookie jar. */
function browserFetch(handler: ReturnType<typeof createApiRoute>, ip = "10.1.1.1"): typeof fetch {
  const jar = new Map<string, string>();
  return async (input, init) => {
    const req = new Request(input, init);
    const headers = new Headers(req.headers);
    headers.set("origin", ORIGIN);
    headers.set("user-agent", "vitest-browser");
    headers.set("x-forwarded-for", ip);
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.set("cookie", cookie);
    const body = init?.body ?? undefined;
    const res = await handler[req.method as "GET"](new Request(req.url, { method: req.method, headers, body }));
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      if (attrs.some((a) => a.trim().toLowerCase() === "max-age=0")) jar.delete(name);
      else jar.set(name, pair.slice(i + 1).trim());
    }
    return res;
  };
}

function setup() {
  const handler = createApiRoute(createMockBackend(loadSeed()));
  const api = createStorefrontApi(createHttpClient({ baseUrl: ORIGIN, auth: "cookie", timeoutMs: 5_000, fetch: browserFetch(handler) }));
  // The sales desk is not part of the storefront client; it acts through raw HTTP, like the client's back office would.
  const desk = browserFetch(handler, "10.2.2.2");
  const deskCall = async (method: string, path: string, body?: unknown) => {
    const res = await desk(`${ORIGIN}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`desk ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  };
  return { api, deskCall };
}

describe("storefront API client against the mock backend over HTTP", () => {
  it("plays the reference scenario end to end: 400 drills, $80 → $90 → $85, order TP-2026-1004", async () => {
    const { api, deskCall } = setup();

    await expect(api.cart.get()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const { user } = await api.auth.login({ username: "demo.customer", password: "demo1234" });
    expect(user.company).toBe("BuildCo Ltd");
    expect((await api.auth.me()).user.id).toBe(user.id);

    const { categories } = await api.catalog.categories();
    expect(categories.length).toBeGreaterThan(0);
    const { items } = await api.catalog.products({ category: "drills" });
    expect(items.some((p) => p.id === DRILL)).toBe(true);
    expect((await api.catalog.product("18v-cordless-drill-driver")).product.priceCents).toBe(10_000);

    let cart = await api.cart.add({ productId: DRILL, quantity: 100 });
    cart = await api.cart.update(DRILL, 400);
    expect(cart.subtotalCents).toBe(4_000_000);

    let n = await api.negotiations.create({ lines: [{ productId: DRILL, unitPriceCents: 8_000 }] });
    expect(n.status).toBe("awaiting_seller");
    await expect(api.cart.update(DRILL, 500)).rejects.toMatchObject({ code: "CART_LOCKED" });

    await deskCall("POST", "/api/auth/login", { username: "demo.seller", password: "demo1234" });
    await deskCall("POST", `/api/seller/negotiations/${n.id}/rounds`, { action: "counter", lines: [{ productId: DRILL, unitPriceCents: 9_000 }] });
    n = await api.negotiations.get(n.id);
    expect(n.status).toBe("awaiting_customer");

    await expect(api.negotiations.offer(n.id, [{ productId: DRILL, unitPriceCents: 9_500 }])).rejects.toMatchObject({ code: "NEGOTIATION_INVALID_PRICE" });
    n = await api.negotiations.offer(n.id, [{ productId: DRILL, unitPriceCents: 8_500 }]);
    await deskCall("POST", `/api/seller/negotiations/${n.id}/rounds`, { action: "accept" });
    n = await api.negotiations.get(n.id);
    expect(n).toMatchObject({ status: "accepted", agreedTotalCents: 3_400_000, savingsCents: 600_000 });

    const key = crypto.randomUUID();
    const first = await api.orders.place({ shippingAddressId: "adr_01", negotiationId: n.id }, key);
    expect(first.order).toMatchObject({ number: "TP-2026-1004", totalCents: 3_400_000, discountCents: 600_000 });
    const retry = await api.orders.place({ shippingAddressId: "adr_01", negotiationId: n.id }, key);
    expect(retry.order.id).toBe(first.order.id);

    const orders = await api.orders.list({ limit: 5 });
    expect(orders.items[0]).toMatchObject({ number: "TP-2026-1004", negotiated: true });
    expect((await api.catalog.product("18v-cordless-drill-driver")).product.stock).toBe(800);

    await api.auth.logout();
    await expect(api.auth.me()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("maps the API's error envelope onto typed errors", async () => {
    const { api } = setup();
    const error = await api.auth.login({ username: "demo.customer", password: "nope" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
  });
});

describe("HTTP client behaviour", () => {
  const ok = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

  it("rejects invalid input before any request is sent", async () => {
    const fetchSpy = vi.fn<typeof fetch>();
    const api = createStorefrontApi(createHttpClient({ baseUrl: ORIGIN, auth: "cookie", timeoutMs: 1_000, fetch: fetchSpy }));
    await expect(api.cart.add({ productId: DRILL, quantity: 0 })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("turns network failures and timeouts into friendly errors", async () => {
    const offline = createStorefrontApi(
      createHttpClient({ baseUrl: ORIGIN, auth: "cookie", timeoutMs: 1_000, fetch: async () => Promise.reject(new TypeError("Failed to fetch")) }),
    );
    await expect(offline.catalog.categories()).rejects.toMatchObject({ code: "INTERNAL", details: { kind: "network" } });

    const hanging: typeof fetch = (_url, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const slow = createStorefrontApi(createHttpClient({ baseUrl: ORIGIN, auth: "cookie", timeoutMs: 20, fetch: hanging }));
    await expect(slow.catalog.categories()).rejects.toMatchObject({ code: "INTERNAL", details: { kind: "timeout" } });
  });

  it("flags contract drift when a response doesn't match the expected shape", async () => {
    const api = createStorefrontApi(createHttpClient({ baseUrl: ORIGIN, auth: "cookie", timeoutMs: 1_000, fetch: async () => ok({ wrong: true }) }));
    await expect(api.auth.me()).rejects.toMatchObject({ code: "INTERNAL", details: { kind: "contract", route: "me" } });
  });

  it("falls back to the HTTP status when an error body isn't in our format", async () => {
    const api = createStorefrontApi(
      createHttpClient({ baseUrl: ORIGIN, auth: "cookie", timeoutMs: 1_000, fetch: async () => new Response("Too many", { status: 429 }) }),
    );
    await expect(api.catalog.categories()).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("lets a custom handler build one storefront response from several calls to the same backend", async () => {
    // A real product payload from the mock, then split across two made-up endpoints (details + stock).
    const { api: mockApi } = setup();
    await mockApi.auth.login({ username: "demo.customer", password: "demo1234" });
    const full = (await mockApi.catalog.product("18v-cordless-drill-driver")).product;
    const { stock, ...details } = full;

    const urls: string[] = [];
    const backend: typeof fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/v1/products/18v-cordless-drill-driver")) return ok({ data: details });
      if (url.endsWith(`/v1/inventory/${full.id}`)) return ok({ available: stock });
      return new Response("{}", { status: 404 });
    };
    const adapter: ApiAdapter = {
      handlers: {
        product: async ({ params }, { request }) => {
          const p = ((await request(`/v1/products/${params.slug}`)) as { data: typeof details }).data;
          const inv = (await request(`/v1/inventory/${p.id}`)) as { available: number };
          return { product: { ...p, stock: inv.available } };
        },
      },
    };
    const api = createStorefrontApi(createHttpClient({ baseUrl: "https://api.socimco.example", auth: "cookie", timeoutMs: 1_000, fetch: backend, adapter }));

    const { product } = await api.catalog.product("18v-cordless-drill-driver");
    expect(product.stock).toBe(stock);
    expect(urls).toEqual(["https://api.socimco.example/v1/products/18v-cordless-drill-driver", `https://api.socimco.example/v1/inventory/${full.id}`]);

    // A handler that forgets a field still gets caught by the contract check.
    const broken = createStorefrontApi(
      createHttpClient({
        baseUrl: "https://api.socimco.example",
        auth: "cookie",
        timeoutMs: 1_000,
        fetch: backend,
        adapter: { handlers: { product: async ({ params }, { request }) => ({ product: ((await request(`/v1/products/${params.slug}`)) as { data: unknown }).data }) } },
      }),
    );
    await expect(broken.catalog.product("18v-cordless-drill-driver")).rejects.toMatchObject({ code: "INTERNAL", details: { kind: "contract", route: "product" } });
  });

  it("adapts a differently shaped API: custom paths, reshaped payloads, bearer tokens, foreign errors", async () => {
    // A real user payload from the mock, so the reshaped response passes contract validation.
    const seedUser = (await setup().api.auth.login({ username: "demo.customer", password: "demo1234" })).user;

    const calls: { url: string; auth: string | null; body: unknown }[] = [];
    const remote: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, auth: new Headers(init?.headers).get("authorization"), body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith("/v2/session")) return ok({ access_token: "tok-123", account: seedUser });
      if (url.endsWith("/v2/me")) return ok({ account: seedUser });
      if (url.endsWith("/v2/session/end")) return ok({ done: true });
      return new Response(JSON.stringify({ errorCode: "E_AUTH", detail: "expired" }), { status: 401 });
    };

    const adapter: ApiAdapter = {
      endpoints: {
        login: { path: "/v2/session" },
        me: { path: "/v2/me" },
        logout: { path: "/v2/session/end" },
      },
      toRequest: (route, input) => (route === "login" ? { body: { user: (input.body as { username: string }).username, pass: (input.body as { password: string }).password } } : input),
      fromResponse: (route, json) => {
        const j = json as { account?: unknown };
        if (route === "login" || route === "me") return { user: j.account };
        if (route === "logout") return { ok: true };
        return json;
      },
      readToken: (_route, json) => (json as { access_token?: string }).access_token ?? null,
      toError: (status, json) => ((json as { errorCode?: string })?.errorCode === "E_AUTH" ? new ApiError("UNAUTHENTICATED", { details: { status } }) : null),
    };

    const tokens = createTokenStore(null);
    const api = createStorefrontApi(createHttpClient({ baseUrl: "https://api.client.example", auth: "bearer", timeoutMs: 1_000, fetch: remote, adapter, tokens }));

    const { user } = await api.auth.login({ username: "demo.customer", password: "demo1234" });
    expect(user.id).toBe(seedUser.id);
    expect(calls[0]).toMatchObject({ url: "https://api.client.example/v2/session", auth: null, body: { user: "demo.customer", pass: "demo1234" } });
    expect(tokens.get()).toBe("tok-123");

    await api.auth.me();
    expect(calls[1]).toMatchObject({ url: "https://api.client.example/v2/me", auth: "Bearer tok-123" });

    await expect(api.cart.get()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(tokens.get()).toBeNull();
  });
});

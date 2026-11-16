import { describe, expect, it } from "vitest";
import { runBackendContract } from "@/core/contract/testing/contract-suite";
import { createMockBackend, loadSeed } from "@/core/mock-backend";
import { createDirectDriver, createRestDriver, TEST_ORIGIN } from "./testing/drivers";

const mock = (now: () => Date) => createMockBackend(loadSeed(), { now });

runBackendContract("mock backend (direct)", () => createDirectDriver(mock));
runBackendContract("mock backend (REST)", () => createRestDriver(mock));

describe("REST transport", () => {
  const post = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
    new Request(new URL(path, TEST_ORIGIN), {
      method: "POST",
      ...init,
      headers: { "content-type": "application/json", origin: TEST_ORIGIN, ...init.headers },
    });
  const login = JSON.stringify({ username: "demo.customer", password: "demo1234" });

  it("blocks state-changing requests from another origin or without an Origin header", async () => {
    const { handler } = createRestDriver(mock);
    const foreign = await handler.POST(post("/api/auth/login", { body: login, headers: { origin: "https://evil.example" } }));
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toMatchObject({ error: { code: "FORBIDDEN" } });

    const noOrigin = new Request(new URL("/api/auth/login", TEST_ORIGIN), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: login,
    });
    expect((await handler.POST(noOrigin)).status).toBe(403);
  });

  it("requires JSON bodies and reports validation issues", async () => {
    const { handler } = createRestDriver(mock);
    const form = await handler.POST(post("/api/auth/login", { body: "a=b", headers: { "content-type": "text/plain" } }));
    expect(form.status).toBe(422);
    const malformed = await handler.POST(post("/api/auth/login", { body: "{" }));
    expect(await malformed.json()).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    const invalid = await handler.POST(post("/api/auth/login", { body: JSON.stringify({ username: "" }) }));
    expect(await invalid.json()).toMatchObject({
      error: { code: "VALIDATION_FAILED", details: { issues: expect.arrayContaining([expect.objectContaining({ path: "username" })]) } },
    });
  });

  it("returns 404 for unknown routes and wrong methods", async () => {
    const { handler } = createRestDriver(mock);
    expect((await handler.GET(new Request(`${TEST_ORIGIN}/api/nope`))).status).toBe(404);
    expect((await handler.DELETE(new Request(`${TEST_ORIGIN}/api/cart`, { method: "DELETE", headers: { origin: TEST_ORIGIN } }))).status).toBe(404);
  });

  it("sets HttpOnly cookies with the right scope and never exposes tokens in bodies", async () => {
    const { handler } = createRestDriver(mock);
    const res = await handler.POST(post("/api/auth/login", { body: login }));
    const [session] = res.headers.getSetCookie();
    expect(session).toMatch(/^session=[\w-]{40,}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=43200$/);
    expect(JSON.stringify(await res.json())).not.toContain(session.split(";")[0].split("=")[1]);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const qr = await handler.POST(post("/api/auth/qr"));
    expect(qr.status).toBe(201);
    const [poll] = qr.headers.getSetCookie();
    expect(poll).toMatch(/^qr_poll=[\w-]{40,}; Path=\/api\/auth\/qr; HttpOnly; SameSite=Strict; Max-Age=120$/);
    const body = await qr.json();
    expect(body).not.toHaveProperty("pollToken");
    expect(JSON.stringify(body)).not.toContain(poll.split(";")[0].split("=")[1]);
  });

  it("marks cookies Secure on https", async () => {
    const { handler } = createRestDriver(mock);
    const res = await handler.POST(
      new Request("https://shop.example/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://shop.example" },
        body: login,
      }),
    );
    expect(res.headers.getSetCookie()[0]).toContain("; Secure");
  });

  it("sends Retry-After when rate limited and clears stale session cookies", async () => {
    const { handler } = createRestDriver(mock);
    const wrong = JSON.stringify({ username: "demo.customer", password: "nope" });
    for (let i = 0; i < 5; i++) await handler.POST(post("/api/auth/login", { body: wrong }));
    const limited = await handler.POST(post("/api/auth/login", { body: wrong }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);

    const stale = await handler.GET(new Request(`${TEST_ORIGIN}/api/auth/me`, { headers: { cookie: "session=stale" } }));
    expect(stale.status).toBe(401);
    expect(stale.headers.getSetCookie()[0]).toMatch(/^session=; .*Max-Age=0$/);
  });

  it("answers 201 for a new order and 200 for an idempotent replay", async () => {
    const d = createRestDriver(mock);
    const customer = d.actor();
    await customer.call("login", { body: { username: "demo.customer", password: "demo1234" } });
    await customer.call("cartAdd", { body: { productId: "prd_hammer_16oz", quantity: 20 } });
    const place = () =>
      d.handler.POST(
        post("/api/orders", {
          body: JSON.stringify({ shippingAddressId: "adr_01" }),
          headers: { cookie: `session=${customer.cookies.session}`, "idempotency-key": "6f1c2b8e-3f43-4b8a-9d55-2f8f2a1d7c10" },
        }),
      );
    expect((await place()).status).toBe(201);
    expect((await place()).status).toBe(200);
  });
});

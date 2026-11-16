import { describe, expect, it } from "vitest";
import type { ErrorCode } from "../errors";
import type { Actor, Driver, DriverFactory } from "./driver";

/*
 * Backend contract: every business rule and the reference scenario.
 * Any ShopBackend implementation must pass this against the reference fixture
 * (see mock-backend/data) with a controllable clock.
 */

const PASSWORD = "demo1234";
const DRILL = "prd_drill_18v";
const DRILL_SLUG = "18v-cordless-drill-driver";
const HAMMER = "prd_hammer_16oz";
const TAPE = "prd_tape_measure";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

async function loggedIn(d: Driver, username = "demo.customer", options: { userAgent?: string } = {}): Promise<Actor> {
  const actor = d.actor({ ip: nextIp(), ...options });
  await actor.call("login", { body: { username, password: PASSWORD } });
  return actor;
}

/** Sessions last 12 hours, so tests that jump further ahead log in again. */
async function relogin(actor: Actor, username: string) {
  await actor.call("login", { body: { username, password: PASSWORD } });
}

async function expectError(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toMatchObject({ code });
}

const key = () => crypto.randomUUID();

const priced = (unitPriceCents: number, productId = DRILL) => [{ productId, unitPriceCents }];

/** Steps 1–2 of the reference scenario: 400 drills in the cart, opening offer $80. */
async function openNegotiation(d: Driver) {
  const customer = await loggedIn(d);
  const seller = await loggedIn(d, "demo.seller");
  await customer.call("cartAdd", { body: { productId: DRILL, quantity: 400 } });
  const neg = await customer.call("negotiationCreate", { body: { lines: priced(8000) } });
  return { customer, seller, id: neg.id };
}

/** Steps 1–5 of the reference scenario: price agreed at $85. */
async function acceptedNegotiation(d: Driver) {
  const ctx = await openNegotiation(d);
  const params = { id: ctx.id };
  await ctx.seller.call("sellerRound", { params, body: { action: "counter", lines: priced(9000) } });
  await ctx.customer.call("negotiationRound", { params, body: { action: "offer", lines: priced(8500) } });
  await ctx.seller.call("sellerRound", { params, body: { action: "accept" } });
  return ctx;
}

export function runBackendContract(name: string, makeDriver: DriverFactory) {
  describe(`${name}: reference scenario`, () => {
    it("negotiates 400 drills from $100 to $85 and places TP-2026-1004", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      const seller = await loggedIn(d, "demo.seller");

      const cart = await customer.call("cartAdd", { body: { productId: DRILL, quantity: 400 } });
      expect(cart.subtotalCents).toBe(4_000_000);
      expect(cart.items).toEqual([
        expect.objectContaining({ productId: DRILL, quantity: 400, unitPriceCents: 10000, negotiationEligible: true }),
      ]);

      let neg = await customer.call("negotiationCreate", { body: { lines: priced(8000) } });
      expect(neg).toMatchObject({ status: "awaiting_seller", customerRoundsLeft: 2 });
      expect((await customer.call("cart")).lockedByNegotiationId).toBe(neg.id);
      const params = { id: neg.id };

      neg = await seller.call("sellerRound", { params, body: { action: "counter", lines: priced(9000) } });
      expect(neg.status).toBe("awaiting_customer");

      neg = await customer.call("negotiationRound", { params, body: { action: "offer", lines: priced(8500) } });
      expect(neg).toMatchObject({ status: "awaiting_seller", customerRoundsLeft: 1 });

      neg = await seller.call("sellerRound", { params, body: { action: "accept" } });
      expect(neg).toMatchObject({
        status: "accepted",
        agreedLines: [{ productId: DRILL, quantity: 400, unitPriceCents: 8500 }],
        agreedTotalCents: 3_400_000,
        savingsCents: 600_000,
      });
      expect(Date.parse(neg.expiresAt) - d.now()).toBe(24 * HOUR);

      const { order } = await customer.call("orderPlace", {
        body: { shippingAddressId: "adr_01", negotiationId: neg.id },
        idempotencyKey: key(),
      });
      expect(order).toMatchObject({
        number: "TP-2026-1004",
        status: "confirmed",
        negotiationId: neg.id,
        subtotalCents: 4_000_000,
        discountCents: 600_000,
        shippingCents: 0,
        taxCents: 0,
        totalCents: 3_400_000,
        lines: [{ productId: DRILL, quantity: 400, listUnitPriceCents: 10000, unitPriceCents: 8500, negotiated: true }],
        shippingAddress: { label: "Main warehouse" },
      });

      expect((await customer.call("product", { params: { slug: DRILL_SLUG } })).product.stock).toBe(800);
      expect(await customer.call("cart")).toMatchObject({ items: [], lockedByNegotiationId: null });
      expect((await customer.call("negotiation", { params })).status).toBe("ordered");
      const recent = await customer.call("orders", { query: { limit: 5 } });
      expect(recent.items[0]).toMatchObject({
        number: "TP-2026-1004",
        negotiated: true,
        savingsCents: 600_000,
        totalCents: 3_400_000,
        itemCount: 400,
      });
    });

    it("rejects an offer of $95 after the $90 counter", async () => {
      const d = makeDriver();
      const { customer, seller, id } = await openNegotiation(d);
      await seller.call("sellerRound", { params: { id }, body: { action: "counter", lines: priced(9000) } });
      await expectError(
        customer.call("negotiationRound", { params: { id }, body: { action: "offer", lines: priced(9500) } }),
        "NEGOTIATION_INVALID_PRICE",
      );
    });

    it("refuses the agreed price 25 hours after acceptance", async () => {
      const d = makeDriver();
      const { customer, id } = await acceptedNegotiation(d);
      d.advance(25 * HOUR);
      await relogin(customer, "demo.customer");
      await expectError(
        customer.call("orderPlace", { body: { shippingAddressId: "adr_01", negotiationId: id }, idempotencyKey: key() }),
        "NEGOTIATION_EXPIRED",
      );
      expect((await customer.call("cart")).lockedByNegotiationId).toBeNull();
    });

    it("returns the same order when the Idempotency-Key is reused", async () => {
      const d = makeDriver();
      const { customer, id } = await acceptedNegotiation(d);
      const idempotencyKey = key();
      const input = { body: { shippingAddressId: "adr_01", negotiationId: id }, idempotencyKey };
      const first = await customer.call("orderPlace", input);
      const second = await customer.call("orderPlace", input);
      expect(second.order).toEqual(first.order);
      expect((await customer.call("product", { params: { slug: DRILL_SLUG } })).product.stock).toBe(800);
      expect((await customer.call("orders", { query: { limit: 50 } })).items).toHaveLength(4);
    });
  });

  describe(`${name}: negotiation rules`, () => {
    it("only allows eligible cart lines", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      await customer.call("cartAdd", { body: { productId: HAMMER, quantity: 400 } });
      await customer.call("cartAdd", { body: { productId: DRILL, quantity: 99 } });
      await expectError(
        customer.call("negotiationCreate", { body: { lines: priced(1500, HAMMER) } }),
        "NEGOTIATION_NOT_ELIGIBLE",
      );
      await expectError(customer.call("negotiationCreate", { body: { lines: priced(8000) } }), "NEGOTIATION_NOT_ELIGIBLE");
      await expectError(
        customer.call("negotiationCreate", { body: { lines: priced(1000, TAPE) } }),
        "NEGOTIATION_NOT_ELIGIBLE",
      );
      const cart = await customer.call("cart");
      expect(cart.items.map((i) => i.negotiationEligible)).toEqual([false, false]);
      await customer.call("cartUpdate", { params: { productId: DRILL }, body: { quantity: 100 } });
      expect((await customer.call("cart")).items[1].negotiationEligible).toBe(true);
    });

    it("requires the opening offer to be below list price", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      await customer.call("cartAdd", { body: { productId: DRILL, quantity: 400 } });
      await expectError(customer.call("negotiationCreate", { body: { lines: priced(10000) } }), "NEGOTIATION_INVALID_PRICE");
      await expectError(customer.call("negotiationCreate", { body: { lines: priced(12000) } }), "NEGOTIATION_INVALID_PRICE");
      await expectError(customer.call("negotiationCreate", { body: { lines: priced(0) } }), "VALIDATION_FAILED");
      await expectError(customer.call("negotiationCreate", { body: { lines: priced(80.5) } }), "VALIDATION_FAILED");
      expect((await customer.call("cart")).lockedByNegotiationId).toBeNull();
    });

    it("keeps seller counters between the last offer and the previous seller price", async () => {
      const d = makeDriver();
      const { seller, id } = await openNegotiation(d);
      const counter = (price: number) =>
        seller.call("sellerRound", { params: { id }, body: { action: "counter", lines: priced(price) } });
      await expectError(counter(8000), "NEGOTIATION_INVALID_PRICE");
      await expectError(counter(7900), "NEGOTIATION_INVALID_PRICE");
      await expectError(counter(10000), "NEGOTIATION_INVALID_PRICE");
      await counter(9500);
    });

    it("keeps customer offers above their previous offer", async () => {
      const d = makeDriver();
      const { customer, seller, id } = await openNegotiation(d);
      await seller.call("sellerRound", { params: { id }, body: { action: "counter", lines: priced(9000) } });
      const offer = (price: number) =>
        customer.call("negotiationRound", { params: { id }, body: { action: "offer", lines: priced(price) } });
      await expectError(offer(8000), "NEGOTIATION_INVALID_PRICE");
      await expectError(offer(7500), "NEGOTIATION_INVALID_PRICE");
      await expectError(offer(9000), "NEGOTIATION_INVALID_PRICE");
      await offer(8001);
    });

    it("requires every round to price all negotiated lines exactly once", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      await customer.call("cartAdd", { body: { productId: DRILL, quantity: 400 } });
      await customer.call("cartAdd", { body: { productId: TAPE, quantity: 300 } });
      await expectError(
        customer.call("negotiationCreate", {
          body: { lines: [...priced(8000), ...priced(8100)] },
        }),
        "VALIDATION_FAILED",
      );
      const neg = await customer.call("negotiationCreate", {
        body: { lines: [...priced(8000), ...priced(1200, TAPE)] },
      });
      expect(neg.lines).toHaveLength(2);
      const seller = await loggedIn(d, "demo.seller");
      await expectError(
        seller.call("sellerRound", { params: { id: neg.id }, body: { action: "counter", lines: priced(9000) } }),
        "NEGOTIATION_INVALID_PRICE",
      );
    });

    it("enforces turns", async () => {
      const d = makeDriver();
      const { customer, seller, id } = await openNegotiation(d);
      await expectError(
        customer.call("negotiationRound", { params: { id }, body: { action: "offer", lines: priced(8200) } }),
        "NEGOTIATION_NOT_YOUR_TURN",
      );
      await expectError(customer.call("negotiationRound", { params: { id }, body: { action: "accept" } }), "NEGOTIATION_NOT_YOUR_TURN");
      await seller.call("sellerRound", { params: { id }, body: { action: "counter", lines: priced(9000) } });
      await expectError(seller.call("sellerRound", { params: { id }, body: { action: "accept" } }), "NEGOTIATION_NOT_YOUR_TURN");
    });

    it("limits the customer to three offers, then allows accept or reject", async () => {
      const d = makeDriver();
      const { customer, seller, id } = await openNegotiation(d);
      const params = { id };
      for (const [counter, offer] of [
        [9900, 8100],
        [9800, 8200],
      ]) {
        await seller.call("sellerRound", { params, body: { action: "counter", lines: priced(counter) } });
        await customer.call("negotiationRound", { params, body: { action: "offer", lines: priced(offer) } });
      }
      const neg = await seller.call("sellerRound", { params, body: { action: "counter", lines: priced(9700) } });
      expect(neg.customerRoundsLeft).toBe(0);
      await expectError(
        customer.call("negotiationRound", { params, body: { action: "offer", lines: priced(8300) } }),
        "NEGOTIATION_NO_ROUNDS_LEFT",
      );
      const accepted = await customer.call("negotiationRound", { params, body: { action: "accept" } });
      expect(accepted).toMatchObject({
        status: "accepted",
        agreedLines: [{ productId: DRILL, unitPriceCents: 9700 }],
        savingsCents: 120_000,
      });
    });

    it("lets the customer accept a counter at the seller's price", async () => {
      const d = makeDriver();
      const { customer, seller, id } = await openNegotiation(d);
      await seller.call("sellerRound", { params: { id }, body: { action: "counter", lines: priced(9000) } });
      const neg = await customer.call("negotiationRound", { params: { id }, body: { action: "accept" } });
      expect(neg).toMatchObject({ status: "accepted", agreedTotalCents: 3_600_000, savingsCents: 400_000 });
    });

    it("unlocks the cart when either side rejects", async () => {
      const d = makeDriver();
      const first = await openNegotiation(d);
      const rejected = await first.seller.call("sellerRound", { params: { id: first.id }, body: { action: "reject" } });
      expect(rejected.status).toBe("rejected");
      expect((await first.customer.call("cart")).lockedByNegotiationId).toBeNull();
      await expectError(
        first.customer.call("negotiationRound", { params: { id: first.id }, body: { action: "accept" } }),
        "NEGOTIATION_CLOSED",
      );

      const second = await first.customer.call("negotiationCreate", { body: { lines: priced(8000) } });
      await first.seller.call("sellerRound", { params: { id: second.id }, body: { action: "counter", lines: priced(9000) } });
      const byCustomer = await first.customer.call("negotiationRound", { params: { id: second.id }, body: { action: "reject" } });
      expect(byCustomer.status).toBe("rejected");
      expect((await first.customer.call("cart")).lockedByNegotiationId).toBeNull();
    });

    it("lets the customer cancel open or accepted negotiations only", async () => {
      const d = makeDriver();
      const { customer, id } = await acceptedNegotiation(d);
      const cancelled = await customer.call("negotiationCancel", { params: { id } });
      expect(cancelled.status).toBe("cancelled");
      expect((await customer.call("cart")).lockedByNegotiationId).toBeNull();
      await expectError(customer.call("negotiationCancel", { params: { id } }), "NEGOTIATION_CLOSED");

      await expectError(customer.call("negotiationCancel", { params: { id: "neg_0001" } }), "NEGOTIATION_CLOSED");
    });

    it("expires open negotiations 48 hours after the last round", async () => {
      const d = makeDriver();
      const { customer, seller, id } = await openNegotiation(d);
      d.advance(40 * HOUR);
      await relogin(seller, "demo.seller");
      await seller.call("sellerRound", { params: { id }, body: { action: "counter", lines: priced(9000) } });
      d.advance(40 * HOUR);
      await relogin(customer, "demo.customer");
      expect((await customer.call("negotiation", { params: { id } })).status).toBe("awaiting_customer");
      d.advance(8 * HOUR);
      expect((await customer.call("negotiation", { params: { id } })).status).toBe("expired");
      expect((await customer.call("cart")).lockedByNegotiationId).toBeNull();
      await expectError(customer.call("negotiationRound", { params: { id }, body: { action: "accept" } }), "NEGOTIATION_EXPIRED");
      await expectError(customer.call("negotiationCancel", { params: { id } }), "NEGOTIATION_EXPIRED");
    });

    it("locks the cart while a negotiation is open", async () => {
      const d = makeDriver();
      const { customer } = await openNegotiation(d);
      await expectError(customer.call("cartAdd", { body: { productId: HAMMER, quantity: 1 } }), "CART_LOCKED");
      await expectError(customer.call("cartUpdate", { params: { productId: DRILL }, body: { quantity: 500 } }), "CART_LOCKED");
      await expectError(customer.call("cartRemove", { params: { productId: DRILL } }), "CART_LOCKED");
      await expectError(customer.call("negotiationCreate", { body: { lines: priced(8000) } }), "CART_LOCKED");
    });

    it("hides negotiations from other customers and lists them for the seller", async () => {
      const d = makeDriver();
      const { seller, id } = await openNegotiation(d);
      const other = await loggedIn(d, "demo.customer2");
      await expectError(other.call("negotiation", { params: { id } }), "NOT_FOUND");
      const waiting = await seller.call("sellerNegotiations", { query: { status: "awaiting_seller" } });
      expect(waiting.items).toEqual([
        expect.objectContaining({ id, customer: { name: "Sam Carter", company: "BuildCo Ltd" }, listTotalCents: 4_000_000, latestPriceTotalCents: 3_200_000 }),
      ]);
      expect((await seller.call("sellerNegotiations", {})).items.map((n) => n.id)).toContain("neg_0001");
    });
  });

  describe(`${name}: checkout`, () => {
    it("requires an Idempotency-Key", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      await customer.call("cartAdd", { body: { productId: HAMMER, quantity: 20 } });
      await expectError(customer.call("orderPlace", { body: { shippingAddressId: "adr_01" } }), "IDEMPOTENCY_KEY_REQUIRED");
    });

    it("rejects an empty cart", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      await expectError(customer.call("orderPlace", { body: { shippingAddressId: "adr_01" }, idempotencyKey: key() }), "CART_EMPTY");
    });

    it("only ships to the customer's own addresses", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      await customer.call("cartAdd", { body: { productId: HAMMER, quantity: 20 } });
      for (const shippingAddressId of ["adr_02", "adr_missing"]) {
        await expectError(customer.call("orderPlace", { body: { shippingAddressId }, idempotencyKey: key() }), "ADDRESS_NOT_FOUND");
      }
    });

    it("re-checks stock at order time", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      const other = await loggedIn(d, "demo.customer2");
      await customer.call("cartAdd", { body: { productId: DRILL, quantity: 400 } });
      await other.call("cartAdd", { body: { productId: DRILL, quantity: 1000 } });
      await other.call("orderPlace", { body: { shippingAddressId: "adr_02" }, idempotencyKey: key() });
      const attempt = customer.call("orderPlace", { body: { shippingAddressId: "adr_01" }, idempotencyKey: key() });
      await expect(attempt).rejects.toMatchObject({
        code: "OUT_OF_STOCK",
        details: { lines: [{ productId: DRILL, requested: 400, available: 200 }] },
      });
      await expectError(customer.call("cartUpdate", { params: { productId: DRILL }, body: { quantity: 201 } }), "OUT_OF_STOCK");
    });

    it("validates quantities against minimum order and stock", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      await expectError(customer.call("cartAdd", { body: { productId: "prd_utility_knife", quantity: 5 } }), "QUANTITY_INVALID");
      await expectError(customer.call("cartAdd", { body: { productId: DRILL, quantity: 1201 } }), "OUT_OF_STOCK");
      await expectError(customer.call("cartAdd", { body: { productId: "prd_missing", quantity: 1 } }), "NOT_FOUND");
      await customer.call("cartAdd", { body: { productId: DRILL, quantity: 1000 } });
      await expectError(customer.call("cartAdd", { body: { productId: DRILL, quantity: 201 } }), "OUT_OF_STOCK");
    });

    it("requires an accepted negotiation that matches the cart lock", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      await customer.call("cartAdd", { body: { productId: DRILL, quantity: 400 } });
      await expectError(
        customer.call("orderPlace", { body: { shippingAddressId: "adr_01", negotiationId: "neg_0001" }, idempotencyKey: key() }),
        "NEGOTIATION_NOT_ACCEPTED",
      );
      const neg = await customer.call("negotiationCreate", { body: { lines: priced(8000) } });
      await expectError(
        customer.call("orderPlace", { body: { shippingAddressId: "adr_01", negotiationId: neg.id }, idempotencyKey: key() }),
        "NEGOTIATION_NOT_ACCEPTED",
      );
      await expectError(customer.call("orderPlace", { body: { shippingAddressId: "adr_01" }, idempotencyKey: key() }), "NEGOTIATION_NOT_ACCEPTED");
    });

    it("prices negotiated lines at the agreed price and others at list price", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      const seller = await loggedIn(d, "demo.seller");
      await customer.call("cartAdd", { body: { productId: HAMMER, quantity: 20 } });
      await customer.call("cartAdd", { body: { productId: DRILL, quantity: 400 } });
      const neg = await customer.call("negotiationCreate", { body: { lines: priced(8500) } });
      await seller.call("sellerRound", { params: { id: neg.id }, body: { action: "accept" } });
      const { order } = await customer.call("orderPlace", {
        body: { shippingAddressId: "adr_01", negotiationId: neg.id },
        idempotencyKey: key(),
      });
      expect(order).toMatchObject({ subtotalCents: 4_037_000, discountCents: 600_000, totalCents: 3_437_000 });
      expect(order.lines.find((l) => l.productId === HAMMER)).toMatchObject({ unitPriceCents: 1850, negotiated: false });
    });

    it("places list-price orders without a negotiation", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      await customer.call("cartAdd", { body: { productId: HAMMER, quantity: 20 } });
      const { order } = await customer.call("orderPlace", { body: { shippingAddressId: "adr_01" }, idempotencyKey: key() });
      expect(order).toMatchObject({ negotiationId: null, subtotalCents: 37_000, discountCents: 0, totalCents: 37_000 });
    });

    it("hides orders from other customers", async () => {
      const d = makeDriver();
      const other = await loggedIn(d, "demo.customer2");
      await expectError(other.call("order", { params: { id: "ord_1001" } }), "NOT_FOUND");
      expect((await other.call("orders", {})).items).toEqual([]);
    });
  });

  describe(`${name}: password login`, () => {
    it("gives the same error for unknown users and wrong passwords", async () => {
      const d = makeDriver();
      const unknown = d.actor({ ip: nextIp() }).call("login", { body: { username: "nobody", password: PASSWORD } });
      const wrong = d.actor({ ip: nextIp() }).call("login", { body: { username: "demo.customer", password: "nope" } });
      const [a, b] = await Promise.allSettled([unknown, wrong]);
      expect(a).toMatchObject({ status: "rejected", reason: { code: "INVALID_CREDENTIALS" } });
      expect(b).toMatchObject({ status: "rejected", reason: { code: "INVALID_CREDENTIALS" } });
      expect((a as PromiseRejectedResult).reason.message).toBe((b as PromiseRejectedResult).reason.message);
    });

    it("reveals a disabled account only after a correct password", async () => {
      const d = makeDriver();
      const actor = d.actor({ ip: nextIp() });
      await expectError(actor.call("login", { body: { username: "demo.inactive", password: "nope" } }), "INVALID_CREDENTIALS");
      await expectError(actor.call("login", { body: { username: "demo.inactive", password: PASSWORD } }), "ACCOUNT_DISABLED");
    });

    it("rate limits after 5 failures per username and IP for 15 minutes", async () => {
      const d = makeDriver();
      const actor = d.actor({ ip: nextIp() });
      const attempt = (password: string) => actor.call("login", { body: { username: "demo.customer", password } });
      for (let i = 0; i < 5; i++) await expectError(attempt("wrong"), "INVALID_CREDENTIALS");
      await expectError(attempt(PASSWORD), "RATE_LIMITED");
      await d.actor({ ip: nextIp() }).call("login", { body: { username: "demo.customer", password: PASSWORD } });
      d.advance(15 * MINUTE);
      const { user } = await attempt(PASSWORD);
      expect(user.id).toBe("usr_01");
    });

    it("returns the user without credentials and ends sessions on logout or after 12 hours", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      const { user } = await customer.call("me");
      expect(user).toMatchObject({ id: "usr_01", role: "customer", addresses: [{ id: "adr_01" }] });
      expect(user).not.toHaveProperty("password");
      expect(user).not.toHaveProperty("username");

      await customer.call("logout");
      await expectError(customer.call("me"), "UNAUTHENTICATED");

      const again = await loggedIn(d);
      d.advance(12 * HOUR);
      await expectError(again.call("me"), "UNAUTHENTICATED");
    });
  });

  describe(`${name}: QR login`, () => {
    async function start(d: Driver) {
      const desktop = d.actor({ ip: nextIp(), userAgent: CHROME_WINDOWS });
      const qr = await desktop.call("qrCreate");
      const code = new URL(qr.approveUrl).searchParams.get("code") ?? "";
      return { desktop, id: qr.id, code, qr };
    }

    it("logs the desktop in once a logged-in phone scans and approves", async () => {
      const d = makeDriver();
      const { desktop, id, code, qr } = await start(d);
      expect(qr.approveUrl).toMatch(/\/qr\/approve\?code=.+/);
      expect(Date.parse(qr.expiresAt) - d.now()).toBe(2 * MINUTE);
      expect(await desktop.call("qrStatus", { params: { id } })).toMatchObject({ status: "pending" });

      const phone = await loggedIn(d);
      const scan = await phone.call("qrScan", { body: { code } });
      expect(scan.requestedFrom).toBe("Chrome on Windows");
      expect((await desktop.call("qrStatus", { params: { id } })).status).toBe("scanned");

      expect(await phone.call("qrApprove", { body: { code, decision: "approve" } })).toEqual({ status: "approved" });
      expect((await desktop.call("qrStatus", { params: { id } })).status).toBe("approved");

      const pollToken = desktop.cookies.qrPoll;
      const { user } = await desktop.call("qrConsume", { params: { id } });
      expect(user.id).toBe("usr_01");
      expect((await desktop.call("me")).user.id).toBe("usr_01");
      expect(desktop.cookies.qrPoll).toBeNull();

      const replay = d.actor({ ip: nextIp() });
      replay.cookies.qrPoll = pollToken;
      await expectError(replay.call("qrConsume", { params: { id } }), "QR_ALREADY_USED");
      await expectError(phone.call("qrScan", { body: { code } }), "QR_ALREADY_USED");
    });

    it("hides the QR session from anyone without the desktop's poll token", async () => {
      const d = makeDriver();
      const { id } = await start(d);
      const stranger = d.actor({ ip: nextIp() });
      await expectError(stranger.call("qrStatus", { params: { id } }), "NOT_FOUND");
      await expectError(stranger.call("qrConsume", { params: { id } }), "NOT_FOUND");
      stranger.cookies.qrPoll = "forged-token";
      await expectError(stranger.call("qrStatus", { params: { id } }), "NOT_FOUND");
    });

    it("requires a session to scan and lets only the scanner decide", async () => {
      const d = makeDriver();
      const { desktop, id, code } = await start(d);
      await expectError(d.actor({ ip: nextIp() }).call("qrScan", { body: { code } }), "UNAUTHENTICATED");

      const phone = await loggedIn(d);
      const other = await loggedIn(d, "demo.customer2");
      await expectError(phone.call("qrApprove", { body: { code, decision: "approve" } }), "FORBIDDEN");
      await expectError(desktop.call("qrConsume", { params: { id } }), "FORBIDDEN");

      await phone.call("qrScan", { body: { code } });
      await expectError(other.call("qrScan", { body: { code } }), "QR_ALREADY_USED");
      await expectError(other.call("qrApprove", { body: { code, decision: "approve" } }), "FORBIDDEN");
      await expectError(desktop.call("qrConsume", { params: { id } }), "FORBIDDEN");
    });

    it("lets the phone deny the login", async () => {
      const d = makeDriver();
      const { desktop, id, code } = await start(d);
      const phone = await loggedIn(d);
      await phone.call("qrScan", { body: { code } });
      expect(await phone.call("qrApprove", { body: { code, decision: "deny" } })).toEqual({ status: "denied" });
      expect((await desktop.call("qrStatus", { params: { id } })).status).toBe("denied");
      await expectError(desktop.call("qrConsume", { params: { id } }), "QR_ALREADY_USED");
      await expectError(desktop.call("me"), "UNAUTHENTICATED");
    });

    it("expires after 120 seconds, even once approved", async () => {
      const d = makeDriver();
      const first = await start(d);
      const phone = await loggedIn(d);
      d.advance(2 * MINUTE);
      expect((await first.desktop.call("qrStatus", { params: { id: first.id } })).status).toBe("expired");
      await expectError(phone.call("qrScan", { body: { code: first.code } }), "QR_EXPIRED");

      const second = await start(d);
      await phone.call("qrScan", { body: { code: second.code } });
      await phone.call("qrApprove", { body: { code: second.code, decision: "approve" } });
      d.advance(2 * MINUTE);
      await expectError(second.desktop.call("qrConsume", { params: { id: second.id } }), "QR_EXPIRED");
    });

    it("rate limits QR creation and polling", async () => {
      const d = makeDriver();
      const desktop = d.actor({ ip: nextIp() });
      for (let i = 0; i < 10; i++) await desktop.call("qrCreate");
      await expectError(desktop.call("qrCreate"), "RATE_LIMITED");

      const { desktop: poller, id } = await start(d);
      for (let i = 0; i < 40; i++) await poller.call("qrStatus", { params: { id } });
      await expectError(poller.call("qrStatus", { params: { id } }), "RATE_LIMITED");
      d.advance(MINUTE);
      await poller.call("qrStatus", { params: { id } });
    });
  });

  describe(`${name}: access and catalog`, () => {
    it("requires a session for the catalog and the right role elsewhere", async () => {
      const d = makeDriver();
      const anonymous = d.actor({ ip: nextIp() });
      await expectError(anonymous.call("categories"), "UNAUTHENTICATED");
      await expectError(anonymous.call("products", {}), "UNAUTHENTICATED");

      const customer = await loggedIn(d);
      const seller = await loggedIn(d, "demo.seller");
      await expectError(customer.call("sellerNegotiations", {}), "FORBIDDEN");
      await expectError(customer.call("sellerRound", { params: { id: "neg_0001" }, body: { action: "accept" } }), "FORBIDDEN");
      await expectError(seller.call("cart"), "FORBIDDEN");
      await expectError(seller.call("orders", {}), "FORBIDDEN");
      expect((await seller.call("categories")).categories.length).toBeGreaterThan(0);
    });

    it("serves the category tree with product counts", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      const { categories } = await customer.call("categories");
      expect(categories.map((c) => c.slug)).toEqual([
        "power-tools",
        "hand-tools",
        "fasteners",
        "measuring",
        "safety",
        "storage",
      ]);
      const power = categories[0];
      expect(power.productCount).toBe(7);
      expect(power.children.find((c) => c.slug === "drills")?.productCount).toBe(3);
    });

    it("filters, searches, sorts and paginates products", async () => {
      const d = makeDriver();
      const customer = await loggedIn(d);
      const all = await customer.call("products", {});
      expect(all).toMatchObject({ total: 24, page: 1, pageSize: 24 });
      expect(all.items).toHaveLength(24);
      expect((await customer.call("products", { query: { page: 2 } })).items).toEqual([]);

      const drills = await customer.call("products", { query: { category: "drills", sort: "price_asc" } });
      expect(drills.items.map((p) => p.id)).toEqual([DRILL, "prd_impact_driver", "prd_sds_hammer_drill"]);
      expect((await customer.call("products", { query: { category: "power-tools" } })).total).toBe(7);

      const search = await customer.call("products", { query: { q: "DRL-18V" } });
      expect(search.items.map((p) => p.id)).toEqual([DRILL]);

      await expectError(customer.call("products", { query: { category: "nope" } }), "NOT_FOUND");
      await expectError(customer.call("product", { params: { slug: "nope" } }), "NOT_FOUND");
      const { product } = await customer.call("product", { params: { slug: DRILL_SLUG } });
      expect(product).toMatchObject({ id: DRILL, priceCents: 10000, minNegotiableQty: 100 });
    });
  });
}

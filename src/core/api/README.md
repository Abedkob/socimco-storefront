# Plugging the SOCIMCO backend into the storefront

This guide is for the backend developer who will connect the storefront to the real API. You only need to touch **one file**: `client/adapters/custom-adapter.ts`. The screens and hooks stay as they are.

> **The short version**
> 1. Set `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_API_ADAPTER=custom` and `NEXT_PUBLIC_API_AUTH` in `.env.local`.
> 2. In `custom-adapter.ts`, map each storefront route (table below) to your endpoint(s).
> 3. Run `pnpm dev`, sign in, and click through. Any field that doesn't match shows up in the browser console with its exact path.
> 4. Run `pnpm test`, then do the reference order (at the end of this guide).

---

## 1. How the pieces fit

```
Screens & hooks (core/features, client/react.tsx)
   └─ StorefrontApi        client/storefront-api.ts   one method per route: api.cart.add(...), api.orders.place(...)
        └─ HttpClient       client/http.ts             base URL, auth, timeout, errors, VALIDATION of every response
             └─ ApiAdapter  client/adapters/custom-adapter.ts   ← YOU EDIT THIS
                  └─ fetch ──► your backend (NEXT_PUBLIC_API_BASE_URL)
```

- **The contract** is `src/core/contract/`:
  - `schemas.ts` defines every field.
  - `routes.ts` lists the storefront routes.
  - `errors.ts` holds the error codes.

  The UI only ever sees data that passed these schemas.
- **The adapter translates** between your API and the contract. Your API does **not** have to change to match ours: the adapter reshapes requests and responses, renames fields, converts money, and can combine several of your calls into one storefront route.
- **The mock** (`src/core/mock-backend/`, served at this app's `/api`) implements the contract exactly. It's the reference for what every route returns: run the app with an empty base URL and inspect the network tab.

### Files in this folder

| File | What it is | Edit? |
|---|---|---|
| `client/adapters/custom-adapter.ts` | Your mapping: endpoints, reshaping, multi-call handlers, errors, token | **Yes** |
| `client/adapter.ts` | The `ApiAdapter` type and the default `contractAdapter` | No |
| `client/http.ts` | Request pipeline: URL, auth, timeout, error mapping, validation | No |
| `client/config.ts` | Reads the `NEXT_PUBLIC_API_*` settings | No |
| `client/storefront-api.ts` | The methods the screens call | No |
| `client/react.tsx` | React Query hooks: caching, polling, idempotent ordering | No |
| `client/token-store.ts` | Keeps the bearer token for the tab (bearer mode only) | No |
| `client/client.test.ts` | Tests, including a full example adapter for a made-up API | Add yours |
| `server/` | The mock's request handler (`/api/*`). Not used when the base URL points at your backend | No |

---

## 2. Settings (`.env.local`, copy from `.env.example`)

| Variable | Values | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | empty, or `https://api.socimco.example` | Empty = the built-in mock. Otherwise your backend's origin; route paths are appended to it. |
| `NEXT_PUBLIC_API_ADAPTER` | `contract` (default) \| `custom` | `custom` turns on `custom-adapter.ts`. Use `contract` only if your API already speaks our contract exactly. |
| `NEXT_PUBLIC_API_AUTH` | `cookie` (default) \| `bearer` | How the browser stays signed in (section 6). |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | `15000` | Requests are aborted after this long. |

These are `NEXT_PUBLIC_*`, so they're compiled into the browser bundle. **Never put secrets here.** Restart `pnpm dev` after changing them.

---

## 3. The adapter, step by step

Open `client/adapters/custom-adapter.ts`. It has commented examples for each part. Fill in only what you need:

| Your situation | Use | Example |
|---|---|---|
| Same data, different URL or method | `endpoints` | `product: { path: "/v1/items/:slug" }` |
| Different field names or formats in the request | `toRequest(route, { body, query })` | `username` → `email`, `page` → `offset/limit` |
| Different field names or formats in the response | `fromResponse(route, json)` | `price: "100.00"` → `priceCents: 10000` |
| One storefront route needs several of your calls, or logic | `handlers[route]` | product + inventory → one `product` |
| Different error body | `toError(status, json)` | `{ error_code: "BAD_LOGIN" }` → `INVALID_CREDENTIALS` |
| Login returns a token instead of a cookie | `readToken(route, json, headers)` | `json.access_token` |

**Order of operations for a route** (see `http.ts`):
1. The storefront's input is validated against the contract (bad input never reaches you).
2. If `handlers[route]` exists, it runs instead of steps 3–5.
3. Otherwise: `endpoints[route]` (or our default path) → `toRequest` → fetch → `readToken` (login routes only) → `fromResponse`.
4. Errors (non-2xx) → `toError` → our envelope `{ error: { code } }` if you return it → fallback by HTTP status (401 → `UNAUTHENTICATED`, 404 → `NOT_FOUND`, 422 → `VALIDATION_FAILED`, 429 → `RATE_LIMITED`, others → `INTERNAL`).
5. The result is validated against the route's response schema. On a mismatch, the console prints `[api] <route> returned an unexpected shape` with the failing field paths, and the screen shows a friendly error instead of wrong data.

### Multi-call handlers (several of your endpoints → one route)

Everything comes from one backend, but a screen sometimes needs data your API splits across endpoints. A handler receives our validated input and a `request()` helper. `request()` already applies the base URL, auth, timeout and error mapping, so you just call your paths:

```ts
handlers: {
  product: async ({ params }, { request }) => {
    const [p, inv] = await Promise.all([
      request(`/v1/products/${params.slug}`),
      request(`/v1/inventory/by-slug/${params.slug}`),
    ]) as [any, any];
    return { product: { ...mapProduct(p), stock: inv.available } };
  },
  orderPlace: async ({ body, idempotencyKey }, { request }) => {
    const o = await request("/v1/orders", { method: "POST", body: mapOrderBody(body), idempotencyKey });
    return { order: mapOrder(o) };
  },
  login: async ({ body }, { request, setToken }) => {      // bearer mode
    const r = (await request("/v1/auth/token", { method: "POST", body })) as any;
    setToken(r.access_token);
    return { user: mapUser((await request("/v1/me")) as any) };
  },
},
```

A handler's return value is validated like any other response. `client.test.ts` has a working two-call handler test ("serves one route from several backend calls") to copy.

### Useful helpers

```ts
const toCents = (v: string | number) => Math.round(Number(v) * 100);          // "100.00" → 10000
const iso = (v: string | number) => new Date(v).toISOString();                // epoch / "2026-11-16 10:00" → ISO
const toUnit = (u: string) => ({ pc: "piece", ea: "piece", box: "box", m: "meter" } as const)[u] ?? "piece";
```

---

## 4. What each route must return

The UI needs these shapes **after** your adapter. Exact zod definitions are in `src/core/contract/schemas.ts`.

**Everything is required unless it's marked nullable (`|null`) or optional (`?`).**

| Route | Default endpoint | Input | Must return |
|---|---|---|---|
| `login` | `POST /api/auth/login` | `{ username, password }` | `{ user: User }` (and sets the session) |
| `logout` | `POST /api/auth/logout` | — | `{ ok: true }` |
| `me` | `GET /api/auth/me` | — | `{ user: User }`, or 401 when signed out (that drives the redirect to `/login`) |
| `qrCreate` | `POST /api/auth/qr` | — | `{ id, approveUrl (absolute URL), expiresAt }` |
| `qrStatus` | `GET /api/auth/qr/:id` | — | `{ status: pending\|scanned\|approved\|denied\|expired\|consumed, expiresAt }` |
| `qrScan` | `POST /api/auth/qr/scan` | `{ code }` | `{ requestedFrom, requestedAt }` |
| `qrApprove` | `POST /api/auth/qr/approve` | `{ code, decision: approve\|deny }` | `{ status: approved\|denied }` |
| `qrConsume` | `POST /api/auth/qr/:id/consume` | — | `{ user: User }` (and sets the session) |
| `categories` | `GET /api/categories` | — | `{ categories: CategoryNode[] }` (top level with `children`) |
| `products` | `GET /api/products` | query `category? q? sort page` | `{ items: ProductListItem[], page, pageSize, total }` |
| `product` | `GET /api/products/:slug` | — | `{ product: Product }` |
| `cart` | `GET /api/cart` | — | `Cart` |
| `cartAdd` | `POST /api/cart/items` | `{ productId, quantity }` | `Cart` (the whole updated cart) |
| `cartUpdate` | `PATCH /api/cart/items/:productId` | `{ quantity }` | `Cart` |
| `cartRemove` | `DELETE /api/cart/items/:productId` | — | `Cart` |
| `negotiationCreate` | `POST /api/negotiations` | `{ lines: [{ productId, unitPriceCents }], message? }` | `Negotiation` |
| `negotiation` | `GET /api/negotiations/:id` | — | `Negotiation` (polled every 5 s while `awaiting_seller`) |
| `negotiationRound` | `POST /api/negotiations/:id/rounds` | `{ action: offer, lines, message? }` or `{ action: accept\|reject, message? }` | `Negotiation` |
| `negotiationCancel` | `POST /api/negotiations/:id/cancel` | — | `Negotiation` |
| `orderPlace` | `POST /api/orders` | `{ shippingAddressId, negotiationId? }` + `Idempotency-Key` header (UUID) | `{ order: Order }` |
| `orders` | `GET /api/orders` | query `limit` (1–50, default 10) | `{ items: OrderSummary[] }`, newest first |
| `order` | `GET /api/orders/:id` | — | `{ order: Order }` |

`products` query values: `sort` is `name | price_asc | price_desc | newest`, `page` starts at 1, and the page size is 24 (`PRODUCT_PAGE_SIZE`).

### Objects

- **User**:
  - `id`, `name`, `email` (a valid email), `company`
  - `role: "customer" | "seller"`: storefront users are `customer`
  - `addresses: Address[]`: checkout needs at least one
- **Address**:
  - `id`, `label` (e.g. "Main warehouse"), `line1`, `city`, `postalCode`
  - `country` as a **2-letter ISO code** (`"US"`, `"MA"`)
  - `isDefault`
- **CategoryNode**:
  - `id`, `slug`, `name`, `imageUrl`, `productCount ≥ 0`, `sortOrder` (int)
  - `children: [{ id, slug, name, imageUrl, productCount }]`
- **ProductListItem**:
  - `id`, `slug`, `name`, `brand`, `imageUrl`
  - `priceCents ≥ 1`, `unit`, `inStock` (bool), `negotiable` (bool)
  - `minNegotiableQty|null`, `rating` (0–5)
- **Product**:
  - `id`, `sku`, `slug`, `name`, `brand`, `categoryId`, `description`
  - `images` (at least 1 URL), `priceCents ≥ 1`, `unit`, `stock ≥ 0`, `minOrderQty ≥ 1`
  - `negotiable`, `minNegotiableQty|null` (**required when `negotiable` is true**)
  - `specs: { "Voltage": "18 V", … }` (string → string), `rating` (0–5), `createdAt`
- **Cart**:
  - `lockedByNegotiationId|null`, `currency` (e.g. `"USD"`)
  - `items: CartLine[]`, `itemCount` (sum of quantities), `subtotalCents`
- **CartLine**:
  - `productId`, `sku`, `name`, `imageUrl`, `unit`, `quantity`
  - `unitPriceCents`, `lineTotalCents`
  - `negotiationEligible`: this line can be negotiated at its current quantity
- **Negotiation**:
  - `id`, `status`, `currency`, `customer: { name, company }`
  - `lines: [{ productId, name, quantity, listUnitPriceCents }]` (at least 1)
  - `rounds: [{ n, by: customer|seller, action: offer|counter|accept|reject, lines: [{ productId, unitPriceCents }], message|null, createdAt }]`
  - `customerRoundsLeft`
  - `agreedLines|null`, `agreedTotalCents|null`, `savingsCents|null`
  - `expiresAt`, `createdAt`, `updatedAt`
  - `status` is one of: `awaiting_seller`, `awaiting_customer`, `accepted`, `rejected`, `cancelled`, `expired`, `ordered`
- **Order**:
  - `id`, `number` (any display string, e.g. `"SO-48213"`), `status: confirmed|processing|shipped|delivered|cancelled`
  - `negotiationId|null`, `currency`
  - `lines: [{ productId, sku, name, imageUrl, quantity, listUnitPriceCents, unitPriceCents, negotiated }]`
  - `subtotalCents`, `discountCents`, `shippingCents`, `taxCents`, `totalCents`
  - `shippingAddress: { label, line1, city, postalCode, country }`, `createdAt`
- **OrderSummary**:
  - `id`, `number`, `status`, `itemCount ≥ 1`, `totalCents`
  - `negotiated` (bool), `savingsCents`, `createdAt`

### Formats that commonly need converting

| Field type | Rule | Typical conversion in `fromResponse` |
|---|---|---|
| **Money** (`*Cents`) | Integer cents, never floats or strings. | `"1250.50"` → `125050` with `toCents` |
| **Timestamps** (`createdAt`, `expiresAt`…) | ISO 8601 with `Z` or an offset: `2026-11-16T10:00:00Z` | Epoch seconds or `"2026-11-16 10:00:00"` → `new Date(…).toISOString()` |
| **Ids** | Non-empty strings, max 100 characters | Numbers → `String(id)` |
| **Slugs** (category, product) | Letters, digits, `-`, `_`, `.`, `~`; no spaces or slashes; max 200 | Use your SKU or id if you have no slug: `slug: String(p.id)` |
| **Quantities** | Integers from 1 to 100,000 | Decimals are not supported (units are piece/box/meter) |
| **`unit`** | `piece` \| `box` \| `meter` | Map your unit codes with `toUnit` |
| **`country`** | ISO 3166-1 alpha-2 | `"Morocco"` → `"MA"` |
| **Statuses** | Exactly our enum values | Map with a lookup table |
| **Images** | Any URL string the browser can load | Make relative paths absolute |

---

## 5. Business rules the backend must enforce

The UI checks these too, for instant feedback, but **your backend is the authority**. The UI's own copies are in `src/core/contract/rules.ts`, and your responses must agree with them.

- **Cart**:
  - A quantity must be at least `minOrderQty` and no more than `stock` (`QUANTITY_INVALID` or `OUT_OF_STOCK`).
  - Totals are computed by the server.
  - While a negotiation is open (`awaiting_seller` or `awaiting_customer`), the cart is locked: `lockedByNegotiationId` is set and changes fail with `CART_LOCKED`.
- **Negotiation eligibility**: a line is eligible when the product is `negotiable` and `quantity ≥ minNegotiableQty`.
- **Offers**:
  - Each new customer price must be **strictly between** the customer's previous offer and the seller's last price (the list price at first).
  - The customer gets **3 offers** in total, tracked in `customerRoundsLeft`.
  - Turns alternate (`NEGOTIATION_NOT_YOUR_TURN`).
- **Validity**:
  - Open offers expire after **48 h**.
  - An accepted price is valid for **24 h** (`expiresAt`), then the negotiation becomes `expired`.
- **Counter-offers** come from your back office (the sales desk). The storefront only polls `negotiation` and shows the counter as a round with `by: "seller", action: "counter"`.
- **Accepted** means:
  - `agreedLines` holds each line's agreed price.
  - `agreedTotalCents` is the sum of quantity × agreed price.
  - `savingsCents` is the list total minus the agreed total.
- **Ordering**:
  - The `Idempotency-Key` header is required. Repeating the same key must return **the same order** and must not create a second one.
  - The address must belong to the user.
  - Stock is re-checked.
  - The negotiation must be `accepted` and not expired, and it becomes `ordered`.
  - The cart is cleared and stock decremented, as one atomic change.
- **Sessions**:
  - `me` returns 401 when there's no valid session.
  - Login must not reveal whether a username exists.
  - Repeated failures are rate-limited (`RATE_LIMITED`).

## Error codes

Return our envelope if you can:

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "…", "details": {} } }
```

Otherwise, map yours in `toError`. Each code has a ready-made user message in `src/core/contract/errors.ts`.

| Code | HTTP | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No or expired session (the UI redirects to sign-in) |
| `INVALID_CREDENTIALS` | 401 | Wrong username or password |
| `ACCOUNT_DISABLED` | 403 | Account is disabled |
| `FORBIDDEN` | 403 | Not allowed |
| `RATE_LIMITED` | 429 | Too many attempts |
| `QR_EXPIRED`, `QR_ALREADY_USED` | 410 | QR sign-in |
| `VALIDATION_FAILED` | 422 | Bad input |
| `NOT_FOUND` | 404 | Unknown product, order or negotiation |
| `QUANTITY_INVALID` | 422 | Below the minimum order quantity |
| `OUT_OF_STOCK` | 409 | Not enough stock (also at order time) |
| `CART_EMPTY`, `CART_LOCKED` | 409 | Cart state |
| `NEGOTIATION_NOT_ELIGIBLE`, `NEGOTIATION_INVALID_PRICE` | 422 | Negotiation input |
| `NEGOTIATION_NO_ROUNDS_LEFT`, `NEGOTIATION_NOT_YOUR_TURN`, `NEGOTIATION_NOT_ACCEPTED`, `NEGOTIATION_EXPIRED`, `NEGOTIATION_CLOSED` | 409 | Negotiation state |
| `ADDRESS_NOT_FOUND` | 404 | Checkout address |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Missing header on `orderPlace` |
| `INTERNAL` | 500 | Anything else |

The client also produces three errors of its own: a network failure, a timeout, and `INTERNAL` with `details.kind = "contract"` when a response doesn't match the schema.

---

## 6. Auth and CORS

The browser calls your API **directly** (no proxy), so:

- **Cookie mode** (`NEXT_PUBLIC_API_AUTH=cookie`, recommended):
  - Login sets an `HttpOnly; Secure` session cookie, with `SameSite=None` if the API is on a different site than the storefront.
  - Every request is sent with `credentials: "include"`.
- **Bearer mode** (`NEXT_PUBLIC_API_AUTH=bearer`):
  - Return the token from `readToken` (or call `setToken` in a handler).
  - It's stored per tab in `sessionStorage` and sent as `Authorization: Bearer …`.
  - It's cleared on logout and on any `UNAUTHENTICATED`.
  - There's no refresh flow yet. If your tokens are short-lived, tell us, or handle the refresh inside a handler.
- **CORS** (your server):
  - `Access-Control-Allow-Origin: <exact storefront origin>`, never `*` in cookie mode. During development the storefront runs on `http://localhost:3001`.
  - `Access-Control-Allow-Credentials: true` in cookie mode.
  - `Access-Control-Allow-Headers: content-type, idempotency-key`, plus `authorization` in bearer mode.
  - `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE`, and an answer to `OPTIONS` preflight requests.

---

## 7. Testing your adapter

1. **Unit test** in `client/client.test.ts`: copy the "example adapter" test and feed it a recorded JSON response from your API. That proves the mapping without a running server.
2. **In the browser**: `pnpm dev`, sign in, and open DevTools → Console. Every `[api] <route> returned an unexpected shape` line lists the failing fields (e.g. `product.priceCents: expected int, received string`).
3. **The reference order** (run it on staging):
   - Add **400 × 18V drill** at $100.00 each ($40,000.00).
   - Negotiate: you offer $80, the sales desk counters $90, you offer $85, and the sales desk accepts.
   - The quote shows **$34,000.00, saving $6,000.00, valid 24 h**.
   - Place the order. The confirmation, order history and order detail show the negotiated total. Stock drops by 400.
   - Negative checks:
     - An offer of $95 after the $90 counter is rejected.
     - Retrying "Place order" after a timeout doesn't create a second order.
4. `pnpm test`, `pnpm typecheck` and `pnpm lint` must stay green.

---

## 8. Known gaps (decide with the product owner)

These screens or ideas exist in the design but **aren't in the contract yet**. If your backend supports them, add a route to `contract/routes.ts` and a schema to `contract/schemas.ts`, add a method in `storefront-api.ts`, and map it in the adapter. Otherwise they stay hidden or marked "coming soon".

- **Catalog filters** by brand, price range, in stock and negotiable. Today only `category`, `q`, `sort` and `page` are sent.
- **The list view lacks some fields.** It has no `stock` count, `sku` or `minOrderQty`. If cards should show them, extend `ProductListItem`.
- **Cart lines lack some fields.** They have no `slug`, `brand`, `stock`, `minOrderQty` or `minNegotiableQty`. As a result the cart can't link to the product, can't show "add N more for trade pricing", and the stepper can't cap at stock; the server still enforces the real limits.
- **Negotiation lines lack `imageUrl`.** The quote page borrows pictures from the cart, so they're blank once the cart is ordered.
- **Order summaries lack an image.** `OrderSummary` has no image, so the order list shows an icon per row. Adding `imageUrl` (for example, the first line's) lets it show the product.
- **The sales-desk contact is hard-coded.** The account page shows "SOCIMCO Sales Desk, sales@socimco.example". An account-manager name, email and phone on `User`, or in store settings, would replace it.
- **There's no store-settings endpoint.** The storefront can't read `StoreConfig.negotiation` (max offers, offer expiry, accepted-price validity). It assumes 3 offers and doesn't show the hours.
- **A customer's quotes list.** Today only one negotiation is fetched, by id, via `cart.lockedByNegotiationId`. The last quote id is remembered in the tab so a closed quote can still be shown. An endpoint for the customer's latest or all quotes would remove that workaround.
- **Address book editing.** Addresses are read-only and come from `User.addresses`.
- **Quick order and buy again** from a past order (this could be built on `cartAdd`).
- **Invoices and PDF downloads.**
- **Token refresh** in bearer mode.
- **The sales-desk console** (seller routes). Not part of this storefront; your back office handles counters and acceptance.

Questions about a field's meaning? Run the app against the mock (empty base URL) and look at the exact JSON each route returns in the network tab. That is the target shape.

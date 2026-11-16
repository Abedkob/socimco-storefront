# Connecting the storefront to the client's API

> **Backend developer?** Start with [`src/core/api/README.md`](../src/core/api/README.md): the step-by-step plug-in guide, field requirements per route, rules and error codes. This page is the overview.

The SOCIMCO storefront talks to its backend through one typed client: `src/core/api/client/`. Every screen and hook uses it, so switching from the built-in mock to the client's API is configuration plus one adapter file. No screen changes.

## How it works today

```
Browser ──► StorefrontApi (storefront-api.ts)
              └─► HttpClient (http.ts): URL, auth, timeout, error mapping, response validation
                    └─► ApiAdapter (adapter.ts): the only place that knows the client's API differs from ours
                          └─► fetch ──► NEXT_PUBLIC_API_BASE_URL (empty = this app's /api, the mock)
```

- **Contract.** `src/core/contract/` (zod schemas and `routes.ts`) is the storefront's source of truth. Every response is validated against it. If an API answers in an unexpected shape, the user sees a friendly error, the console logs exactly which field differs (`kind: "contract"`), and nothing renders wrong data.
- **Storefront routes only.** The client covers sign-in, QR sign-in, catalog, cart, quotes (negotiation) and orders. The sales-desk routes (`seller*`) stay server-side for the mock and its tests; SOCIMCO's own back office does that job.
- **React hooks.** `src/core/api/client/react.tsx` provides them:
  - `useCart`, `useCartMutations`: each cart change writes the returned cart straight into the cache
  - `useNegotiation`: polls every 5 s while it's the sales desk's turn, and pauses in a hidden tab
  - `usePlaceOrder`: reuses its idempotency key on retry, so one click is one order
  - `useQrLogin`: polls every 2 s until the code reaches a final state
  - plus catalog, orders and session hooks

## Settings (`.env.local`, see `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | empty | Empty = mock. Otherwise the client's API origin, e.g. `https://api.socimco.example`. |
| `NEXT_PUBLIC_API_ADAPTER` | `contract` | `custom` turns on `src/core/api/client/adapters/custom-adapter.ts`, the mapping to their API. |
| `NEXT_PUBLIC_API_AUTH` | `cookie` | `cookie`: the API sets an HttpOnly session cookie. `bearer`: the API returns a token at login. |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | `15000` | Requests are aborted after this long, with a "took too long" message. |

## What we need from the client's API team

1. **API docs.** A base URL per environment, plus an endpoint list with request and response examples, or an OpenAPI file if they have one.
2. **CORS for the storefront's origin** (and `localhost:3001` for development). The browser calls their API directly:
   - `Access-Control-Allow-Origin: <storefront origin>`, never `*` when cookies are used
   - `Access-Control-Allow-Credentials: true` in cookie mode
   - allowed headers: `content-type`, `idempotency-key`, plus `authorization` in bearer mode
3. **The auth model.** Preferred: an HttpOnly, `Secure` session cookie with `SameSite=None` if the API is on another site. If they use tokens instead: the login response field that holds the token, its lifetime, and how to refresh it.
4. **Capabilities to confirm**, each mapped below:
   - price negotiation (offer, counter, accept, reject, with 3 customer offers)
   - QR sign-in
   - idempotent order placement
   - the quotes list
   - invoices
   - address editing
   - catalog filters

   Anything they don't support becomes a product decision: hide the feature, or call it "coming soon".

## The storefront's routes (what each one must return)

Shapes are defined in `src/core/contract/schemas.ts`. Error responses ideally use our envelope `{ "error": { "code", "message", "details?" } }`; otherwise the adapter maps theirs (below).

| Route | Our endpoint | Returns |
|---|---|---|
| login | `POST /api/auth/login` `{ username, password }` | `{ user }` |
| logout | `POST /api/auth/logout` | `{ ok: true }` |
| me | `GET /api/auth/me` | `{ user }` |
| qrCreate | `POST /api/auth/qr` | `{ id, approveUrl, expiresAt }` |
| qrStatus | `GET /api/auth/qr/:id` | `{ status, expiresAt }` |
| qrScan | `POST /api/auth/qr/scan` `{ code }` | `{ requestedFrom, requestedAt }` |
| qrApprove | `POST /api/auth/qr/approve` `{ code, decision }` | `{ status }` |
| qrConsume | `POST /api/auth/qr/:id/consume` | `{ user }` |
| categories | `GET /api/categories` | `{ categories }` (tree) |
| products | `GET /api/products?category&q&sort&page` | `{ items, page, pageSize, total }` |
| product | `GET /api/products/:slug` | `{ product }` |
| cart | `GET /api/cart` | cart (computed totals, `lockedByNegotiationId`) |
| cartAdd | `POST /api/cart/items` `{ productId, quantity }` | cart |
| cartUpdate | `PATCH /api/cart/items/:productId` `{ quantity }` | cart |
| cartRemove | `DELETE /api/cart/items/:productId` | cart |
| negotiationCreate | `POST /api/negotiations` `{ lines, message? }` | negotiation |
| negotiation | `GET /api/negotiations/:id` | negotiation |
| negotiationRound | `POST /api/negotiations/:id/rounds` `{ action: offer\|accept\|reject, lines?, message? }` | negotiation |
| negotiationCancel | `POST /api/negotiations/:id/cancel` | negotiation |
| orderPlace | `POST /api/orders` `{ shippingAddressId, negotiationId? }` + `Idempotency-Key` header | `{ order }` |
| orders | `GET /api/orders?limit` | `{ items }` |
| order | `GET /api/orders/:id` | `{ order }` |

## Plugging in their API (once the docs arrive)

Fill in `src/core/api/client/adapters/custom-adapter.ts` and set `NEXT_PUBLIC_API_ADAPTER=custom`. The template has commented examples for every part, including `handlers` for routes that need several backend calls. The full guide is [`src/core/api/README.md`](../src/core/api/README.md). In outline:

```ts
import type { ApiAdapter } from "@/core/api/client";
import { ApiError } from "@/core/contract";

export const socimcoAdapter: ApiAdapter = {
  // Their URL for each of our routes (method defaults to ours).
  endpoints: {
    login: { path: "/v1/auth/session" },
    product: { path: "/v1/catalog/items/:slug" },
    // …
  },
  // Our request → theirs.
  toRequest: (route, input) => input,
  // Their JSON → our contract's response shape (then validated automatically).
  fromResponse: (route, json) => json,
  // Their error JSON → one of our error codes (or null to fall back to the HTTP status).
  toError: (status, json) => null,
  // Bearer mode only: where the session token is in the login response.
  readToken: (route, json) => (json as { access_token?: string }).access_token ?? null,
};
```

`src/core/api/client/client.test.ts` already shows a working adapter for a made-up API with different paths, field names, bearer tokens and error format. Copy its pattern, then point the scenario test at a staging URL to prove the full flow:

> 400 drills → offer $80 → counter $90 → offer $85 → accepted ($34,000.00, saving $6,000.00) → order placed

## Checks

- `pnpm test`: the client runs the full reference scenario against the mock over real HTTP (cookies, origin checks, idempotent ordering). It also covers error mapping, network failures, timeouts, contract-drift detection, and the example adapter.
- ESLint keeps `core/api/client` free of server code and the mock backend, so it stays safe to ship to the browser.

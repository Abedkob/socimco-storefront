# SOCIMCO trade portal (storefront)

The private B2B storefront for SOCIMCO's trade customers. It covers:
- sign-in, by password or by QR code from a signed-in phone
- the catalog: categories, search and product pages
- the cart
- **trade quotes**: price negotiation, the only discount mechanism
- checkout, order history and the account

There is no public browsing and no sign-up: only existing customers can enter.

It ships with a **built-in mock backend** with realistic demo data, so it runs fully on its own today. Connecting the real SOCIMCO API is a configuration change plus one adapter file. No screen changes.

> **Backend developer: start here →** [`src/core/api/README.md`](src/core/api/README.md)
> It covers what to change, every route's required fields, business rules, error codes, auth, CORS and testing.

---

## Run it

Requirements: **Node 22** and **pnpm 9** (`corepack enable` gives you the right pnpm).

```bash
pnpm install
cp .env.example .env.local      # optional: the defaults use the built-in mock
pnpm dev                        # http://localhost:3001
```

### Demo accounts (mock backend only, password `demo1234`)

| Username | Who | Use it for |
|---|---|---|
| `demo.customer` | Sam Carter, BuildCo Ltd | The main customer: has order history and an address |
| `demo.customer2` | Alex Morgan, Northside Builders | A second customer with no orders (new-customer home) |
| `demo.inactive` | Disabled account | Shows the "account disabled" error |
| `demo.seller` | Sales desk | Not a storefront user. Answers quotes through the mock's sales-desk API (below) |

The mock keeps its data **in memory**: orders, quotes, carts and stock reset to the seed every time the server restarts. The seed is in `src/core/mock-backend/data/*.json`, and `pnpm validate:data` checks it.

### Playing the sales desk locally

Quotes are answered by SOCIMCO's back office, which isn't part of this app. With the mock, you play it from a terminal. First, as a customer in the browser, add 100 or more drills to the cart and request a trade price. Then:

```powershell
# PowerShell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$h = @{ Origin = "http://localhost:3001" }
Invoke-RestMethod http://localhost:3001/api/auth/login -Method Post -ContentType application/json -Headers $h -WebSession $s `
  -Body '{"username":"demo.seller","password":"demo1234"}'
(Invoke-RestMethod http://localhost:3001/api/seller/negotiations -WebSession $s).items        # find the quote id
Invoke-RestMethod http://localhost:3001/api/seller/negotiations/neg_0002/rounds -Method Post -ContentType application/json -Headers $h -WebSession $s `
  -Body '{"action":"counter","lines":[{"productId":"prd_drill_18v","unitPriceCents":9000}]}'   # or {"action":"accept"} / {"action":"reject"}
```

```bash
# bash / zsh
curl -c jar -H "Origin: http://localhost:3001" -H "Content-Type: application/json" \
  -d '{"username":"demo.seller","password":"demo1234"}' http://localhost:3001/api/auth/login
curl -b jar http://localhost:3001/api/seller/negotiations
curl -b jar -H "Origin: http://localhost:3001" -H "Content-Type: application/json" \
  -d '{"action":"counter","lines":[{"productId":"prd_drill_18v","unitPriceCents":9000}]}' \
  http://localhost:3001/api/seller/negotiations/neg_0002/rounds
```

State-changing calls need the `Origin` header and a JSON body: the mock rejects cross-site requests, as the real API should. The open quote page picks up the answer within 5 seconds.

**The reference scenario**, used in tests and for acceptance:
- Add 400 × 18V drill at $100.00 each ($40,000.00).
- Negotiate: you offer $80, the sales desk counters $90, you offer $85, and the sales desk accepts.
- The quote shows **$34,000.00, saving $6,000.00**, valid for 24 hours.
- The order is placed as **TP-2026-1004**, and drill stock drops from 1200 to 800.

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server on port 3001 |
| `pnpm build` / `pnpm start` | Production build, then serve it on port 3001 |
| `pnpm test` | Vitest: contract suite, mock backend, API client (including the full reference scenario over HTTP), dependency rules |
| `pnpm typecheck` | Route types + `tsc --noEmit` |
| `pnpm lint` | ESLint, including the architecture rules below |
| `pnpm validate:data` | Checks the mock seed JSON against the contract |

---

## Configuration (`.env.local`)

All of these are `NEXT_PUBLIC_*`, so they're **compiled into the browser bundle**: no secrets. Restart or rebuild after changing them. Details are in `.env.example`.

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | empty | Empty = the built-in mock at this app's `/api`. Set it to the SOCIMCO API origin to use the real backend. |
| `NEXT_PUBLIC_API_ADAPTER` | `contract` | `custom` uses `src/core/api/client/adapters/custom-adapter.ts` to translate the real API. |
| `NEXT_PUBLIC_API_AUTH` | `cookie` | `cookie` (HttpOnly session cookie) or `bearer` (token kept per tab). |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | `15000` | Request timeout. |
| `NEXT_PUBLIC_QR_LOGIN` | `on` | `off` hides sign-in with a phone (QR panel and "Approve a computer") for a backend without QR support. |

---

## Where things are

```
src/
  app/                      Routes (thin: each page renders a feature screen)
    (auth)/login            Sign-in: password + QR panel
    qr/approve              Phone screen that approves a desktop QR sign-in
    (shop)/                 Everything behind sign-in (AuthGate + Shell)
      page.tsx              Home
      category/[slug]       Category listing with filters and sort
      search                Search results
      products/[slug]       Product detail
      cart                  Cart
      negotiation           Trade quote (offer, counter, accept, countdown)
      checkout              Checkout and order placed
      orders, orders/[id]   Order history and detail
      account               Profile, company, addresses
    api/[...path]           The MOCK backend's REST API (see "Before going live")
    globals.css             SOCIMCO theme: colour tokens, fonts, background, button styles
  design/
    shell.tsx               Header, navigation, mega-menu, mini-cart, mobile nav, footer
    providers.tsx           React Query + toasts
  core/
    contract/               THE source of truth: zod schemas, routes, error codes, business rules
    api/client/             Browser API client, React hooks, adapters  ← where the real API is plugged in
    api/server/             Request handler for the mock's /api routes
    mock-backend/           In-memory demo backend + seed JSON
    features/               Screens: auth, catalog, cart, negotiation, checkout, orders, account
    ui/                     Shared components (buttons, stepper, chips, sheet, toast, formatting)
  server/backend.ts         Chooses the server-side backend (the mock)
docs/api-integration.md     Overview of the API integration for project managers
public/brand/               SOCIMCO logo files
```

### Architecture rules (enforced by ESLint and `src/core/dependency-rules.test.ts`)

- **What screens may import.** `core/features` and `core/ui` may import only `core/contract`, `core/api/client` and `core/ui`. Screens never know which backend is running.
- **Keeping the browser bundle clean.** `core/api/client` never imports server code or the mock, so it's safe to ship to the browser.
- **Validated data only.** Every API response is validated against `core/contract/schemas.ts` before the UI sees it. A wrong shape shows a friendly error and logs the exact field in the console.

### Stack

- Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript strict
- Tailwind CSS v4 with tokens in `globals.css` (the default palette is disabled, so use the theme colours)
- TanStack Query 5, zod 4, lucide-react icons, Vitest

- `qrcode.react` draws the scannable sign-in QR code, which encodes the `approveUrl` from the API.
- **The phone's in-app scanner.** On a phone, Account → Approve a computer opens `/qr/approve`, which uses the camera:
  - It reads codes with the browser's `BarcodeDetector` (Chrome on Android), or with `jsqr` elsewhere (Safari on iPhone).
  - It only accepts this site's own `/qr/approve?code=…` links.
  - It needs HTTPS (or localhost) and camera permission.
  - Without a camera, the phone's own camera app works too: it opens the same link.
- In `next.config.ts`, `experimental.instantInsights.validationLevel: "manual-warning"` stops Next's dev-only "instant navigation" check from flagging every shop page. Pages wait for the signed-in customer and load their data in the browser, so they can't render instantly from the server by design.

> Next.js 16 differs from older versions in places. Check `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).

---

## Before going live

- [ ] **Connect the real API.** Follow [`src/core/api/README.md`](src/core/api/README.md): set the three `NEXT_PUBLIC_API_*` variables and fill in `custom-adapter.ts`.
- [ ] **Remove the mock from production.** `src/app/api/[...path]` serves the demo backend, **including the demo logins**. Once the real API is live, delete that route (and `src/server/backend.ts` with `src/core/mock-backend` if nothing else uses them), or block `/api/*` at the host.
- [ ] **CORS and cookies** on the SOCIMCO API for the storefront's real domain (section 6 of the API guide).
- [ ] **Run the reference scenario on staging** with real accounts.
- [ ] **Product photos.** The demo uses free-licence Unsplash/Pexels photos via their CDNs; replace them with SOCIMCO's own catalogue images from the API.
- [ ] **Indexing.** The site is private and sends `noindex`; keep it that way.
- [ ] **Decide the known gaps** listed at the end of the API guide: catalog filters, quotes list, address editing, invoices, store settings.

## Status at handover

- **Checks pass:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (99 tests), `pnpm validate:data` and `pnpm build`.
- **Every screen checked in the browser at 390 px and 1440 px**, signed in against the mock: home, category, search, product, cart, quote, checkout, orders, order detail, account, QR approval and not-found pages. None scrolls sideways, and each has one main heading.
- **Flows verified end to end:**
  - the reference scenario through the real screens
  - password sign-in and its errors
  - QR sign-in: approve, already used, unknown code
  - the phone's in-app scanner: tested with a simulated camera and decoder (wrong code, then a real code), and the no-camera fallback
  - sign-out, and a session expiring and returning to the right page
- **Controls marked "Proposal"** (add or edit address, order these again) are designs waiting for backend support. They explain this when clicked instead of doing anything.

## Deploying

**Live:** https://socimco-storefront.vercel.app (Vercel project `socimco-storefront`). **Code:** https://github.com/Abedkob/socimco-storefront (private).

- **Pushing to `main`** deploys to production.
- **Other branches** get a preview URL. Use one per integration step (for example `feat/api-auth`, `feat/api-catalog`) and check the preview before merging.
- **Settings for the real API** (`NEXT_PUBLIC_API_*`) go in Vercel → Project → Settings → Environment Variables. Because they're compiled in, **redeploy after changing them**. You can set them on Preview only first, test, then on Production.
- **The mock resets.** While it runs on Vercel, its in-memory data resets whenever Vercel starts a fresh server (after a deploy or an idle period), and demo users then have to sign in again. That's fine for demos, and it ends when the real API is connected.

It's also a standard Next.js app: `pnpm build && pnpm start` on any Node 22 host, or import the folder on Vercel. No database or server secrets are needed by the storefront itself; all data comes from the API set in `NEXT_PUBLIC_API_BASE_URL`.

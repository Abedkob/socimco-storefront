# SOCIMCO trade portal

The private B2B storefront for SOCIMCO's trade customers: tools and hardware ordered by the hundred, with prices customers **negotiate with the sales desk**.

| | |
|---|---|
| **Live demo** | https://socimco-storefront.onrender.com: sign in as `test.customer` / `demo1234` |
| **Code** | https://github.com/Abedkob/socimco-storefront (private) |
| **Backend developer guide** | [`src/core/api/README.md`](src/core/api/README.md): how to plug in the real API |
| **Integration overview** | [`docs/api-integration.md`](docs/api-integration.md): a shorter summary for project managers |

**The storefront is in French only:** every screen, message, amount and date. Developer documentation (these READMEs) stays in English. The UI wording is fixed in [`docs/glossary-fr.md`](docs/glossary-fr.md); use it for any new text.

The app runs today on a **built-in demo backend** with realistic data. Connecting SOCIMCO's real API means changing settings and filling in **one adapter file**; no screen changes.

---

## Contents

1. [What the app does](#what-the-app-does)
2. [Try the live demo](#try-the-live-demo)
3. [Run it on your computer](#run-it-on-your-computer)
4. [Connecting the real API](#connecting-the-real-api)
5. [Configuration](#configuration)
6. [Scripts](#scripts)
7. [Project structure](#project-structure)
8. [Deploying](#deploying)
9. [Before going live](#before-going-live)
10. [Status and what was tested](#status-and-what-was-tested)
11. [Known gaps](#known-gaps)
12. [Troubleshooting](#troubleshooting)

---

## What the app does

Only existing customers can enter: there is **no public browsing and no sign-up**. Every page needs a sign-in, and search engines are told not to index the site.

**Signing in**
- **Username and password.**
- **QR code, in both directions:**
  - **A phone signs a computer in.** The computer's sign-in page shows a QR code. On a phone that's already signed in, tap the scan button at the top (or Account → Approve a computer), scan the code and approve.
  - **A computer signs a phone in.** On the computer, Account → **Sign in on your phone** shows a QR code. On the phone's sign-in page, tap **Scan QR code to sign in**.
    - With **"Ask me to confirm on this computer"** on (the default), you click Allow on the computer first.
    - With it off, scanning alone signs the phone in.
- **The phone has its own in-app scanner.** The phone's normal camera app also works, because the QR code is a regular link.

**Shopping**
- **Home:** hero, departments, featured products, recent orders.
- **Catalog:** categories with sorting and filters, search, and product pages with gallery, specs, stock and a quantity stepper.
- **Cart:** change quantities, see trade-price eligibility, and the cart locks while a quote is open.

**Trade quotes (price negotiation)**, the only discount mechanism
- The customer proposes a unit price for lines that qualify (enough quantity of a negotiable product).
- The sales desk accepts, declines or counters. The quote page updates by itself every few seconds.
- The customer has **3 offers**. Each must be above their last offer and below the desk's last price.
- An agreed price holds for **24 hours**. Open offers expire after 48 hours.

**Checkout and after**
- **Checkout:** pick a delivery address, see the negotiated savings per line, and place the order. A retry never creates a second order.
- **Order history and order detail:** status steps, savings, the delivery address, and a link back to the quote.
- **Account:** profile, company, delivery addresses, the sales-desk contact, phone sign-in, and sign-out.

Controls tagged **Proposal** (add or edit an address, "Order these again") are designs waiting for backend support. Clicking one explains that and does nothing else.

---

## Try the live demo

**https://socimco-storefront.onrender.com**

| Username | Password | Who | Use it for |
|---|---|---|---|
| `test.customer` | `demo1234` | Nadia Haddad, Atlas Contracting | **Start here.** Fresh customer, no orders, two delivery addresses |
| `demo.customer` | `demo1234` | Sam Carter, BuildCo Ltd | Has order history and a past negotiated order |
| `demo.customer2` | `demo1234` | Alex Morgan, Northside Builders | A second customer, for example as the "other" account in QR tests |
| `demo.inactive` | `demo1234` | Disabled account | Shows the "account disabled" error |
| `demo.seller` | `demo1234` | SOCIMCO Sales Desk | **Not a storefront user.** Answers quotes through the demo's sales-desk API (see below) |

- **It's on Render's free plan.** It sleeps after about 15 minutes without visitors. The first visit after that takes about a minute, and the demo data starts fresh: carts, quotes and orders are reset.
- **The address is public, but the app isn't.** Everything is behind sign-in, and all data is fake. Anyone who guesses a demo login could look around, so don't put real data in it.

**A good path through the demo:** sign in as `test.customer`, then:
1. Open « Perceuse-visseuse sans fil 18 V » (the 18V drill) and add 400 to the cart.
2. In the cart, choose « Demander un prix négocié » and offer 80.
3. As the sales desk, counter $90 (see "Playing the sales desk" below). The quote page updates by itself.
4. Offer $85. As the sales desk, accept.
5. The quote shows **$34,000.00, saving $6,000.00**. Choose **Checkout**, pick an address and place the order.
6. See it under **Orders**, marked *Negotiated*.

---

## Run it on your computer

Requirements: **Node 22** and **pnpm 9** (`corepack enable` provides the right pnpm).

```bash
pnpm install
pnpm dev            # http://localhost:3001
```

No `.env.local` is needed: the defaults use the built-in demo backend. To change settings, copy `.env.example` to `.env.local` (see [Configuration](#configuration)).

The demo backend keeps its data **in memory**, so restarting the server resets carts, quotes, orders and stock. The starting data is in `src/core/mock-backend/data/*.json`, and `pnpm validate:data` checks it.

### Playing the sales desk

SOCIMCO's own back office answers quotes; it isn't part of this app, and there's no admin screen. With the demo backend, you play the sales desk from a terminal.

First, as a customer in the browser, add 100 or more drills to the cart and request a trade price. Then run the commands below. They're shown for `http://localhost:3001`; for the live demo, replace both occurrences with `https://socimco-storefront.onrender.com`.

```powershell
# PowerShell
$site = "http://localhost:3001"
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$h = @{ Origin = $site }
Invoke-RestMethod "$site/api/auth/login" -Method Post -ContentType application/json -Headers $h -WebSession $s `
  -Body '{"username":"demo.seller","password":"demo1234"}'
(Invoke-RestMethod "$site/api/seller/negotiations?status=awaiting_seller" -WebSession $s).items   # find the quote id
Invoke-RestMethod "$site/api/seller/negotiations/neg_0002/rounds" -Method Post -ContentType application/json -Headers $h -WebSession $s `
  -Body '{"action":"counter","lines":[{"productId":"prd_drill_18v","unitPriceCents":9000}],"message":"We can do $90."}'
# accept:  -Body '{"action":"accept"}'      decline:  -Body '{"action":"reject"}'
```

```bash
# bash / zsh
SITE=http://localhost:3001
curl -c jar -H "Origin: $SITE" -H "Content-Type: application/json" \
  -d '{"username":"demo.seller","password":"demo1234"}' $SITE/api/auth/login
curl -b jar "$SITE/api/seller/negotiations?status=awaiting_seller"
curl -b jar -H "Origin: $SITE" -H "Content-Type: application/json" \
  -d '{"action":"counter","lines":[{"productId":"prd_drill_18v","unitPriceCents":9000}]}' \
  $SITE/api/seller/negotiations/neg_0002/rounds
```

State-changing calls need the `Origin` header and a JSON body, because the demo rejects cross-site requests, as the real API should.

### The reference scenario

This is used by the automated tests and for acceptance:
- 400 × 18V drill at $100.00 = **$40,000.00**.
- You offer $80, the desk counters $90, and you offer $85. An offer of $95 is rejected, because it's above the desk's $90. The desk accepts $85.
- Agreed **$34,000.00, saving $6,000.00**, valid for 24 hours.
- The order is placed as **TP-2026-1004** (on a fresh server), and drill stock drops from 1,200 to 800.
- Retrying the same order returns the same order. Ordering more than 24 hours after acceptance is refused as expired.

---

## Connecting the real API

All of SOCIMCO's backend comes in through one place, `src/core/api/client/`. The full guide is [`src/core/api/README.md`](src/core/api/README.md). In short:

1. **Settings.** Set `NEXT_PUBLIC_API_BASE_URL` (their API), `NEXT_PUBLIC_API_ADAPTER=custom` and `NEXT_PUBLIC_API_AUTH` (`cookie` or `bearer`).
2. **The adapter.** Fill in `src/core/api/client/adapters/custom-adapter.ts`:
   - their URLs for our routes
   - reshaping requests and responses (field names, money in cents, dates)
   - routes that need several of their calls
   - their error codes mapped to ours
3. **Check in the browser.** Every response is checked against `src/core/contract/schemas.ts`. If a field doesn't match, the console shows exactly which one, and the screen shows a friendly error instead of wrong data.
4. **CORS and cookies.** Their API must allow the storefront's address (CORS), and in cookie mode accept credentials.
5. **The reference scenario.** Run it on their staging system with real accounts.

Things their backend must do are listed in the guide: business rules, every route's required fields, error codes, and both QR flows. Its last section lists what the API doesn't cover yet.

---

## Configuration

These go in `.env.local`, or in the hosting service's environment settings. All are `NEXT_PUBLIC_*`, so they're **compiled into the browser code at build time**:
- **Rebuild after changing them** (on Render or Vercel, redeploy).
- **Never put secrets in them.**

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | empty | Empty = the built-in demo backend at this app's `/api`. Otherwise, the SOCIMCO API's address. |
| `NEXT_PUBLIC_API_ADAPTER` | `contract` | `custom` uses `adapters/custom-adapter.ts` to translate the real API. `contract` = the API already speaks our format (the demo does). |
| `NEXT_PUBLIC_API_AUTH` | `cookie` | `cookie`: the API sets a secure session cookie. `bearer`: the API returns a token, kept per browser tab. |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | `15000` | Requests are cancelled after this many milliseconds. |
| `NEXT_PUBLIC_QR_LOGIN` | `on` | `off` hides both QR sign-in directions, for a backend that doesn't support them. Password sign-in is unaffected. |
| `NEXT_PUBLIC_CURRENCY` | `USD` | The currency prices are shown in, using French formatting: `USD` → `40 000,00 $US`, `EUR` → `40 000,00 €`, `MAD` → `40 000,00 MAD`. The demo data is in USD. |

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server on http://localhost:3001 |
| `pnpm build` | Production build. Also produces `.next/standalone`, the single-server package used by Docker. |
| `pnpm start` | Serves the production build on port 3001. A warning about `output: standalone` is expected and harmless. |
| `pnpm test` | Vitest (116 tests). See the list below. |
| `pnpm typecheck` | Route types plus a strict TypeScript check |
| `pnpm lint` | ESLint, including the architecture rules below |
| `pnpm validate:data` | Checks the demo data against the contract |

`pnpm test` covers:
- the **backend contract suite**: every business rule, both QR flows and the reference scenario, run twice (directly, and through real HTTP requests)
- the browser API client, including the scenario over HTTP, error handling, timeouts and adapter examples
- the settings, the QR link check, and the dependency rules

---

## Project structure

```
src/
  app/                          Routes. Each page only renders a feature screen.
    (auth)/login                Sign-in: password, QR panel (computer), "Scan QR code to sign in" (phone)
    qr/approve                  Phone: scanner + "Sign in on a computer?" approval
    qr/sign-in                  Phone: scanner + sign in with a computer's code
    (shop)/                     Everything behind sign-in (AuthGate + Shell)
      page.tsx                  Home
      category/[slug], search   Catalog listing with filters and sort, search results
      products/[slug]           Product detail
      cart, negotiation         Cart, trade quote
      checkout                  Checkout and "order placed"
      orders, orders/[id]       Order history and detail
      account                   Profile, addresses, sales desk, phone sign-in, sign-out
    api/[...path]               The DEMO backend's REST API (remove before going live)
    globals.css                 SOCIMCO theme: colour tokens, fonts, background, buttons
  design/
    shell.tsx                   Header, navigation, mega-menu, mini-cart, phone nav, footer
    providers.tsx               React Query + toasts
  core/
    contract/                   THE source of truth: schemas, routes, error codes, business rules,
                                and the backend contract test suite (testing/)
    api/client/                 Browser API client, React hooks, adapters  ← the real API plugs in here
    api/server/                 Request handler for the demo's /api routes
    mock-backend/               In-memory demo backend + demo data (data/*.json)
    features/                   Screens: auth (sign-in, QR, scanner), catalog, cart, negotiation,
                                checkout, orders, account, status pages
    ui/                         Shared building blocks: buttons, stepper, chips, sheet, toast, formatting
  server/backend.ts             Picks the server-side backend (the demo)
docs/api-integration.md         Short integration overview
docs/glossary-fr.md             French UI wording and formatting rules
Dockerfile, render.yaml         Single-server package and the Render setup
public/brand/                   SOCIMCO logo files
```

### Architecture rules

These are enforced by ESLint and by `src/core/dependency-rules.test.ts`:
- **What screens may import.** `core/features` and `core/ui` may import only `core/contract`, `core/api/client` and `core/ui`. Screens never know which backend is behind them.
- **Browser code stays clean.** `core/api/client` never imports server code or the demo backend.
- **The UI only sees validated data.** Every response is validated against the contract first.

### Stack

- **Framework:** Next.js 16 (App Router, Cache Components), React 19, strict TypeScript.
- **Styling:** Tailwind CSS v4. Theme tokens are in `globals.css`, and the default palette is switched off, so use the theme colours.
- **Libraries:**
  - TanStack Query 5 for data, caching and polling
  - zod 4 for the contract
  - lucide-react for icons
  - Vitest for tests
- **QR:**
  - `qrcode.react` draws the codes.
  - The phone scanner uses the browser's `BarcodeDetector` where it exists (Chrome on Android), and the small `jsqr` library elsewhere (Safari on iPhone).
  - The camera needs HTTPS (or localhost) and the user's permission.
- **Next.js 16 differs from older versions.** Check `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).

---

## Deploying

> **While the demo backend is used, run the app as ONE server.** The demo keeps sessions, carts, quotes and orders in that server's memory.
>
> On serverless hosting such as **Vercel**, simultaneous requests reach different copies of the server, each with its own memory. Signed-in customers then randomly look signed out, and pages keep loading or bounce back to sign-in. This was measured, and it's why the demo moved to Render.
>
> Once the real SOCIMCO API is connected, the storefront keeps no data of its own, and Vercel or any number of servers is fine.

### Render (current live demo)

- `render.yaml` defines **one free Docker web service** in Frankfurt, with a health check on `/login`, which **redeploys on every push to `main`**.
- To set it up again from scratch: in Render, choose **New → Blueprint**, pick this repository, then **Apply**.
- `NEXT_PUBLIC_*` settings are in `render.yaml` and under the service's **Environment** tab. Render passes them to the Docker build.

### Docker (any host: Dokploy, Railway, Fly, your own server)

```bash
docker build -t socimco-storefront .
docker run -p 3000:3000 socimco-storefront          # http://localhost:3000
```

- Run **1 instance** on port **3000**, with the health check `GET /login`. The container runs as a non-root user.
- Settings are build arguments, for example `docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.socimco.example -t socimco-storefront .`.

### Vercel (for when the real API is connected)

- The project `socimco-storefront` is linked to the GitHub repo: https://socimco-storefront.vercel.app.
- Pushing to `main` deploys to production, and other branches get preview links.
- **Don't use it for the demo**, for the reason above. Once the real API is in, it works well: put the `NEXT_PUBLIC_API_*` settings in Project → Settings → Environment Variables, and redeploy.
- Vercel's firewall may briefly challenge scripts that send many requests quickly; that's Vercel, not the app. Space out automated tests.

---

## Before going live

- [ ] **Connect the real API** ([guide](src/core/api/README.md)), and run the reference scenario on staging.
- [ ] **Remove the demo backend** from the production build. `src/app/api/[...path]` serves it, **including the demo logins**. Delete that route, and remove `src/server/backend.ts` and `src/core/mock-backend` if nothing else uses them. Or block `/api/*` at the host.
- [ ] **CORS and cookies** on the SOCIMCO API for the storefront's real domain (section 6 of the guide).
- [ ] **QR sign-in:** confirm the backend supports both flows, or set `NEXT_PUBLIC_QR_LOGIN=off`. Decide whether the "no confirmation" phone sign-in mode is allowed.
- [ ] **Product photos:** the demo uses free-licence Unsplash/Pexels photos; switch to SOCIMCO's own images from the API.
- [ ] **Sales-desk contact** on the Account page is fixed text; supply it from the API.
- [ ] **Keep `noindex`**, because the site is private.
- [ ] **Decide the known gaps** (below).
- [ ] **Choose the production host:** Vercel works once the demo backend is gone.

---

## Status and what was tested

| Check | Result |
|---|---|
| `pnpm typecheck`, `pnpm lint`, `pnpm validate:data`, `pnpm build` | Pass |
| `pnpm test` | 116 tests pass |
| **Live demo (Render), automated, as `test.customer`** | **39/39 checks**: sign-in and its errors, catalog, cart, the full negotiation, checkout (second address, no duplicate orders, safety key required), order history, stock, privacy between accounts, both QR flows, sign-out |
| **Live demo, 4 rounds of 8 simultaneous requests** (the Vercel problem) | 32/32 succeed |
| **On-screen walkthrough, production build, desktop 1440 px** | The whole buying path through the real buttons: add 400 drills → quote $80 → counter $90 shows by itself → $95 blocked on screen → $85 → accepted → checkout to the second address → order placed → orders, detail, account, phone sign-in panel |
| **Phone width 390 px** | All 12 shop and QR pages: no sideways scrolling, one main heading each, full-size buttons |
| **QR sign-in in the browser** | Both directions, with and without confirmation, reused and unknown codes, and the scanner with a simulated camera |

**Not yet verified:**
- **A real phone camera scanning a real screen.** The scanner was tested with a simulated camera; try it once on a phone.
- **The real SOCIMCO API**, which isn't connected yet.

---

## Known gaps

These need a product decision or backend support. Details are at the end of the [API guide](src/core/api/README.md):
- **Catalog filters** (brand, price, stock, negotiable) run only on the products already loaded. The API filters by category and search only.
- **Some fields are missing:**
  - Cart lines lack product link, brand, stock and minimum quantities.
  - Quote lines lack images.
  - Order summaries lack images.
- **No API yet for:**
  - store settings (number of offers, quote validity)
  - the customer's list of quotes
  - editing addresses
  - invoices
  - re-ordering
- **The sales-desk contact** is fixed text.
- **Bearer-token refresh** isn't built.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| The live demo takes about a minute to open | Render's free plan was asleep. Wait; the data starts fresh. |
| On Vercel: endless loading, or bounced back to sign-in | The demo backend on serverless (see [Deploying](#deploying)). Use Render, or connect the real API. |
| Scripts against Vercel get `403` with `X-Vercel-Mitigated: challenge` | Vercel's bot protection. Slow down; it clears by itself. |
| `pnpm dev` says port 3001 is in use | Another dev server is running. Stop it, or run `pnpm exec next dev -p 3002`. |
| Dev server shows old colours or styles | Stop it and run `pnpm dev` again. |
| A response "doesn't match" error in the console | The API returned a field in a different shape. The console names the field; fix it in the adapter. |
| Phone scanner says the camera can't open | The page needs HTTPS and camera permission. The phone's own camera app works as a fallback. |

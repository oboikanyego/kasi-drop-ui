# KasiDrop — Ionic + Angular Storefront

**Local roots. Delivered.** A mobile-first South African-made goods store, built using Ionic 8 and Angular 20.

## Run

- Requirements: Node.js 22 and npm.
- Clone this repo, run \`npm install\` and \`npm start\`.
- Start the [KasiDrop API](https://github.com/oboikanyego/kasi-drop-api) on port 10000, or use the live Render deployment.
- For local development use a proxy: \`npm start -- --proxy-config proxy.conf.json\`.

**Sleeping API:** Render's free tier sleeps the API after 15 minutes without traffic, and the first request then takes 30-60 seconds. On a first visit (or when the last confirmation is over 10 minutes old) the app shows a splash screen and asks `GET /api/meta?wake=1` until the API answers, retrying every 2 seconds, and only then boots. After 3 seconds the splash explains the wait. If the API still has not answered after 2 minutes the app boots anyway, into its offline preview. The same check runs when you come back to a tab that was left open (it becomes visible or regains focus) and the last confirmation is over 10 minutes old. If the API answers at once nothing is shown; if not, after 0.4 seconds a full-screen loader covers the page, and the page behind it cannot be clicked or tabbed to, until the API is awake. That wait is capped at 90 seconds, and after a give-up it does not cover the page again for 5 minutes. A tab that stays in view and untouched for a long time fires neither event, so it is not covered. Local development skips all of this; open the page with `?wake=1` to try it. The timings are constants at the top of `src/app/wake-api.ts`.

Sign-in uses an httpOnly session cookie set by the API, so no token is ever stored in the browser or readable by page scripts. That relies on the app reaching the API at the same origin (the `/api` proxy). Requests carry an `X-KasiDrop-CSRF` header, which the API requires for cookie-authenticated changes. A token left in `localStorage` by an older release is swapped for the cookie on the next visit.

The app calls the API at relative path \`/api\` so Netlify proxies requests via \`netlify.toml\`. Configure the Render service URL in that file if your assigned hostname differs. The UI needs the API for products, login and checkout.

## Checks

- `npm run lint`: ESLint on the app, tests and config
- `npm test`: fast unit and source checks (`tests/`)
- `npm run test:e2e`: browser tests (`e2e/`) for checkout, PayFast return and admin flows. They drive the production build against a recording stub API (`e2e/stub-server.mjs`), so run `npm run build` first. Locally, install Chromium once with `npx playwright install chromium`.

## Current integrations and persistence (October 2026)

- **Live storefront:** https://kasi-drop.netlify.app/
- **API:** Node.js/Express service deployed via Render. The app calls relative `/api` and relies on Netlify's proxy configuration; verify the current backend URL in `netlify.toml`.
- **Shopping assistant:** Google Gemini is the primary AI provider, with Groq as a configured fallback and catalogue search as a non-AI fallback. Provider credentials are held on the backend, not in Ionic.
- **Favourites:** Signed-in users' selections are saved in MongoDB via `GET /api/favorites`, `PUT /api/favorites/:productId`, `DELETE /api/favorites/:productId`, and `POST /api/favorites/merge`. Guest selections use `kasi_guest_favorites` in localStorage and can be merged after sign-in. They are **not** sessionStorage-only.
- **Health checks:** `GET /health` is the backend liveness route; `GET /api/health` is readiness (MongoDB-aware in persistent mode). A suspended Render service cannot respond to these probes.
- **Code style:** `npm run format` applies Prettier, and `npm run format:check` checks formatting.

## Journey coverage

- Homepage, featured products, categories, catalogue filters, product details
- Persistent shopping bag (browser storage), shipping calculation and checkout
- Demo customer signup/login and order history
- Admin KPI dashboard, stock editing, order fulfilment and product creation (photos are uploaded, shrunk in the browser to 1200px and stored by the API)
- Gemini-powered chat (with Groq fallback when configured) and assisted admin listing draft

Demo customer \`shopper@kasidrop.test\` / \`Demo@12345\`; demo admin \`admin@kasidrop.test\` / \`Demo@12345\`. Demo data is ephemeral, and checkout is simulated; these credentials must not be used for live customers.

## Deployment

Netlify should import this GitHub repo with:

- Build: \`npm ci && npm run build\`
- Publish directory: \`dist/kasi-drop-ui\`
- Base directory: repository root
- SPA redirects and API reverse proxy are defined in \`netlify.toml\`.

**Status:** MVP code, not an audited production commerce site. Semantic vector embeddings are not yet implemented; catalogue search currently uses keyword/contextual synonyms. Real payments require further verification and security testing.

## Backend connection and preview mode

The storefront calls the real API through Netlify's \`/api/\*\` proxy. If the API cannot be reached, **catalogue reads fall back to 12 clearly labelled static preview products** so the design can be explored. An on-screen banner warns that inventory/prices are examples and checkout is disabled. This is not a replacement for a deployed backend or payment verification.

To enable accounts, stock, orders and checkout, deploy [kasi-drop-api](https://github.com/oboikanyego/kasi-drop-api) to Render, set its \`CLIENT_URL\` to this Netlify origin, and update \`netlify.toml\` to point at the **actual** Render URL. Verify \`GET /api/meta\` and \`GET /api/products\` return 200 through Netlify before accepting demo orders.

## Analytics and customer feedback

The app anonymously records broad page views, catalogue searches (without query text), AI chat invocations (without prompts), add-to-cart actions, checkout starts and checkout creations. Events are sent to `POST /api/analytics/events` without personal identifiers; analytics requests do not block shopping.

Customers can share feedback at **`/feedback`**. The form supports bug reports, suggestions and shopping-experience feedback with an optional 1–5 rating. Submissions go to `POST /api/feedback`.

The **Admin → Insights & Feedback** tab shows 30-day anonymous event counts, checkout creation/start percentage, HTTP 5xx event counts and recent tester feedback. These are **not unique visitor numbers or confirmed payment conversions**. The admin routes require authenticated admin access.

## Launch improvements (November 2026)

- A polished, accessible, responsive `/feedback` form lets early customers submit experience feedback, ideas and bug reports.
- Admin → Insights & Feedback now supports triage statuses (`new`, `in_review`, `resolved`, `closed`) and status filtering.
- The admin reports **verified payments / PayFast orders created** (server-owned checkout cohort) independently from anonymous frontend checkout counts; these are not interchangeable.
- Admin overview shows deployment readiness diagnostics. Live payments remain **disabled**; only the sandbox gateway is implemented.
- The homepage features a trending-products section driven by 30-day anonymous product views and add-to-cart aggregates. There is no user identity tracking or personalised profile.
- The API has an optional Cloudflare R2 storage backend configured entirely through Render environment values. See API README for the staged migration procedure; do not add secrets to Netlify.

## Hide discontinued products

**Admin → Inventory** now includes a visibility status and **Hide from store / Show in store** controls. Hidden products remain in the admin catalogue and can be restored without losing their information. Filter visible/hidden items and navigate pages. Shoppers no longer see hidden products in searches, details, recommendations or AI suggestions, and cannot check out with a hidden item from an old cart.

## Shop budget range picker

The shop now has touch-friendly minimum/maximum budget sliders and editable Rand amount fields (R0–R5,000+, with an open upper end at the slider maximum). Products update when an amount is selected. Filters also work in offline read-only catalogue preview. Clear filters resets the budget range.

# KasiDrop — Ionic + Angular Storefront

**Local roots. Delivered.** A mobile-first South African-made goods store, built using Ionic 8 and Angular 20.

## Run
- Requirements: Node.js 22 and npm.
- Clone this repo, run \`npm install\` and \`npm start\`.
- Start the [KasiDrop API](https://github.com/oboikanyego/kasi-drop-api) on port 10000, or use the live Render deployment.
- For local development use a proxy: \`npm start -- --proxy-config proxy.conf.json\`.

The app calls the API at relative path \`/api\` so Netlify proxies requests via \`netlify.toml\`. Configure the Render service URL in that file if your assigned hostname differs. The UI needs the API for products, login and checkout.

## Journey coverage
- Homepage, featured products, categories, catalogue filters, product details
- Persistent shopping bag (browser storage), shipping calculation and checkout
- Demo customer signup/login and order history
- Admin KPI dashboard, stock editing, order fulfilment and product creation
- Claude-powered chat (when API key exists) and assisted admin listing draft

Demo customer \`shopper@kasidrop.test\` / \`Demo@12345\`; demo admin \`admin@kasidrop.test\` / \`Demo@12345\`. Demo data is ephemeral, and checkout is simulated; these credentials must not be used for live customers.

## Deployment
Netlify should import this GitHub repo with:
- Build: \`npm install && npm run build\`
- Publish directory: \`dist/kasi-drop-ui\`
- Base directory: repository root
- SPA redirects and API reverse proxy are defined in \`netlify.toml\`.

**Status:** MVP code, not an audited production commerce site. Semantic vector embeddings are not yet implemented; catalogue search currently uses keyword/contextual synonyms. Real payments require further verification and security testing.

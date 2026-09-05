# GeeLark Flows — Reusable Automation Marketplace

Production storefront and operations dashboard for reusable mobile automation flows. The application sells platform-specific workflows, accepts USDT through NOWPayments, receives transactional email through Resend, stores commerce data in Cloudflare D1, and streams purchased flow archives privately from R2.

GeeLark Flows is an independent digital-products business and is not affiliated with, endorsed by, or sponsored by the owner of the GeeLark software or trademark.

## Architecture

- React 19 storefront and private administration UI
- Vite 8 build and local development server
- Cloudflare Worker API using Hono
- D1 for orders, invoices, sessions, audit events, mail, and fulfillment state
- R2 for private product archives
- NOWPayments for USDT invoices and signed IPN callbacks
- Resend for transactional delivery and signed inbound-email events

Pricing and product identity are resolved from `src/data/products.js` by the Worker. Client-submitted prices and titles are never trusted.

## Local development

Requirements: Node.js 24+ and npm.

```bash
npm ci
copy .env.example .env
npm run dev
```

The server binds to `127.0.0.1:5173` by default. Local checkout uses deterministic fake wallet addresses and never contacts NOWPayments unless `ENABLE_LIVE_PAYMENT_MOCK=true` is explicitly configured.

Local admin login is disabled until `DEV_ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD` are set. Local webhook mutation is disabled until `DEV_CRYPTO_WEBHOOK_SECRET` is set.

## Verification

```bash
npm test
npm run build
npm audit --audit-level=high
```

The test command runs pricing, route-level checkout, payment reconciliation, webhook signature, checkout privacy, secure download, legal/trust, custom-request, cart, delivery, and schema suites.

## Production configuration

Non-secret Worker variables live in `wrangler.jsonc`. Store secrets with Wrangler, never in source control:

```bash
npx wrangler secret put NOWPAYMENTS_API_KEY
npx wrangler secret put NOWPAYMENTS_IPN_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_WEBHOOK_SECRET
npx wrangler secret put ADMIN_BOOTSTRAP_SECRET
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
npx wrangler secret put ANALYTICS_HASH_SALT
```

`ADMIN_BOOTSTRAP_SECRET` must contain at least 32 characters. Bootstrap is disabled by default with `ADMIN_BOOTSTRAP_ENABLED=false`. Enable it only for the initial administrator creation, provision the administrator, then immediately disable it and deploy again.

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (generate with `npx web-push generate-vapid-keys`) enable browser push notifications; if any of the three is missing, push stays silently disabled. `ANALYTICS_HASH_SALT` pseudonymizes visitor/IP hashes for storefront analytics and must be set explicitly — it must not be left to fall back to `ADMIN_BOOTSTRAP_SECRET`.

### Administrator password recovery

Cloudflare Workers accepts at most 100,000 PBKDF2 iterations. If an administrator was provisioned by an older release that generated a 600,000-iteration hash, deploy the current Worker first and then replace that incompatible verifier from an authenticated Wrangler terminal:

```bash
npm run admin:reset-password -- --email admin@example.com --remote
```

The command prompts for the new password without echoing it, generates a fresh random salt, and updates only the matching administrator in the remote D1 database. It never places the plaintext password in command history or source files.

Apply database migrations before deploying code that expects the new columns:

```bash
npx wrangler d1 execute geelarkflows_payment --remote --command="SELECT order_id, COUNT(*) AS invoice_count FROM crypto_payments GROUP BY order_id HAVING COUNT(*) > 1"
npx wrangler d1 migrations apply geelarkflows_payment --remote
npm run build
npm run deploy
```

The preflight query must return no rows. If it finds historical duplicates, review them manually before applying the unique invoice-per-order index; do not delete payment history blindly.

`schema.sql` is the consolidated schema for a completely new database. Existing databases should use the versioned files in `migrations/`.

## R2 product delivery

Each product must have its own ZIP object using this exact private key convention:

```text
flows/<product-id>.zip
```

For example:

```text
flows/instagram-account-creation.zip
flows/tiktok-warmup.zip
flows/mobile-seo-searches.zip
```

The admin fulfillment action verifies every purchased object before sending email. The customer receives seven-day private links. The Worker checks that the requested product belongs to the paid order and streams the R2 object without buffering it in memory. A missing object fails fulfillment and never marks the order delivered.

## Checkout and payment security

- Orders and invoices are written atomically before a wallet address is returned.
- Order IDs use 128 bits of randomness.
- Customer status requests require a separate 256-bit token and are rate-limited.
- Public status responses omit customer email.
- Signed payment events must match the stored payment ID, order ID, USDT network, expected crypto amount, USD price, and currency.
- Underpayments and mismatches are placed into `review_required` instead of marking the order paid.
- Customer polling reads D1 only; vendor synchronization is an explicit audited admin action.

## SEO

The production build generates static pages for every flow plus legal/contact routes, canonical metadata, Product/Breadcrumb/FAQ structured data, XML and text sitemaps, `robots.txt`, and an IndexNow URL list.

```bash
npm run build
npm run seo:indexnow
```

Submit `https://geelarkflows.com/sitemap.xml` to both Google Search Console and Bing Webmaster Tools.

## Launch checklist

- Have qualified counsel review the published operator identity and determine whether any more specific jurisdiction or business-address disclosure is legally required.
- Confirm the independent/non-affiliation trademark disclaimer is appropriate.
- Upload one verified R2 archive for every active product ID.
- Apply D1 migrations and verify there are no duplicate historical payment rows.
- Configure all five Worker secrets and both provider webhooks.
- Provision the first administrator, then disable bootstrap.
- Run `npm test`, `npm run build`, and `npm audit --audit-level=high`.
- Test one low-value invoice on each supported network before enabling normal sales.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import app from '../src/worker.js';

const statusToken = 'a'.repeat(64);
const statusTokenHash = crypto.createHash('sha256').update(statusToken).digest('hex');
const payment = {
  id: '987654321',
  order_id: 'ord_0123456789abcdef0123456789abcdef',
  currency: 'USDT (ERC-20)',
  network_id: 'erc20',
  provider_currency: 'usdterc20',
  pay_address: '0x1111111111111111111111111111111111111111',
  pay_amount_crypto: '1000',
  status: 'waiting',
  confirmations: 0,
  required_confirmations: 2,
};
const order = {
  id: payment.order_id,
  status: 'awaiting_payment',
  total_usd: 1000,
  total_usd_cents: 100000,
  delivery_method: 'download_package',
  workflow_subtotal: 1000,
  workflow_subtotal_cents: 100000,
  setup_fee: 0,
  setup_fee_cents: 0,
  fulfillment_status: 'not_ready',
  status_token_hash: statusTokenHash,
};

let requestedAssetKey = null;
const mockDb = {
  prepare(query) {
    return {
      bind(...args) {
        return {
          async first() {
            if (query.includes('FROM crypto_payments')) return payment;
            if (query.includes('FROM orders WHERE id = ?')) return order;
            if (query.includes('INSERT INTO api_rate_limits')) return { request_count: 1 };
            if (query.includes('FROM order_download_tokens')) {
              return {
                token_id: 'dlt_test',
                order_id: order.id,
                status: 'paid',
                items: JSON.stringify([{ id: 'instagram-account-creation', title: 'Instagram Account Creation' }]),
              };
            }
            return null;
          },
          async run() { return { success: true, args }; },
          async all() { return { results: [] }; },
        };
      },
    };
  },
};

const bucket = {
  async get(key) {
    requestedAssetKey = key;
    return {
      body: new Blob(['zip-data']).stream(),
      size: 8,
      writeHttpMetadata(headers) { headers.set('Content-Type', 'application/zip'); },
    };
  },
};

const env = { DB: mockDb, FLOWS_BUCKET: bucket };

const noToken = await app.request(`https://geelarkflows.com/api/checkout/status/${order.id}`, undefined, env);
assert.equal(noToken.status, 404, 'status endpoint must reject missing checkout token');

const wrongToken = await app.request(
  new Request(`https://geelarkflows.com/api/checkout/status/${order.id}`, { headers: { 'X-Checkout-Token': 'b'.repeat(64) } }),
  undefined,
  env,
);
assert.equal(wrongToken.status, 404, 'status endpoint must reject incorrect checkout token');

const validStatus = await app.request(
  new Request(`https://geelarkflows.com/api/checkout/status/${order.id}`, { headers: { 'X-Checkout-Token': statusToken } }),
  undefined,
  env,
);
assert.equal(validStatus.status, 200);
const statusBody = await validStatus.json();
assert.equal(statusBody.data.network, 'erc20', 'stored ERC-20 invoice must never fall back to TRC-20');
assert.equal(statusBody.data.customerEmail, undefined, 'public status response must not expose customer email');
assert.match(validStatus.headers.get('cache-control') || '', /no-store/);

const downloadToken = 'c'.repeat(64);
const validDownload = await app.request(
  `https://geelarkflows.com/api/downloads/${downloadToken}/instagram-account-creation`,
  undefined,
  env,
);
assert.equal(validDownload.status, 200);
assert.equal(requestedAssetKey, 'flows/instagram-account-creation.zip');
assert.equal(await validDownload.text(), 'zip-data');

const wrongProduct = await app.request(
  `https://geelarkflows.com/api/downloads/${downloadToken}/tiktok-account-creation`,
  undefined,
  env,
);
assert.equal(wrongProduct.status, 404, 'token must not download a product outside the purchased order');

const bootstrapDb = { prepare: () => ({ bind: () => ({ run: async () => ({}) }), first: async () => ({ count: 0 }) }) };
const bootstrapRequest = () => new Request('https://geelarkflows.com/api/admin/auth/bootstrap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@example.com', password: 'StrongPassword1!', bootstrapSecret: 'geelark_initial_bootstrap_key_2026' }),
});
const disabledBootstrap = await app.request(bootstrapRequest(), undefined, { DB: bootstrapDb });
assert.equal(disabledBootstrap.status, 403, 'bootstrap must be disabled by default');
const missingSecretBootstrap = await app.request(bootstrapRequest(), undefined, { DB: bootstrapDb, ADMIN_BOOTSTRAP_ENABLED: 'true' });
assert.equal(missingSecretBootstrap.status, 503, 'bootstrap must never use a hardcoded fallback secret');

const workerSource = fs.readFileSync('src/worker.js', 'utf8');
assert(!workerSource.includes('master_package.zip'), 'universal master package must not be used');
assert(!workerSource.includes('api.qrserver.com'), 'payment addresses must not be disclosed to a QR service');

const assetEnv = {
  ASSETS: {
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      return pathname === '/index.html'
        ? new Response('<!doctype html><title>GeeLark Flows</title>', { status: 200, headers: { 'Content-Type': 'text/html' } })
        : new Response('Not Found', { status: 404 });
    },
  },
};

const validCartDeepLink = await app.request('https://geelarkflows.com/cart', undefined, assetEnv);
assert.equal(validCartDeepLink.status, 200, 'known SPA route must receive the index shell');

const validFlowDeepLink = await app.request('https://geelarkflows.com/flows/instagram-account-creation/', undefined, assetEnv);
assert.equal(validFlowDeepLink.status, 200, 'known catalog flow route must receive the index shell');

const invalidFlowDeepLink = await app.request('https://geelarkflows.com/flows/not-a-real-flow/', undefined, assetEnv);
assert.equal(invalidFlowDeepLink.status, 404, 'unknown catalog flow must not become a soft-404 homepage');

const invalidPublicPath = await app.request('https://geelarkflows.com/not-a-real-page', undefined, assetEnv);
assert.equal(invalidPublicPath.status, 404, 'unknown public path must preserve a real HTTP 404');

console.log('Checkout privacy, network safety, secure delivery, and bootstrap hardening tests passed.');

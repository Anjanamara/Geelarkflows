import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import app from '../src/worker.js';

function createD1Adapter() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync('schema.sql', 'utf8'));

  return {
    sqlite,
    prepare(query) {
      let values = [];
      return {
        bind(...boundValues) {
          values = boundValues;
          return this;
        },
        async first() {
          return sqlite.prepare(query).get(...values) || null;
        },
        async all() {
          return { results: sqlite.prepare(query).all(...values) };
        },
        async run() {
          const result = sqlite.prepare(query).run(...values);
          return { meta: { changes: result.changes }, changes: result.changes };
        },
      };
    },
  };
}

function analyticsRequest(overrides = {}, headerOverrides = {}) {
  const request = new Request('https://geelarkflows.com/api/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.47',
      'CF-IPCountry': 'IN',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      Referer: 'https://geelarkflows.com/',
      ...headerOverrides,
    },
    body: JSON.stringify({
      event_type: 'page_view',
      visitor_id: 'visitor_1234567890abcdef',
      session_id: 'session_1234567890abcdef',
      event_id: crypto.randomUUID(),
      page_path: '/flows/instagram-account-creation?ignored=1',
      landing_referrer_host: 'www.bing.com',
      ...overrides,
    }),
  });
  Object.defineProperty(request, 'cf', {
    value: { country: 'IN', region: 'Telangana', city: 'Hyderabad' },
  });
  return request;
}

function cartStateRequest(productIds) {
  const request = new Request('https://geelarkflows.com/api/analytics/cart-state', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.47',
      'CF-IPCountry': 'IN',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      Referer: 'https://geelarkflows.com/',
    },
    body: JSON.stringify({
      visitor_id: 'visitor_1234567890abcdef',
      session_id: 'session_1234567890abcdef',
      event_id: crypto.randomUUID(),
      page_path: '/cart',
      landing_referrer_host: 'www.bing.com',
      product_ids: productIds,
    }),
  });
  Object.defineProperty(request, 'cf', {
    value: { country: 'IN', region: 'Telangana', city: 'Hyderabad' },
  });
  return request;
}

const db = createD1Adapter();
const env = { DB: db, ADMIN_BOOTSTRAP_SECRET: 'test-only-analytics-hmac-secret-123456' };

const pageView = await app.request(analyticsRequest(), undefined, env);
assert.equal(pageView.status, 202);
assert.equal((await pageView.json()).recorded, true);

const storedPageView = db.sqlite.prepare('SELECT * FROM storefront_analytics_events').get();
assert.equal(storedPageView.event_type, 'page_view');
assert.equal(storedPageView.page_path, '/flows/instagram-account-creation');
assert.equal(storedPageView.ip_network, '203.0.113.0/24');
assert.notEqual(storedPageView.ip_hash, '203.0.113.47');
assert(!JSON.stringify(storedPageView).includes('Chrome/140.0.0.0'), 'raw user agent must not be stored');
assert.equal(storedPageView.device_type, 'Desktop');
assert.equal(storedPageView.browser_family, 'Edge');
assert.equal(storedPageView.referrer_host, 'bing.com');
assert.equal(storedPageView.country_code, 'IN');
assert.equal(storedPageView.region, 'Telangana');
assert.equal(storedPageView.city, 'Hyderabad');

const duplicatePageView = await app.request(analyticsRequest(), undefined, env);
assert.equal(duplicatePageView.status, 202);
assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM storefront_analytics_events').get().count, 1);

const botPageView = await app.request(analyticsRequest({
  visitor_id: 'visitor_bot_1234567890abcdef',
  session_id: 'session_bot_1234567890abcdef',
  event_id: crypto.randomUUID(),
  page_path: '/bot-crawl',
}, { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }), undefined, env);
assert.equal(botPageView.status, 202);

const cartAdd = await app.request(analyticsRequest({
  event_type: 'cart_add',
  product_id: 'instagram-account-creation',
  event_id: crypto.randomUUID(),
}), undefined, env);
assert.equal(cartAdd.status, 202);
assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM storefront_analytics_events WHERE event_type = 'cart_add'").get().count, 1);

const unknownFlow = await app.request(analyticsRequest({
  event_type: 'cart_add',
  product_id: 'not-a-real-flow',
}), undefined, env);
assert.equal(unknownFlow.status, 400);

const cartState = await app.request(
  cartStateRequest(['instagram-account-creation', 'instagram-warmup']),
  undefined,
  env,
);
assert.equal(cartState.status, 202);
const storedCart = db.sqlite.prepare('SELECT * FROM storefront_cart_state').get();
assert.equal(storedCart.item_count, 2);
assert.equal(storedCart.cart_value_cents, 125000);
assert.deepEqual(JSON.parse(storedCart.product_ids_json), ['instagram-account-creation', 'instagram-warmup']);
assert.equal(storedCart.city, 'Hyderabad');
assert.equal(storedCart.browser_family, 'Edge');
assert.equal(storedCart.referrer_host, 'bing.com');

const invalidCartState = await app.request(
  cartStateRequest(['not-a-real-flow']),
  undefined,
  env,
);
assert.equal(invalidCartState.status, 400);

const clearedCartState = await app.request(cartStateRequest([]), undefined, env);
assert.equal(clearedCartState.status, 202);
assert.equal(db.sqlite.prepare('SELECT item_count FROM storefront_cart_state').get().item_count, 0);

const restoredCartState = await app.request(
  cartStateRequest(['instagram-account-creation', 'instagram-warmup']),
  undefined,
  env,
);
assert.equal(restoredCartState.status, 202);

const unauthenticatedAnalytics = await app.request(
  'https://geelarkflows.com/api/admin/analytics?days=30',
  undefined,
  env,
);
assert.equal(unauthenticatedAnalytics.status, 401);

const rawAdminToken = 'valid_admin_analytics_token';
const adminTokenHash = crypto.createHash('sha256').update(rawAdminToken).digest('hex');
db.sqlite.prepare("INSERT INTO admin_users (id, email, password_hash, role, name) VALUES (?, ?, ?, 'SUPER_ADMIN', ?)")
  .run('usr_analytics', 'admin@geelarkflows.com', 'test_hash', 'Analytics Admin');
db.sqlite.prepare('INSERT INTO admin_sessions (id, token_hash, user_id, last_active_at, expires_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)')
  .run('ses_analytics', adminTokenHash, 'usr_analytics', '2099-01-01T00:00:00.000Z');

const adminAnalytics = await app.request(
  new Request('https://geelarkflows.com/api/admin/analytics?days=30', {
    headers: { Cookie: `gf_admin_session=${rawAdminToken}` },
  }),
  undefined,
  env,
);
assert.equal(adminAnalytics.status, 200);
const dashboard = await adminAnalytics.json();
assert.equal(dashboard.success, true);
assert.equal(dashboard.data.metrics.unique_visitors, 1);
assert.equal(dashboard.data.metrics.page_views, 1);
assert.equal(dashboard.data.metrics.cart_visitors, 1);
assert.equal(dashboard.data.metrics.cart_additions, 1);
assert.equal(dashboard.data.metrics.active_carts, 1);
assert.equal(dashboard.data.popular_flows[0].title, 'Instagram Account Creation');
assert.equal(dashboard.data.recent_cart_additions[0].ip_network, '203.0.113.0/24');
assert.equal(dashboard.data.recent_cart_additions[0].visitor_id.length, 12);
assert.equal(dashboard.data.recent_cart_additions[0].city, 'Hyderabad');
assert.equal(dashboard.data.locations[0].city, 'Hyderabad');
assert.equal(dashboard.data.locations[0].unique_visitors, 1);
assert.equal(dashboard.data.active_carts[0].item_count, 2);
assert.equal(dashboard.data.active_carts[0].cart_value_usd, 1250);
assert.equal(dashboard.data.active_carts[0].items[0].title, 'Instagram Account Creation');
assert.equal(dashboard.data.traffic_sources[0].referrer_host, 'bing.com');
assert.equal(dashboard.data.traffic_sources[0].sessions, 1);
assert.equal(dashboard.data.traffic_sources[0].unique_visitors, 1);
assert.equal(dashboard.data.traffic_sources[0].page_views, 1);
assert.equal(dashboard.data.traffic_sources[0].cart_visitors, 1);
assert.equal(dashboard.data.recent_cart_additions[0].referrer_host, 'bing.com');

const invalidReferrer = await app.request(analyticsRequest({
  visitor_id: 'visitor_invalid_source_1234567890',
  session_id: 'session_invalid_source_1234567890',
  event_id: crypto.randomUUID(),
  page_path: '/invalid-source-test',
  landing_referrer_host: 'https://attacker.example/path?secret=1',
}), undefined, env);
assert.equal(invalidReferrer.status, 202);
assert.equal(
  db.sqlite.prepare("SELECT referrer_host FROM storefront_analytics_events WHERE page_path = '/invalid-source-test'").get().referrer_host,
  'Internal',
  'malformed client sources must fall back to the request referrer instead of storing a URL',
);

const clientAnalyticsSource = fs.readFileSync('src/analytics.js', 'utf8');
assert(clientAnalyticsSource.includes('document.referrer'));
assert(clientAnalyticsSource.includes('landing_referrer_host: getLandingReferrerHost()'));
const adminAnalyticsSource = fs.readFileSync('src/admin/pages/AdminAnalytics.jsx', 'utf8');
assert(adminAnalyticsSource.includes('Traffic sources'));

console.log('Storefront visitor and cart analytics tests passed.');

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
        bind(...boundValues) { values = boundValues; return this; },
        async first() { return sqlite.prepare(query).get(...values) || null; },
        async all() { return { results: sqlite.prepare(query).all(...values) }; },
        async run() {
          const result = sqlite.prepare(query).run(...values);
          return { meta: { changes: result.changes }, changes: result.changes };
        },
      };
    },
  };
}

function publicRequest(path, init) {
  return new Request(`https://geelarkflows.com${path}`, init);
}

function adminRequest(path, token, method = 'GET', body = undefined) {
  return new Request(`https://geelarkflows.com${path}`, {
    method,
    headers: {
      Cookie: `gf_admin_session=${token}`,
      ...(method !== 'GET' ? { 'Content-Type': 'application/json', 'X-Admin-Action': '1' } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const db = createD1Adapter();
const vapidEcdh = crypto.createECDH('prime256v1');
vapidEcdh.generateKeys();
const env = {
  DB: db,
  VAPID_PUBLIC_KEY: vapidEcdh.getPublicKey().toString('base64url'),
  VAPID_PRIVATE_KEY: vapidEcdh.getPrivateKey().toString('base64url'),
  VAPID_SUBJECT: 'mailto:support@geelarkflows.com',
};
const rawAdminToken = 'notification_admin_session_token';
const adminTokenHash = crypto.createHash('sha256').update(rawAdminToken).digest('hex');
db.sqlite.prepare("INSERT INTO admin_users (id, email, password_hash, role, name) VALUES (?, ?, ?, 'SUPER_ADMIN', ?)")
  .run('usr_notify', 'notify-admin@example.test', 'test_hash', 'Notification Admin');
db.sqlite.prepare('INSERT INTO admin_sessions (id, token_hash, user_id, last_active_at, expires_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)')
  .run('ses_notify', adminTokenHash, 'usr_notify', '2099-01-01T00:00:00.000Z');
db.sqlite.prepare(`
  INSERT INTO coupon_codes (id, code, description, discount_type, discount_value, active)
  VALUES ('cpn_notify', 'CART15', 'Cart notification test', 'percentage', 15, 1)
`).run();

const unauthenticated = await app.request('https://geelarkflows.com/api/admin/notifications', undefined, env);
assert.equal(unauthenticated.status, 401, 'admin notification inventory must require authentication');

const createResponse = await app.request(adminRequest('/api/admin/notifications', rawAdminToken, 'POST', {
  title: 'Save on your current cart',
  message: 'Use this code before checkout to save on the workflows already in your cart.',
  audience_type: 'active_cart',
  coupon_id: 'cpn_notify',
  cta_label: 'Use coupon',
  cta_url: '/checkout',
  active: true,
}), undefined, env);
assert.equal(createResponse.status, 201);
const created = await createResponse.json();
assert.match(created.id, /^ntf_/);

const rejectedExternalCta = await app.request(adminRequest('/api/admin/notifications', rawAdminToken, 'POST', {
  title: 'Unsafe redirect',
  message: 'This notification should be rejected by internal CTA validation.',
  audience_type: 'all',
  cta_label: 'Continue',
  cta_url: 'https://attacker.example',
}), undefined, env);
assert.equal(rejectedExternalCta.status, 400, 'external notification CTAs must be rejected');

const visitorId = 'visitor_notification_1234567890';
const emptyFeed = await app.request(
  publicRequest(`/api/notifications?visitor_id=${encodeURIComponent(visitorId)}`),
  undefined,
  env,
);
assert.equal(emptyFeed.status, 200);
assert.equal((await emptyFeed.json()).notifications.length, 0, 'active-cart messages must not reach empty carts');

const cartResponse = await app.request(publicRequest('/api/analytics/cart-state', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/140.0.0.0' },
  body: JSON.stringify({
    visitor_id: visitorId,
    session_id: 'session_notification_1234567890',
    event_id: crypto.randomUUID(),
    page_path: '/cart',
    product_ids: ['instagram-account-creation'],
  }),
}), undefined, env);
assert.equal(cartResponse.status, 202);

const targetedFeed = await app.request(
  publicRequest(`/api/notifications?visitor_id=${encodeURIComponent(visitorId)}`),
  undefined,
  env,
);
const targetedData = await targetedFeed.json();
assert.equal(targetedData.notifications.length, 1);
assert.equal(targetedData.notifications[0].coupon_code, 'CART15');
assert.equal(targetedData.notifications[0].cta_url, '/checkout');
assert.equal(targetedData.unread_count, 1);

const readResponse = await app.request(publicRequest(`/api/notifications/${created.id}/read`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visitor_id: visitorId }),
}), undefined, env);
assert.equal(readResponse.status, 200);
const readFeed = await app.request(publicRequest(`/api/notifications?visitor_id=${encodeURIComponent(visitorId)}`), undefined, env);
assert.equal((await readFeed.json()).unread_count, 0, 'opening the feed must persist read state');

const dismissResponse = await app.request(publicRequest(`/api/notifications/${created.id}/dismiss`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visitor_id: visitorId }),
}), undefined, env);
assert.equal(dismissResponse.status, 200);
const dismissedFeed = await app.request(publicRequest(`/api/notifications?visitor_id=${encodeURIComponent(visitorId)}`), undefined, env);
assert.equal((await dismissedFeed.json()).notifications.length, 0, 'dismissed notifications must stay hidden');

const adminInventory = await app.request(adminRequest('/api/admin/notifications', rawAdminToken), undefined, env);
assert.equal(adminInventory.status, 200);
const inventoryData = await adminInventory.json();
assert.equal(inventoryData.notifications[0].delivered_count, 1);
assert.equal(inventoryData.notifications[0].read_count, 1);
assert.equal(inventoryData.notifications[0].dismissed_count, 1);

const deactivate = await app.request(adminRequest(`/api/admin/notifications/${created.id}`, rawAdminToken, 'PATCH', { active: false }), undefined, env);
assert.equal(deactivate.status, 200);
assert.equal((await deactivate.json()).active, false);

const pushConfig = await app.request('https://geelarkflows.com/api/push/config', undefined, env);
assert.equal(pushConfig.status, 200);
assert.equal((await pushConfig.json()).public_key, env.VAPID_PUBLIC_KEY);

const clientEcdh = crypto.createECDH('prime256v1');
clientEcdh.generateKeys();
const pushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-subscription-endpoint',
  expirationTime: null,
  keys: {
    p256dh: clientEcdh.getPublicKey().toString('base64url'),
    auth: crypto.randomBytes(16).toString('base64url'),
  },
};
const untrustedSubscription = await app.request(publicRequest('/api/push/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.22' },
  body: JSON.stringify({ visitor_id: visitorId, subscription: { ...pushSubscription, endpoint: 'https://attacker.example/push' } }),
}), undefined, env);
assert.equal(untrustedSubscription.status, 400, 'arbitrary push endpoints must be rejected to prevent SSRF');

const subscribeResponse = await app.request(publicRequest('/api/push/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.22' },
  body: JSON.stringify({ visitor_id: visitorId, subscription: pushSubscription }),
}), undefined, env);
assert.equal(subscribeResponse.status, 200);
assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM storefront_push_subscriptions WHERE active = 1').get().count, 1);

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  assert.equal(String(url), pushSubscription.endpoint);
  return new Response('', { status: 201 });
};
let pushCampaignResponse;
try {
  pushCampaignResponse = await app.request(adminRequest('/api/admin/notifications', rawAdminToken, 'POST', {
    title: 'Browser push cart offer',
    message: 'This browser push is visible even after the storefront tab is closed.',
    audience_type: 'active_cart',
    coupon_id: 'cpn_notify',
    cta_label: 'Use coupon',
    cta_url: '/checkout',
    push_enabled: true,
    active: true,
  }), undefined, env);
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(pushCampaignResponse.status, 201);
const pushCampaign = await pushCampaignResponse.json();
assert.equal(pushCampaign.push.sent, 1);
assert.equal(pushCampaign.push.failed, 0);
const pushDelivery = db.sqlite.prepare('SELECT status, response_status FROM storefront_push_deliveries').get();
assert.equal(pushDelivery.status, 'sent');
assert.equal(pushDelivery.response_status, 201);

const unsubscribeResponse = await app.request(publicRequest('/api/push/unsubscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visitor_id: visitorId, endpoint: pushSubscription.endpoint }),
}), undefined, env);
assert.equal(unsubscribeResponse.status, 200);
assert.equal(db.sqlite.prepare('SELECT active FROM storefront_push_subscriptions').get().active, 0);

const component = fs.readFileSync('src/components/StorefrontNotifications.jsx', 'utf8');
assert(component.includes('aria-expanded={isOpen}'));
assert(component.includes('aria-live="polite"'));
assert(component.includes('notification-live-region'));
assert(component.includes('addCouponToCheckoutPath(destination, notification.coupon_code)'));
assert(component.includes('No email required'));
assert(component.includes('Notification.requestPermission()'));
assert(component.includes("navigator.serviceWorker.register('/sw.js'"));
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
assert(serviceWorker.includes("self.addEventListener('push'"));
assert(serviceWorker.includes("self.addEventListener('notificationclick'"));
assert(serviceWorker.includes('safeDestination'));
const adminComponent = fs.readFileSync('src/admin/pages/AdminNotifications.jsx', 'utf8');
assert(adminComponent.includes('Also send browser push now'));
const appSource = fs.readFileSync('src/App.jsx', 'utf8');
assert(!appSource.includes('Do all flows include a video demo?'));
assert(appSource.includes("What's visible before you pay."));
assert(appSource.includes('How are checkout, payment, and delivery handled?'));

console.log('In-site notification targeting, receipts, admin controls, privacy UI, and trust FAQ tests passed.');

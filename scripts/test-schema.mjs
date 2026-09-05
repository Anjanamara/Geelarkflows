import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const schema = fs.readFileSync('schema.sql', 'utf8');
const db = new DatabaseSync(':memory:');
db.exec(schema);

const requiredColumns = {
  orders: ['total_usd_cents', 'status_token_hash', 'fulfillment_status', 'coupon_code', 'coupon_discount_usd', 'coupon_discount_cents'],
  crypto_payments: ['network_id', 'provider_currency', 'pay_amount_crypto_text', 'expected_price_usd_cents'],
  order_fulfillment_logs: ['updated_at'],
  order_download_tokens: ['token_hash', 'expires_at', 'download_count'],
  api_rate_limits: ['window_started_at', 'request_count'],
  storefront_analytics_events: ['dedupe_key', 'event_type', 'visitor_hash', 'session_hash', 'product_id', 'page_path', 'ip_network', 'device_type'],
  storefront_cart_state: ['visitor_hash', 'session_hash', 'product_ids_json', 'item_count', 'cart_value_cents', 'country_code', 'updated_at'],
  coupon_codes: ['code', 'discount_type', 'discount_value', 'min_subtotal_cents', 'max_redemptions', 'active', 'starts_at', 'expires_at'],
  coupon_redemptions: ['coupon_id', 'order_id', 'customer_email', 'discount_cents'],
  storefront_notifications: ['title', 'message', 'audience_type', 'product_id', 'coupon_id', 'cta_url', 'push_enabled', 'push_sent_at', 'active'],
  storefront_notification_receipts: ['notification_id', 'visitor_hash', 'delivered_at', 'read_at', 'dismissed_at'],
  storefront_push_subscriptions: ['endpoint_hash', 'endpoint', 'p256dh_key', 'auth_key', 'visitor_hash', 'active', 'revoked_at'],
  storefront_push_deliveries: ['notification_id', 'subscription_id', 'status', 'response_status', 'error_message'],
};

for (const [table, columns] of Object.entries(requiredColumns)) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  const names = new Set(rows.map((row) => row.name));
  columns.forEach((column) => assert(names.has(column), `${table}.${column} is required`));
}

const paymentIndexes = db.prepare("PRAGMA index_list('crypto_payments')").all();
assert(paymentIndexes.some((index) => index.unique === 1), 'crypto_payments must enforce one invoice per order');

const migrationDb = new DatabaseSync(':memory:');
migrationDb.exec(`
  CREATE TABLE orders (
    id TEXT PRIMARY KEY, total_usd REAL NOT NULL, workflow_subtotal REAL NOT NULL DEFAULT 0,
    setup_fee REAL NOT NULL DEFAULT 0, fulfillment_status TEXT NOT NULL DEFAULT 'not_ready'
  );
  CREATE TABLE crypto_payments (
    id TEXT PRIMARY KEY, order_id TEXT NOT NULL, currency TEXT NOT NULL,
    pay_amount_crypto REAL NOT NULL, exchange_rate_usd REAL NOT NULL
  );
  CREATE TABLE order_fulfillment_logs (
    id TEXT PRIMARY KEY, order_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE admin_users (id TEXT PRIMARY KEY);
  CREATE TABLE audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL);
  INSERT INTO orders VALUES ('ord_old', 1000, 1000, 0, 'delivered');
  INSERT INTO crypto_payments VALUES ('pay_old', 'ord_old', 'USDT (ERC-20)', 1000, 1);
`);
migrationDb.exec(fs.readFileSync('migrations/0001_security_hardening.sql', 'utf8'));
migrationDb.exec(fs.readFileSync('migrations/0003_coupon_codes.sql', 'utf8'));
migrationDb.exec(fs.readFileSync('migrations/0005_storefront_notifications.sql', 'utf8'));
migrationDb.exec(fs.readFileSync('migrations/0006_browser_push.sql', 'utf8'));
const migratedOrder = migrationDb.prepare('SELECT * FROM orders WHERE id = ?').get('ord_old');
const migratedPayment = migrationDb.prepare('SELECT * FROM crypto_payments WHERE id = ?').get('pay_old');
assert.equal(migratedOrder.total_usd_cents, 100000);
assert.equal(migratedOrder.fulfillment_status, 'package_delivered');
assert.equal(migratedPayment.network_id, 'erc20');
assert.equal(migratedPayment.provider_currency, 'usdterc20');
assert.equal(migratedOrder.coupon_discount_cents, 0);

const couponMigrationTables = new Set(
  migrationDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
);
assert(couponMigrationTables.has('coupon_codes'));
assert(couponMigrationTables.has('coupon_redemptions'));
assert(couponMigrationTables.has('storefront_notifications'));
assert(couponMigrationTables.has('storefront_notification_receipts'));
assert(couponMigrationTables.has('storefront_push_subscriptions'));
assert(couponMigrationTables.has('storefront_push_deliveries'));
const couponTrigger = migrationDb.prepare(
  "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'coupon_redemptions_validate_availability'",
).get();
assert(couponTrigger, 'coupon redemption availability trigger is required');
migrationDb.prepare(`
  INSERT INTO coupon_codes
    (id, code, discount_type, discount_value, max_redemptions, active)
  VALUES ('cpn_limit', 'LIMIT1', 'percentage', 10, 1, 1)
`).run();
migrationDb.prepare(`
  INSERT INTO orders (id, total_usd, workflow_subtotal, setup_fee, fulfillment_status)
  VALUES ('ord_1', 10, 10, 0, 'not_ready'), ('ord_2', 10, 10, 0, 'not_ready')
`).run();
migrationDb.prepare(`
  INSERT INTO coupon_redemptions
    (id, coupon_id, order_id, customer_email, discount_cents)
  VALUES ('red_1', 'cpn_limit', 'ord_1', 'first@example.test', 100)
`).run();
assert.throws(() => migrationDb.prepare(`
  INSERT INTO coupon_redemptions
    (id, coupon_id, order_id, customer_email, discount_cents)
  VALUES ('red_2', 'cpn_limit', 'ord_2', 'second@example.test', 100)
`).run(), /coupon is unavailable/, 'usage limit must be enforced atomically');

const analyticsMigrationDb = new DatabaseSync(':memory:');
analyticsMigrationDb.exec(fs.readFileSync('migrations/0002_storefront_analytics.sql', 'utf8'));
analyticsMigrationDb.exec(fs.readFileSync('migrations/0004_storefront_cart_state.sql', 'utf8'));
const analyticsColumns = new Set(
  analyticsMigrationDb.prepare('PRAGMA table_info(storefront_analytics_events)').all().map((row) => row.name),
);
assert(analyticsColumns.has('visitor_hash'));
assert(analyticsColumns.has('ip_network'));
const analyticsIndexes = analyticsMigrationDb.prepare("PRAGMA index_list('storefront_analytics_events')").all();
assert(analyticsIndexes.length >= 5, 'analytics table must include dedupe and reporting indexes');
const cartStateIndexes = analyticsMigrationDb.prepare("PRAGMA index_list('storefront_cart_state')").all();
assert(cartStateIndexes.length >= 4, 'cart-state table must include primary and reporting indexes');

console.log('Schema and production migration security validation passed.');

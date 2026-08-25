import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const schema = fs.readFileSync('schema.sql', 'utf8');
const db = new DatabaseSync(':memory:');
db.exec(schema);

const requiredColumns = {
  orders: ['total_usd_cents', 'status_token_hash', 'fulfillment_status'],
  crypto_payments: ['network_id', 'provider_currency', 'pay_amount_crypto_text', 'expected_price_usd_cents'],
  order_fulfillment_logs: ['updated_at'],
  order_download_tokens: ['token_hash', 'expires_at', 'download_count'],
  api_rate_limits: ['window_started_at', 'request_count'],
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
  CREATE TABLE audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL);
  INSERT INTO orders VALUES ('ord_old', 1000, 1000, 0, 'delivered');
  INSERT INTO crypto_payments VALUES ('pay_old', 'ord_old', 'USDT (ERC-20)', 1000, 1);
`);
migrationDb.exec(fs.readFileSync('migrations/0001_security_hardening.sql', 'utf8'));
const migratedOrder = migrationDb.prepare('SELECT * FROM orders WHERE id = ?').get('ord_old');
const migratedPayment = migrationDb.prepare('SELECT * FROM crypto_payments WHERE id = ?').get('pay_old');
assert.equal(migratedOrder.total_usd_cents, 100000);
assert.equal(migratedOrder.fulfillment_status, 'package_delivered');
assert.equal(migratedPayment.network_id, 'erc20');
assert.equal(migratedPayment.provider_currency, 'usdterc20');

console.log('Schema and production migration security validation passed.');

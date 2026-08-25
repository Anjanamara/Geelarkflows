-- Production upgrade for databases created before secure checkout and per-flow delivery.
-- Apply once with: npx wrangler d1 migrations apply geelarkflows_payment --remote

ALTER TABLE orders ADD COLUMN total_usd_cents INTEGER;
ALTER TABLE orders ADD COLUMN workflow_subtotal_cents INTEGER;
ALTER TABLE orders ADD COLUMN setup_fee_cents INTEGER;
ALTER TABLE orders ADD COLUMN status_token_hash TEXT;

UPDATE orders
SET total_usd_cents = CAST(ROUND(total_usd * 100) AS INTEGER),
    workflow_subtotal_cents = CAST(ROUND(workflow_subtotal * 100) AS INTEGER),
    setup_fee_cents = CAST(ROUND(setup_fee * 100) AS INTEGER);

UPDATE orders
SET fulfillment_status = 'package_delivered'
WHERE fulfillment_status = 'delivered';

ALTER TABLE crypto_payments ADD COLUMN network_id TEXT;
ALTER TABLE crypto_payments ADD COLUMN provider_currency TEXT;
ALTER TABLE crypto_payments ADD COLUMN pay_amount_crypto_text TEXT;
ALTER TABLE crypto_payments ADD COLUMN exchange_rate_usd_text TEXT;
ALTER TABLE crypto_payments ADD COLUMN expected_price_usd_cents INTEGER;

UPDATE crypto_payments
SET network_id = CASE
      WHEN LOWER(currency) LIKE '%erc-20%' THEN 'erc20'
      WHEN LOWER(currency) LIKE '%bep-20%' THEN 'bep20'
      WHEN LOWER(currency) LIKE '%sol%' THEN 'sol'
      ELSE 'trc20'
    END,
    provider_currency = CASE
      WHEN LOWER(currency) LIKE '%erc-20%' THEN 'usdterc20'
      WHEN LOWER(currency) LIKE '%bep-20%' THEN 'usdtbsc'
      WHEN LOWER(currency) LIKE '%sol%' THEN 'usdtsol'
      ELSE 'usdttrc20'
    END,
    pay_amount_crypto_text = CAST(pay_amount_crypto AS TEXT),
    exchange_rate_usd_text = CAST(exchange_rate_usd AS TEXT),
    expected_price_usd_cents = (
      SELECT total_usd_cents FROM orders WHERE orders.id = crypto_payments.order_id
    );

ALTER TABLE order_fulfillment_logs ADD COLUMN updated_at DATETIME;
UPDATE order_fulfillment_logs SET updated_at = created_at WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS order_download_tokens (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_by TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at DATETIME,
  revoked_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_count INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_payments_one_per_order ON crypto_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_order_id ON order_download_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires_at ON order_download_tokens(expires_at);

CREATE TRIGGER IF NOT EXISTS audit_logs_prevent_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs are append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_logs_prevent_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs are append-only');
END;

-- Cloudflare D1 Migration Schema for GeeLark Flows
-- Orders & Crypto Payments (Core eCommerce)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_email TEXT NOT NULL,
  total_usd REAL NOT NULL,
  total_usd_cents INTEGER NOT NULL,
  delivery_method TEXT NOT NULL DEFAULT 'download_package', -- 'download_package' | 'geelark_setup'
  workflow_subtotal REAL NOT NULL DEFAULT 0,
  workflow_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  setup_fee REAL NOT NULL DEFAULT 0,
  setup_fee_cents INTEGER NOT NULL DEFAULT 0,
  coupon_code TEXT,
  coupon_discount_usd REAL NOT NULL DEFAULT 0,
  coupon_discount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_payment', 'paid', 'processing', 'completed', 'cancelled', 'refunded', 'failed')),
  items TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL DEFAULT 'not_ready' CHECK (fulfillment_status IN ('not_ready', 'fulfillment_pending', 'package_preparing', 'package_delivered', 'setup_pending', 'setup_in_progress', 'setup_completed', 'failed')),
  status_token_hash TEXT,
  fulfillment_notes TEXT,
  delivered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crypto_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL,
  network_id TEXT NOT NULL,
  provider_currency TEXT NOT NULL,
  pay_address TEXT NOT NULL,
  pay_amount_crypto REAL NOT NULL,
  pay_amount_crypto_text TEXT NOT NULL,
  exchange_rate_usd REAL NOT NULL,
  exchange_rate_usd_text TEXT NOT NULL,
  expected_price_usd_cents INTEGER NOT NULL,
  tx_hash TEXT,
  confirmations INTEGER DEFAULT 0,
  required_confirmations INTEGER DEFAULT 2,
  expires_at DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'confirming', 'sending', 'partially_paid', 'confirmed', 'finished', 'paid', 'failed', 'expired', 'refunded', 'review_required')),
  verification_source TEXT NOT NULL DEFAULT 'nowpayments_ipn',
  verified_by_admin TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Admin Users & RBAC
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- Format: pbkdf2_sha256$100000$<salt_hex>$<hash_hex>
  role TEXT NOT NULL DEFAULT 'ADMIN', -- 'ADMIN' | 'SUPER_ADMIN'
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin Sessions (Hashed Tokens Only)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL, -- SHA-256 hash of raw cookie token
  user_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- Append-Only System Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_admin_id TEXT,
  actor_admin_email TEXT NOT NULL,
  actor_ip TEXT,
  actor_user_agent TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state TEXT,
  new_state TEXT,
  reason TEXT,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Persistent Fulfillment Attempt History
CREATE TABLE IF NOT EXISTS order_fulfillment_logs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT UNIQUE NOT NULL,
  triggered_by TEXT NOT NULL, -- 'system_webhook' | 'admin:<email>'
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'dispatched', 'failed')),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Private, expiring tokens used to stream only the flows purchased in an order.
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

-- Narrow per-checkout status rate limiter. Keys are hashes, never raw customer tokens.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_count INTEGER NOT NULL DEFAULT 1
);

-- Checkout coupon definitions. discount_value is a whole percentage for
-- percentage coupons and integer USD cents for fixed-amount coupons.
CREATE TABLE IF NOT EXISTS coupon_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  min_subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK (min_subtotal_cents >= 0),
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  starts_at DATETIME,
  expires_at DATETIME,
  created_by_admin_id TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  discount_cents INTEGER NOT NULL CHECK (discount_cents > 0),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupon_codes(id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Login Rate Limiting (IP & Email based)
CREATE TABLE IF NOT EXISTS login_rate_limits (
  key TEXT PRIMARY KEY, -- 'ip:<ip>' or 'email:<email>'
  attempts INTEGER NOT NULL DEFAULT 1,
  locked_until DATETIME,
  last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inbound Customer Emails (Resend Receiving)
CREATE TABLE IF NOT EXISTS inbound_emails (
  id TEXT PRIMARY KEY,
  provider_email_id TEXT UNIQUE NOT NULL, -- Resend email/event ID for strict idempotency
  message_id TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT NOT NULL, -- JSON array
  cc_addresses TEXT,         -- JSON array
  reply_to TEXT,
  subject TEXT NOT NULL,
  text_body TEXT,
  html_body TEXT,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  order_id TEXT,             -- Associated order ID (nullable)
  customer_email TEXT,       -- Associated customer email
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- Inbound Email Attachments
CREATE TABLE IF NOT EXISTS email_attachments (
  id TEXT PRIMARY KEY,
  inbound_email_id TEXT NOT NULL,
  provider_attachment_id TEXT,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_reference TEXT,    -- R2 storage key or download URL
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inbound_email_id) REFERENCES inbound_emails(id) ON DELETE CASCADE
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_order_id ON crypto_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_status ON crypto_payments(status);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_created_at ON crypto_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_logs_order_id ON order_fulfillment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_order_id ON order_download_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires_at ON order_download_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_active ON coupon_codes(active);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_expires_at ON coupon_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_created_at ON coupon_redemptions(created_at);

CREATE TRIGGER IF NOT EXISTS coupon_redemptions_validate_availability
BEFORE INSERT ON coupon_redemptions
WHEN NOT EXISTS (
  SELECT 1
  FROM coupon_codes c
  WHERE c.id = NEW.coupon_id
    AND c.active = 1
    AND (c.starts_at IS NULL OR datetime(c.starts_at) <= datetime('now'))
    AND (c.expires_at IS NULL OR datetime(c.expires_at) > datetime('now'))
    AND (
      c.max_redemptions IS NULL
      OR (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id) < c.max_redemptions
    )
)
BEGIN
  SELECT RAISE(ABORT, 'coupon is unavailable');
END;

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
CREATE INDEX IF NOT EXISTS idx_inbound_emails_received_at ON inbound_emails(received_at);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_is_read ON inbound_emails(is_read);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_is_archived ON inbound_emails(is_archived);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from_address ON inbound_emails(from_address);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_order_id ON inbound_emails(order_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_customer ON inbound_emails(customer_email);
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(inbound_email_id);

-- Custom Automation Requests (Inbound Leads)
CREATE TABLE IF NOT EXISTS custom_automation_requests (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'flow', -- 'flow' | 'consulting'
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',         -- 'new' | 'in_review' | 'contacted' | 'closed'
  ip_hash TEXT,
  internal_notification_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
  internal_notification_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_requests_created_at ON custom_automation_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_custom_requests_email ON custom_automation_requests(customer_email);
CREATE INDEX IF NOT EXISTS idx_custom_requests_status ON custom_automation_requests(status);
CREATE INDEX IF NOT EXISTS idx_custom_requests_ip_hash ON custom_automation_requests(ip_hash);

-- Privacy-conscious first-party storefront analytics (90-day rolling retention)
CREATE TABLE IF NOT EXISTS storefront_analytics_events (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'cart_add')),
  visitor_hash TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  product_id TEXT,
  page_path TEXT NOT NULL,
  referrer_host TEXT,
  ip_hash TEXT,
  ip_network TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  device_type TEXT,
  browser_family TEXT,
  os_family TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON storefront_analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_created ON storefront_analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_visitor_created ON storefront_analytics_events(visitor_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_product_created ON storefront_analytics_events(product_id, created_at);

-- Last-known cart composition for visitors who have not disabled first-party analytics.
CREATE TABLE IF NOT EXISTS storefront_cart_state (
  visitor_hash TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  product_ids_json TEXT NOT NULL DEFAULT '[]',
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0 AND item_count <= 25),
  cart_value_cents INTEGER NOT NULL DEFAULT 0 CHECK (cart_value_cents >= 0),
  page_path TEXT NOT NULL,
  referrer_host TEXT,
  ip_network TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  device_type TEXT,
  browser_family TEXT,
  os_family TEXT,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cart_state_updated_at ON storefront_cart_state(updated_at);
CREATE INDEX IF NOT EXISTS idx_cart_state_item_updated ON storefront_cart_state(item_count, updated_at);
CREATE INDEX IF NOT EXISTS idx_cart_state_country_updated ON storefront_cart_state(country_code, updated_at);

-- In-site notification campaigns. Visitors are addressed only through the same
-- pseudonymous browser identifier used by first-party storefront analytics.
CREATE TABLE IF NOT EXISTS storefront_notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience_type TEXT NOT NULL CHECK (audience_type IN ('all', 'active_cart', 'product_cart')),
  product_id TEXT,
  coupon_id TEXT,
  cta_label TEXT,
  cta_url TEXT,
  push_enabled INTEGER NOT NULL DEFAULT 0 CHECK (push_enabled IN (0, 1)),
  push_sent_at DATETIME,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  starts_at DATETIME,
  expires_at DATETIME,
  created_by_admin_id TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupon_codes(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS storefront_notification_receipts (
  notification_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  delivered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  dismissed_at DATETIME,
  PRIMARY KEY (notification_id, visitor_hash),
  FOREIGN KEY (notification_id) REFERENCES storefront_notifications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_active_schedule ON storefront_notifications(active, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON storefront_notifications(audience_type, product_id);
CREATE INDEX IF NOT EXISTS idx_notification_receipts_visitor ON storefront_notification_receipts(visitor_hash, dismissed_at, read_at);
CREATE INDEX IF NOT EXISTS idx_notification_receipts_delivered ON storefront_notification_receipts(notification_id, delivered_at);

-- Browser push endpoints are stored only after an explicit permission grant.
CREATE TABLE IF NOT EXISTS storefront_push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint_hash TEXT NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  last_success_at DATETIME,
  revoked_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storefront_push_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'gone')),
  response_status INTEGER,
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (notification_id, subscription_id),
  FOREIGN KEY (notification_id) REFERENCES storefront_notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES storefront_push_subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active_seen ON storefront_push_subscriptions(active, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_visitor ON storefront_push_subscriptions(visitor_hash, active);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_notification ON storefront_push_deliveries(notification_id, status);

-- Cloudflare D1 Migration Schema for GeeLark Flows
-- Orders & Crypto Payments (Core eCommerce)

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_email TEXT NOT NULL,
  total_usd REAL NOT NULL,
  delivery_method TEXT NOT NULL DEFAULT 'download_package', -- 'download_package' | 'geelark_setup'
  workflow_subtotal REAL NOT NULL DEFAULT 0,
  setup_fee REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  items TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL DEFAULT 'not_ready', -- 'not_ready' | 'fulfillment_pending' | 'package_preparing' | 'package_delivered' | 'setup_pending' | 'setup_in_progress' | 'setup_completed' | 'failed'
  fulfillment_notes TEXT,
  delivered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crypto_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  pay_address TEXT NOT NULL,
  pay_amount_crypto REAL NOT NULL,
  exchange_rate_usd REAL NOT NULL,
  tx_hash TEXT,
  confirmations INTEGER DEFAULT 0,
  required_confirmations INTEGER DEFAULT 2,
  expires_at DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
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
  status TEXT NOT NULL, -- 'dispatched' | 'failed'
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

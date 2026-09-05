-- Privacy-conscious in-site notification campaigns and anonymous delivery state.
-- Apply with: npx wrangler d1 migrations apply geelarkflows_payment --remote

CREATE TABLE IF NOT EXISTS storefront_notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience_type TEXT NOT NULL CHECK (audience_type IN ('all', 'active_cart', 'product_cart')),
  product_id TEXT,
  coupon_id TEXT,
  cta_label TEXT,
  cta_url TEXT,
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

CREATE INDEX IF NOT EXISTS idx_notifications_active_schedule
  ON storefront_notifications(active, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_audience
  ON storefront_notifications(audience_type, product_id);
CREATE INDEX IF NOT EXISTS idx_notification_receipts_visitor
  ON storefront_notification_receipts(visitor_hash, dismissed_at, read_at);
CREATE INDEX IF NOT EXISTS idx_notification_receipts_delivered
  ON storefront_notification_receipts(notification_id, delivered_at);

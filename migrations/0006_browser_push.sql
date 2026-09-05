-- Opt-in browser push subscriptions and auditable campaign delivery results.
-- Apply with: npx wrangler d1 execute geelarkflows_payment --remote --file migrations/0006_browser_push.sql

ALTER TABLE storefront_notifications ADD COLUMN push_enabled INTEGER NOT NULL DEFAULT 0 CHECK (push_enabled IN (0, 1));
ALTER TABLE storefront_notifications ADD COLUMN push_sent_at DATETIME;

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

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active_seen
  ON storefront_push_subscriptions(active, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_visitor
  ON storefront_push_subscriptions(visitor_hash, active);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_notification
  ON storefront_push_deliveries(notification_id, status);

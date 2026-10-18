-- Behavior-based storefront notification targeting. This records only
-- pseudonymous, first-party engagement thresholds; it does not store click
-- coordinates, keystrokes, or form contents.

ALTER TABLE storefront_notifications
  ADD COLUMN behavior_trigger TEXT NOT NULL DEFAULT 'immediate'
  CHECK (behavior_trigger IN ('immediate', 'engaged', 'deep_scroll', 'product_view'));

CREATE TABLE IF NOT EXISTS storefront_engagement_state (
  visitor_hash TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 1 CHECK (page_views >= 1 AND page_views <= 50),
  max_scroll_percent INTEGER NOT NULL DEFAULT 0 CHECK (max_scroll_percent >= 0 AND max_scroll_percent <= 100),
  engaged_seconds INTEGER NOT NULL DEFAULT 0 CHECK (engaged_seconds >= 0 AND engaged_seconds <= 3600),
  last_path TEXT NOT NULL,
  last_product_id TEXT,
  engaged_at DATETIME,
  deep_scrolled_at DATETIME,
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_engagement_updated
  ON storefront_engagement_state(updated_at);
CREATE INDEX IF NOT EXISTS idx_engagement_qualified
  ON storefront_engagement_state(engaged_at, deep_scrolled_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_engagement_product
  ON storefront_engagement_state(last_product_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_notifications_behavior
  ON storefront_notifications(behavior_trigger, audience_type, product_id);

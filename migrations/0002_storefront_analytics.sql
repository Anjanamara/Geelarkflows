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

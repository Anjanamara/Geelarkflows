-- Last-known first-party cart state for operational storefront analytics.
-- Cart contents are product IDs only and values are resolved from the server catalog.
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

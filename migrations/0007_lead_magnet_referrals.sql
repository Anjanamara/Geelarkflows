-- Voluntary lead magnet, personal welcome coupons, and purchase-qualified
-- referral rewards. Apply with:
-- npx wrangler d1 migrations apply geelarkflows_payment --remote

ALTER TABLE orders ADD COLUMN lead_id TEXT;
ALTER TABLE orders ADD COLUMN referred_by_code TEXT;

CREATE TABLE IF NOT EXISTS storefront_leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  visitor_hash TEXT,
  selected_product_id TEXT,
  cart_product_ids_json TEXT NOT NULL DEFAULT '[]',
  source_path TEXT,
  referrer_host TEXT,
  ip_network TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  device_type TEXT,
  browser_family TEXT,
  os_family TEXT,
  marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK (marketing_consent IN (0, 1)),
  consent_version TEXT,
  consent_at DATETIME,
  unsubscribed_at DATETIME,
  welcome_coupon_id TEXT NOT NULL,
  welcome_coupon_code TEXT NOT NULL,
  welcome_coupon_expires_at DATETIME NOT NULL,
  referral_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  referred_by_code TEXT,
  unsubscribe_token_hash TEXT NOT NULL UNIQUE,
  email_delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_delivery_status IN ('pending', 'sent', 'failed', 'skipped')),
  email_delivery_error TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'engaged', 'converted')),
  last_requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (welcome_coupon_id) REFERENCES coupon_codes(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS storefront_referral_rewards (
  id TEXT PRIMARY KEY,
  referrer_lead_id TEXT NOT NULL,
  qualified_order_id TEXT NOT NULL UNIQUE,
  purchaser_email_hash TEXT NOT NULL,
  reward_coupon_id TEXT NOT NULL UNIQUE,
  reward_coupon_code TEXT NOT NULL,
  reward_email_status TEXT NOT NULL DEFAULT 'pending' CHECK (reward_email_status IN ('pending', 'sent', 'failed', 'skipped')),
  rewarded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_lead_id) REFERENCES storefront_leads(id) ON DELETE RESTRICT,
  FOREIGN KEY (qualified_order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  FOREIGN KEY (reward_coupon_id) REFERENCES coupon_codes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_storefront_leads_created ON storefront_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_storefront_leads_visitor ON storefront_leads(visitor_hash);
CREATE INDEX IF NOT EXISTS idx_storefront_leads_referrer ON storefront_leads(referred_by_code);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON storefront_referral_rewards(referrer_lead_id, rewarded_at);

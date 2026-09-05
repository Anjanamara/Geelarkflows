-- Server-authoritative checkout coupons and immutable order discount snapshots.
-- Apply with: npx wrangler d1 migrations apply geelarkflows_payment --remote

ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN coupon_discount_usd REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN coupon_discount_cents INTEGER NOT NULL DEFAULT 0;

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

CREATE INDEX IF NOT EXISTS idx_coupon_codes_active ON coupon_codes(active);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_expires_at ON coupon_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_created_at ON coupon_redemptions(created_at);

-- Close the concurrent-checkout race at the database boundary. A coupon that
-- is inactive, outside its schedule, or at its usage limit cannot be redeemed
-- even if its availability changed after the checkout preview.
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

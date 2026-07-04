-- ============================================================
-- unclaimed_businesses_v1.sql
-- Adds support for pre-seeded unclaimed business listings.
-- SAFE TO RUN MULTIPLE TIMES (all idempotent).
-- ============================================================

-- 1. Add is_claimed flag to shops
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS is_claimed      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS claimed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_phone   TEXT;
-- Note: is_claimed defaults to TRUE for all existing shops
-- (they were registered properly). Imported unclaimed shops
-- will have is_claimed=false explicitly.

-- 2. Relax owner_phone UNIQUE + NOT NULL so unclaimed shops
--    can use a generated placeholder instead of a real number.
--    We keep UNIQUE so real phones can't collide.
--    The NOT NULL constraint must stay — use a generated UUID-based
--    placeholder for unclaimed shops instead of NULL.
--    No schema change needed here — handled at import time.

-- 3. Add claim_requests table
CREATE TABLE IF NOT EXISTS claim_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  phone        TEXT NOT NULL,
  pin_hash     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected')),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_claim_requests_shop   ON claim_requests(shop_id);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);

-- 4. Index for fast unclaimed listing queries
CREATE INDEX IF NOT EXISTS idx_shops_is_claimed ON shops(is_claimed);

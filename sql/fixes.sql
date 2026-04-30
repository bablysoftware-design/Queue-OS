-- ============================================================
-- SAF QUEUE — Bug Fixes SQL
-- Run this in Supabase SQL Editor AFTER schema.sql + migrations.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX 1 & 26: Atomic token increment (eliminates race condition)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_token(p_shop_id UUID)
RETURNS INT AS $$
DECLARE
  v_next INT;
BEGIN
  UPDATE shops
  SET current_token = current_token + 1
  WHERE id = p_shop_id
  RETURNING current_token INTO v_next;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- FIX 5: Fix token reset midnight bug
-- Replace UNIQUE constraint with partial index
-- (allows same token_number across days once old ones are expired)
-- ─────────────────────────────────────────────────────────────
-- Drop old unique constraint (safe if it doesn't exist)
ALTER TABLE tokens DROP CONSTRAINT IF EXISTS unique_token_per_shop;

-- Partial unique index: only enforce uniqueness for ACTIVE tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_active_unique
  ON tokens(shop_id, token_number)
  WHERE status IN ('waiting', 'called');

-- ─────────────────────────────────────────────────────────────
-- FIX 8: Add customer_name to tokens table
-- ─────────────────────────────────────────────────────────────
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- ─────────────────────────────────────────────────────────────
-- FIX 2: Shopkeeper session tokens (auth for dashboard routes)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopkeeper_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_sessions_token   ON shopkeeper_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_shop_id ON shopkeeper_sessions(shop_id);

-- ─────────────────────────────────────────────────────────────
-- FIX 10: PIN change — add pin_changed_at for audit trail
-- ─────────────────────────────────────────────────────────────
ALTER TABLE shopkeepers ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE shopkeepers ADD COLUMN IF NOT EXISTS pin_changed_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- FIX 11 & 18: Business hours already in migrations.sql
-- Ensure columns exist
-- ─────────────────────────────────────────────────────────────
ALTER TABLE shops ADD COLUMN IF NOT EXISTS opening_time TEXT DEFAULT '09:00';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS closing_time TEXT DEFAULT '21:00';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS address      TEXT;

-- ─────────────────────────────────────────────────────────────
-- FIX 14: Customer cancel token — add 'cancelled' status
-- ─────────────────────────────────────────────────────────────
-- tokens.status already supports free text, just add to docs.
-- Add cancelled_at column for tracking
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- FIX 22: Shop close notification tracking
-- ─────────────────────────────────────────────────────────────
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS shop_closed_notified BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────
-- FIX 27: Index on customer_phone for fast duplicate checks
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tokens_customer_phone
  ON tokens(shop_id, customer_phone)
  WHERE status IN ('waiting', 'called');

-- ─────────────────────────────────────────────────────────────
-- FIX 3: N+1 fix — single RPC for shops + live queue counts
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_public_shops(
  p_area     TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit    INT  DEFAULT 50,
  p_offset   INT  DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'shops', COALESCE(json_agg(shop_data ORDER BY is_open DESC, queue_length ASC), '[]'::json),
    'total', COUNT(*) OVER(),
    'areas', (SELECT json_agg(DISTINCT area ORDER BY area) FROM shops WHERE is_active = TRUE AND area IS NOT NULL)
  )
  INTO v_result
  FROM (
    SELECT
      s.id,
      s.name,
      s.category,
      s.area,
      s.address,
      s.description,
      s.opening_time,
      s.closing_time,
      s.is_open,
      s.is_active,
      s.current_token,
      s.avg_service_time_mins,
      COUNT(t.id) FILTER (WHERE t.status = 'waiting') AS queue_length,
      MAX(t.token_number) FILTER (WHERE t.status = 'called') AS current_serving,
      COUNT(t.id) FILTER (WHERE t.status = 'waiting') * s.avg_service_time_mins AS estimated_wait,
      (COUNT(t.id) FILTER (WHERE t.status = 'waiting')) >= 15 AS is_busy
    FROM shops s
    LEFT JOIN tokens t ON t.shop_id = s.id AND t.created_at::DATE = CURRENT_DATE
    WHERE s.is_active = TRUE
      AND (p_area IS NULL OR s.area ILIKE '%' || p_area || '%')
      AND (p_category IS NULL OR s.category = p_category)
    GROUP BY s.id
    LIMIT p_limit OFFSET p_offset
  ) shop_data;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- FIX 5 (cont): Fix reset_daily_tokens to not conflict
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_daily_tokens()
RETURNS void AS $$
BEGIN
  -- Expire all waiting tokens from previous day
  UPDATE tokens
  SET status = 'expired'
  WHERE status = 'waiting'
    AND created_at < CURRENT_DATE::TIMESTAMPTZ;

  -- Complete any still-called tokens from previous day
  UPDATE tokens
  SET status = 'completed', completed_at = NOW()
  WHERE status = 'called'
    AND created_at < CURRENT_DATE::TIMESTAMPTZ;

  -- Reset token counter ONLY for active shops
  -- Safe now because partial index only enforces uniqueness
  -- for waiting/called tokens — old expired ones don't conflict
  UPDATE shops
  SET current_token = 0
  WHERE is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- FIX 6: Rate limiting helper — count tokens by fingerprint today
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION count_customer_tokens_today(
  p_shop_id         UUID,
  p_customer_phone  TEXT
)
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM tokens
  WHERE shop_id = p_shop_id
    AND customer_phone = p_customer_phone
    AND created_at::DATE = CURRENT_DATE
    AND status NOT IN ('cancelled', 'expired');
$$ LANGUAGE sql;

-- ─────────────────────────────────────────────────────────────
-- CLEANUP: expire old sessions
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM shopkeeper_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- END OF FIXES
-- ============================================================
